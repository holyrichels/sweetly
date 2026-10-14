import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";

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

import SecureImage from "@/components/secure-image";
import SoloScreen from "@/components/solo-screen";
import { CalendarGrid, FadeIn, formatDateISO, formatDateRu } from "@/components/date-field";
import { getAppData, refreshAppData, useAppData } from "@/lib/app-data";
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
  const router = useRouter();
  const [loading, setLoading] = useState(!getAppData().ready);

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

  const appData = useAppData();

  useLayoutEffect(() => {
    setLoading(!appData.ready);
    setUserId(appData.userId);
    setCoupleId(appData.coupleId);
    setMemories(appData.memories as Memory[]);
  }, [appData]);

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

  async function loadMemories(_cid: string) {
    // Список обновляется в общем хранилище и сразу приходит сюда
    await refreshAppData();
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

  const [filter, setFilter] = useState<"all" | "image" | "video">("all");

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#C23A62" />
      </View>
    );
  }

  if (!coupleId) return <SoloScreen kind="memories" />;

  const filtered = memories.filter(
    (memory) => filter === "all" || memory.media_type === filter,
  );

  const [featured, ...others] = filtered;

  const chips: { key: "all" | "image" | "video"; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "image", label: "Фото" },
    { key: "video", label: "Видео" },
  ];

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Воспоминания</Text>
            <Text style={styles.subtitle}>Моменты, которые вы сохранили</Text>
          </View>

          <Pressable
            style={styles.addButton}
            onPress={() => router.push("/memory-new" as any)}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path d={creating ? "M6 6l12 12M18 6L6 18" : "M12 5v14M5 12h14"} fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>
        </View>

        {/* ============ ФИЛЬТРЫ ============ */}

        <View style={styles.chipRow}>
          {chips.map((chip) => {
            const active = filter === chip.key;

            return (
              <Pressable
                key={chip.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(chip.key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ============ ФОРМА ДОБАВЛЕНИЯ ============ */}

        {creating && (
          <View style={styles.formCard}>
            <Pressable style={styles.mediaBox} onPress={pickMedia}>
              {picked?.type === "image" ? (
                <Image source={{ uri: picked.uri }} style={styles.mediaPreview} />
              ) : picked?.type === "video" ? (
                <Text style={styles.mediaHint}>Видео выбрано, нажмите, чтобы заменить</Text>
              ) : (
                <Text style={styles.mediaHint}>Выбрать фото или видео</Text>
              )}
            </Pressable>

            <TextInput
              style={styles.input}
              placeholder="Подпись"
              placeholderTextColor="#B49BA3"
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

        {filtered.length === 0 ? (
          <Text style={styles.emptyListText}>
            Здесь будут ваши совместные фото и видео. Добавьте первое воспоминание.
          </Text>
        ) : (
          <>
            {/* ============ ГЛАВНОЕ ВОСПОМИНАНИЕ ============ */}

            {featured && (
              <Pressable style={styles.featured} onPress={() => openMemory(featured)}>
                <View style={styles.featuredMedia}>
                  {featured.media_type === "video" ? (
                    <Svg width={44} height={44} viewBox="0 0 24 24">
                      <Path d="M8 5v14l11-7z" fill="#C23A62" />
                    </Svg>
                  ) : (
                    <SecureImage bucket="memories" path={featured.photo_path} style={styles.featuredImage} />
                  )}
                </View>

                <View style={styles.featuredBody}>
                  <View style={styles.featuredText}>
                    <Text style={styles.featuredTitle} numberOfLines={1}>
                      {featured.caption || "Воспоминание"}
                    </Text>
                    <Text style={styles.cardDate}>{formatDateRu(featured.memory_date)}</Text>
                  </View>
                </View>
              </Pressable>
            )}

            {/* ============ СЕТКА ============ */}

            <View style={styles.grid}>
              {others.map((memory, index) => (
                <Pressable key={memory.id} style={styles.card} onPress={() => openMemory(memory)}>
                  <View style={[styles.cardMedia, index % 2 === 0 ? styles.cardMediaSoft : styles.cardMediaPink]}>
                    {memory.media_type === "video" ? (
                      <Svg width={34} height={34} viewBox="0 0 24 24">
                        <Path d="M8 5v14l11-7z" fill="#C23A62" />
                      </Svg>
                    ) : (
                      <SecureImage bucket="memories" path={memory.photo_path} style={styles.cardImage} />
                    )}
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {memory.caption || "Воспоминание"}
                    </Text>
                    <Text style={styles.cardDate}>{formatDateRu(memory.memory_date)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
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
  screen: { flex: 1, backgroundColor: "#FFF1F0" },

  content: {
    paddingHorizontal: 22,
    paddingTop: 55,
    paddingBottom: 70,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },

  center: {
    flex: 1,
    backgroundColor: "#FFF1F0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },

  emptyTitle: {
    color: "#3B1F2B",
    fontFamily: "Manrope_700Bold",
    fontSize: 20,
    marginBottom: 8,
    textAlign: "center",
  },

  emptyText: {
    color: "#7A5A66",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  headerText: { flex: 1, paddingRight: 12 },

  title: {
    color: "#3B1F2B",
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 36,
  },

  subtitle: {
    color: "#7A5A66",
    fontSize: 15,
    marginTop: 4,
  },

  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#C23A62",
    alignItems: "center",
    justifyContent: "center",
  },

  chipRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },

  chip: {
    height: 42,
    paddingHorizontal: 20,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  chipActive: {
    backgroundColor: "#3B1F2B",
  },

  chipText: {
    color: "#3B1F2B",
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
  },

  chipTextActive: {
    color: "#FFFFFF",
  },

  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    gap: 12,
    marginBottom: 18,
  },

  mediaBox: {
    height: 190,
    borderRadius: 18,
    backgroundColor: "#FFE6DB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  mediaPreview: { width: "100%", height: "100%" },

  mediaHint: {
    color: "#7A5A66",
    fontSize: 14,
    fontFamily: "Manrope_700Bold",
  },

  input: {
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF1F0",
    paddingHorizontal: 18,
    fontSize: 15,
    color: "#3B1F2B",
  },

  dateField: {
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF1F0",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dateFieldText: {
    color: "#3B1F2B",
    fontSize: 15,
    fontFamily: "Manrope_700Bold",
  },

  dateFieldIcon: {
    color: "#C23A62",
    fontSize: 14,
    fontFamily: "Manrope_700Bold",
  },

  formButtons: {
    flexDirection: "row",
    gap: 10,
  },

  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#C23A62",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Manrope_700Bold",
  },

  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF1F0",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonText: {
    color: "#3B1F2B",
    fontSize: 15,
    fontFamily: "Manrope_700Bold",
  },

  emptyListText: {
    color: "#7A5A66",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 40,
  },

  featured: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 14,
  },

  featuredMedia: {
    height: 200,
    backgroundColor: "#FFE6DB",
    alignItems: "center",
    justifyContent: "center",
  },

  featuredImage: { width: "100%", height: "100%" },

  featuredBody: {
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
  },

  featuredText: { flex: 1 },

  featuredTitle: {
    color: "#3B1F2B",
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },

  card: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
  },

  cardMedia: {
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  cardMediaSoft: { backgroundColor: "#FFE6DB" },

  cardMediaPink: { backgroundColor: "#F9D3DC" },

  cardImage: { width: "100%", height: "100%" },

  cardBody: {
    padding: 14,
  },

  cardTitle: {
    color: "#3B1F2B",
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
  },

  cardDate: {
    color: "#7A5A66",
    fontSize: 12,
    marginTop: 3,
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
