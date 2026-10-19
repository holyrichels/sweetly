import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { PrimaryButton, SectionLabel } from "@/components/sweetly-ui";
import { C, FONTS, liveStyles } from "@/constants/sweetly-theme";

import { ICON, SoloBrandHeader } from "./solo-shell";

const WEEKDAYS = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];

// Полоска последних семи дней: сегодня выделен, выбор даты — на экране создания пары
function DayStrip() {
  const today = new Date();

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);

    date.setDate(today.getDate() - (6 - index));

    return date;
  });

  return (
    <View style={styles.strip}>
      {days.map((date, index) => {
        const isToday = index === 6;

        return (
          <View key={index} style={[styles.day, isToday && styles.dayToday]}>
            <Text style={[styles.dayWeek, isToday && styles.dayWeekToday]}>{WEEKDAYS[date.getDay()]}</Text>
            <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>{date.getDate()}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Строка «что откроется вдвоём» с замком справа
function LockedRow({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path d={icon} fill="none" stroke={C.error} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>

      <Text style={styles.rowTitle}>{title}</Text>

      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path d={ICON.lock} fill="none" stroke={C.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

// Главная без пары: как на доске
export default function SoloHome() {
  const router = useRouter();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SoloBrandHeader />

      <DayStrip />

      <View style={styles.card}>
        <View style={styles.heartCircle}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path d={ICON.heart} fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinejoin="round" />
          </Svg>
        </View>

        <Text style={styles.cardTitle}>Пока вы здесь одни</Text>

        <Text style={styles.cardText}>Пригласите партнёра — и здесь появятся ваш общий таймер и дни вместе.</Text>

        <PrimaryButton
          title="Пригласить партнёра"
          onPress={() => router.push("/start-date" as any)}
          style={styles.cardButton}
        />
      </View>

      <View style={styles.list}>
        <SectionLabel>ЧТО ОТКРОЕТСЯ ВДВОЁМ</SectionLabel>

        <LockedRow icon={ICON.clock} title="Общий таймер" />
        <LockedRow icon={ICON.door} title="Комната на двоих" />
        <LockedRow icon={ICON.smile} title="Скучаю и настроение" />
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

    strip: {
      flexDirection: "row",
      gap: 8,
    },

    day: {
      flex: 1,
      height: 84,
      borderRadius: 22,
      backgroundColor: C.card,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },

    dayToday: {
      backgroundColor: C.accent,
    },

    dayWeek: {
      color: C.muted,
      fontFamily: FONTS.textBold,
      fontSize: 11,
    },

    dayWeekToday: {
      color: C.accentOn,
    },

    dayNumber: {
      color: C.text,
      fontFamily: FONTS.display,
      fontSize: 20,
    },

    dayNumberToday: {
      color: C.accentOn,
    },

    card: {
      backgroundColor: C.accent,
      borderRadius: 32,
      padding: 24,
      gap: 10,
    },

    heartCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(255,255,255,0.22)",
      alignItems: "center",
      justifyContent: "center",
    },

    cardTitle: {
      color: C.accentOn,
      fontFamily: FONTS.display,
      fontSize: 28,
      marginTop: 4,
    },

    cardText: {
      color: C.accentOn,
      fontFamily: FONTS.text,
      fontSize: 15,
      lineHeight: 21,
      opacity: 0.95,
    },

    cardButton: {
      backgroundColor: C.card,
      marginTop: 6,
    },

    list: {
      gap: 8,
    },

    row: {
      backgroundColor: C.card,
      borderRadius: 22,
      paddingVertical: 12,
      paddingLeft: 12,
      paddingRight: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },

    rowIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.peach,
      alignItems: "center",
      justifyContent: "center",
    },

    rowTitle: {
      flex: 1,
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 16,
    },
  })
);
