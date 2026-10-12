import { useState } from "react";

import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton, Field } from "@/components/sweetly-ui";
import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { routeAfterAuth } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);

    if (!email.trim() || !password) {
      setError("Введите почту и пароль");

      return;
    }

    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("Неверная почта или пароль");

      return;
    }

    await routeAfterAuth(router);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.replace("/welcome" as any)}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>С возвращением</Text>
        <Text style={styles.subtitle}>Войдите в свой аккаунт Sweetly</Text>
      </View>

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

      <View style={styles.field}>
        <Text style={styles.label}>ПАРОЛЬ</Text>

        <View style={styles.passwordWrap}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Введите пароль"
            placeholderTextColor={SWEETLY.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />

          <Pressable style={styles.showButton} onPress={() => setShowPassword((value) => !value)}>
            <Text style={styles.showText}>{showPassword ? "Скрыть" : "Показать"}</Text>
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton title={loading ? "Входим..." : "Войти"} onPress={submit} disabled={loading} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Нет аккаунта?</Text>

        <Pressable onPress={() => router.replace("/register" as any)}>
          <Text style={styles.footerLink}>Создать</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SWEETLY.background },

  content: {
    paddingHorizontal: 22,
    paddingTop: 24,
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

  titleBlock: { gap: 6 },

  title: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 34,
  },

  subtitle: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 15,
  },

  field: { gap: 6 },

  label: {
    color: SWEETLY.muted,
    fontFamily: FONTS.textBold,
    fontSize: 13,
    letterSpacing: 0.3,
  },

  passwordWrap: {
    height: 54,
    borderRadius: 27,
    backgroundColor: SWEETLY.card,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 22,
    paddingRight: 6,
  },

  passwordInput: {
    flex: 1,
    height: 54,
    fontSize: 16,
    color: SWEETLY.text,
    fontFamily: FONTS.text,
  },

  showButton: {
    height: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
  },

  showText: {
    color: SWEETLY.muted,
    fontFamily: FONTS.textBold,
    fontSize: 13,
  },

  error: {
    color: SWEETLY.error,
    fontFamily: FONTS.textBold,
    fontSize: 14,
  },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    marginTop: 16,
  },

  footerText: {
    color: SWEETLY.muted,
    fontFamily: FONTS.textBold,
    fontSize: 15,
  },

  footerLink: {
    color: SWEETLY.accent,
    fontFamily: FONTS.textBold,
    fontSize: 15,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
});
