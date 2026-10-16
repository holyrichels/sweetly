import { useState } from "react";

import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { PrimaryButton, SectionLabel } from "@/components/sweetly-ui";
import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { notify } from "@/lib/dialogs";

import { SoloTitle } from "./solo-shell";

const MOODS = [
  { value: "Супер", d: "M7.5 13.5c1 3.5 8 3.5 9 0z" },
  { value: "Хорошо", d: "M8.5 13.5s1.5 2 3.5 2 3.5-2 3.5-2" },
  { value: "Так себе", d: "M8.5 15h7" },
  { value: "Грустно", d: "M8.5 16.5s1.5-2 3.5-2 3.5 2 3.5 2" },
  { value: "Злюсь", d: "M8.5 16.5c1-1.8 5-1.8 7 0M8 8.5l3 1M16 8.5l-3 1" },
];

const WEEK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// Настроение без пары: выбрать можно, сохранится после подключения партнёра
export default function SoloMood() {
  const [mood, setMood] = useState<string | null>(null);

  const [note, setNote] = useState("");

  const todayIndex = (new Date().getDay() + 6) % 7;

  function save() {
    notify("Почти готово", "Настроение сохранится, когда подключится партнёр");
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SoloTitle title="Настроение" subtitle="Как ты сегодня?" />

      <View style={styles.moodCard}>
        {MOODS.map((item) => {
          const selected = mood === item.value;

          return (
            <Pressable key={item.value} style={styles.moodItem} onPress={() => setMood(item.value)}>
              <View style={[styles.moodCircle, selected && styles.moodCircleOn]}>
                <Svg width={34} height={34} viewBox="0 0 24 24">
                  <Circle cx={12} cy={12} r={9} fill="none" stroke={selected ? "#FFFFFF" : SWEETLY.text} strokeWidth={2} />
                  <Path d={item.d} fill="none" stroke={selected ? "#FFFFFF" : SWEETLY.text} strokeWidth={2} strokeLinecap="round" />
                  <Path d="M9 9.5h.01M15 9.5h.01" fill="none" stroke={selected ? "#FFFFFF" : SWEETLY.text} strokeWidth={3} strokeLinecap="round" />
                </Svg>
              </View>

              <Text style={[styles.moodLabel, selected && styles.moodLabelOn]}>{item.value}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionLabel>ЗАМЕТКА К НАСТРОЕНИЮ</SectionLabel>

      <TextInput
        style={styles.input}
        placeholder="Что случилось сегодня?"
        placeholderTextColor={SWEETLY.muted}
        value={note}
        onChangeText={setNote}
        maxLength={140}
      />

      <PrimaryButton title="Сохранить" onPress={save} />

      <Text style={styles.hint}>Партнёр увидит твоё настроение, когда подключится</Text>

      <SectionLabel>ЭТА НЕДЕЛЯ</SectionLabel>

      <View style={styles.week}>
        {WEEK.map((day, index) => {
          const isToday = index === todayIndex;

          return (
            <View key={day} style={styles.day}>
              <View
                style={[
                  styles.dot,
                  isToday ? styles.dotToday : styles.dotEmpty,
                ]}
              />
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{day}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SWEETLY.background },

  content: {
    paddingHorizontal: 22,
    paddingTop: 55,
    paddingBottom: 70,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: 12,
  },

  moodCard: {
    backgroundColor: SWEETLY.card,
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  moodItem: { alignItems: "center", width: "18%" },

  moodCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: SWEETLY.background,
    alignItems: "center",
    justifyContent: "center",
  },

  moodCircleOn: { backgroundColor: SWEETLY.accent },

  moodLabel: {
    color: SWEETLY.text,
    fontFamily: FONTS.text,
    fontSize: 12,
    marginTop: 6,
  },

  moodLabelOn: {
    color: SWEETLY.accent,
    fontFamily: FONTS.textBold,
  },

  input: {
    height: 52,
    borderRadius: 26,
    backgroundColor: SWEETLY.card,
    paddingHorizontal: 20,
    fontSize: 15,
    color: SWEETLY.text,
  },

  hint: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 13,
    textAlign: "center",
  },

  week: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  day: { alignItems: "center", gap: 6, flex: 1 },

  dot: { width: 38, height: 38, borderRadius: 19 },

  dotToday: {
    borderWidth: 2,
    borderColor: SWEETLY.accent,
    backgroundColor: SWEETLY.card,
  },

  dotEmpty: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: SWEETLY.dashed,
  },

  dayLabel: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 12,
  },

  dayLabelToday: {
    color: SWEETLY.accent,
    fontFamily: FONTS.textBold,
  },
});
