import { useEffect, useRef, useState } from "react";

import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import NotifyToggles from "@/components/notify-toggles";
import SubHeader from "@/components/sub-header";
import { PrimaryButton, SecondaryButton } from "@/components/sweetly-ui";
import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { refreshAppData, useAppData } from "@/lib/app-data";
import { BOT_USERNAME } from "@/lib/invite";
import { confirmAction, notify } from "@/lib/dialogs";
import { supabase } from "@/lib/supabase";

const BELL = "M6 10a6 6 0 0112 0v4l2 3H4l2-3zM10 19a2 2 0 004 0";

export default function NotificationsScreen() {
  const router = useRouter();

  const app = useAppData();

  const [code, setCode] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  const [testing, setTesting] = useState(false);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Пока не привязан: создаём код и ждём, когда бот его подтвердит
  useEffect(() => {
    if (app.telegramLinked) return;

    supabase.functions
      .invoke("notify-partner", { body: { action: "create_link_code" } })
      .then(({ data }) => setCode(data?.code ?? null))
      .catch(() => {});

    timer.current = setInterval(() => {
      refreshAppData();
    }, 3000);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [app.telegramLinked]);

  // Как только бот подтвердил привязку, останавливаем проверку
  useEffect(() => {
    if (app.telegramLinked && timer.current) {
      clearInterval(timer.current);

      timer.current = null;
    }
  }, [app.telegramLinked]);

  async function openBot() {
    if (!code) return;

    await Linking.openURL(`https://t.me/${BOT_USERNAME}?start=${code}`);
  }

  async function copyCode() {
    if (!code) return;

    await Clipboard.setStringAsync(code);

    setCopied(true);

    setTimeout(() => setCopied(false), 2000);
  }

  async function sendTest() {
    setTesting(true);

    try {
      const { data, error } = await supabase.functions.invoke("notify-partner", {
        body: { action: "test" },
      });

      if (error || !data?.sent) {
        notify("Не получилось", "Бот не смог отправить сообщение. Проверьте, что вы нажали «Старт» в боте.");

        return;
      }

      notify("Готово", "Тестовое сообщение отправлено в Telegram");
    } finally {
      setTesting(false);
    }
  }

  function unlink() {
    confirmAction(
      "Отвязать Telegram?",
      "Уведомления от партнёра перестанут приходить.",
      async () => {
        await supabase.functions.invoke("notify-partner", { body: { action: "unlink" } });

        await refreshAppData();
      },
      "Отвязать",
    );
  }

  const linked = app.telegramLinked;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SubHeader title="Привязка Telegram" />

      {linked ? (
        <>
          <View style={styles.statusCard}>
            <View style={styles.statusIcon}>
              <Svg width={24} height={24} viewBox="0 0 24 24">
                <Path d={BELL} fill="none" stroke={SWEETLY.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>

            <View style={styles.flex}>
              <Text style={styles.statusTitle}>Telegram привязан</Text>
              <Text style={styles.statusSub}>{app.telegramUsername ? `@${app.telegramUsername}` : "Уведомления включены"}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>ЧТО ПРИХОДИТ В TELEGRAM</Text>

          <NotifyToggles />

          <SecondaryButton
            title={testing ? "Отправляем..." : "Отправить тестовое уведомление"}
            onPress={sendTest}
          />

          <Pressable style={styles.unlink} onPress={unlink}>
            <Text style={styles.unlinkText}>Отвязать Telegram</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={styles.statusCard}>
            <View style={styles.statusIcon}>
              <Svg width={24} height={24} viewBox="0 0 24 24">
                <Path d={BELL} fill="none" stroke={SWEETLY.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>

            <View style={styles.flex}>
              <Text style={styles.statusTitle}>Telegram не привязан</Text>
              <Text style={styles.statusSub}>Уведомления будут приходить в мессенджер</Text>
            </View>
          </View>

          <View style={styles.steps}>
            {[
              `Откройте бота @${BOT_USERNAME}`,
              "Нажмите «Старт»",
              "Вернитесь в Sweetly — привязка подтвердится сама",
            ].map((text, index) => (
              <View key={text} style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{text}</Text>
              </View>
            ))}
          </View>

          <PrimaryButton title="Открыть Telegram" onPress={openBot} disabled={!code} />

          <Text style={styles.sectionLabel}>ИЛИ ОТПРАВЬТЕ БОТУ КОД</Text>

          <View style={styles.codeCard}>
            <Text style={styles.code}>{code ?? "— — — — — — — —"}</Text>

            <SecondaryButton title={copied ? "Скопировано" : "Скопировать"} onPress={copyCode} />
          </View>

          <View style={styles.waiting}>
            <View style={styles.waitingDot} />
            <Text style={styles.waitingText}>Ждём подтверждения от бота</Text>
          </View>
        </>
      )}

      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>Назад в настройки</Text>
      </Pressable>
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

  flex: { flex: 1 },

  statusCard: {
    backgroundColor: SWEETLY.card,
    borderRadius: 28,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SWEETLY.peach,
    alignItems: "center",
    justifyContent: "center",
  },

  statusTitle: {
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 17,
  },

  statusSub: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 13,
    marginTop: 2,
  },

  sectionLabel: {
    color: SWEETLY.muted,
    fontFamily: FONTS.textBold,
    fontSize: 13,
    letterSpacing: 0.4,
    marginTop: 6,
  },

  steps: {
    backgroundColor: SWEETLY.card,
    borderRadius: 28,
    padding: 18,
    gap: 14,
  },

  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: SWEETLY.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  stepNumberText: {
    color: "#FFFFFF",
    fontFamily: FONTS.textBold,
    fontSize: 14,
  },

  stepText: {
    flex: 1,
    color: SWEETLY.text,
    fontFamily: FONTS.text,
    fontSize: 15,
  },

  codeCard: {
    backgroundColor: SWEETLY.card,
    borderRadius: 28,
    padding: 18,
    gap: 12,
  },

  code: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 24,
    letterSpacing: 2,
    textAlign: "center",
  },

  waiting: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  waitingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SWEETLY.accent,
  },

  waitingText: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 14,
  },

  unlink: {
    alignSelf: "center",
    paddingVertical: 12,
  },

  unlinkText: {
    color: SWEETLY.error,
    fontFamily: FONTS.textBold,
    fontSize: 15,
  },

  back: {
    alignSelf: "center",
    paddingVertical: 8,
  },

  backText: {
    color: SWEETLY.muted,
    fontFamily: FONTS.textBold,
    fontSize: 14,
  },
});
