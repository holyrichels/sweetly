import { useEffect, useState } from "react";

import { StyleSheet, Text, View } from "react-native";

import { Toggle } from "@/components/sweetly-ui";
import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { useAppData } from "@/lib/app-data";
import { supabase } from "@/lib/supabase";

// Переключатели: о чём бот присылает сообщения. Настройки хранятся в профиле.
export default function NotifyToggles() {
  const app = useAppData();

  const [miss, setMiss] = useState(true);

  const [mood, setMood] = useState(true);

  useEffect(() => {
    if (!app.userId) return;

    supabase
      .from("profiles")
      .select("notify_miss, notify_mood")
      .eq("id", app.userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;

        setMiss(data.notify_miss !== false);
        setMood(data.notify_mood !== false);
      });
  }, [app.userId]);

  async function change(field: "notify_miss" | "notify_mood", value: boolean) {
    if (!app.userId) return;

    const setter = field === "notify_miss" ? setMiss : setMood;

    setter(value);

    const { error } = await supabase.from("profiles").update({ [field]: value }).eq("id", app.userId);

    // Не удалось сохранить: возвращаем прежнее положение
    if (error) setter(!value);
  }

  const rows = [
    { title: "Партнёр скучает", sub: "Когда он нажимает «Скучаю»", value: miss, field: "notify_miss" as const },
    { title: "Настроение партнёра", sub: "Когда он отмечает настроение", value: mood, field: "notify_mood" as const },
  ];

  return (
    <View style={styles.card}>
      {rows.map((row, index) => (
        <View key={row.field} style={[styles.row, index < rows.length - 1 && styles.border]}>
          <View style={styles.text}>
            <Text style={styles.title}>{row.title}</Text>
            <Text style={styles.sub}>{row.sub}</Text>
          </View>

          <Toggle value={row.value} onChange={(value) => change(row.field, value)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SWEETLY.card,
    borderRadius: 28,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 68,
    gap: 12,
  },

  border: {
    borderBottomWidth: 1,
    borderBottomColor: SWEETLY.divider,
  },

  text: { flex: 1 },

  title: {
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 16,
  },

  sub: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 13,
    marginTop: 2,
  },
});
