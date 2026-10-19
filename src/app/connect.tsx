import { useEffect, useState } from "react";

import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Field, PrimaryButton, ScreenTitle, SecondaryButton } from "@/components/sweetly-ui";
import { FONTS, C, liveStyles } from "@/constants/sweetly-theme";
import { refreshAppData } from "@/lib/app-data";
import { shareInvite } from "@/lib/invite";
import { supabase } from "@/lib/supabase";

// Имя бота без @. Должно совпадать с настройками.
const BOT_USERNAME = "sweetly_couple_bot";

export default function ConnectScreen() {
  const router = useRouter();

  const [code, setCode] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  const [partnerCode, setPartnerCode] = useState("");

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCode();
  }, []);

  async function loadCode() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    const { data: member } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!member) return;

    const { data: couple } = await supabase
      .from("couples")
      .select("invite_code")
      .eq("id", member.couple_id)
      .maybeSingle();

    setCode(couple?.invite_code ?? null);
  }

  async function copyCode() {
    if (!code) return;

    await Clipboard.setStringAsync(code);

    setCopied(true);

    setTimeout(() => setCopied(false), 2000);
  }

  // Тот же текст и ссылка, что на главной: сначала текст, потом ссылка
  function shareInviteLink() {
    shareInvite(code);
  }

  async function join() {
    const value = partnerCode.trim().toUpperCase();

    if (!value) {
      setError("Введите код партнёра");

      return;
    }

    setBusy(true);

    setError(null);

    const { data, error: rpcError } = await supabase.rpc("join_couple_by_code", { code: value });

    setBusy(false);

    if (rpcError || !data) {
      setError("Приглашение не найдено или устарело");

      return;
    }

    await refreshAppData();

    router.replace("/" as any);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.titleBlock}>
        <ScreenTitle>Подключите партнёра</ScreenTitle>

        <Text style={styles.subtitle}>
          Sweetly работает вдвоём. Отправьте партнёру свой код или введите код, который прислал он.
        </Text>
      </View>

      <View style={styles.codeCard}>
        <Text style={styles.label}>ВАШ КОД</Text>

        <Text style={styles.code}>{code ?? "— — — — — —"}</Text>

        <View style={styles.codeButtons}>
          <SecondaryButton
            title={copied ? "Скопировано" : "Скопировать"}
            onPress={copyCode}
            style={styles.halfButton}
          />

          <PrimaryButton title="Поделиться" onPress={shareInviteLink} style={styles.halfButton} />
        </View>
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>или</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>КОД ПАРТНЁРА</Text>
        <Field placeholder="Введите код" value={partnerCode} onChangeText={setPartnerCode} autoCapitalize="characters" />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton title={busy ? "Подключаем..." : "Подключиться"} onPress={join} disabled={busy} />

      <Pressable style={styles.skip} onPress={() => router.replace("/" as any)}>
        <Text style={styles.skipText}>Пропустить пока</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = liveStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },

  content: {
    paddingHorizontal: 22,
    paddingTop: 40,
    paddingBottom: 40,
    gap: 14,
  },

  titleBlock: { gap: 6 },

  subtitle: {
    color: C.muted,
    fontFamily: FONTS.text,
    fontSize: 15,
    lineHeight: 22,
  },

  codeCard: {
    backgroundColor: C.card,
    borderRadius: 28,
    padding: 20,
    gap: 12,
  },

  label: {
    color: C.muted,
    fontFamily: FONTS.textBold,
    fontSize: 13,
    letterSpacing: 0.3,
  },

  code: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 36,
    letterSpacing: 4,
    textAlign: "center",
    marginVertical: 6,
  },

  codeButtons: {
    flexDirection: "row",
    gap: 10,
  },

  halfButton: {
    flex: 1,
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.divider,
  },

  dividerText: {
    color: C.muted,
    fontFamily: FONTS.text,
    fontSize: 14,
  },

  field: { gap: 6 },

  error: {
    color: C.error,
    fontFamily: FONTS.textBold,
    fontSize: 14,
  },

  skip: {
    alignSelf: "center",
    paddingVertical: 12,
  },

  skipText: {
    color: C.muted,
    fontFamily: FONTS.textBold,
    fontSize: 15,
  },
}));
