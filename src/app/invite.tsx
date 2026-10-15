import { useEffect, useState } from "react";

import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { PrimaryButton, SecondaryButton } from "@/components/sweetly-ui";
import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { getAppData, refreshAppData } from "@/lib/app-data";
import { clearPendingInvite, getPendingInvite } from "@/lib/invite-link";
import { supabase } from "@/lib/supabase";

type Step = "loading" | "ready" | "invalid" | "inPair" | "busy";

// Экран приглашения: «[Имя] приглашает вас в Sweetly»
export default function InviteScreen() {
  const router = useRouter();

  const [code, setCode] = useState<string | null>(null);

  const [inviter, setInviter] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("loading");

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pending = getPendingInvite();

    if (!pending) {
      router.replace("/" as any);

      return;
    }

    setCode(pending);

    supabase.rpc("invite_preview", { p_code: pending }).then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;

      if (!row) {
        setStep("invalid");

        return;
      }

      setInviter(row.inviter_name);

      setStep("ready");
    });
  }, []);

  function goHome() {
    clearPendingInvite();

    router.replace("/" as any);
  }

  async function accept() {
    if (!code) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Не вошёл: приглашение сохранено, после регистрации или входа вернёмся сюда
    if (!session) {
      router.replace("/register" as any);

      return;
    }

    if (getAppData().coupleId) {
      setStep("inPair");

      return;
    }

    setStep("busy");

    setError(null);

    const { data, error: joinError } = await supabase.rpc("join_couple_by_code", { code });

    if (joinError || !data) {
      setError("Не получилось подключиться. Попробуйте ещё раз.");

      setStep("ready");

      return;
    }

    clearPendingInvite();

    await refreshAppData();

    router.replace("/" as any);
  }

  if (step === "loading" || step === "busy") {
    return (
      <View style={styles.screen}>
        <ActivityIndicator size="large" color={SWEETLY.accent} />
      </View>
    );
  }

  if (step === "invalid") {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Приглашение не найдено</Text>

        <Text style={styles.text}>Ссылка устарела или код введён неверно. Попросите партнёра прислать новую.</Text>

        <PrimaryButton title="На главную" onPress={goHome} />
      </View>
    );
  }

  if (step === "inPair") {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Вы уже в паре</Text>

        <Text style={styles.text}>Чтобы подключить другого партнёра, сначала выйдите из текущей пары.</Text>

        <PrimaryButton title="На главную" onPress={goHome} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.heart}>
        <Text style={styles.heartText}>♥</Text>
      </View>

      <Text style={styles.title}>{inviter} приглашает вас в Sweetly</Text>

      <Text style={styles.text}>
        Вместе вы будете считать дни, делиться настроением и хранить общие воспоминания.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton title="Принять приглашение" onPress={accept} />

      <SecondaryButton title="Не сейчас" onPress={goHome} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SWEETLY.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    gap: 16,
  },

  heart: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: SWEETLY.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  heartText: {
    color: "#FFFFFF",
    fontSize: 40,
  },

  title: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 28,
    textAlign: "center",
  },

  text: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 8,
  },

  error: {
    color: SWEETLY.error,
    fontFamily: FONTS.textBold,
    fontSize: 14,
    textAlign: "center",
  },
});
