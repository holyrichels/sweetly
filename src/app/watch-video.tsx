import { useEffect, useState } from "react";

import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View, Image } from "react-native";
import Svg, { Path } from "react-native-svg";

import { C, FONTS, liveStyles } from "@/constants/sweetly-theme";
import { useAppData } from "@/lib/app-data";
import { supabase } from "@/lib/supabase";

const PATHS: Record<string, string> = {
  heart: "M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z",
  funny: "M12 3a9 9 0 100 18 9 9 0 000-18zM8 14s1.5 2.5 4 2.5S16 14 16 14M9 9.5h.01M15 9.5h.01",
  star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2-4.5-4.4 6.2-.9z",
  like: "M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5.5c1 0 1.8.9 1.6 2l-1.3 7c-.2 1-1 1.8-2 1.8H7",
};

type Reaction = { id: string; user_id: string; kind: string; at_seconds: number; note: string | null };

function mmss(total: number) {
  const value = Math.floor(total);
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = String(value % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// Страница сохранённого видео: метки двух людей, сводка и список реакций по времени
export default function WatchVideoScreen() {
  const router = useRouter();

  const { id } = useLocalSearchParams<{ id: string }>();

  const app = useAppData();

  const [video, setVideo] = useState<any>(null);

  const [items, setItems] = useState<Reaction[]>([]);

  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;

    (async () => {
      const { data: row } = await supabase
        .from("watch_videos")
        .select("id, youtube_id, title, watched_at, duration_seconds")
        .eq("id", id)
        .maybeSingle();

      setVideo(row);

      const { data: list } = await supabase
        .from("watch_reactions")
        .select("id, user_id, kind, at_seconds, note")
        .eq("video_id", id)
        .order("at_seconds", { ascending: true });

      const reactions = (list as Reaction[]) ?? [];

      setItems(reactions);

      const userIds = [...new Set(reactions.map((item) => item.user_id))];

      if (userIds.length) {
        const { data: people } = await supabase.from("profiles").select("id, name").in("id", userIds);

        const map: Record<string, string> = {};

        (people ?? []).forEach((person: any) => (map[person.id] = person.name));

        setNames(map);
      }
    })();
  }, [id]);

  const duration = video?.duration_seconds || Math.max(1, ...items.map((item) => item.at_seconds));

  const me = app.userId;

  const name = (userId: string) => (userId === me ? app.me?.name || "Вы" : names[userId] || "Партнёр");

  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.kind] = (acc[item.kind] ?? 0) + 1;
    return acc;
  }, {});

  if (!video) {
    return <View style={styles.screen} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path d="M15 6l-6 6 6 6" fill="none" stroke={C.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>

      <Text style={styles.title}>{video.title || "Видео"}</Text>

      <Text style={styles.sub}>
        {new Date(video.watched_at).toLocaleDateString("ru-RU")} · {mmss(duration)} · смотрели вдвоём
      </Text>

      <View style={styles.thumbWrap}>
        <Image source={{ uri: `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg` }} style={styles.thumb} />
        <Pressable
          style={styles.again}
          onPress={() => router.push(`/watch?youtube=${video.youtube_id}` as any)}
        >
          <Text style={styles.againText}>Смотреть снова</Text>
        </Pressable>
      </View>

      <View style={styles.trackWrap}>
        <View style={styles.track} />
        {items.map((item) => (
          <Pressable
            key={item.id}
            style={[
              styles.mark,
              {
                left: `${(item.at_seconds / duration) * 100}%`,
                backgroundColor: item.user_id === me ? C.accent : C.text,
              },
            ]}
            onPress={() => router.push(`/watch?youtube=${video.youtube_id}&t=${item.at_seconds}` as any)}
          />
        ))}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: C.accent }]} />
          <Text style={styles.legendText}>{name(me ?? "")}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: C.text }]} />
          <Text style={styles.legendText}>Партнёр</Text>
        </View>
      </View>

      <View style={styles.summary}>
        {Object.entries(counts).map(([kind, count]) => (
          <View key={kind} style={styles.pill}>
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path d={PATHS[kind] ?? PATHS.heart} fill="none" stroke={C.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.pillText}>{count}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.label}>РЕАКЦИИ ПО ХОДУ ВИДЕО</Text>

      <View style={styles.list}>
        {items.length === 0 ? (
          <Text style={styles.empty}>Реакций пока нет</Text>
        ) : (
          items.map((item, index) => (
            <Pressable
              key={item.id}
              style={[styles.row, index < items.length - 1 && styles.border]}
              onPress={() => router.push(`/watch?youtube=${video.youtube_id}&t=${item.at_seconds}` as any)}
            >
              <View style={styles.time}>
                <Text style={styles.timeText}>{mmss(item.at_seconds)}</Text>
              </View>

              <View style={styles.rowIcon}>
                <Svg width={18} height={18} viewBox="0 0 24 24">
                  <Path d={PATHS[item.kind] ?? PATHS.heart} fill="none" stroke={C.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>

              <View style={styles.flex}>
                <Text style={styles.who}>{name(item.user_id)}</Text>
                {item.note ? <Text style={styles.note}>«{item.note}»</Text> : null}
              </View>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = liveStyles(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.background },

    content: {
      paddingHorizontal: 22,
      paddingTop: 55,
      paddingBottom: 70,
      width: "100%",
      maxWidth: 520,
      alignSelf: "center",
      gap: 12,
    },

    flex: { flex: 1 },

    back: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: C.card,
      alignItems: "center",
      justifyContent: "center",
    },

    title: {
      color: C.text,
      fontFamily: FONTS.display,
      fontSize: 30,
    },

    sub: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 13,
    },

    thumbWrap: {
      borderRadius: 22,
      overflow: "hidden",
      height: 200,
      backgroundColor: C.videoBg,
      justifyContent: "flex-end",
    },

    thumb: {
      position: "absolute",
      width: "100%",
      height: "100%",
    },

    again: {
      alignSelf: "center",
      marginBottom: 16,
      height: 48,
      paddingHorizontal: 26,
      borderRadius: 24,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
    },

    againText: {
      color: C.accentOn,
      fontFamily: FONTS.textBold,
      fontSize: 15,
    },

    trackWrap: {
      height: 16,
      justifyContent: "center",
    },

    track: {
      height: 5,
      borderRadius: 3,
      backgroundColor: C.divider,
    },

    mark: {
      position: "absolute",
      top: 4,
      width: 8,
      height: 8,
      borderRadius: 4,
      marginLeft: -4,
      borderWidth: 1.5,
      borderColor: C.background,
    },

    legend: {
      flexDirection: "row",
      gap: 14,
    },

    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },

    legendText: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 13,
    },

    summary: {
      flexDirection: "row",
      gap: 8,
    },

    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: C.card,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },

    pillText: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 13,
    },

    label: {
      color: C.muted,
      fontFamily: FONTS.textBold,
      fontSize: 13,
      letterSpacing: 0.4,
      marginTop: 6,
    },

    list: {
      backgroundColor: C.card,
      borderRadius: 22,
      overflow: "hidden",
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },

    border: {
      borderBottomWidth: 1,
      borderBottomColor: C.divider,
    },

    time: {
      backgroundColor: C.background,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },

    timeText: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 13,
    },

    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.peach,
      alignItems: "center",
      justifyContent: "center",
    },

    who: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 15,
    },

    note: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 12,
      marginTop: 2,
    },

    empty: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 14,
      textAlign: "center",
      padding: 18,
    },
  })
);
