import { ReactNode } from "react";

import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PrimaryButton, ScreenTitle, SectionLabel } from "@/components/sweetly-ui";
import { FONTS, SWEETLY } from "@/constants/sweetly-theme";

type Kind = "home" | "room" | "mood" | "memories";

const CONTENT: Record<Kind, { title: string; subtitle?: string; heading: string; text: string; cta: string; list: string[]; listTitle: string }> = {
  home: {
    title: "Sweetly",
    heading: "Пока вы здесь одни",
    text: "Пригласите партнёра — и здесь появятся ваш общий таймер и дни вместе.",
    cta: "Пригласить партнёра",
    listTitle: "ЧТО ОТКРОЕТСЯ ВДВОЁМ",
    list: ["Общий таймер", "Комната на двоих", "Скучаю и настроение"],
  },
  room: {
    title: "Комната",
    subtitle: "Ваше общее пространство",
    heading: "Комната откроется вдвоём",
    text: "Подключите партнёра, чтобы вести общие планы и желания и смотреть видео вместе.",
    cta: "Пригласить партнёра",
    listTitle: "ЧТО БУДЕТ ВНУТРИ",
    list: ["Планы", "Желания", "Места", "Заметки"],
  },
  mood: {
    title: "Настроение",
    subtitle: "Как ты сегодня?",
    heading: "Партнёр увидит твоё настроение",
    text: "Сохранить настроение можно, когда партнёр подключится.",
    cta: "Пригласить партнёра",
    listTitle: "",
    list: [],
  },
  memories: {
    title: "Воспоминания",
    subtitle: "Моменты, которые вы сохранили",
    heading: "Пока нет воспоминаний",
    text: "Добавляйте фото и видео. Партнёр увидит их, когда подключится.",
    cta: "Пригласить партнёра",
    listTitle: "",
    list: [],
  },
};

// Экран вкладки, когда пара ещё не создана. Одинаковый стиль, разный текст.
export default function SoloScreen({ kind, children }: { kind: Kind; children?: ReactNode }) {
  const router = useRouter();

  const content = CONTENT[kind];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenTitle>{content.title}</ScreenTitle>

      {content.subtitle ? <Text style={styles.subtitle}>{content.subtitle}</Text> : null}

      {children}

      {!children && (
        <View style={styles.card}>
          <Text style={styles.heading}>{content.heading}</Text>
          <Text style={styles.text}>{content.text}</Text>

          <PrimaryButton title={content.cta} onPress={() => router.push("/start-date" as any)} style={styles.cta} />
        </View>
      )}

      {content.list.length > 0 && (
        <View>
          <SectionLabel>{content.listTitle}</SectionLabel>

          <View style={styles.list}>
            {content.list.map((item, index) => (
              <View key={item} style={[styles.row, index < content.list.length - 1 && styles.border]}>
                <Text style={styles.rowText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {kind === "home" || kind === "room" ? null : (
        <Pressable style={styles.link} onPress={() => router.push("/connect" as any)}>
          <Text style={styles.linkText}>Ввести код партнёра</Text>
        </Pressable>
      )}
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
    gap: 16,
  },

  subtitle: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 16,
    marginTop: -10,
  },

  card: {
    backgroundColor: SWEETLY.card,
    borderRadius: 28,
    padding: 22,
    gap: 10,
  },

  heading: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 24,
  },

  text: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 15,
    lineHeight: 22,
  },

  cta: { marginTop: 6 },

  list: {
    backgroundColor: SWEETLY.card,
    borderRadius: 24,
    overflow: "hidden",
  },

  row: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  border: {
    borderBottomWidth: 1,
    borderBottomColor: SWEETLY.divider,
  },

  rowText: {
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 16,
  },

  link: {
    alignSelf: "center",
    paddingVertical: 10,
  },

  linkText: {
    color: SWEETLY.accent,
    fontFamily: FONTS.textBold,
    fontSize: 15,
  },
});
