import { useEffect, useLayoutEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";

import PageHeader from "@/components/page-header";
import { getAppData, refreshAppData, useAppData } from "@/lib/app-data";
import { supabase } from "@/lib/supabase";

const MOOD_OPTIONS = [
  { emoji: "🥰", label: "Влюблён(а)" },
  { emoji: "😊", label: "Хорошо" },
  { emoji: "😌", label: "Спокойно" },
  { emoji: "😐", label: "Нейтрально" },
  { emoji: "😔", label: "Грустно" },
  { emoji: "😠", label: "Злюсь" },
  { emoji: "😴", label: "Устал(а)" },
  { emoji: "🤒", label: "Болею" },
];

export default function MoodScreen() {
  const [loading, setLoading] = useState(!getAppData().ready);

  const [session, setSession] = useState<any>(null);

  const [coupleId, setCoupleId] = useState<string | null>(null);

  const [partnerName, setPartnerName] = useState("Партнёр");

  const [myMood, setMyMood] = useState<string | null>(null);

  const [partnerMood, setPartnerMood] = useState<string | null>(null);

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

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#C23A62" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.messageScreen}>
        <Text style={styles.messageEmoji}>🔐</Text>

        <Text style={styles.messageTitle}>Сначала войдите в аккаунт</Text>

        <Text style={styles.messageText}>
          Перейдите на вкладку «Главная», чтобы войти или зарегистрироваться.
        </Text>
      </View>
    );
  }

  if (!coupleId) {
    return (
      <View style={styles.messageScreen}>
        <Text style={styles.messageEmoji}>💌</Text>

        <Text style={styles.messageTitle}>Пока нет пары</Text>

        <Text style={styles.messageText}>
          Создайте пару или присоединитесь по коду на вкладке «Главная».
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader title="Настроение" />

      <Text style={styles.pageSubtitle}>
        Поделись, как ты себя чувствуешь сегодня
      </Text>

      {/* ================================================= */}
      {/* PARTNER MOOD */}
      {/* ================================================= */}

      <View style={styles.partnerMoodCard}>
        <Text style={styles.partnerMoodEmoji}>{partnerMood || "❓"}</Text>

        <View style={styles.partnerMoodInfo}>
          <Text style={styles.partnerMoodLabel}>{partnerName}</Text>

          <Text style={styles.partnerMoodValue}>
            {partnerMood
              ? MOOD_OPTIONS.find((item) => item.emoji === partnerMood)
                  ?.label || "Настроение отмечено"
              : "Ещё не отметил(а) настроение"}
          </Text>
        </View>
      </View>

      {/* ================================================= */}
      {/* MY MOOD PICKER */}
      {/* ================================================= */}

      <Text style={styles.sectionLabel}>Как ты себя чувствуешь?</Text>

      <View style={styles.moodGrid}>
        {MOOD_OPTIONS.map((option) => {
          const selected = myMood === option.emoji;

          return (
            <Pressable
              key={option.emoji}
              style={[styles.moodItem, selected && styles.moodItemSelected]}
              onPress={() => selectMood(option.emoji)}
            >
              <Text style={styles.moodEmoji}>{option.emoji}</Text>

              <Text
                style={[
                  styles.moodLabel,
                  selected && styles.moodLabelSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFF1F0",
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 65,
    paddingBottom: 70,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#FFF1F0",
    alignItems: "center",
    justifyContent: "center",
  },

  messageScreen: {
    flex: 1,
    backgroundColor: "#FFF1F0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },

  messageEmoji: {
    fontSize: 40,
    marginBottom: 14,
  },

  messageTitle: {
    color: "#3B1F2B",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },

  messageText: {
    color: "#7A5A66",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  pageTitle: {
    color: "#3B1F2B",
    fontSize: 28,
    fontWeight: "800",
  },

  pageSubtitle: {
    color: "#7A5A66",
    fontSize: 14,
    marginTop: 6,
    marginBottom: 20,
  },

  partnerMoodCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#9b6676",
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 3,
    marginBottom: 26,
  },

  partnerMoodEmoji: {
    fontSize: 40,
    marginRight: 14,
  },

  partnerMoodInfo: {
    flex: 1,
  },

  partnerMoodLabel: {
    color: "#7A5A66",
    fontSize: 12,
    fontWeight: "700",
  },

  partnerMoodValue: {
    color: "#49333b",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 3,
  },

  sectionLabel: {
    color: "#7A5A66",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },

  moodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  moodItem: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#9b6676",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 2,
  },

  moodItemSelected: {
    backgroundColor: "#C23A62",
  },

  moodEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },

  moodLabel: {
    color: "#8a6b74",
    fontSize: 12,
    fontWeight: "700",
  },

  moodLabelSelected: {
    color: "#fff",
  },
});
