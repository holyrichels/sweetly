import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import PageHeader from "@/components/page-header";
import { CalendarGrid, FadeIn, formatDateISO, formatDateRu } from "@/components/date-field";
import SecureImage from "@/components/secure-image";
import { supabase } from "@/lib/supabase";

type Memory = {
  id: string;
  created_by: string;
  photo_path: string;
  caption: string;
  memory_date: string;
};

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
      { text: "Удалить", style: "destructive", onPress: onConfirm },
    ]);
  }
}

export default function MemoriesScreen() {
  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState<string | null>(null);

  const [coupleId, setCoupleId] = useState<string | null>(null);

  const [memories, setMemories] = useState<Memory[]>([]);

  const [creating, setCreating] = useState(false);

  const [pickedUri, setPickedUri] = useState<string | null>(null);

  const [pickedBase64, setPickedBase64] = useState<string | null>(null);

  const [caption, setCaption] = useState("");

  const [memoryDate, setMemoryDate] = useState(formatDateISO(new Date()));

  const [showCalendar, setShowCalendar] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const uid = session.user.id;

      setUserId(uid);

      const { data: member } = await supabase
        .from("couple_members")
        .select("couple_id")
        .eq("user_id", uid)
        .maybeSingle();

      if (!member) return;

      setCoupleId(member.couple_id);

      await loadMemories(member.couple_id);
    } finally {
      setLoading(false);
    }
  }

  async function loadMemories(cid: string) {
    const { data } = await supabase
      .from("couple_memories")
      .select("id, created_by, photo_path, caption, memory_date")
      .eq("couple_id", cid)
      .order("memory_date", { ascending: false })
      .order("created_at", { ascending: false });

    setMemories(data ?? []);
  }

  // Realtime: новые и удалённые воспоминания появляются у обоих сразу
  useEffect(() => {
    if (!coupleId) return;

    const channel = supabase
      .channel(`memories-${coupleId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "couple_memories", filter: `couple_id=eq.${coupleId}` },
        () => {
          loadMemories(coupleId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId]);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted && permission.canAskAgain !== false) {
      notify("Нужен доступ", "Разрешите доступ к фото, чтобы добавить воспоминание.");

      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    setPickedUri(result.assets[0].uri);
    setPickedBase64(result.assets[0].base64);
  }

  function resetForm() {
    setCreating(false);
    setPickedUri(null);
    setPickedBase64(null);
    setCaption("");
    setMemoryDate(formatDateISO(new Date()));
    setShowCalendar(false);
  }

  async function saveMemory() {
    if (!coupleId || !userId || !pickedBase64) {
      notify("Нет фото", "Выберите фото для воспоминания.");

      return;
    }

    setSaving(true);

    try {
      const binary = atob(pickedBase64);
      const bytes = new Uint8Array(binary.length);

      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const path = `${coupleId}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("memories")
        .upload(path, bytes, { contentType: "image/jpeg" });

      if (uploadError) {
        notify("Ошибка", uploadError.message);

        return;
      }

      const { error } = await supabase.from("couple_memories").insert({
        couple_id: coupleId,
        created_by: userId,
        photo_path: path,
        caption: caption.trim(),
        memory_date: memoryDate,
      });

      if (error) {
        notify("Ошибка", error.message);

        return;
      }

      resetForm();
      await loadMemories(coupleId);
    } catch (error) {
      notify("Ошибка", (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function removeMemory(memory: Memory) {
    confirmAction("Удалить воспоминание?", "Фото и подпись будут удалены.", async () => {
      await supabase.storage.from("memories").remove([memory.photo_path]);

      const { error } = await supabase.from("couple_memories").delete().eq("id", memory.id);

      if (error) {
        notify("Ошибка", error.message);

        return;
      }

      if (coupleId) await loadMemories(coupleId);
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e98ca8" />
      </View>
    );
  }

  if (!coupleId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>📸</Text>
        <Text style={styles.emptyTitle}>Воспоминаний пока нет</Text>
        <Text style={styles.emptyText}>Сначала создайте пару или присоединитесь по коду.</Text>
      </View>
    );
  }

  // Группируем по годам, новые сверху
  const years = Array.from(new Set(memories.map((m) => m.memory_date.slice(0, 4)))).sort(
    (a, b) => Number(b) - Number(a),
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader title="Воспоминания" />

      {!creating ? (
        <Pressable style={styles.addButton} onPress={() => setCreating(true)}>
          <Text style={styles.addButtonText}>+ Добавить воспоминание</Text>
        </Pressable>
      ) : (
        <View style={styles.formCard}>
          <Pressable style={styles.photoBox} onPress={pickPhoto}>
            {pickedUri ? (
              <Image source={{ uri: pickedUri }} style={styles.photoPreview} />
            ) : (
              <Text style={styles.photoHint}>📷 Выбрать фото</Text>
            )}
          </Pressable>

          <TextInput
            style={styles.input}
            placeholder="Подпись"
            placeholderTextColor="#b9a2aa"
            value={caption}
            onChangeText={setCaption}
          />

          <Pressable style={styles.dateField} onPress={() => setShowCalendar((v) => !v)}>
            <Text style={styles.dateFieldText}>{formatDateRu(memoryDate)}</Text>
            <Text style={styles.dateFieldIcon}>{showCalendar ? "▴" : "▾"}</Text>
          </Pressable>

          {showCalendar && (
            <FadeIn>
              <CalendarGrid value={memoryDate} onChange={setMemoryDate} />
            </FadeIn>
          )}

          <View style={styles.formButtons}>
            <Pressable style={styles.secondaryButton} onPress={resetForm}>
              <Text style={styles.secondaryButtonText}>Отмена</Text>
            </Pressable>

            <Pressable style={styles.primaryButton} onPress={saveMemory} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? "Сохраняем..." : "Сохранить"}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {memories.length === 0 ? (
        <Text style={styles.emptyListText}>
          Здесь будут ваши совместные фото. Добавьте первое воспоминание.
        </Text>
      ) : (
        years.map((year) => (
          <View key={year}>
            <Text style={styles.yearLabel}>{year}</Text>

            {memories
              .filter((m) => m.memory_date.startsWith(year))
              .map((memory) => (
                <View key={memory.id} style={styles.card}>
                  <SecureImage bucket="memories" path={memory.photo_path} style={styles.cardImage} />

                  <View style={styles.cardBody}>
                    <Text style={styles.cardDate}>
                      {formatDateRu(memory.memory_date)}
                    </Text>

                    {memory.caption ? <Text style={styles.cardCaption}>{memory.caption}</Text> : null}

                    {memory.created_by === userId && (
                      <Pressable onPress={() => removeMemory(memory)}>
                        <Text style={styles.deleteText}>Удалить</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff5f8",
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 55,
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

  addButton: {
    height: 50,
    borderRadius: 18,
    backgroundColor: "#e98ca8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  addButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  formCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    gap: 12,
    marginBottom: 16,
    shadowColor: "#9b6676",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  photoBox: {
    height: 200,
    borderRadius: 16,
    backgroundColor: "#fdeef3",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  photoPreview: {
    width: "100%",
    height: "100%",
  },

  photoHint: {
    color: "#b49ba3",
    fontSize: 15,
    fontWeight: "700",
  },

  input: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ead5dc",
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#35242a",
    backgroundColor: "#ffffff",
  },

  dateField: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ead5dc",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dateFieldText: {
    color: "#35242a",
    fontSize: 15,
    fontWeight: "700",
  },

  dateFieldIcon: {
    color: "#c98aa0",
    fontSize: 14,
    fontWeight: "800",
  },

  formButtons: {
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

  emptyListText: {
    color: "#92767f",
    fontSize: 14,
    textAlign: "center",
    marginTop: 30,
    lineHeight: 20,
  },

  yearLabel: {
    color: "#624850",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 12,
    marginBottom: 10,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: "#9b6676",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  cardImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "#fdeef3",
  },

  cardBody: {
    padding: 14,
    gap: 4,
  },

  cardDate: {
    color: "#a0838c",
    fontSize: 12,
    fontWeight: "700",
  },

  cardCaption: {
    color: "#35242a",
    fontSize: 15,
    fontWeight: "700",
  },

  deleteText: {
    color: "#d9536f",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6,
  },
});
