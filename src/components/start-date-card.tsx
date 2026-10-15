import { useState } from "react";

import { StyleSheet, Text, View } from "react-native";

import { CalendarGrid, formatDateISO, formatDateRu } from "@/components/date-field";
import { PrimaryButton, SectionLabel } from "@/components/sweetly-ui";
import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { createCoupleWithDate } from "@/lib/couple";

// Выбор даты начала и создание пары прямо на главной, если пары ещё нет
export default function StartDateCard() {
  const [date, setDate] = useState(formatDateISO(new Date()));

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);

    setSaving(true);

    const message = await createCoupleWithDate(date);

    setSaving(false);

    if (message) setError(message);
  }

  return (
    <View style={styles.wrap}>
      <SectionLabel>КОГДА ВСЁ НАЧАЛОСЬ?</SectionLabel>

      <View style={styles.card}>
        <CalendarGrid value={date} onChange={setDate} />
      </View>

      <Text style={styles.selected}>{formatDateRu(date)}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton title={saving ? "Создаём..." : "Создать пару"} onPress={create} disabled={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },

  card: {
    backgroundColor: SWEETLY.card,
    borderRadius: 28,
    padding: 12,
  },

  selected: {
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 16,
    textAlign: "center",
  },

  error: {
    color: SWEETLY.error,
    fontFamily: FONTS.textBold,
    fontSize: 14,
    textAlign: "center",
  },
});
