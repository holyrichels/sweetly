import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { SWEETLY } from "@/constants/sweetly-theme";

import { AccentCard, ICON, SoloTitle, WhiteButton } from "./solo-shell";

// Воспоминания без пары: добавить можно, видно будет вдвоём
export default function SoloMemories() {
  const router = useRouter();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SoloTitle title="Воспоминания" subtitle="Моменты, которые вы сохранили" />

      <AccentCard
        icon={ICON.photo}
        title="Пока нет воспоминаний"
        text="Добавляйте фото и видео. Партнёр увидит их, когда подключится."
      >
        <View style={styles.buttons}>
          <WhiteButton title="Добавить воспоминание" onPress={() => router.push("/start-date" as any)} />
        </View>
      </AccentCard>
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

  buttons: { gap: 10 },
});
