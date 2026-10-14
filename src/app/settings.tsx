import { useState } from "react";

import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import NotifyToggles from "@/components/notify-toggles";
import SubHeader from "@/components/sub-header";
import { Field, PrimaryButton, SecondaryButton, SectionLabel } from "@/components/sweetly-ui";
import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { clearAppData, useAppData } from "@/lib/app-data";
import { confirmAction, notify } from "@/lib/dialogs";
import { supabase } from "@/lib/supabase";

const CHEVRON = "M9 6l6 6-6 6";

export default function SettingsScreen() {
  const router = useRouter();

  const app = useAppData();

  const [passwordOpen, setPasswordOpen] = useState(false);

  const [newPassword, setNewPassword] = useState("");

  const [repeatPassword, setRepeatPassword] = useState("");

  const [saving, setSaving] = useState(false);

  async function copyEmail() {
    if (!app.email) return;

    await Clipboard.setStringAsync(app.email);

    notify("Скопировано", app.email);
  }

  async function savePassword() {
    if (newPassword.length < 8) {
      notify("Слишком короткий пароль", "Минимум 8 символов");

      return;
    }

    if (newPassword !== repeatPassword) {
      notify("Пароли не совпадают", "Введите одинаковый пароль дважды");

      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setSaving(false);

    if (error) {
      notify("Ошибка", error.message);

      return;
    }

    setNewPassword("");
    setRepeatPassword("");
    setPasswordOpen(false);

    notify("Готово", "Пароль изменён");
  }

  function logout() {
    confirmAction("Выйти из аккаунта?", "Войти можно снова в любой момент.", async () => {
      await supabase.auth.signOut();

      clearAppData();

      router.replace("/welcome" as any);
    }, "Выйти");
  }

  function deleteAccount() {
    confirmAction(
      "Удалить аккаунт?",
      "Все ваши данные будут удалены без возможности восстановления.",
      () =>
        confirmAction("Точно удалить?", "Это действие нельзя отменить.", async () => {
          const { data, error } = await supabase.functions.invoke("delete-account");

          if (error || data?.error) {
            notify("Не удалось удалить", error?.message ?? data?.error ?? "Ошибка");

            return;
          }

          await supabase.auth.signOut();

          clearAppData();

          router.replace("/welcome" as any);
        }, "Удалить навсегда"),
      "Продолжить",
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SubHeader title="Настройки" />

      <View>
        <SectionLabel>АККАУНТ</SectionLabel>

        <View style={styles.card}>
          <Pressable style={[styles.row, styles.border]} onPress={copyEmail} disabled={!app.email}>
            <View style={styles.flex}>
              <Text style={styles.rowLabel}>Почта</Text>
              <Text style={styles.rowValue}>{app.email ?? "не указана"}</Text>
            </View>
          </Pressable>

          <Pressable style={[styles.row, styles.border]} onPress={() => router.push("/notifications" as any)}>
            <View style={styles.flex}>
              <Text style={styles.rowLabel}>Telegram</Text>
              <Text style={styles.rowValue}>
                {app.telegramLinked
                  ? app.telegramUsername
                    ? `@${app.telegramUsername}`
                    : "Привязан"
                  : "Не привязан"}
              </Text>
            </View>

            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path d={CHEVRON} fill="none" stroke={SWEETLY.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>

          <Pressable style={styles.row} onPress={() => setPasswordOpen((open) => !open)}>
            <View style={styles.flex}>
              <Text style={styles.rowValue}>Сменить пароль</Text>
            </View>

            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path d={CHEVRON} fill="none" stroke={SWEETLY.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>

          {passwordOpen && (
            <View style={styles.passwordBox}>
              <Field
                placeholder="Новый пароль"
                secureTextEntry
                autoCapitalize="none"
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <Field
                placeholder="Повторите пароль"
                secureTextEntry
                autoCapitalize="none"
                value={repeatPassword}
                onChangeText={setRepeatPassword}
              />

              <PrimaryButton title={saving ? "Сохраняем..." : "Сохранить пароль"} onPress={savePassword} disabled={saving} />
            </View>
          )}
        </View>
      </View>

      <View>
        <SectionLabel>УВЕДОМЛЕНИЯ</SectionLabel>

        <NotifyToggles />

        {!app.telegramLinked && (
          <Text style={styles.hint}>Сообщения придут после привязки Telegram.</Text>
        )}
      </View>

      <SecondaryButton title="Выйти из аккаунта" onPress={logout} />

      <Pressable style={styles.danger} onPress={deleteAccount}>
        <Text style={styles.dangerText}>Удалить аккаунт</Text>
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
    gap: 22,
  },

  flex: { flex: 1 },

  card: {
    backgroundColor: SWEETLY.card,
    borderRadius: 28,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 64,
  },

  border: {
    borderBottomWidth: 1,
    borderBottomColor: SWEETLY.divider,
  },

  rowLabel: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 13,
  },

  rowValue: {
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 17,
    marginTop: 2,
  },

  passwordBox: {
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: SWEETLY.divider,
  },

  hint: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 13,
    marginTop: 8,
    paddingHorizontal: 6,
  },

  danger: {
    alignSelf: "center",
    paddingVertical: 12,
  },

  dangerText: {
    color: SWEETLY.error,
    fontFamily: FONTS.textBold,
    fontSize: 15,
  },
});
