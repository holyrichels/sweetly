import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { PrimaryButton } from "@/components/sweetly-ui";
import { C, FONTS, liveStyles } from "@/constants/sweetly-theme";

import { ICON } from "./solo-shell";

const SECTIONS = [
  { title: "Планы", desc: "Что хотите сделать вместе", icon: ICON.calendar },
  { title: "Желания", desc: "Подарки и мечты друг друга", icon: ICON.gift },
  { title: "Места", desc: "Куда съездить и где побывать", icon: ICON.pin },
  { title: "Заметки", desc: "Мелочи, которые важно помнить", icon: ICON.doc },
];

// Комната без пары: сетка разделов с замками, как на доске
export default function SoloRoom() {
  const router = useRouter();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Комната</Text>
      <Text style={styles.subtitle}>Ваше общее пространство</Text>

      <View style={styles.hero}>
        <View style={styles.heroCircle}>
          <Svg width={26} height={26} viewBox="0 0 24 24">
            <Path d={ICON.lock} fill="none" stroke={C.accentOn} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>

        <Text style={styles.heroTitle}>Комната откроется вдвоём</Text>

        <Text style={styles.heroText}>
          Подключите партнёра, чтобы вести общие планы и желания и смотреть видео вместе.
        </Text>

        <PrimaryButton
          title="Пригласить партнёра"
          onPress={() => router.push("/start-date" as any)}
          style={styles.fullButton}
        />
      </View>

      <Text style={styles.label}>ЧТО БУДЕТ ВНУТРИ</Text>

      <View style={styles.grid}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardIcon}>
                <Svg width={22} height={22} viewBox="0 0 24 24">
                  <Path d={section.icon} fill="none" stroke={C.error} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>

              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path d={ICON.lock} fill="none" stroke={C.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>

            <Text style={styles.cardTitle}>{section.title}</Text>
            <Text style={styles.cardDesc}>{section.desc}</Text>
          </View>
        ))}
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
      gap: 14,
    },

    title: {
      color: C.text,
      fontFamily: FONTS.display,
      fontSize: 36,
    },

    subtitle: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 15,
      marginTop: -8,
    },

    hero: {
      backgroundColor: C.card,
      borderRadius: 28,
      padding: 22,
      alignItems: "center",
      gap: 10,
    },

    heroCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
    },

    fullButton: {
      alignSelf: "stretch",
    },

    heroTitle: {
      color: C.text,
      fontFamily: FONTS.display,
      fontSize: 24,
      textAlign: "center",
    },

    heroText: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      marginBottom: 6,
    },

    label: {
      color: C.muted,
      fontFamily: FONTS.textBold,
      fontSize: 13,
      letterSpacing: 0.4,
      marginTop: 6,
    },

    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 12,
    },

    card: {
      width: "48%",
      backgroundColor: C.card,
      borderRadius: 24,
      padding: 16,
      gap: 6,
    },

    cardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },

    cardIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.peach,
      alignItems: "center",
      justifyContent: "center",
    },

    cardTitle: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 16,
    },

    cardDesc: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 12,
      lineHeight: 17,
    },
  })
);
