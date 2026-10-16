import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { SectionLabel } from "@/components/sweetly-ui";
import { SWEETLY } from "@/constants/sweetly-theme";

import { AccentCard, ICON, SoloRow, SoloTitle, WhiteButton } from "./solo-shell";

// Комната без пары: что будет внутри, когда подключится партнёр
export default function SoloRoom() {
  const router = useRouter();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SoloTitle title="Комната" subtitle="Ваше общее пространство" />

      <AccentCard
        icon={ICON.door}
        title="Комната откроется вдвоём"
        text="Подключите партнёра, чтобы вести общие планы и желания и смотреть видео вместе."
      >
        <WhiteButton title="Пригласить партнёра" onPress={() => router.push("/start-date" as any)} />
      </AccentCard>

      <View style={styles.list}>
        <SectionLabel>ЧТО БУДЕТ ВНУТРИ</SectionLabel>

        <SoloRow icon={ICON.calendar} title="Планы" />
        <SoloRow icon={ICON.gift} title="Желания" />
        <SoloRow icon={ICON.pin} title="Места" />
        <SoloRow icon={ICON.doc} title="Заметки" />
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
