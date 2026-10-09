import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "@/lib/supabase";

function formatDateRu(value?: string | null) {
  if (!value) return "не указана";

  return new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState<string | null>(null);

  const [email, setEmail] = useState<string | null>(null);

  const [name, setName] = useState("");

  const [editingName, setEditingName] = useState(false);

  const [nameDraft, setNameDraft] = useState("");

  const [savingName, setSavingName] = useState(false);

  const [couple, setCouple] = useState<any>(null);

  const [partnerName, setPartnerName] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);

        return;
      }

      const uid = session.user.id;

      setUserId(uid);

      const rawEmail = session.user.email ?? null;

      // Аккаунты, созданные через Telegram, имеют служебную почту, её не показываем
      setEmail(
        rawEmail && !rawEmail.endsWith("@telegram.user") ? rawEmail : null,
      );

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", uid)
        .maybeSingle();

      setName(profile?.name ?? "");

      const { data: member } = await supabase
        .from("couple_members")
        .select("couple_id")
        .eq("user_id", uid)
        .maybeSingle();

      if (!member) {
        setCouple(null);
        setPartnerName(null);

        return;
      }

      const { data: coupleRow } = await supabase
        .from("couples")
        .select("id, invite_code, relationship_status, relationship_date")
        .eq("id", member.couple_id)
        .maybeSingle();

      setCouple(coupleRow ?? null);

      const { data: members } = await supabase
        .from("couple_members")
        .select("user_id")
        .eq("couple_id", member.couple_id);

      const partnerId = members?.find((item) => item.user_id !== uid)?.user_id;

      if (partnerId) {
        const { data: partnerProfile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", partnerId)
          .maybeSingle();

        setPartnerName(partnerProfile?.name ?? "Партнёр");
      } else {
        setPartnerName(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    const trimmed = nameDraft.trim();

    if (!trimmed || !userId) {
      Alert.alert("Ошибка", "Имя не может быть пустым");

      return;
    }

    setSavingName(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ name: trimmed })
        .eq("id", userId)
        .select("id");

      if (error) {
        Alert.alert("Ошибка", error.message);

        return;
      }

      if (!data || data.length === 0) {
        Alert.alert(
          "Не удалось сохранить",
          "Нет политики на изменение профиля в Supabase.",
        );

        return;
      }

      setName(trimmed);
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  }

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e98ca8" />
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>👤</Text>
        <Text style={styles.emptyTitle}>Вы не вошли</Text>
        <Text style={styles.emptyText}>Войдите, чтобы увидеть профиль.</Text>
      </View>
    );
  }

  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Профиль</Text>

      {/* ============ ПОЛЬЗОВАТЕЛЬ ============ */}

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        {editingName ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.input}
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Ваше имя"
              placeholderTextColor="#b9a2aa"
              autoFocus
            />

            <View style={styles.editButtons}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setEditingName(false)}
              >
                <Text style={styles.secondaryButtonText}>Отмена</Text>
              </Pressable>

              <Pressable
                style={styles.primaryButton}
                onPress={saveName}
                disabled={savingName}
              >
                <Text style={styles.primaryButtonText}>
                  {savingName ? "Сохраняем..." : "Сохранить"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{name || "Без имени"}</Text>

              <Pressable
                onPress={() => {
                  setNameDraft(name);
                  setEditingName(true);
                }}
              >
                <Text style={styles.editLink}>Изменить</Text>
              </Pressable>
            </View>

            {email ? <Text style={styles.email}>{email}</Text> : null}
          </>
        )}
      </View>

      {/* ============ ПАРА ============ */}

      <Text style={styles.sectionLabel}>Ваша пара</Text>

      <View style={styles.card}>
        {couple ? (
          <>
            <Row
              label="Партнёр"
              value={partnerName ?? "ещё не присоединился"}
            />
            <Row
              label="Статус"
              value={couple.relationship_status || "влюбленные"}
            />
            <Row
              label="Вместе с"
              value={formatDateRu(couple.relationship_date)}
            />
            {couple.invite_code ? (
              <Row label="Код приглашения" value={couple.invite_code} />
            ) : null}
          </>
        ) : (
          <Text style={styles.emptyText}>
            Вы пока не в паре. Создайте пару или присоединитесь по коду на
            главной.
          </Text>
        )}
      </View>

      {/* ============ ВЫХОД ============ */}

      <Pressable style={styles.logoutButton} onPress={confirmLogout}>
        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff5f8",
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 65,
    paddingBottom: 70,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },

  center: {
    flex: 1,
    backgroundColor: "#fff5f8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },

  emptyEmoji: {
    fontSize: 40,
    marginBottom: 14,
  },

  emptyTitle: {
    color: "#35242a",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },

  emptyText: {
    color: "#92767f",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  pageTitle: {
    color: "#35242a",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 20,
  },

  sectionLabel: {
    color: "#624850",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 10,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    shadowColor: "#9b6676",
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#e98ca8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  avatarText: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "800",
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  name: {
    color: "#35242a",
    fontSize: 20,
    fontWeight: "800",
  },

  editLink: {
    color: "#e98ca8",
    fontSize: 14,
    fontWeight: "700",
  },

  email: {
    color: "#92767f",
    fontSize: 13,
    marginTop: 4,
  },

  editRow: {
    gap: 12,
  },

  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ead5dc",
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#35242a",
    backgroundColor: "#ffffff",
  },

  editButtons: {
    flexDirection: "row",
    gap: 10,
  },

  primaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#e98ca8",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  secondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fff5f8",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonText: {
    color: "#8a6b74",
    fontSize: 15,
    fontWeight: "700",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f5e6ec",
  },

  rowLabel: {
    color: "#92767f",
    fontSize: 14,
    fontWeight: "600",
  },

  rowValue: {
    color: "#35242a",
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
    textAlign: "right",
    marginLeft: 12,
  },

  logoutButton: {
    marginTop: 28,
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
