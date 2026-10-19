import { useMemo, useState } from "react";

import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import NotifyToggles from "@/components/notify-toggles";
import SubHeader from "@/components/sub-header";
import { Field, PrimaryButton, SecondaryButton, SectionLabel } from "@/components/sweetly-ui";
import { ACCENTS, AccentName, FONTS } from "@/constants/sweetly-theme";
import { useColors } from "@/lib/theme";
import { clearAppData, refreshAppData, useAppData } from "@/lib/app-data";
import { confirmAction, notify } from "@/lib/dialogs";
import { supabase } from "@/lib/supabase";

const CHEVRON = "M9 6l6 6-6 6";

export default function SettingsScreen() {
  const c = useColors();

  const styles = useMemo(() => makeStyles(c), [c]);

  const router = useRouter();

  const app = useAppData();

  const [passwordOpen, setPasswordOpen] = useState(false);

  const [newPassword, setNewPassword] = useState("");

  const [repeatPassword, setRepeatPassword] = useState("");

  const [saving, setSaving] = useState(false);

  // Сохраняем выбор оформления в профиле: тема и акцентный цвет
  async function saveAppearance(field: "theme" | "accent", value: string) {
    if (!app.userId) return;

    const { error } = await supabase.from("profiles").update({ [field]: value }).eq("id", app.userId);

    if (error) {
      notify("Ошибка", error.message);

      return;
    }

    await refreshAppData();
  }

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
              <Path d={CHEVRON} fill="none" stroke={c.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>

          <Pressable style={styles.row} onPress={() => setPasswordOpen((open) => !open)}>
            <View style={styles.flex}>
              <Text style={styles.rowValue}>Сменить пароль</Text>
            </View>

            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path d={CHEVRON} fill="none" stroke={c.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
        <SectionLabel>ОФОРМЛЕНИЕ</SectionLabel>

        <View style={styles.appearanceCard}>
          <View style={styles.segment}>
            {(["light", "dark", "auto"] as const).map((value) => {
              const active = (app.me?.theme ?? "light") === value;

              return (
                <Pressable
                  key={value}
                  style={[styles.segmentItem, active && styles.segmentItemActive]}
                  onPress={() => saveAppearance("theme", value)}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {value === "light" ? "Светлая" : value === "dark" ? "Тёмная" : "Авто"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.accentRow}>
            <Text style={styles.accentLabel}>Акцентный цвет</Text>

            <View style={styles.swatches}>
              {(Object.keys(ACCENTS) as AccentName[]).map((name) => {
                const active = (app.me?.accent ?? "rose") === name;

                return (
                  <View key={name} style={styles.swatchItem}>
                    <Pressable
                      accessibilityLabel={ACCENTS[name].label}
                      style={[
                        styles.swatch,
                        { backgroundColor: ACCENTS[name].color },
                        active && styles.swatchActive,
                      ]}
                      onPress={() => saveAppearance("accent", name)}
                    >
                      {active && (
                        <Svg width={18} height={18} viewBox="0 0 24 24">
                          <Path d="M5 12l5 5 9-10" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                      )}
                    </Pressable>

                    <Text style={styles.swatchLabel}>{ACCENTS[name].label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </View>

      <View>
        <SectionLabel>УВЕДОМЛЕНИЯ</SectionLabel>

        <NotifyToggles />

        {!app.telegramLinked && (
          <Text style={styles.hint}>Сообщения придут после привязки Telegram.</Text>
        )}
      </View>

      <Pressable style={styles.outlineButton} onPress={logout}>
        <Text style={styles.outlineText}>Выйти из аккаунта</Text>
      </Pressable>

      <Pressable style={styles.dangerButton} onPress={deleteAccount}>
        <Text style={styles.dangerText}>Удалить аккаунт</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  appearanceCard: {
    backgroundColor: c.card,
    borderRadius: 24,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },

  segment: {
    flexDirection: "row",
    backgroundColor: c.background,
    borderRadius: 24,
    padding: 4,
    gap: 4,
  },

  segmentItem: {
    flex: 1,
    minWidth: 0,
    height: 44,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  segmentItemActive: {
    backgroundColor: c.accent,
  },

  segmentText: {
    color: c.text,
    fontFamily: FONTS.textBold,
    fontSize: 14,
  },

  segmentTextActive: {
    color: "#FFFFFF",
  },

  accentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  accentLabel: {
    color: c.text,
    fontFamily: FONTS.textBold,
    fontSize: 15,
  },

  swatches: {
    flexDirection: "row",
    gap: 8,
  },

  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  screen: { flex: 1, backgroundColor: c.background },

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
    backgroundColor: c.card,
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
    borderBottomColor: c.divider,
  },

  rowLabel: {
    color: c.muted,
    fontFamily: FONTS.text,
    fontSize: 13,
  },

  rowValue: {
    color: c.text,
    fontFamily: FONTS.textBold,
    fontSize: 17,
    marginTop: 2,
  },

  passwordBox: {
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: c.divider,
  },

  hint: {
    color: c.muted,
    fontFamily: FONTS.text,
    fontSize: 13,
    marginTop: 8,
    paddingHorizontal: 6,
  },

  swatchItem: {
    alignItems: "center",
    gap: 4,
  },

  swatchActive: {
    borderWidth: 3,
    borderColor: c.text,
  },

  swatchLabel: {
    color: c.muted,
    fontFamily: FONTS.text,
    fontSize: 12,
  },

  outlineButton: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: c.text,
    alignItems: "center",
    justifyContent: "center",
  },

  outlineText: {
    color: c.text,
    fontFamily: FONTS.textBold,
    fontSize: 16,
  },

  dangerButton: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: c.error,
    alignItems: "center",
    justifyContent: "center",
  },

  dangerText: {
    color: c.error,
    fontFamily: FONTS.textBold,
    fontSize: 16,
  },
});
}
