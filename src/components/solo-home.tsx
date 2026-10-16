import { ScrollView, StyleSheet, View } from "react-native";

import StartDateCard from "@/components/start-date-card";
import { SectionLabel } from "@/components/sweetly-ui";
import { SWEETLY } from "@/constants/sweetly-theme";

import { AccentCard, ICON, SoloBrandHeader, SoloRow } from "./solo-shell";

// Главная без пары: приветствие, выбор даты и что откроется вдвоём
export default function SoloHome() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SoloBrandHeader />

      <AccentCard
        icon={ICON.heart}
        title="Пока вы здесь одни"
        text="Выберите дату, с которой начались отношения, и пригласите партнёра."
      />

      <StartDateCard />

      <View style={styles.list}>
        <SectionLabel>ЧТО ОТКРОЕТСЯ ВДВОЁМ</SectionLabel>

        <SoloRow icon={ICON.clock} title="Общий таймер" />
        <SoloRow icon={ICON.door} title="Комната на двоих" />
        <SoloRow icon={ICON.smile} title="Скучаю и настроение" />
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
    gap: 14,
  },

  list: { gap: 8, marginTop: 6 },
});
