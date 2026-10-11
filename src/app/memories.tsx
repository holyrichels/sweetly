import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";

import PageHeader from "@/components/page-header";
import SecureImage from "@/components/secure-image";
import { CalendarGrid, FadeIn, formatDateISO, formatDateRu } from "@/components/date-field";
import { supabase } from "@/lib/supabase";

type Memory = {
  id: string;
  created_by: string;
  photo_path: string;
  caption: string;
  memory_date: string;
  media_type: "image" | "video";
};

type PickedMedia = {
  uri: string;
  type: "image" | "video";
  mimeType: string;
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

// Плеер для полноэкранного просмотра видео
function VideoPlayerView({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={styles.fullMedia}
      nativeControls
      contentFit="contain"
    />
  );
}

export default function MemoriesScreen() {
  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState<string | null>(null);

  const [coupleId, setCoupleId] = useState<string | null>(null);

  const [memories, setMemories] = useState<Memory[]>([]);

  const [creating, setCreating] = useState(false);

  const [picked, setPicked] = useState<PickedMedia | null>(null);

  const [caption, setCaption] = useState("");

  const [memoryDate, setMemoryDate] = useState(formatDateISO(new Date()));

  const [showCalendar, setShowCalendar] = useState(false);

  const [saving, setSaving] = useState(false);

  // Что сейчас открыто на весь экран
  const [viewing, setViewing] = useState<{ memory: Memory; url: string } | null>(null);

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
      .select("id, created_by, photo_path, caption, memory_date, media_type")
      .eq("couple_id", cid)
      .order("memory_date", { ascending: false })
      .order("created_at", { ascending: false });

    setMemories((data ?? []) as Memory[]);
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

  async function pickMedia() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted && permission.canAskAgain !== false) {
      notify("Нужен доступ", "Разрешите доступ к фото и видео, чтобы добавить воспоминание.");

      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.7,
      // Видео длиннее 2 минут не берём, чтобы не грузить слишком большие файлы
      videoMaxDuration: 120,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const type = asset.type === "video" ? "video" : "image";

    setPicked({
      uri: asset.uri,
      type,
      mimeType: asset.mimeType ?? (type === "video" ? "video/mp4" : "image/jpeg"),
    });
  }

  function resetForm() {
    setCreating(false);
    setPicked(null);
    setCaption("");
    setMemoryDate(formatDateISO(new Date()));
    setShowCalendar(false);
  }

  async function saveMemory() {
    if (!coupleId || !userId || !picked) {
      notify("Нет файла", "Выберите фото или видео для воспоминания.");

      return;
    }

    setSaving(true);

    try {
      // Читаем файл целиком и отправляем в хранилище с правильным типом
      const response = await fetch(picked.uri);
      const bytes = await response.arrayBuffer();

      const extension = picked.mimeType.split("/")[1]?.split("+")[0] ?? (picked.type === "video" ? "mp4" : "jpg");
      const path = `${coupleId}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("memories")
        .upload(path, bytes, { contentType: picked.mimeType });

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
        media_type: picked.type,
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

  // Открываем воспоминание полностью: получаем временную ссылку на файл
  async function openMemory(memory: Memory) {
    const { data, error } = await supabase.storage
      .from("memories")
      .createSignedUrl(memory.photo_path, 3600);

    if (error || !data?.signedUrl) {
      notify("Ошибка", error?.message ?? "Не удалось открыть файл");

      return;
    }

    setViewing({ memory, url: data.signedUrl });
  }

  function removeMemory(memory: Memory) {
    confirmAction("Удалить воспоминание?", "Фото или видео и подпись будут удалены.", async () => {
      await supabase.storage.from("memories").remove([memory.photo_path]);

      const { error } = await supabase.from("couple_memories").delete().eq("id", memory.id);

      if (error) {
        notify("Ошибка", error.message);

        return;
      }

      setViewing(null);

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
    <>
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
            <Pressable style={styles.mediaBox} onPress={pickMedia}>
              {picked?.type === "image" ? (
                <Image source={{ uri: picked.uri }} style={styles.mediaPreview} />
              ) : picked?.type === "video" ? (
                <View style={styles.videoPicked}>
                  <Text style={styles.playIcon}>▶</Text>
                  <Text style={styles.videoPickedText}>Видео выбрано, нажмите, чтобы заменить</Text>
                </View>
              ) : (
                <Text style={styles.mediaHint}>📷 Выбрать фото или видео</Text>
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
                <Text style={styles.primaryButtonText}>{saving ? "Загружаем..." : "Сохранить"}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {memories.length === 0 ? (
          <Text style={styles.emptyListText}>
            Здесь будут ваши совместные фото и видео. Добавьте первое воспоминание.
          </Text>
        ) : (
          years.map((year) => (
            <View key={year}>
              <Text style={styles.yearLabel}>{year}</Text>

              {memories
                .filter((m) => m.memory_date.startsWith(year))
                .map((memory) => (
                  <Pressable key={memory.id} style={styles.card} onPress={() => openMemory(memory)}>
                    {memory.media_type === "video" ? (
                      <View style={styles.videoThumb}>
                        <Text style={styles.playIcon}>▶</Text>
                        <Text style={styles.videoThumbText}>Видео</Text>
                      </View>
                    ) : (
                      <SecureImage bucket="memories" path={memory.photo_path} style={styles.cardImage} />
                    )}

                    <View style={styles.cardBody}>
                      <Text style={styles.cardDate}>{formatDateRu(memory.memory_date)}</Text>

                      {memory.caption ? <Text style={styles.cardCaption}>{memory.caption}</Text> : null}
                    </View>
                  </Pressable>
                ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* ============ ПОЛНОЭКРАННЫЙ ПРОСМОТР ============ */}

      <Modal
        visible={viewing !== null}
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <View style={styles.viewer}>
          <View style={styles.viewerTop}>
            <Pressable style={styles.viewerButton} onPress={() => setViewing(null)}>
              <Text style={styles.viewerButtonText}>✕</Text>
            </Pressable>

            {viewing && userId === viewing.memory.created_by ? (
              <Pressable style={styles.viewerButton} onPress={() => removeMemory(viewing.memory)}>
                <Text style={styles.viewerButtonText}>🗑</Text>
              </Pressable>
            ) : null}
          </View>

          {viewing?.memory.media_type === "video" ? (
            <VideoPlayerView uri={viewing.url} />
          ) : viewing ? (
            <Image source={{ uri: viewing.url }} style={styles.fullMedia} resizeMode="contain" />
          ) : null}

          {viewing?.memory.caption ? (
            <Text style={styles.viewerCaption}>{viewing.memory.caption}</Text>
          ) : null}
        </View>
      </Modal>
    </>
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

  mediaBox: {
    height: 200,
    borderRadius: 16,
    backgroundColor: "#fdeef3",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  mediaPreview: {
    width: "100%",
    height: "100%",
  },

  mediaHint: {
    color: "#b49ba3",
    fontSize: 15,
    fontWeight: "700",
  },

  videoPicked: {
    alignItems: "center",
    gap: 8,
  },

  videoPickedText: {
    color: "#8a6b74",
    fontSize: 13,
    fontWeight: "700",
  },

  playIcon: {
    color: "#e98ca8",
    fontSize: 34,
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
  },

  videoThumb: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "#35242a",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  videoThumbText: {
    color: "#fbe3ec",
    fontSize: 12,
    fontWeight: "700",
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

  viewer: {
    flex: 1,
    backgroundColor: "#120a0e",
    justifyContent: "center",
  },

  viewerTop: {
    position: "absolute",
    bottom: 56,
    left: 18,
    right: 18,
    zIndex: 2,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  viewerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  viewerButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },

  fullMedia: {
    width: "100%",
    height: "100%",
  },

  viewerCaption: {
    position: "absolute",
    bottom: 120,
    left: 20,
    right: 20,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
});
