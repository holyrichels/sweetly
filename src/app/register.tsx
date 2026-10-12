import { useState } from "react";

import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Field, PrimaryButton } from "@/components/sweetly-ui";
import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { routeAfterAuth } from "@/lib/onboarding";
import { supabase } from "@/lib/supabase";

export default function RegisterScreen() {
  const router = useRouter();

  const [name, setName] = useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [confirmSent, setConfirmSent] = useState(false);

  async function submit() {
    setError(null);

    if (!name.trim()) {
      setError("Введите ваше имя");

      return;
    }

    if (!email.trim()) {
      setError("Введите почту");

      return;
    }

    if (password.length < 8) {
      setError("Пароль не короче 8 символов");

      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() } },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);

      return;
    }

    // Если подтверждение почты включено, входа ещё нет
    if (!data.session) {
      setConfirmSent(true);

      return;
    }

    await routeAfterAuth(router);
  }

  if (confirmSent) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Проверьте почту</Text>
        <Text style={styles.subtitle}>
          Мы отправили письмо для подтверждения. После него войдите в аккаунт.
        </Text>

        <PrimaryButton title="Войти" onPress={() => router.replace("/login" as any)} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable style={styles.back} onPress={() => router.replace("/welcome" as any)}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>Создать аккаунт</Text>
        <Text style={styles.subtitle}>Это займёт минуту</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>ВАШЕ ИМЯ</Text>
        <Field placeholder="Как вас зовут" value={name} onChangeText={setName} />
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
            placeholder="Придумайте пароль"
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

        <Text style={styles.hint}>Не короче 8 символов</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        title={loading ? "Создаём..." : "Создать аккаунт"}
        onPress={submit}
        disabled={loading}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Уже есть аккаунт?</Text>

        <Pressable onPress={() => router.replace("/login" as any)}>
          <Text style={styles.footerLink}>Войти</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SWEETLY.background, paddingHorizontal: 22, paddingTop: 40 },

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

  hint: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 12,
    paddingLeft: 6,
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
