import { useEffect, useState } from "react";

import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";

import { refreshAppData, useAppData } from "@/lib/app-data";
import { supabase } from "@/lib/supabase";

// Имя бота без @. Поменяй, если выбрал другой username в BotFather.
const BOT_USERNAME = "sweetly_couple_bot";

// На вебе многокнопочный Alert не показывается, поэтому там используем окна браузера
function notify(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: "Отмена", style: "cancel" },
      { text: "Подтвердить", style: "destructive", onPress: onConfirm },
    ]);
  }
}

export default function SettingsScreen() {
  const router = useRouter();



  const [passwordOpen, setPasswordOpen] = useState(false);

  const [newPassword, setNewPassword] = useState("");

  const [repeatPassword, setRepeatPassword] = useState("");

  const [savingPassword, setSavingPassword] = useState(false);


  const [linkingTelegram, setLinkingTelegram] = useState(false);

  // Почта и статус Telegram берутся из общего хранилища, страница открывается сразу
  const appData = useAppData();

  const email = appData.telegramOnly ? null : appData.email;

  const isTelegramOnly = appData.telegramOnly;

  const telegramLinked = appData.telegramLinked;

  // Обновляем статус привязки при открытии, например после возврата из бота
  useEffect(() => {
    refreshAppData();
  }, []);

  // Создаём одноразовый код и открываем бота с ним. Бот связывает Telegram после «Старт».
  async function linkTelegram() {
    setLinkingTelegram(true);

    try {
      const { data, error } = await supabase.functions.invoke("notify-partner", {
        body: { action: "create_link_code" },
      });

      if (error || !data?.code) {
        notify("Ошибка", error?.message ?? "Не удалось создать ссылку");

        return;
      }

      await Linking.openURL(`https://t.me/${BOT_USERNAME}?start=${data.code}`);
    } finally {
      setLinkingTelegram(false);
    }
  }

  async function copyEmail() {
    if (!email) return;

    await Clipboard.setStringAsync(email);

    notify("Скопировано", email);
  }

  async function savePassword() {
    if (newPassword.length < 6) {
      notify("Слишком короткий пароль", "Минимум 6 символов");

      return;
    }

    if (newPassword !== repeatPassword) {
      notify("Пароли не совпадают", "Введите одинаковый пароль дважды");

      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        notify("Ошибка", error.message);

        return;
      }

      setNewPassword("");
      setRepeatPassword("");
      setPasswordOpen(false);
      notify("Готово", "Пароль изменён");
    } finally {
      setSavingPassword(false);
    }
  }

  function logout() {
    confirmAction(
      "Выйти из аккаунта?",
      "Войти можно снова в любой момент.",
      async () => {
        await supabase.auth.signOut();
        router.replace("/");
      },
    );
  }

  function confirmDelete() {
    confirmAction(
      "Удалить аккаунт?",
      "Все ваши данные будут удалены без возможности восстановления.",
      () =>
        confirmAction("Точно удалить?", "Это действие нельзя отменить.", deleteAccount),
    );
  }

  async function deleteAccount() {
    const { data, error } = await supabase.functions.invoke("delete-account");

    if (error || data?.error) {
      notify("Не удалось удалить", error?.message ?? data?.error ?? "Ошибка");

      return;
    }

    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>‹ Назад</Text>
      </Pressable>

      <Text style={styles.title}>Настройки</Text>

      <Text style={styles.sectionLabel}>Аккаунт</Text>

      <View style={styles.listCard}>
        {email ? (
          <Pressable style={styles.row} onPress={copyEmail}>
            <View style={styles.icon}>
              <Text style={styles.iconText}>@</Text>
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.value}>{email}</Text>
              <Text style={styles.hint}>Почта аккаунта — нажмите, чтобы скопировать</Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.row}>
            <View style={styles.icon}>
              <Text style={styles.iconText}>✈️</Text>
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.value}>Вход через Telegram</Text>
              <Text style={styles.hint}>Почты у аккаунта нет</Text>
            </View>
          </View>
        )}

        {!isTelegramOnly && (
          <>
            <Pressable
              style={styles.row}
              onPress={() => setPasswordOpen((open) => !open)}
            >
              <View style={styles.icon}>
                <Text style={styles.iconText}>🔒</Text>
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.value}>Сменить пароль</Text>
                <Text style={styles.hint}>Придумайте новый пароль</Text>
              </View>
              <Text style={styles.chevron}>{passwordOpen ? "⌃" : "›"}</Text>
            </Pressable>

            {passwordOpen && (
              <View style={styles.expandBox}>
                <TextInput
                  style={styles.input}
                  placeholder="Новый пароль"
                  placeholderTextColor="#b9a2aa"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Повторите пароль"
                  placeholderTextColor="#b9a2aa"
                  secureTextEntry
                  value={repeatPassword}
                  onChangeText={setRepeatPassword}
                />
                <Pressable
                  style={styles.primaryButton}
                  onPress={savePassword}
                  disabled={savingPassword}
                >
                  <Text style={styles.primaryButtonText}>
                    {savingPassword ? "Сохраняем..." : "Сохранить пароль"}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        <Pressable
          style={styles.row}
          onPress={telegramLinked ? undefined : linkTelegram}
          disabled={telegramLinked || linkingTelegram}
        >
          <View style={styles.icon}>
            <Text style={styles.iconText}>✈️</Text>
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.value}>Telegram</Text>
            <Text style={styles.hint}>
              {telegramLinked
                ? "Уведомления от партнёра приходят в бота"
                : "Нажмите, затем «Старт» в боте, чтобы получать уведомления"}
            </Text>
          </View>
          {!telegramLinked && <Text style={styles.chevron}>›</Text>}
        </Pressable>

        <Pressable style={[styles.row, styles.rowLast]} onPress={logout}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>↪</Text>
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.value}>Выйти из аккаунта</Text>
          </View>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>Опасная зона</Text>

      <Pressable style={styles.dangerCard} onPress={confirmDelete}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>🗑</Text>
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.dangerTitle}>Удалить аккаунт</Text>
          <Text style={styles.hint}>Вместе со всеми записями, без возврата</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFF1F0",
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 65,
    paddingBottom: 70,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },

  back: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    marginBottom: 12,
  },

  backText: {
    color: "#C23A62",
    fontSize: 16,
    fontWeight: "800",
  },

  title: {
    color: "#3B1F2B",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },

  sectionLabel: {
    color: "#7A5A66",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 22,
    marginBottom: 10,
  },

  listCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#9b6676",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f5e6ec",
  },

  rowLast: {
    borderBottomWidth: 0,
  },

  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFE6DB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  iconAccent: {
    backgroundColor: "#C23A62",
  },

  iconDanger: {
    backgroundColor: "#d9536f",
  },

  iconText: {
    fontSize: 16,
    color: "#3B1F2B",
    fontWeight: "800",
  },

  textWrap: {
    flex: 1,
  },

  value: {
    color: "#3B1F2B",
    fontSize: 15,
    fontWeight: "800",
  },

  hint: {
    color: "#7A5A66",
    fontSize: 12,
    marginTop: 2,
  },

  chevron: {
    color: "#c98aa0",
    fontSize: 22,
    fontWeight: "700",
    marginLeft: 8,
  },

  expandBox: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f5e6ec",
  },

  input: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E3B7C2",
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#3B1F2B",
    backgroundColor: "#ffffff",
  },

  primaryButton: {
    height: 44,
    borderRadius: 14,
    backgroundColor: "#C23A62",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  dangerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#9b6676",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  dangerTitle: {
    color: "#d9536f",
    fontSize: 15,
    fontWeight: "800",
  },
});
