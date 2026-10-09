import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { supabase } from "@/lib/supabase";

const MOOD_OPTIONS = [
  { emoji: "🥰", label: "Люблю" },
  { emoji: "😊", label: "Хорошо" },
  { emoji: "😌", label: "Спокойно" },
  { emoji: "😐", label: "Нейтрально" },
  { emoji: "😔", label: "Грустно" },
  { emoji: "😠", label: "Злюсь" },
  { emoji: "😴", label: "Устал(а)" },
  { emoji: "🤒", label: "Болею" },
];

export default function MoodScreen() {
  const [loading, setLoading] = useState(true);

  const [session, setSession] = useState<any>(null);

  const [coupleId, setCoupleId] = useState<string | null>(null);

  const [partnerName, setPartnerName] = useState("Партнёр");

  const [myMood, setMyMood] = useState<string | null>(null);

  const [partnerMood, setPartnerMood] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  // =========================================================
  // AUTH + LOAD
  // =========================================================

  useEffect(() => {
    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);

      if (newSession) {
        loadCoupleAndMoods(newSession.user.id);
      } else {
        setCoupleId(null);
        setMyMood(null);
        setPartnerMood(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function load() {
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      setSession(currentSession);

      if (currentSession) {
        await loadCoupleAndMoods(currentSession.user.id);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadCoupleAndMoods(userId: string) {
    try {
      const { data: member } = await supabase
        .from("couple_members")
        .select("couple_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!member) {
        setCoupleId(null);

        return;
      }

      setCoupleId(member.couple_id);

      const { data: members } = await supabase
        .from("couple_members")
        .select("user_id")
        .eq("couple_id", member.couple_id);

      const userIds = members?.map((item) => item.user_id) ?? [];

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", userIds);

        const partner = profiles?.find((profile) => profile.id !== userId);

        if (partner?.name) {
          setPartnerName(partner.name);
        }
      }

      await loadMoods(member.couple_id, userId);
    } catch (error) {
      console.log("Load mood error:", error);
    }
  }

  async function loadMoods(coupleIdValue: string, userId: string) {
    const { data: moods, error } = await supabase
      .from("couple_moods")
      .select("user_id, mood")
      .eq("couple_id", coupleIdValue);

    if (error) {
      console.log("Ошибка загрузки настроения:", error.message);

      return;
    }

    const mine = moods?.find((item) => item.user_id === userId)?.mood ?? null;

    const partner =
      moods?.find((item) => item.user_id !== userId)?.mood ?? null;

    setMyMood(mine);
    setPartnerMood(partner);
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
        <ActivityIndicator size="large" color="#e98ca8" />
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
      <Text style={styles.pageTitle}>Настроение</Text>

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
                style={[styles.moodLabel, selected && styles.moodLabelSelected]}
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
    backgroundColor: "#fff5f8",
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 65,
    paddingBottom: 70,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#fff5f8",
    alignItems: "center",
    justifyContent: "center",
  },

  messageScreen: {
    flex: 1,
    backgroundColor: "#fff5f8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },

  messageEmoji: {
    fontSize: 40,
    marginBottom: 14,
  },

  messageTitle: {
    color: "#35242a",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },

  messageText: {
    color: "#92767f",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  pageTitle: {
    color: "#35242a",
    fontSize: 28,
    fontWeight: "800",
  },

  pageSubtitle: {
    color: "#92767f",
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
    color: "#a0838c",
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
    color: "#624850",
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
    backgroundColor: "#e98ca8",
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
