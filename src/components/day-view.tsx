import { useEffect, useState } from "react";

import { Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/sweetly-ui";
import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { supabase } from "@/lib/supabase";

type MoodRow = { user_id: string; mood: string; note: string | null };

type MemoryRow = { id: string; caption: string; media_type: string };

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Карточка выбранного дня: настроение, «Скучаю» и воспоминания за этот день
export default function DayView({
  dateISO,
  coupleId,
  userId,
  partnerName,
  myName,
  startDate,
  onToday,
}: {
  dateISO: string;
  coupleId: string;
  userId: string;
  partnerName: string;
  myName: string;
  startDate: string | null;
  onToday: () => void;
}) {
  const [moods, setMoods] = useState<MoodRow[]>([]);

  const [myMisses, setMyMisses] = useState(0);

  const [partnerMisses, setPartnerMisses] = useState(0);

  const [memories, setMemories] = useState<MemoryRow[]>([]);

  useEffect(() => {
    let active = true;

    (async () => {
      const [moodRes, missRes, memRes] = await Promise.all([
        supabase.from("couple_mood_days").select("user_id, mood, note").eq("couple_id", coupleId).eq("day", dateISO),
        supabase.from("couple_miss_log").select("user_id").eq("couple_id", coupleId).eq("day", dateISO),
        supabase
          .from("couple_memories")
          .select("id, caption, media_type")
          .eq("couple_id", coupleId)
          .eq("memory_date", dateISO),
      ]);

      if (!active) return;

      setMoods((moodRes.data as MoodRow[]) ?? []);

      const misses = (missRes.data as { user_id: string }[]) ?? [];

      setMyMisses(misses.filter((item) => item.user_id === userId).length);

      setPartnerMisses(misses.filter((item) => item.user_id !== userId).length);

      setMemories((memRes.data as MemoryRow[]) ?? []);
    })();

    return () => {
      active = false;
    };
  }, [dateISO, coupleId, userId]);

  const date = new Date(`${dateISO}T00:00:00`);

  const title = capitalize(
    date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) +
      " · " +
      date.toLocaleDateString("ru-RU", { weekday: "long" }),
  );

  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;

  const days = start ? Math.max(0, Math.floor((date.getTime() - start.getTime()) / 86400000)) : 0;

  const moodName = (userIdValue: string) => (userIdValue === userId ? myName : partnerName);

  return (
    <View style={styles.wrap}>
      <View style={styles.summary}>
        <Text style={styles.summaryText} numberOfLines={1}>
          Влюблённые с {partnerName}
        </Text>

        <Text style={styles.summaryDays}>
          {days} <Text style={styles.summaryUnit}>дн</Text>
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Настроение</Text>

          {moods.length === 0 ? (
            <Text style={styles.empty}>Никто не отмечал настроение</Text>
          ) : (
            moods.map((row) => (
              <Text key={row.user_id} style={styles.line}>
                {moodName(row.user_id)} — {row.mood}
                {row.note ? `\n«${row.note}»` : ""}
              </Text>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Скучаю</Text>

          {myMisses + partnerMisses === 0 ? (
            <Text style={styles.empty}>В этот день не нажимали</Text>
          ) : (
            <Text style={styles.line}>
              {myName} — {myMisses} раз · {partnerName} — {partnerMisses} раз
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Воспоминания</Text>

          {memories.length === 0 ? (
            <Text style={styles.empty}>В этот день ничего не добавляли</Text>
          ) : (
            memories.map((memory) => (
              <Text key={memory.id} style={styles.line}>
                {memory.caption || (memory.media_type === "video" ? "Видео" : "Фото")}
              </Text>
            ))
          )}
        </View>
      </View>

      <PrimaryButton title="Вернуться к сегодняшнему дню" onPress={onToday} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },

  summary: {
    backgroundColor: SWEETLY.card,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  summaryText: {
    flex: 1,
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 16,
    marginRight: 10,
  },

  summaryDays: {
    color: SWEETLY.accent,
    fontFamily: FONTS.display,
    fontSize: 24,
  },

  summaryUnit: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 14,
  },

  card: {
    backgroundColor: SWEETLY.card,
    borderRadius: 28,
    padding: 20,
    gap: 16,
  },

  cardTitle: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 24,
  },

  section: { gap: 6 },

  sectionTitle: {
    color: SWEETLY.muted,
    fontFamily: FONTS.textBold,
    fontSize: 13,
    letterSpacing: 0.4,
  },

  line: {
    color: SWEETLY.text,
    fontFamily: FONTS.text,
    fontSize: 15,
    lineHeight: 21,
  },

  empty: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 14,
  },
});
