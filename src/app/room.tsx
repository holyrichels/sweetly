import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import PageHeader from "@/components/page-header";
import { getAppData, useAppData } from "@/lib/app-data";
import { supabase } from "@/lib/supabase";

type RoomState = {
  video_id: string | null;
  is_playing: boolean;
  position_seconds: number;
  updated_by: string | null;
  updated_at: string;
};

type Message = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
};

// Достаём ID видео из обычной ссылки, короткой youtu.be и ссылки shorts
function extractYoutubeId(input: string): string | null {
  const match = input.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

// Загружаем API плеера YouTube один раз
let youtubeApiPromise: Promise<void> | null = null;

function loadYoutubeApi(): Promise<void> {
  if ((window as any).YT?.Player) return Promise.resolve();

  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve) => {
      const previous = (window as any).onYouTubeIframeAPIReady;

      (window as any).onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve();
      };

      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    });
  }

  return youtubeApiPromise;
}

export default function RoomScreen() {
  const isWeb = Platform.OS === "web";

  const [loading, setLoading] = useState(!getAppData().ready);

  const [userId, setUserId] = useState<string | null>(null);

  const [coupleId, setCoupleId] = useState<string | null>(null);

  const [room, setRoom] = useState<RoomState | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);

  const [partnerOnline, setPartnerOnline] = useState(false);

  const [linkDraft, setLinkDraft] = useState("");

  const [messageDraft, setMessageDraft] = useState("");

  const [sending, setSending] = useState(false);

  // Плеер и флаг, чтобы не отправлять обратно то, что пришло от партнёра
  const playerRef = useRef<any>(null);

  const applyingRemote = useRef(false);

  const loadedVideoRef = useRef<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  // Актуальные значения для обработчиков плеера (они не должны видеть старые данные)
  const roomRef = useRef<RoomState | null>(null);

  const userIdRef = useRef<string | null>(null);

  const coupleIdRef = useRef<string | null>(null);

  roomRef.current = room;

  userIdRef.current = userId;

  coupleIdRef.current = coupleId;

  const appData = useAppData();

  // Пара, пользователь и состояние видео приходят из общего хранилища сразу
  useLayoutEffect(() => {
    setLoading(!appData.ready);
    setUserId(appData.userId);
    setCoupleId(appData.coupleId);
    setRoom(appData.room as RoomState | null);
  }, [appData]);

  // Сообщения чата загружаем один раз, когда известна пара
  useEffect(() => {
    if (appData.coupleId) loadMessages(appData.coupleId);
  }, [appData.coupleId]);

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

      await loadRoom(member.couple_id);
      await loadMessages(member.couple_id);
    } finally {
      setLoading(false);
    }
  }

  async function loadRoom(cid: string) {
    const { data } = await supabase
      .from("room_state")
      .select("video_id, is_playing, position_seconds, updated_by, updated_at")
      .eq("couple_id", cid)
      .maybeSingle();

    setRoom(data ?? null);
  }

  async function loadMessages(cid: string) {
    const { data } = await supabase
      .from("room_messages")
      .select("id, user_id, text, created_at")
      .eq("couple_id", cid)
      .order("created_at", { ascending: true })
      .limit(200);

    setMessages(data ?? []);
  }

  // =========================================================
  // REALTIME: состояние видео, чат и присутствие партнёра
  // =========================================================

  useEffect(() => {
    if (!coupleId || !userId) return;

    const channel = supabase
      .channel(`room-${coupleId}`, { config: { presence: { key: userId } } })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_state", filter: `couple_id=eq.${coupleId}` },
        (payload: any) => {
          if (payload.new) setRoom(payload.new as RoomState);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages", filter: `couple_id=eq.${coupleId}` },
        (payload: any) => {
          const message = payload.new as Message;

          setMessages((previous) =>
            previous.some((item) => item.id === message.id) ? previous : [...previous, message],
          );
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const others = Object.keys(state).filter((key) => key !== userId);

        setPartnerOnline(others.length > 0);
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId, userId]);

  // =========================================================
  // ПЛЕЕР: применяем состояние, которое пришло от партнёра
  // =========================================================

  useEffect(() => {
    if (!isWeb || !room?.video_id) return;

    // Своё изменение плеер уже показывает, применять его второй раз не нужно
    if (room.updated_by && room.updated_by === userIdRef.current) return;

    let cancelled = false;

    (async () => {
      await loadYoutubeApi();

      if (cancelled) return;

      // Сколько прошло с последнего изменения, чтобы догнать время
      const elapsed = Math.max(0, (Date.now() - new Date(room.updated_at).getTime()) / 1000);
      const targetPosition = room.is_playing
        ? room.position_seconds + elapsed
        : room.position_seconds;

      applyingRemote.current = true;

      const YT = (window as any).YT;

      if (!playerRef.current) {
        playerRef.current = new YT.Player("room-player", {
          height: "100%",
          width: "100%",
          videoId: room.video_id,
          playerVars: { playsinline: 1, rel: 0 },
          events: {
            onStateChange: onLocalStateChange,
          },
        });

        loadedVideoRef.current = room.video_id;
      } else if (loadedVideoRef.current !== room.video_id) {
        // Партнёр сменил видео: загружаем новое с нужной позиции
        playerRef.current.loadVideoById({
          videoId: room.video_id,
          startSeconds: targetPosition,
        });

        loadedVideoRef.current = room.video_id;
      } else {
        playerRef.current.seekTo(targetPosition, true);

        if (room.is_playing) {
          playerRef.current.playVideo();
        } else {
          playerRef.current.pauseVideo();
        }
      }

      // Даём плееру время прислать свои события, и не реагируем на них как на свои
      setTimeout(() => {
        applyingRemote.current = false;
      }, 1200);
    })();

    return () => {
      cancelled = true;
    };
  }, [room?.video_id, room?.is_playing, room?.updated_at, isWeb]);

  // Наш плеер: отправляем партнёру, когда мы нажали play, pause
  function onLocalStateChange(event: any) {
    const current = roomRef.current;
    const uid = userIdRef.current;
    const cid = coupleIdRef.current;

    if (applyingRemote.current || !uid || !cid || !current?.video_id) return;

    const YT = (window as any).YT;
    const isPlaying = event.data === YT.PlayerState.PLAYING;
    const isPaused = event.data === YT.PlayerState.PAUSED;

    if (!isPlaying && !isPaused) return;

    const position = playerRef.current?.getCurrentTime?.() ?? 0;

    // Если состояние уже такое же, как в базе, ничего не отправляем (защита от эха)
    const sameAsRemote =
      current.is_playing === isPlaying &&
      Math.abs(position - current.position_seconds) < 1.5;

    if (sameAsRemote) return;

    supabase
      .from("room_state")
      .upsert(
        {
          couple_id: cid,
          video_id: current.video_id,
          is_playing: isPlaying,
          position_seconds: position,
          updated_by: uid,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "couple_id" },
      )
      .then(() => {});
  }

  // Ставим видео на двоих
  async function startVideo() {
    if (!coupleId || !userId) return;

    const videoId = extractYoutubeId(linkDraft.trim());

    if (!videoId) {
      Alert.alert("Не нашли видео", "Вставьте ссылку на YouTube");

      return;
    }

    const { error } = await supabase.from("room_state").upsert(
      {
        couple_id: coupleId,
        video_id: videoId,
        is_playing: false,
        position_seconds: 0,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "couple_id" },
    );

    if (error) {
      Alert.alert("Ошибка", error.message);

      return;
    }

    setLinkDraft("");
  }

  async function sendMessage() {
    const text = messageDraft.trim();

    if (!text || !coupleId || !userId || sending) return;

    setSending(true);

    try {
      const { data, error } = await supabase
        .from("room_messages")
        .insert({ couple_id: coupleId, user_id: userId, text })
        .select("id, user_id, text, created_at")
        .single();

      if (error) {
        Alert.alert("Ошибка", error.message);

        return;
      }

      setMessages((previous) => [...previous, data as Message]);
      setMessageDraft("");
    } finally {
      setSending(false);
    }
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
        <Text style={styles.emptyEmoji}>🛋️</Text>
        <Text style={styles.emptyTitle}>Комната пока пуста</Text>
        <Text style={styles.emptyText}>Сначала создайте пару или присоединитесь по коду.</Text>
      </View>
    );
  }

  if (!isWeb) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>🎬</Text>
        <Text style={styles.emptyTitle}>Совместный просмотр</Text>
        <Text style={styles.emptyText}>
          Пока открывается в браузере или в Telegram. В приложении на iPhone добавим позже.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeader title="Комната" />

        {/* ============ ПЛЕЕР ============ */}

        <View style={styles.playerCard}>
          {room?.video_id ? (
            <View nativeID="room-player" style={styles.player} />
          ) : (
            <View style={styles.playerEmpty}>
              <Text style={styles.playerEmptyIcon}>▶</Text>
              <Text style={styles.playerEmptyText}>Вставьте ссылку на видео</Text>
            </View>
          )}
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusText}>
            {partnerOnline ? "вы вдвоём" : "вы один"}
          </Text>
        </View>

        <View style={styles.linkRow}>
          <TextInput
            style={styles.linkInput}
            placeholder="Ссылка на YouTube"
            placeholderTextColor="#b9a2aa"
            value={linkDraft}
            onChangeText={setLinkDraft}
            autoCapitalize="none"
          />

          <Pressable style={styles.primaryButton} onPress={startVideo}>
            <Text style={styles.primaryButtonText}>Включить</Text>
          </Pressable>
        </View>

        {/* ============ ЧАТ ============ */}

        <View style={styles.chatCard}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle}>Чат</Text>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.chatList}
            contentContainerStyle={styles.chatListContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.length === 0 ? (
              <Text style={styles.chatEmpty}>Здесь пока пусто. Напишите первым.</Text>
            ) : (
              messages.map((message) => {
                const mine = message.user_id === userId;

                return (
                  <View
                    key={message.id}
                    style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
                  >
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                      {message.text}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.messageInput}
            placeholder="Написать..."
            placeholderTextColor="#b9a2aa"
            value={messageDraft}
            onChangeText={setMessageDraft}
            onSubmitEditing={sendMessage}
          />

          <Pressable style={styles.sendButton} onPress={sendMessage} disabled={sending}>
            <Text style={styles.sendIcon}>➤</Text>
          </Pressable>
        </View>
      </ScrollView>
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
    paddingTop: 55,
    paddingBottom: 40,
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

  playerCard: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#35242a",
    shadowColor: "#9b6676",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  player: {
    width: "100%",
    height: "100%",
  },

  playerEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  playerEmptyIcon: {
    color: "#e98ca8",
    fontSize: 36,
    marginBottom: 10,
  },

  playerEmptyText: {
    color: "#fbe3ec",
    fontSize: 14,
    fontWeight: "700",
  },

  statusRow: {
    alignItems: "center",
    marginTop: 12,
  },

  statusText: {
    color: "#a0838c",
    fontSize: 12,
    fontWeight: "700",
  },

  linkRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    alignItems: "center",
  },

  linkInput: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ead5dc",
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#35242a",
    backgroundColor: "#ffffff",
  },

  primaryButton: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "#e98ca8",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  chatCard: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 16,
    height: 360,
    shadowColor: "#9b6676",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  chatHeader: {
    marginBottom: 8,
  },

  chatTitle: {
    color: "#35242a",
    fontSize: 16,
    fontWeight: "800",
  },

  chatList: {
    flex: 1,
  },

  chatListContent: {
    gap: 8,
    paddingBottom: 6,
  },

  chatEmpty: {
    color: "#b49ba3",
    fontSize: 14,
    textAlign: "center",
    marginTop: 110,
  },

  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },

  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: "#e98ca8",
    borderBottomRightRadius: 4,
  },

  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: "#fdeef3",
    borderBottomLeftRadius: 4,
  },

  bubbleText: {
    color: "#35242a",
    fontSize: 14,
  },

  bubbleTextMine: {
    color: "#ffffff",
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },

  messageInput: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#ead5dc",
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#35242a",
    backgroundColor: "#ffffff",
  },

  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e98ca8",
    alignItems: "center",
    justifyContent: "center",
  },

  sendIcon: {
    color: "#ffffff",
    fontSize: 18,
  },
});
