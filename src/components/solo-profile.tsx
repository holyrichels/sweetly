import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { SectionLabel } from "@/components/sweetly-ui";
import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { useAppData } from "@/lib/app-data";

import { AccentCard, ICON, SoloTitle, WhiteButton } from "./solo-shell";

// Профиль без пары: аккаунт, приглашение и разделы
export default function SoloProfile() {
  const router = useRouter();

  const app = useAppData();

  const name = app.me?.name || "Вы";

  const initial = name.trim().charAt(0).toUpperCase();

  const rows = [
    { title: "Ввести код партнёра", sub: "Если партнёр уже прислал код", path: "/connect" },
    { title: "Настройки", sub: "Аккаунт и уведомления", path: "/settings" },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SoloTitle title="Профиль" />

      <View style={styles.me}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.flex}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.account}>Аккаунт Sweetly</Text>
        </View>
      </View>

      <AccentCard
        icon={ICON.heart}
        title="Партнёр не подключён"
        text="Подключите, чтобы открыть общие функции."
      >
        <WhiteButton title="Пригласить партнёра" onPress={() => router.push("/start-date" as any)} />
      </AccentCard>

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
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowSub}>{row.sub}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
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

  flex: { flex: 1 },

  me: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },

  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: SWEETLY.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: "#FFFFFF",
    fontFamily: FONTS.display,
    fontSize: 32,
  },

  name: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 28,
  },

  account: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 14,
    marginTop: 2,
  },

  codeCard: {
    backgroundColor: SWEETLY.card,
    borderRadius: 24,
    padding: 18,
    gap: 6,
  },

  code: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 28,
    letterSpacing: 3,
  },

  list: {
    backgroundColor: SWEETLY.card,
    borderRadius: 28,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 64,
  },

  border: {
    borderBottomWidth: 1,
    borderBottomColor: SWEETLY.divider,
  },

  rowTitle: {
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 17,
  },

  rowSub: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 13,
    marginTop: 2,
  },

  chevron: {
    color: SWEETLY.muted,
    fontSize: 24,
  },
});
