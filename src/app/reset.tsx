import { useState } from "react";

import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Field, PrimaryButton } from "@/components/sweetly-ui";
import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { supabase } from "@/lib/supabase";

// Адрес, куда придёт пользователь из письма: текущий сайт
function siteUrl() {
  return typeof window !== "undefined" ? window.location.origin : undefined;
}

export default function ResetScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [sentTo, setSentTo] = useState<string | null>(null);

  async function send() {
    setError(null);

    const value = email.trim();

    if (!value) {
      setError("Введите почту аккаунта");

      return;
    }

    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(value, {
      redirectTo: siteUrl(),
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);

      return;
    }

    setSentTo(value);
  }

  // Экран «Проверьте почту»
  if (sentTo) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Проверьте почту</Text>

        <Text style={styles.subtitle}>
          Мы отправили ссылку для сброса пароля на {sentTo}. Если письма нет, загляните в «Спам».
        </Text>

        <PrimaryButton title="Вернуться ко входу" onPress={() => router.replace("/login" as any)} />

        <Pressable style={styles.link} onPress={send} disabled={loading}>
          <Text style={styles.linkText}>{loading ? "Отправляем..." : "Отправить ещё раз"}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.replace("/login" as any)}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>

      <Text style={styles.title}>Восстановление пароля</Text>

      <Text style={styles.subtitle}>
        Введите почту аккаунта — мы отправим ссылку, чтобы задать новый пароль.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>ПОЧТА</Text>
        <Field
          placeholder="name@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton title={loading ? "Отправляем..." : "Отправить ссылку"} onPress={send} disabled={loading} />

      <Pressable style={styles.link} onPress={() => router.replace("/login" as any)}>
        <Text style={styles.linkText}>Вернуться ко входу</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SWEETLY.background },

  content: {
    paddingHorizontal: 22,
    paddingTop: 40,
    paddingBottom: 40,
    gap: 14,
  },

  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SWEETLY.card,
    alignItems: "center",
    justifyContent: "center",
  },

  backText: {
    color: SWEETLY.text,
    fontSize: 26,
    marginTop: -4,
  },

  title: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 32,
  },

  subtitle: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 15,
    lineHeight: 22,
  },

  field: { gap: 6 },

  label: {
    color: SWEETLY.muted,
    fontFamily: FONTS.textBold,
    fontSize: 13,
    letterSpacing: 0.3,
  },

  error: {
    color: SWEETLY.error,
    fontFamily: FONTS.textBold,
    fontSize: 14,
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
