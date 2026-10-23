import { useState } from "react";

import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import SubHeader from "@/components/sub-header";
import { C, FONTS, liveStyles } from "@/constants/sweetly-theme";
import { refreshAppData, useAppData } from "@/lib/app-data";
import { shareInvite } from "@/lib/invite";
import { notify } from "@/lib/dialogs";
import { supabase } from "@/lib/supabase";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

// Код комнаты: показ, копирование, отправка и создание нового кода
export default function RoomCodeScreen() {
  const router = useRouter();

  const app = useAppData();

  const [copied, setCopied] = useState(false);

  const [busy, setBusy] = useState(false);

  const code = app.couple?.invite_code ?? "";

  const hasPartner = !!app.partner;

  const status = hasPartner
    ? `${app.me?.name || "Вы"} и ${app.partner?.name} в комнате`
    : "Вы одни в комнате";

  function copy() {
    if (!code) return;

    navigator.clipboard?.writeText(code);

    setCopied(true);

    setTimeout(() => setCopied(false), 2000);
  }

  // Новый код: старый перестаёт работать, участники остаются в комнате
  async function regenerate() {
    if (!app.coupleId || busy) return;

    setBusy(true);

    const next = newCode();

    const { error } = await supabase.from("couples").update({ invite_code: next }).eq("id", app.coupleId);

    setBusy(false);

    if (error) {
      notify("Ошибка", error.message);

      return;
    }

    await refreshAppData();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SubHeader title="Код комнаты" />

      <View style={styles.card}>
        <Text style={styles.label}>КОД ДЛЯ ВХОДА</Text>

        <View style={styles.cells}>
          {(code || "--------").split("").map((char, index) => (
            <View key={index} style={styles.cell}>
              <Text style={styles.char}>{char}</Text>
            </View>
          ))}
        </View>

        <View style={styles.row}>
          <Pressable style={[styles.button, styles.half]} onPress={copy}>
            <Text style={styles.buttonText}>{copied ? "Скопировано" : "Скопировать"}</Text>
          </Pressable>

          <Pressable style={[styles.button, styles.half]} onPress={() => shareInvite(code)}>
            <Text style={styles.buttonText}>Поделиться</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.dot} />
        <Text style={styles.statusText}>{status}</Text>
      </View>

      <Pressable style={styles.outline} onPress={regenerate} disabled={busy}>
        <Text style={styles.outlineText}>{busy ? "Создаём..." : "Создать новый код"}</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={() => router.push("/watch" as any)}>
        <Text style={styles.buttonText}>Смотреть вместе</Text>
      </Pressable>
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

    card: {
      backgroundColor: C.card,
      borderRadius: 28,
      padding: 20,
      gap: 16,
    },

    label: {
      color: C.muted,
      fontFamily: FONTS.textBold,
      fontSize: 13,
      letterSpacing: 0.4,
    },

    cells: {
      flexDirection: "row",
      justifyContent: "space-between",
    },

    cell: {
      width: 36,
      height: 50,
      borderRadius: 12,
      backgroundColor: C.background,
      alignItems: "center",
      justifyContent: "center",
    },

    char: {
      color: C.text,
      fontFamily: FONTS.display,
      fontSize: 24,
    },

    row: {
      flexDirection: "row",
      gap: 10,
    },

    half: { flex: 1 },

    button: {
      height: 52,
      borderRadius: 26,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
    },

    buttonText: {
      color: C.accentOn,
      fontFamily: FONTS.textBold,
      fontSize: 15,
    },

    statusCard: {
      backgroundColor: C.card,
      borderRadius: 22,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: C.accent,
    },

    statusText: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 15,
    },

    outline: {
      height: 52,
      borderRadius: 26,
      borderWidth: 1.5,
      borderColor: C.text,
      alignItems: "center",
      justifyContent: "center",
    },

    outlineText: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 15,
    },
  })
);
