import { useState } from "react";

import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import SubHeader from "@/components/sub-header";
import { C, FONTS, liveStyles } from "@/constants/sweetly-theme";
import { refreshAppData } from "@/lib/app-data";
import { supabase } from "@/lib/supabase";

// Вход в комнату по коду из 8 символов
export default function RoomJoinScreen() {
  const router = useRouter();

  const [value, setValue] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  async function join() {
    const code = value.trim().toUpperCase();

    if (code.length !== 8) {
      setError("Код из 8 символов, буквы и цифры");
      return;
    }

    setBusy(true);

    setError(null);

    const { data, error: rpcError } = await supabase.rpc("join_couple_by_code", { code });

    setBusy(false);

    if (rpcError || !data) {
      setError("Комната не найдена или код устарел");
      return;
    }

    await refreshAppData();

    router.replace("/" as any);
  }

  return (
    <View style={styles.screen}>
      <SubHeader title="Вход по коду" />

      <Text style={styles.label}>КОД КОМНАТЫ</Text>

      <TextInput
        style={styles.input}
        placeholder="XXXXXXXX"
        placeholderTextColor={C.muted}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
        value={value}
        onChangeText={(text) => setValue(text.replace(/\s/g, "").toUpperCase())}
      />

      <Text style={styles.hint}>Буквы и цифры, без пробелов</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={join} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? "Входим..." : "Войти"}</Text>
      </Pressable>

      <Pressable style={styles.link} onPress={() => router.replace("/room-code" as any)}>
        <Text style={styles.linkText}>Создать свою комнату</Text>
      </Pressable>
    </View>
  );
}

const styles = liveStyles(() =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: C.background,
      paddingHorizontal: 22,
      paddingTop: 55,
      gap: 12,
    },

    label: {
      color: C.muted,
      fontFamily: FONTS.textBold,
      fontSize: 13,
      letterSpacing: 0.4,
    },

    input: {
      height: 58,
      borderRadius: 29,
      backgroundColor: C.card,
      paddingHorizontal: 22,
      fontSize: 22,
      letterSpacing: 6,
      color: C.text,
      textAlign: "center",
    },

    hint: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 13,
      textAlign: "center",
    },

    error: {
      color: C.error,
      fontFamily: FONTS.textBold,
      fontSize: 14,
      textAlign: "center",
    },

    button: {
      height: 56,
      borderRadius: 28,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 6,
    },

    buttonText: {
      color: C.accentOn,
      fontFamily: FONTS.textBold,
      fontSize: 16,
    },

    link: {
      alignSelf: "center",
      paddingVertical: 10,
    },

    linkText: {
      color: C.accent,
      fontFamily: FONTS.textBold,
      fontSize: 15,
    },
  })
);
