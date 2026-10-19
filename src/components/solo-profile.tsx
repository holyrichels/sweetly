import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { SectionLabel } from "@/components/sweetly-ui";
import { C, FONTS, liveStyles } from "@/constants/sweetly-theme";
import { useAppData } from "@/lib/app-data";

import { PrimaryButton } from "@/components/sweetly-ui";

const LINK = "M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1";
const HEART = "M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z";
const SLIDERS = "M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6";
const CHEVRON = "M9 6l6 6-6 6";

function Icon({ d, color, size = 22, stroke = 1.8 }: { d: string; color: string; size?: number; stroke?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Профиль без пары: аватар, приглашение и разделы
export default function SoloProfile() {
  const router = useRouter();

  const app = useAppData();

  const name = app.me?.name || "Вы";

  const initial = name.trim().charAt(0).toUpperCase();

  const rows = [
    { title: "Моя ссылка-приглашение", icon: LINK, path: "/start-date" },
    { title: "Ввести код партнёра", icon: HEART, path: "/connect" },
    { title: "Настройки", icon: SLIDERS, path: "/settings" },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Профиль</Text>

      <View style={styles.me}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <Text style={styles.name}>{name}</Text>
        <Text style={styles.nick}>{app.telegramUsername ? `@${app.telegramUsername}` : "Аккаунт Sweetly"}</Text>
      </View>

      <View style={styles.partnerCard}>
        <View style={styles.dashedCircle}>
          <Svg width={34} height={34} viewBox="0 0 24 24">
            <Circle cx={12} cy={8} r={3.5} fill="none" stroke={C.dashed} strokeWidth={1.6} />
            <Path d="M5 20c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5" fill="none" stroke={C.dashed} strokeWidth={1.6} strokeLinecap="round" />
          </Svg>
        </View>

        <View style={styles.flex}>
          <Text style={styles.partnerTitle}>Партнёр не подключён</Text>
          <Text style={styles.partnerText}>Подключите, чтобы открыть общие функции</Text>
        </View>
      </View>

      <PrimaryButton title="Пригласить партнёра" onPress={() => router.push("/start-date" as any)} />

      {app.couple?.invite_code ? (
        <View style={styles.codeCard}>
          <SectionLabel>МОЙ КОД ПРИГЛАШЕНИЯ</SectionLabel>
          <Text style={styles.code}>{app.couple.invite_code}</Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {rows.map((row, index) => (
          <Pressable
            key={row.title}
            style={[styles.row, index < rows.length - 1 && styles.border]}
            onPress={() => router.push(row.path as any)}
          >
            <Icon d={row.icon} color={C.dashed} />
            <Text style={styles.rowTitle}>{row.title}</Text>
            <Icon d={CHEVRON} color={C.muted} size={20} />
          </Pressable>
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

    flex: { flex: 1 },

    title: {
      color: C.text,
      fontFamily: FONTS.display,
      fontSize: 36,
    },

    me: {
      alignItems: "center",
      gap: 6,
      marginTop: 4,
    },

    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
    },

    avatarText: {
      color: C.accentOn,
      fontFamily: FONTS.display,
      fontSize: 40,
    },

    name: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 22,
      marginTop: 6,
    },

    nick: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 14,
    },

    partnerCard: {
      backgroundColor: C.card,
      borderRadius: 26,
      padding: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },

    dashedCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: C.dashed,
      alignItems: "center",
      justifyContent: "center",
    },

    partnerTitle: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 17,
    },

    partnerText: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 13,
      marginTop: 2,
    },

    codeCard: {
      backgroundColor: C.card,
      borderRadius: 24,
      padding: 18,
      gap: 6,
    },

    code: {
      color: C.text,
      fontFamily: FONTS.display,
      fontSize: 28,
      letterSpacing: 3,
    },

    list: {
      backgroundColor: C.card,
      borderRadius: 28,
      overflow: "hidden",
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 18,
    },

    border: {
      borderBottomWidth: 1,
      borderBottomColor: C.divider,
    },

    rowTitle: {
      flex: 1,
      color: C.text,
      fontFamily: FONTS.text,
      fontSize: 16,
    },
  })
);
