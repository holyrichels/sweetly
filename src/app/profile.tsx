import { useEffect, useState } from "react";

import { useRouter } from "expo-router";
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

import {
  CalendarGrid,
  FadeIn,
  formatDateISO,
  formatDateRu,
} from "@/components/date-field";
import { supabase } from "@/lib/supabase";

const GENDER_OPTIONS = ["Женский", "Мужской"];

function capitalizeFirst(text: string) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function pluralDays(count: number) {
  const last = count % 10;
  const lastTwo = count % 100;

  if (last === 1 && lastTwo !== 11) return "день";
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return "дня";

  return "дней";
}

function daysSince(value?: string | null) {
  if (!value) return 0;

  const start = new Date(`${value}T00:00:00`).getTime();

  return Math.max(0, Math.floor((Date.now() - start) / 86400000));
}

function fmtDate(value?: string | null) {
  return value ? formatDateRu(value) : null;
}

export default function ProfileScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState<string | null>(null);

  const [email, setEmail] = useState<string | null>(null);

  const [name, setName] = useState("");

  const [gender, setGender] = useState<string | null>(null);

  const [birthday, setBirthday] = useState<string | null>(null);

  const [partnerBirthday, setPartnerBirthday] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);

  const [nameDraft, setNameDraft] = useState("");

  const [savingName, setSavingName] = useState(false);

  // Какая строка сейчас раскрыта для редактирования: пол или день рождения
  const [openField, setOpenField] = useState<"gender" | "birthday" | null>(
    null,
  );

  const [couple, setCouple] = useState<any>(null);

  const [partnerName, setPartnerName] = useState<string | null>(null);

  const [timersCount, setTimersCount] = useState(0);

  const [missTotal, setMissTotal] = useState(0);

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

      setEmail(
        rawEmail && !rawEmail.endsWith("@telegram.user") ? rawEmail : null,
      );

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, gender, birthday")
        .eq("id", uid)
        .maybeSingle();

      setName(profile?.name ?? "");
      setGender(profile?.gender ?? null);
      setBirthday(profile?.birthday ?? null);

      const { data: member } = await supabase
        .from("couple_members")
        .select("couple_id")
        .eq("user_id", uid)
        .maybeSingle();

      if (!member) {
        setCouple(null);
        setPartnerName(null);
        setPartnerBirthday(null);

        return;
      }

      const coupleId = member.couple_id;

      const { data: coupleRow } = await supabase
        .from("couples")
        .select("id, relationship_status, relationship_date")
        .eq("id", coupleId)
        .maybeSingle();

      setCouple(coupleRow ?? null);

      const { data: members } = await supabase
        .from("couple_members")
        .select("user_id")
        .eq("couple_id", coupleId);

      const partnerId = members?.find((item) => item.user_id !== uid)?.user_id;

      if (partnerId) {
        const { data: partnerProfile } = await supabase
          .from("profiles")
          .select("name, birthday")
          .eq("id", partnerId)
          .maybeSingle();

        setPartnerName(partnerProfile?.name ?? "Партнёр");
        setPartnerBirthday(partnerProfile?.birthday ?? null);
      } else {
        setPartnerName(null);
        setPartnerBirthday(null);
      }

      const { data: timers } = await supabase
        .from("couple_timers")
        .select("id")
        .eq("couple_id", coupleId);

      setTimersCount((timers?.length ?? 0) + 1);

      const { data: miss } = await supabase
        .from("couple_miss_counts")
        .select("user_one_count, user_two_count")
        .eq("couple_id", coupleId)
        .maybeSingle();

      setMissTotal((miss?.user_one_count ?? 0) + (miss?.user_two_count ?? 0));
    } finally {
      setLoading(false);
    }
  }

  // Сохраняем одно поле профиля. Если политики на UPDATE нет, сообщаем об этом.
  async function saveProfileField(field: string, value: string | null) {
    if (!userId) return false;

    const { data, error } = await supabase
      .from("profiles")
      .update({ [field]: value })
      .eq("id", userId)
      .select("id");

    if (error) {
      Alert.alert("Ошибка", error.message);

      return false;
    }

    if (!data || data.length === 0) {
      Alert.alert(
        "Не удалось сохранить",
        "Нет политики на изменение профиля в Supabase.",
      );

      return false;
    }

    return true;
  }

  async function saveName() {
    const trimmed = nameDraft.trim();

    if (!trimmed) {
      Alert.alert("Ошибка", "Имя не может быть пустым");

      return;
    }

    setSavingName(true);

    try {
      if (await saveProfileField("name", trimmed)) {
        setName(trimmed);
        setEditingName(false);
      }
    } finally {
      setSavingName(false);
    }
  }

  async function pickGender(value: string) {
    if (await saveProfileField("gender", value)) {
      setGender(value);
      setOpenField(null);
    }
  }

  async function pickBirthday(value: string) {
    if (await saveProfileField("birthday", value)) {
      setBirthday(value);
    }
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

  const togetherDays = daysSince(couple?.relationship_date);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Профиль</Text>

      {/* ============ ШАПКА ============ */}

      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        {editingName ? (
          <View style={styles.editWrap}>
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
            <Pressable
              style={styles.nameRow}
              onPress={() => {
                setNameDraft(name);
                setEditingName(true);
              }}
            >
              <Text style={styles.name}>{name || "Без имени"}</Text>
              <Text style={styles.editIcon}>✎</Text>
            </Pressable>

            {email ? <Text style={styles.email}>{email}</Text> : null}
          </>
        )}
      </View>

      {/* ============ ОТНОШЕНИЯ ============ */}

      <Text style={styles.sectionLabel}>Отношения</Text>

      <View style={styles.listCard}>
        {couple ? (
          <>
            <Row
              icon="♥"
              title="Статус отношений"
              value={capitalizeFirst(
                couple.relationship_status || "влюбленные",
              )}
            />
            <Row
              icon="👤"
              title="Партнёр"
              value={partnerName ?? "ещё не присоединился"}
            />
            <Row
              icon="📅"
              title="Вместе"
              value={`${togetherDays} ${pluralDays(togetherDays)} с ${fmtDate(couple.relationship_date)}`}
              last
            />
          </>
        ) : (
          <Row icon="♥" title="Пара" value="не создана" last />
        )}
      </View>

      {/* ============ ЛИЧНОЕ ============ */}

      <Text style={styles.sectionLabel}>Личное</Text>

      <View style={styles.listCard}>
        <Pressable
          onPress={() => setOpenField(openField === "gender" ? null : "gender")}
        >
          <Row icon="⚧" title="Пол" value={gender || "не указан"} editable />
        </Pressable>

        {openField === "gender" && (
          <FadeIn>
            <View style={styles.expandBox}>
              <View style={styles.chipRow}>
                {GENDER_OPTIONS.map((option) => {
                  const active = gender === option;

                  return (
                    <Pressable
                      key={option}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => pickGender(option)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </FadeIn>
        )}

        <Pressable
          onPress={() =>
            setOpenField(openField === "birthday" ? null : "birthday")
          }
        >
          <Row
            icon="🎂"
            title="Мой день рождения"
            value={fmtDate(birthday) ?? "не указан"}
            editable
          />
        </Pressable>

        {openField === "birthday" && (
          <FadeIn>
            <View style={styles.expandBox}>
              <CalendarGrid
                value={birthday ?? formatDateISO(new Date())}
                onChange={pickBirthday}
              />

              <Pressable
                style={styles.doneButton}
                onPress={() => setOpenField(null)}
              >
                <Text style={styles.doneButtonText}>Готово</Text>
              </Pressable>
            </View>
          </FadeIn>
        )}

        <Row
          icon="🎁"
          title="День рождения партнёра"
          value={
            partnerName
              ? (fmtDate(partnerBirthday) ?? "не указан")
              : "партнёр не присоединился"
          }
          last
        />
      </View>

      {/* ============ СТАТИСТИКА ============ */}

      {couple ? (
        <>
          <Text style={styles.sectionLabel}>Статистика</Text>

          <View style={styles.bigStatCard}>
            <Text style={styles.bigStatLabel}>ДНЕЙ ВМЕСТЕ</Text>
            <Text style={styles.bigStatNumber}>{togetherDays}</Text>
          </View>

          <View style={styles.smallStatRow}>
            <View style={styles.smallStatCard}>
              <Text style={styles.smallStatNumber}>{timersCount}</Text>
              <Text style={styles.smallStatLabel}>Таймеров</Text>
            </View>

            <View style={styles.smallStatCard}>
              <Text style={styles.smallStatNumber}>{missTotal}</Text>
              <Text style={styles.smallStatLabel}>Скучаю</Text>
            </View>
          </View>
        </>
      ) : null}

      {/* ============ НАСТРОЙКИ ============ */}

      <Text style={styles.sectionLabel}>Другое</Text>

      <Pressable
        style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
        onPress={() => router.push("/settings" as any)}
      >
        <View style={styles.rowIcon}>
          <Text style={styles.rowIconText}>⚙️</Text>
        </View>
        <Text style={styles.settingsTitle}>Настройки</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({
  icon,
  title,
  value,
  last,
  editable,
}: {
  icon: string;
  title: string;
  value: string;
  last?: boolean;
  editable?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.rowIcon}>
        <Text style={styles.rowIconText}>{icon}</Text>
      </View>

      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>

      {editable ? <Text style={styles.editChevron}>⌄</Text> : null}
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

  pressed: {
    opacity: 0.7,
  },

  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 26,
    padding: 22,
    alignItems: "center",
    shadowColor: "#9b6676",
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },

  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#e98ca8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  avatarText: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "800",
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  name: {
    color: "#35242a",
    fontSize: 20,
    fontWeight: "800",
  },

  editIcon: {
    color: "#e98ca8",
    fontSize: 16,
    fontWeight: "800",
  },

  email: {
    color: "#92767f",
    fontSize: 13,
    marginTop: 4,
  },

  editWrap: {
    width: "100%",
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

  sectionLabel: {
    color: "#624850",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 24,
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

  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fdeef3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  rowIconText: {
    fontSize: 16,
  },

  rowTextWrap: {
    flex: 1,
  },

  rowTitle: {
    color: "#92767f",
    fontSize: 12,
    fontWeight: "600",
  },

  rowValue: {
    color: "#35242a",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
  },

  editChevron: {
    color: "#c98aa0",
    fontSize: 16,
    fontWeight: "800",
    marginLeft: 8,
  },

  expandBox: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f5e6ec",
  },

  chipRow: {
    flexDirection: "row",
    gap: 8,
  },

  chip: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#fff5f8",
    alignItems: "center",
    justifyContent: "center",
  },

  chipActive: {
    backgroundColor: "#e98ca8",
  },

  chipText: {
    color: "#8a6b74",
    fontSize: 14,
    fontWeight: "700",
  },

  chipTextActive: {
    color: "#ffffff",
  },

  doneButton: {
    marginTop: 10,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#e98ca8",
    alignItems: "center",
    justifyContent: "center",
  },

  doneButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  bigStatCard: {
    backgroundColor: "#e98ca8",
    borderRadius: 24,
    padding: 22,
  },

  bigStatLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    opacity: 0.85,
  },

  bigStatNumber: {
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "800",
    marginTop: 4,
  },

  smallStatRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },

  smallStatCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#9b6676",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  smallStatNumber: {
    color: "#35242a",
    fontSize: 24,
    fontWeight: "800",
  },

  smallStatLabel: {
    color: "#92767f",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },

  settingsRow: {
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

  settingsTitle: {
    flex: 1,
    color: "#35242a",
    fontSize: 16,
    fontWeight: "800",
  },

  chevron: {
    color: "#c98aa0",
    fontSize: 24,
    fontWeight: "700",
  },
});
