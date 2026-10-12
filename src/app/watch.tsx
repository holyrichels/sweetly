import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";

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

export default function WatchScreen() {
  const router = useRouter();
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
        <ActivityIndicator size="large" color="#C23A62" />
      </View>
    );
  }

  if (!coupleId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Сначала создайте пару</Text>
        <Text style={styles.emptyText}>Совместный просмотр доступен, когда вы в паре.</Text>
      </View>
    );
  }

  if (!isWeb) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Совместный просмотр</Text>
        <Text style={styles.emptyText}>
          Пока открывается в браузере или в Telegram. В приложении на iPhone добавим позже.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path d="M15 6l-6 6 6 6" fill="none" stroke="#3B1F2B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>

        <Text style={styles.title}>Смотрим вместе</Text>
      </View>

      {/* ============ ПЛЕЕР ============ */}

      <View style={styles.playerCard}>
        <View style={styles.syncPill}>
          <View style={[styles.syncDot, partnerOnline && styles.syncDotOnline]} />
          <Text style={styles.syncText}>
            {partnerOnline ? "Синхронно с партнёром" : "Вы один"}
          </Text>
        </View>

        {room?.video_id ? (
          <View nativeID="room-player" style={styles.player} />
        ) : (
          <View style={styles.playerEmpty}>
            <View style={styles.playCircle}>
              <Svg width={26} height={26} viewBox="0 0 24 24">
                <Path d="M8 5v14l11-7z" fill="#FFFFFF" />
              </Svg>
            </View>
          </View>
        )}
      </View>

      {/* ============ ССЫЛКА ============ */}

      <View style={styles.linkRow}>
        <TextInput
          style={styles.linkInput}
          placeholder="Вставьте ссылку на видео"
          placeholderTextColor="#B49BA3"
          value={linkDraft}
          onChangeText={setLinkDraft}
          autoCapitalize="none"
        />

        <Pressable style={styles.connectButton} onPress={startVideo}>
          <Text style={styles.connectText}>Включить</Text>
        </Pressable>
      </View>

      {/* ============ ЧАТ ============ */}

      <Text style={styles.sectionLabel}>ЧАТ</Text>

      <View style={styles.chatCard}>
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

        <View style={styles.inputRow}>
          <TextInput
            style={styles.messageInput}
            placeholder="Написать..."
            placeholderTextColor="#B49BA3"
            value={messageDraft}
            onChangeText={setMessageDraft}
            onSubmitEditing={sendMessage}
          />

          <Pressable style={styles.sendButton} onPress={sendMessage} disabled={sending}>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path d="M3 11l18-8-8 18-2-8-8-2z" fill="#FFFFFF" />
            </Svg>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF1F0" },

  content: {
    paddingHorizontal: 22,
    paddingTop: 55,
    paddingBottom: 40,
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

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    color: "#3B1F2B",
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 30,
  },

  playerCard: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 24,
    backgroundColor: "#3B1F2B",
    overflow: "hidden",
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

  playCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#C23A62",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 4,
  },

  syncPill: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#B49BA3",
  },

  syncDotOnline: {
    backgroundColor: "#4CD08A",
  },

  syncText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Manrope_700Bold",
  },

  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },

  linkInput: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    fontSize: 14,
    color: "#3B1F2B",
  },

  connectButton: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: "#3B1F2B",
    alignItems: "center",
    justifyContent: "center",
  },

  connectText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Manrope_700Bold",
  },

  sectionLabel: {
    color: "#7A5A66",
    fontSize: 14,
    fontFamily: "Manrope_700Bold",
    letterSpacing: 0.4,
    marginTop: 22,
    marginBottom: 10,
  },

  chatCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    height: 340,
  },

  chatList: { flex: 1 },

  chatListContent: { gap: 8, paddingBottom: 6 },

  chatEmpty: {
    color: "#B49BA3",
    fontSize: 14,
    textAlign: "center",
    marginTop: 100,
  },

  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },

  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: "#C23A62",
    borderBottomRightRadius: 4,
  },

  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: "#FFE6DB",
    borderBottomLeftRadius: 4,
  },

  bubbleText: { color: "#3B1F2B", fontSize: 14 },

  bubbleTextMine: { color: "#FFFFFF" },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },

  messageInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF1F0",
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#3B1F2B",
  },

  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#C23A62",
    alignItems: "center",
    justifyContent: "center",
  },
});
