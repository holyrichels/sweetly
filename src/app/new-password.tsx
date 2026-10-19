import { useState } from "react";

import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Field, PrimaryButton } from "@/components/sweetly-ui";
import { FONTS, C, liveStyles } from "@/constants/sweetly-theme";
import { notify } from "@/lib/dialogs";
import { supabase } from "@/lib/supabase";

// Открывается по ссылке из письма о сбросе пароля
export default function NewPasswordScreen() {
  const router = useRouter();

  const [password, setPassword] = useState("");

  const [repeat, setRepeat] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);

    if (password.length < 8) {
      setError("Пароль не короче 8 символов");

      return;
    }

    if (password !== repeat) {
      setError("Пароли не совпадают");

      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);

      return;
    }

    notify("Готово", "Пароль изменён");

    router.replace("/" as any);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Новый пароль</Text>

      <Text style={styles.subtitle}>Придумайте пароль, который вы ещё не использовали.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>НОВЫЙ ПАРОЛЬ</Text>
        <Field placeholder="Не короче 8 символов" secureTextEntry autoCapitalize="none" value={password} onChangeText={setPassword} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>ПОВТОРИТЕ ПАРОЛЬ</Text>
        <Field placeholder="Повторите пароль" secureTextEntry autoCapitalize="none" value={repeat} onChangeText={setRepeat} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton title={loading ? "Сохраняем..." : "Сохранить пароль"} onPress={save} disabled={loading} />
    </ScrollView>
  );
}

const styles = liveStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },

  content: {
    paddingHorizontal: 22,
    paddingTop: 60,
    paddingBottom: 40,
    gap: 14,
  },

  title: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 32,
  },

  subtitle: {
    color: C.muted,
    fontFamily: FONTS.text,
    fontSize: 15,
    lineHeight: 22,
  },

  field: { gap: 6 },

  label: {
    color: C.muted,
    fontFamily: FONTS.textBold,
    fontSize: 13,
    letterSpacing: 0.3,
  },

  error: {
    color: C.error,
    fontFamily: FONTS.textBold,
    fontSize: 14,
  },
}));
