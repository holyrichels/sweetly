import { useEffect, useState } from "react";

import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { supabase } from "@/lib/supabase";

type MoodRow = { user_id: string; mood: string; note: string | null };

type MemoryRow = { id: string; caption: string; media_type: string };

type EventKey = "mood" | "miss" | "memory";

const EVENTS: { key: EventKey; label: string }[] = [
  { key: "mood", label: "Настроение" },
  { key: "miss", label: "Скучаю" },
  { key: "memory", label: "Воспоминание" },
];

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Иконка события в круглой кнопке (контурная, 24 px)
function EventIcon({ kind, color }: { kind: EventKey; color: string }) {
  if (kind === "mood") {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={9} fill="none" stroke={color} strokeWidth={1.8} />
        <Path d="M8.5 14s1.5 2 3.5 2 3.5-2 3.5-2" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M9 9.5h.01M15 9.5h.01" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      </Svg>
    );
  }

  if (kind === "miss") {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path
          d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Rect x={3} y={5} width={18} height={14} rx={3} fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M3 16l5-5 4 4 3-3 6 6" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={8.5} cy={9.5} r={1.5} fill={color} />
    </Svg>
  );
}

// Карточка выбранного дня: круглые кнопки событий и подробности
export default function DayView({
  dateISO,
  coupleId,
  userId,
  partnerName,
  myName,
  startDate,
}: {
  dateISO: string;
  coupleId: string;
  userId: string;
  partnerName: string;
  myName: string;
  startDate: string | null;
}) {
  const [moods, setMoods] = useState<MoodRow[]>([]);

  const [myMisses, setMyMisses] = useState(0);

  const [partnerMisses, setPartnerMisses] = useState(0);

  const [memories, setMemories] = useState<MemoryRow[]>([]);

  const [active, setActive] = useState<EventKey>("mood");

  useEffect(() => {
    let alive = true;

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

      if (!alive) return;

      setMoods((moodRes.data as MoodRow[]) ?? []);

      const misses = (missRes.data as { user_id: string }[]) ?? [];

      setMyMisses(misses.filter((item) => item.user_id === userId).length);

      setPartnerMisses(misses.filter((item) => item.user_id !== userId).length);

      setMemories((memRes.data as MemoryRow[]) ?? []);
    })();

    return () => {
      alive = false;
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

  const moodName = (value: string) => (value === userId ? myName : partnerName);

  const counts: Record<EventKey, number> = {
    mood: moods.length,
    miss: myMisses + partnerMisses,
    memory: memories.length,
  };

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

      <Text style={styles.title}>{title}</Text>

      <View style={styles.eventsRow}>
        {EVENTS.map((event) => {
          const selected = active === event.key;

          return (
            <Pressable key={event.key} style={styles.eventItem} onPress={() => setActive(event.key)}>
              <View style={[styles.eventCircle, selected && styles.eventCircleActive]}>
                <EventIcon kind={event.key} color={selected ? "#FFFFFF" : SWEETLY.accent} />
              </View>

              <Text style={styles.eventLabel}>
                {event.label}
                {counts[event.key] > 0 ? ` · ${counts[event.key]}` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        {active === "mood" &&
          (moods.length === 0 ? (
            <Text style={styles.empty}>Никто не отмечал настроение</Text>
          ) : (
            moods.map((row) => (
              <Text key={row.user_id} style={styles.line}>
                {moodName(row.user_id)} — {row.mood}
                {row.note ? `\n«${row.note}»` : ""}
              </Text>
            ))
          ))}

        {active === "miss" &&
          (myMisses + partnerMisses === 0 ? (
            <Text style={styles.empty}>В этот день не нажимали «Скучаю»</Text>
          ) : (
            <Text style={styles.line}>
              {myName} — {myMisses} раз · {partnerName} — {partnerMisses} раз
            </Text>
          ))}

        {active === "memory" &&
          (memories.length === 0 ? (
            <Text style={styles.empty}>В этот день ничего не добавляли</Text>
          ) : (
            memories.map((memory) => (
              <Text key={memory.id} style={styles.line}>
                {memory.caption || (memory.media_type === "video" ? "Видео" : "Фото")}
              </Text>
            ))
          ))}
      </View>
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

  title: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 22,
  },

  eventsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },

  eventItem: {
    alignItems: "center",
    gap: 6,
    minWidth: 44,
  },

  eventCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SWEETLY.card,
    alignItems: "center",
    justifyContent: "center",
  },

  eventCircleActive: {
    backgroundColor: SWEETLY.accent,
  },

  eventLabel: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 12,
    textAlign: "center",
  },

  card: {
    backgroundColor: SWEETLY.card,
    borderRadius: 28,
    padding: 20,
    gap: 8,
    minHeight: 90,
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
