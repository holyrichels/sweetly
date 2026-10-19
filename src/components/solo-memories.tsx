import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { PrimaryButton } from "@/components/sweetly-ui";
import { C, FONTS, liveStyles } from "@/constants/sweetly-theme";

import { ICON } from "./solo-shell";

// Воспоминания без пары: пустая карточка с пунктиром, как на доске
export default function SoloMemories() {
  const router = useRouter();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Воспоминания</Text>
          <Text style={styles.subtitle}>Моменты, которые вы сохранили</Text>
        </View>

        <Pressable style={styles.addButton} onPress={() => router.push("/start-date" as any)}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path d="M12 5v14M5 12h14" fill="none" stroke={C.accentOn} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Svg width={28} height={28} viewBox="0 0 24 24">
            <Path d={ICON.photo} fill="none" stroke={C.error} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>

        <Text style={styles.emptyTitle}>Пока нет воспоминаний</Text>

        <Text style={styles.emptyText}>Добавляйте фото и видео. Партнёр увидит их, когда подключится.</Text>

        <PrimaryButton
          title="+ Добавить воспоминание"
          onPress={() => router.push("/start-date" as any)}
          style={styles.fullButton}
        />

        <Pressable style={styles.outline} onPress={() => router.push("/start-date" as any)}>
          <Text style={styles.outlineText}>Пригласить партнёра</Text>
        </Pressable>
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
      gap: 16,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    headerText: { flex: 1, gap: 4 },

    title: {
      color: C.text,
      fontFamily: FONTS.display,
      fontSize: 36,
    },

    subtitle: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 15,
    },

    addButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
    },

    empty: {
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: C.dashed,
      borderRadius: 32,
      padding: 26,
      alignItems: "center",
      gap: 12,
      marginTop: 10,
    },

    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: C.peach,
      alignItems: "center",
      justifyContent: "center",
    },

    emptyTitle: {
      color: C.text,
      fontFamily: FONTS.display,
      fontSize: 24,
      textAlign: "center",
    },

    emptyText: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      marginBottom: 4,
    },

    fullButton: {
      alignSelf: "stretch",
    },

    outline: {
      alignSelf: "stretch",
      height: 52,
      borderRadius: 26,
      borderWidth: 1.5,
      borderColor: C.dashed,
      alignItems: "center",
      justifyContent: "center",
    },

    outlineText: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 16,
    },
  })
);
