import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { supabase } from "@/lib/supabase";

export default function SettingsScreen() {
  const router = useRouter();

  function confirmLogout() {
    Alert.alert("Выйти из аккаунта?", "Войти можно снова в любой момент.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Выйти",
        style: "destructive",
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>‹ Назад</Text>
      </Pressable>

      <Text style={styles.title}>Настройки</Text>

      <Pressable style={styles.logoutButton} onPress={confirmLogout}>
        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff5f8",
    paddingHorizontal: 18,
    paddingTop: 65,
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
    color: "#e98ca8",
    fontSize: 16,
    fontWeight: "800",
  },

  title: {
    color: "#35242a",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 24,
  },

  logoutButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f3c9d4",
    alignItems: "center",
    justifyContent: "center",
  },

  logoutText: {
    color: "#d9536f",
    fontSize: 15,
    fontWeight: "800",
  },
});
