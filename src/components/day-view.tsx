import { useEffect, useState } from "react";

import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { supabase } from "@/lib/supabase";

type MoodRow = { user_id: string; mood: string; note: string | null };

type MemoryRow = { id: string; caption: string; media_type: string };

type EventKey = "mood" | "miss" | "memory";

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Иконка события (контурная, 24 px) в круглом фоне
function EventIcon({ kind }: { kind: EventKey }) {
  const color = SWEETLY.accent;

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

// Одна строка события: круглая иконка, название и описание
function EventRow({
  kind,
  title,
  lines,
  last,
}: {
  kind: EventKey;
  title: string;
  lines: string[];
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.iconCircle}>
        <EventIcon kind={kind} />
      </View>

      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>

        {lines.map((line, index) => (
          <Text key={index} style={styles.rowSub}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Карточка выбранного дня: заголовок с датой и три события списком
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

  const moodLines =
    moods.length === 0
      ? ["Никто не отмечал настроение"]
      : moods.map((row) => `${moodName(row.user_id)} — ${row.mood}${row.note ? ` · «${row.note}»` : ""}`);

  const missLines =
    myMisses + partnerMisses === 0
      ? ["В этот день не нажимали"]
      : [`${myName} — ${myMisses} раз · ${partnerName} — ${partnerMisses} раз`];

  const memoryLines =
    memories.length === 0
      ? ["В этот день ничего не добавляли"]
      : [memories.map((memory) => memory.caption || (memory.media_type === "video" ? "Видео" : "Фото")).join(" · ")];

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
        <Text style={styles.title}>{title}</Text>

        <EventRow kind="mood" title="Настроение" lines={moodLines} />
        <EventRow kind="miss" title="Скучаю" lines={missLines} />
        <EventRow kind="memory" title="Воспоминание" lines={memoryLines} last />
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

  card: {
    backgroundColor: SWEETLY.card,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },

  title: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 26,
    marginBottom: 14,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },

  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: SWEETLY.divider,
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SWEETLY.peach,
    alignItems: "center",
    justifyContent: "center",
  },

  rowText: {
    flex: 1,
    gap: 2,
  },

  rowTitle: {
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 17,
  },

  rowSub: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 13,
    lineHeight: 18,
  },
});
