import SkeletonScreen from "@/components/skeleton-screen";
import Svg, { Path } from "react-native-svg";
import { useEffect, useLayoutEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import PageHeader from "@/components/page-header";
import { getAppData, refreshAppData, useAppData } from "@/lib/app-data";
import { formatDateISO } from "@/components/date-field";
import SoloScreen from "@/components/solo-screen";
import { supabase } from "@/lib/supabase";

// На вебе многокнопочный Alert не показывается, поэтому там используем окна браузера
function notify(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// Цвет дня недели по настроению
const MOOD_COLORS: Record<string, string> = {
  "Супер": "#C23A62",
  "Хорошо": "#E87A94",
  "Так себе": "#F4B1C0",
  "Грустно": "#8E4585",
  "Злюсь": "#3B1F2B",
};

// Даты текущей недели (понедельник — воскресенье) в формате ГГГГ-ММ-ДД
function currentWeekIso(): string[] {
  const now = new Date();

  const offset = (now.getDay() + 6) % 7;

  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);

    date.setDate(monday.getDate() + index);

    return formatDateISO(date);
  });
}

const MOOD_OPTIONS = [
  { value: "Супер", d: "M7.5 13.5c1 3.5 8 3.5 9 0z" },
  { value: "Хорошо", d: "M8.5 13.5s1.5 2 3.5 2 3.5-2 3.5-2" },
  { value: "Так себе", d: "M8.5 15h7" },
  { value: "Грустно", d: "M8.5 16.5s1.5-2 3.5-2 3.5 2 3.5 2" },
  { value: "Злюсь", d: "M8.5 16.5c1-1.8 5-1.8 7 0M8 8.5l3 1M16 8.5l-3 1" },
];
export default function MoodScreen() {
  const [loading, setLoading] = useState(!getAppData().ready);

  const [session, setSession] = useState<any>(null);

  const [coupleId, setCoupleId] = useState<string | null>(null);

  const [partnerName, setPartnerName] = useState("Партнёр");

  const [myMood, setMyMood] = useState<string | null>(null);

  const [partnerMood, setPartnerMood] = useState<string | null>(null);

  const [weekMoods, setWeekMoods] = useState<Record<string, string>>({});

  const [noteDraft, setNoteDraft] = useState("");

  const [sharing, setSharing] = useState(false);

  const [saving, setSaving] = useState(false);

  // =========================================================
  // ДАННЫЕ: берём из общего хранилища, без отдельных запросов
  // =========================================================

  const appData = useAppData();

  useLayoutEffect(() => {
    setLoading(!appData.ready);

    setSession(appData.userId ? { user: { id: appData.userId } } : null);

    setCoupleId(appData.coupleId);

    setPartnerName(appData.partner?.name || "Партнёр");

    const mine = appData.moods.find((item) => item.user_id === appData.userId)?.mood ?? null;

    const partner = appData.moods.find((item) => item.user_id !== appData.userId)?.mood ?? null;

    setMyMood(mine);

    setPartnerMood(partner);
  }, [appData]);

  // Обновление после изменений: список настроений приходит из хранилища
  async function loadMoods(_coupleIdValue: string, _userId: string) {
    await refreshAppData();
  }

  // =========================================================
  // REALTIME
  // =========================================================

  useEffect(() => {
    if (!session?.user?.id || !coupleId) return;

    const channel = supabase
      .channel(`mood-updates-${coupleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_moods",
          filter: `couple_id=eq.${coupleId}`,
        },
        () => {
          loadMoods(coupleId, session.user.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, coupleId]);

  // =========================================================
  // SELECT MOOD
  // =========================================================

  async function selectMood(emoji: string) {
    if (!session?.user?.id || !coupleId || saving) {
      return;
    }

    const previousMood = myMood;

    setSaving(true);

    setMyMood(emoji);

    try {
      const { error } = await supabase.from("couple_moods").upsert(
        {
          couple_id: coupleId,
          user_id: session.user.id,
          mood: emoji,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "couple_id,user_id" },
      );

      if (error) {
        setMyMood(previousMood);

        Alert.alert("Ошибка", error.message);
      } else {
        // Запоминаем настроение за сегодня, чтобы неделя показывала историю
        const today = formatDateISO(new Date());

        supabase
          .from("couple_mood_days")
          .upsert(
            { couple_id: coupleId, user_id: session.user.id, day: today, mood: emoji },
            { onConflict: "couple_id,user_id,day" },
          )
          .then(() => {});

        setWeekMoods((previous) => ({ ...previous, [today]: emoji }));

        // Уведомляем партнёра в Telegram, ошибка уведомления не мешает приложению
        supabase.functions
          .invoke("notify-partner", { body: { kind: "mood", mood: emoji } })
          .catch(() => {});
      }
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // RENDER
  // =========================================================

  const weekdayIndex = (new Date().getDay() + 6) % 7;

  const weekDates = currentWeekIso();

  useEffect(() => {
    if (!coupleId || !session?.user?.id) return;

    supabase
      .from("couple_mood_days")
      .select("day, mood, note")
      .eq("user_id", session.user.id)
      .gte("day", weekDates[0])
      .lte("day", weekDates[6])
      .then(({ data }) => {
        const map: Record<string, string> = {};

        (data ?? []).forEach((row: { day: string; mood: string }) => {
          map[row.day] = row.mood;
        });

        setWeekMoods(map);

        const todayIso = formatDateISO(new Date());

        const todayRow = (data ?? []).find(
          (row: { day: string; note?: string | null }) => row.day === todayIso,
        ) as { note?: string | null } | undefined;

        if (todayRow?.note) setNoteDraft(todayRow.note);
      });
  }, [coupleId, session?.user?.id]);

  if (loading) return <SkeletonScreen />;

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Сначала войдите в аккаунт</Text>
        <Text style={styles.emptyText}>Перейдите на главную, чтобы войти.</Text>
      </View>
    );
  }

  if (!coupleId) return <SoloScreen kind="mood" />;

  const partnerOption = MOOD_OPTIONS.find((item) => item.value === partnerMood);

  // Отправляем партнёру настроение вместе с заметкой и сохраняем заметку за день
  async function shareMood() {
    if (!myMood || !coupleId || !session?.user?.id || sharing) {
      notify("Сначала выберите настроение", "Нажмите на одно из лиц выше");

      return;
    }

    setSharing(true);

    try {
      const note = noteDraft.trim();

      const today = formatDateISO(new Date());

      const { error } = await supabase.from("couple_mood_days").upsert(
        {
          couple_id: coupleId,
          user_id: session.user.id,
          day: today,
          mood: myMood,
          note,
        },
        { onConflict: "couple_id,user_id,day" },
      );

      if (error) {
        notify("Ошибка", error.message);

        return;
      }

      await supabase.functions.invoke("notify-partner", {
        body: { kind: "mood", mood: myMood, note },
      });

      notify("Готово", "Партнёр получил ваше настроение");
    } finally {
      setSharing(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Настроение</Text>
      <Text style={styles.subtitle}>Как ты сегодня?</Text>

      {/* ============ ВЫБОР НАСТРОЕНИЯ ============ */}

      <View style={styles.moodCard}>
        {MOOD_OPTIONS.map((option) => {
          const selected = myMood === option.value;

          return (
            <Pressable
              key={option.value}
              style={styles.moodItem}
              onPress={() => selectMood(option.value)}
            >
              <View style={[styles.moodCircle, selected && styles.moodCircleActive]}>
                <Svg width={36} height={36} viewBox="0 0 24 24">
                  <Path
                    d="M12 3a9 9 0 100 18 9 9 0 000-18z"
                    fill="none"
                    stroke={selected ? "#FFFFFF" : "#3B1F2B"}
                    strokeWidth={2.2}
                  />
                  <Path
                    d={option.d}
                    fill="none"
                    stroke={selected ? "#FFFFFF" : "#3B1F2B"}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                  />
                  <Path
                    d="M9 9.5h.01M15 9.5h.01"
                    fill="none"
                    stroke={selected ? "#FFFFFF" : "#3B1F2B"}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                </Svg>
              </View>

              <Text style={[styles.moodLabel, selected && styles.moodLabelActive]}>
                {option.value}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ============ ЗАМЕТКА И ОТПРАВКА ============ */}

      <Text style={styles.sectionLabel}>ЗАМЕТКА К НАСТРОЕНИЮ</Text>

      <TextInput
        style={styles.noteInput}
        placeholder="Что случилось сегодня?"
        placeholderTextColor="#B49BA3"
        value={noteDraft}
        onChangeText={setNoteDraft}
        maxLength={140}
      />

      <Pressable style={styles.shareButton} onPress={shareMood} disabled={sharing}>
        <Text style={styles.shareText}>
          {sharing ? "Отправляем..." : `Поделиться с ${partnerName}`}
        </Text>
      </Pressable>

      {/* ============ НАСТРОЕНИЕ ПАРТНЁРА ============ */}

      <View style={styles.partnerCard}>
        <View style={styles.partnerCircle}>
          <Svg width={32} height={32} viewBox="0 0 24 24">
            <Path d="M12 3a9 9 0 100 18 9 9 0 000-18z" fill="none" stroke="#C23A62" strokeWidth={2.2} />
            <Path d={partnerOption?.d ?? "M8.5 13.5s1.5 2 3.5 2 3.5-2 3.5-2"} fill="none" stroke="#C23A62" strokeWidth={2.2} strokeLinecap="round" />
            <Path d="M9 9.5h.01M15 9.5h.01" fill="none" stroke="#C23A62" strokeWidth={3} strokeLinecap="round" />
          </Svg>
        </View>

        <View style={styles.partnerText}>
          <Text style={styles.partnerName}>{partnerName} сегодня</Text>
          <Text style={styles.partnerMood}>{partnerMood ?? "ещё не отметил(а)"}</Text>
        </View>
      </View>

      {/* ============ ЭТА НЕДЕЛЯ ============ */}

      <Text style={styles.sectionLabel}>ЭТА НЕДЕЛЯ</Text>

      <View style={styles.weekRow}>
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, index) => {
          const date = weekDates[index];

          const mood = weekMoods[date];

          const color = mood ? MOOD_COLORS[mood] : undefined;

          const isToday = index === (new Date().getDay() + 6) % 7;

          return (
            <View key={day} style={styles.weekItem}>
              <View
                style={[
                  styles.weekCircle,
                  color ? { backgroundColor: color } : isToday ? styles.weekCircleToday : styles.weekCircleEmpty,
                ]}
              />

              <Text style={[styles.weekLabel, isToday && styles.weekLabelToday]}>{day}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF1F0" },

  content: {
    paddingHorizontal: 22,
    paddingTop: 55,
    paddingBottom: 70,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },

  center: {
    flex: 1,
    backgroundColor: "#FFF1F0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },

  emptyTitle: {
    color: "#3B1F2B",
    fontFamily: "Manrope_700Bold",
    fontSize: 20,
    marginBottom: 8,
    textAlign: "center",
  },

  emptyText: {
    color: "#7A5A66",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  title: {
    color: "#3B1F2B",
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 40,
  },

  subtitle: {
    color: "#7A5A66",
    fontSize: 16,
    marginTop: 4,
    marginBottom: 22,
  },

  moodCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  moodItem: {
    alignItems: "center",
    width: "18%",
  },

  moodCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#FFF1F0",
    alignItems: "center",
    justifyContent: "center",
  },

  moodCircleActive: {
    backgroundColor: "#C23A62",
  },

  moodLabel: {
    color: "#3B1F2B",
    fontSize: 12,
    marginTop: 6,
    fontFamily: "Manrope_500Medium",
  },

  moodLabelActive: {
    fontFamily: "Manrope_700Bold",
    color: "#C23A62",
  },

  noteInput: {
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    fontSize: 15,
    color: "#3B1F2B",
    marginTop: 8,
  },

  shareButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: "#C23A62",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },

  shareText: {
    color: "#FFFFFF",
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
  },

  partnerCard: {
    marginTop: 18,
    backgroundColor: "#FFE6DB",
    borderRadius: 28,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  partnerCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  partnerText: {
    flex: 1,
  },

  partnerName: {
    color: "#7A5A66",
    fontSize: 13,
  },

  partnerMood: {
    color: "#3B1F2B",
    fontFamily: "Manrope_700Bold",
    fontSize: 20,
    marginTop: 2,
  },

  sectionLabel: {
    color: "#7A5A66",
    fontSize: 14,
    fontFamily: "Manrope_700Bold",
    letterSpacing: 0.4,
    marginTop: 26,
    marginBottom: 12,
  },

  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  weekItem: {
    alignItems: "center",
    flex: 1,
  },

  weekCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  weekCircleFilled: {
    backgroundColor: "#C23A62",
  },

  weekCircleToday: {
    borderWidth: 2,
    borderColor: "#C23A62",
    backgroundColor: "#FFFFFF",
  },

  weekCircleEmpty: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#E3B7C2",
  },

  weekLabel: {
    color: "#7A5A66",
    fontSize: 13,
    marginTop: 6,
  },

  weekLabelToday: {
    color: "#C23A62",
    fontFamily: "Manrope_700Bold",
  },
});
