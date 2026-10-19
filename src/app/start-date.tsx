import { useState } from "react";

import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { CalendarGrid, formatDateISO, formatDateRu } from "@/components/date-field";
import { PrimaryButton, ScreenTitle } from "@/components/sweetly-ui";
import { FONTS, C, liveStyles } from "@/constants/sweetly-theme";
import { refreshAppData } from "@/lib/app-data";
import { supabase } from "@/lib/supabase";

export default function StartDateScreen() {
  const router = useRouter();

  const [date, setDate] = useState(formatDateISO(new Date()));

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Создаём пару с выбранной датой начала, как и раньше
  async function createCouple() {
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      setError("Сессия не найдена, войдите заново");

      return;
    }

    setSaving(true);

    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Id задаём сами: строку пары не читаем обратно, пока пользователь не стал участником
      const coupleId = crypto.randomUUID();

      const { error: coupleError } = await supabase.from("couples").insert({
        id: coupleId,
        invite_code: code,
        relationship_status: "влюбленные",
        relationship_date: date,
      });

      if (coupleError) {
        setError(coupleError.message);

        return;
      }

      const { error: memberError } = await supabase
        .from("couple_members")
        .insert({ couple_id: coupleId, user_id: session.user.id });

      if (memberError) {
        setError(memberError.message);

        return;
      }

      await supabase.from("couple_miss_counts").insert({
        couple_id: coupleId,
        user_one_id: session.user.id,
        user_one_count: 0,
        user_two_count: 0,
      });

      await refreshAppData();

      router.replace("/connect" as any);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.titleBlock}>
        <ScreenTitle>Когда всё началось?</ScreenTitle>

        <Text style={styles.subtitle}>
          Выберите дату, с которой вы вместе. От неё мы считаем дни.
        </Text>
      </View>

      <View style={styles.card}>
        <CalendarGrid value={date} onChange={setDate} />
      </View>

      <Text style={styles.selected}>{formatDateRu(date)}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton title={saving ? "Создаём..." : "Далее"} onPress={createCouple} disabled={saving} />
    </ScrollView>
  );
}

const styles = liveStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },

  content: {
    paddingHorizontal: 22,
    paddingTop: 40,
    paddingBottom: 40,
    gap: 14,
  },

  titleBlock: { gap: 6 },

  subtitle: {
    color: C.muted,
    fontFamily: FONTS.text,
    fontSize: 15,
    lineHeight: 22,
  },

  card: {
    backgroundColor: C.card,
    borderRadius: 28,
    padding: 12,
  },

  selected: {
    color: C.text,
    fontFamily: FONTS.textBold,
    fontSize: 16,
    textAlign: "center",
  },

  error: {
    color: C.error,
    fontFamily: FONTS.textBold,
    fontSize: 14,
    textAlign: "center",
  },
}));
