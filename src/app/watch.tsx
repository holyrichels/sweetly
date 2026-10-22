import { C, liveStyles, FONTS } from "@/constants/sweetly-theme";
import SkeletonScreen from "@/components/skeleton-screen";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";

import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Linking } from "react-native";

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
// На Android проверка «не бот» от YouTube появляется во встроенном плеере,
// поэтому там не встраиваем плеер, а даём кнопку «Открыть в YouTube»
const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

// Открываем видео во внешнем браузере: Telegram openLink выводит ссылку из своего окна
function openYoutube(url: string) {
  const tg = (globalThis as any).Telegram?.WebApp;

  if (tg?.openLink) {
    tg.openLink(url);
  } else {
    Linking.openURL(url);
  }
}

// Реакции: сердце, смешно, звезда, класс (порядок совпадает с кнопками)
const REACTION_KINDS = ["heart", "funny", "star", "like"] as const;

type ReactionKind = (typeof REACTION_KINDS)[number];

type ReactionRow = { id: string; user_id: string; kind: ReactionKind; at_seconds: number };

const REACTION_PATHS: Record<ReactionKind, string> = {
  heart: "M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z",
  funny: "M12 3a9 9 0 100 18 9 9 0 000-18zM8 14s1.5 2.5 4 2.5S16 14 16 14M9 9.5h.01M15 9.5h.01",
  star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2-4.5-4.4 6.2-.9z",
  like: "M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5.5c1 0 1.8.9 1.6 2l-1.3 7c-.2 1-1 1.8-2 1.8H7",
};

const SUPABASE_URL = "https://lodzbjnakrweelsotnim.supabase.co";

const SUPABASE_KEY = "sb_publishable_tCl2mvi0SCdq1HVYBL6lgA_YlbMIEFJ";

// Открыт ли сайт внутри Telegram (тогда вход уже есть через Mini App)
const insideTelegram = () => !!(globalThis as any).Telegram?.WebApp?.initData;

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

// На вебе многокнопочный Alert не показывается, поэтому там используем окна браузера
function notify(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
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

    // Своё изменение плеер уже показывает, если видео то же самое.
    // Новое видео загружаем всегда, иначе оно появится только со второго раза.
    if (room.updated_by && room.updated_by === userIdRef.current && loadedVideoRef.current === room.video_id) return;

    if (blockEmbed) return;

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
            onError: (event: any) => setEmbedError(event?.data ?? 0),
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

  // Прогресс видео для полосы и времени
  const [progress, setProgress] = useState({ current: 0, duration: 0 });

  // Сохранённое видео пары и его реакции
  const [videoRowId, setVideoRowId] = useState<string | null>(null);

  const [reactions, setReactions] = useState<ReactionRow[]>([]);

  // Реакция, до которой дошло воспроизведение: показываем её на две секунды
  const [activeReaction, setActiveReaction] = useState<ReactionRow | null>(null);

  const reactionsRef = useRef<ReactionRow[]>([]);

  reactionsRef.current = reactions;

  const lastTimeRef = useRef(0);

  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Код ошибки плеера: показываем кнопку «Открыть в YouTube», а не переходим сами
  const [embedError, setEmbedError] = useState<number | null>(null);

  // Проверка «не бот» от YouTube появляется только на Android внутри Telegram
  const [blockEmbed] = useState(() => isAndroid && !!(globalThis as any).Telegram?.WebApp?.initData);

  // Android внутри Telegram: сразу открываем «Смотрим вместе» на сайте в браузере
  useEffect(() => {
    if (!blockEmbed) return;

    (async () => {
      const { data, error } = await supabase.functions.invoke("request-web-login");

      if (error || !data?.code) {
        notify("Не получилось", "Попробуйте открыть экран ещё раз");

        return;
      }

      const tg = (globalThis as any).Telegram?.WebApp;

      tg?.openLink?.(`${window.location.origin}/watch?code=${data.code}`);
    })();
  }, [blockEmbed]);

  // Видео сохраняется в список автоматически, когда пара его открывает
  useEffect(() => {
    const youtubeId = room?.video_id;

    const cid = coupleIdRef.current;

    const uid = userIdRef.current;

    if (!youtubeId || !cid || !uid) return;

    (async () => {
      let { data: row } = await supabase
        .from("watch_videos")
        .select("id")
        .eq("couple_id", cid)
        .eq("youtube_id", youtubeId)
        .maybeSingle();

      if (!row) {
        const inserted = await supabase
          .from("watch_videos")
          .insert({
            couple_id: cid,
            youtube_id: youtubeId,
            url: `https://www.youtube.com/watch?v=${youtubeId}`,
            added_by: uid,
          })
          .select("id")
          .single();

        row = inserted.data;
      }

      if (!row) return;

      setVideoRowId(row.id);

      const { data: list } = await supabase
        .from("watch_reactions")
        .select("id, user_id, kind, at_seconds")
        .eq("video_id", row.id)
        .order("at_seconds", { ascending: true });

      setReactions((list as ReactionRow[]) ?? []);
    })();
  }, [room?.video_id, coupleId]);

  // Реакция сохраняется на текущей секунде видео
  async function addReaction(kind: ReactionKind) {
    const uid = userIdRef.current;

    if (!videoRowId || !uid) {
      notify("Подождите", "Видео ещё загружается");

      return;
    }

    const at = Math.floor(progress.current);

    const { data, error } = await supabase
      .from("watch_reactions")
      .insert({ video_id: videoRowId, user_id: uid, kind, at_seconds: at })
      .select("id, user_id, kind, at_seconds")
      .single();

    if (error) {
      notify("Ошибка", error.message);

      return;
    }

    if (data) setReactions((previous) => [...previous, data as ReactionRow]);
  }

  // Браузер: есть ли вход в аккаунт (в Telegram он уже есть всегда)
  const [webSession, setWebSession] = useState<boolean | null>(null);

  const [loginCode, setLoginCode] = useState("");

  const [loginError, setLoginError] = useState<string | null>(null);

  const [loginBusy, setLoginBusy] = useState(false);

  // Код из ссылки (?code=...) меняем на вход сразу, и убираем его из адресной строки
  useEffect(() => {
    if (webSession !== false || insideTelegram()) return;

    const fromLink = new URLSearchParams(window.location.search).get("code");

    if (!fromLink) return;

    window.history.replaceState({}, "", window.location.pathname);

    setLoginCode(fromLink.toUpperCase());

    redeemLoginCode(fromLink);
  }, [webSession]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setWebSession(!!data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setWebSession(!!session));

    return () => subscription.unsubscribe();
  }, []);

  // Меняем одноразовый код из бота на вход в аккаунт
  async function redeemLoginCode(value?: string) {
    const code = (value ?? loginCode).trim().toUpperCase();

    setLoginError(null);

    setLoginBusy(true);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/redeem-web-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ code }),
      });

      const result = await response.json();

      if (!response.ok || !result.token_hash) {
        // Код истёк, уже использован или введён неверно
        setLoginError("expired");

        return;
      }

      const { error } = await supabase.auth.verifyOtp({ token_hash: result.token_hash, type: "magiclink" });

      if (error) setLoginError(error.message);
    } catch {
      setLoginError("Нет связи, попробуйте ещё раз");
    } finally {
      setLoginBusy(false);
    }
  }

  useEffect(() => {
    setEmbedError(null);
  }, [room?.video_id]);

  useEffect(() => {
    if (!isWeb || !room?.video_id) return;

    const timer = setInterval(() => {
      const player = playerRef.current;

      if (!player?.getCurrentTime) return;

      const now = player.getCurrentTime() ?? 0;

      const previous = lastTimeRef.current;

      lastTimeRef.current = now;

      setProgress({
        current: now,
        duration: player.getDuration?.() ?? 0,
      });

      // Воспроизведение прошло момент реакции: показываем её
      const passed = reactionsRef.current.find(
        (item) => item.at_seconds > previous && item.at_seconds <= now,
      );

      if (passed) {
        setActiveReaction(passed);

        if (reactionTimer.current) clearTimeout(reactionTimer.current);

        reactionTimer.current = setTimeout(() => setActiveReaction(null), 2000);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [isWeb, room?.video_id]);

  // Сохраняем состояние, чтобы партнёр увидел перемотку и паузу
  function saveRoom(isPlaying: boolean, position: number) {
    const current = roomRef.current;

    const uid = userIdRef.current;

    const cid = coupleIdRef.current;

    if (!current?.video_id || !uid || !cid) return;

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

  function togglePlay() {
    const player = playerRef.current;

    if (!player) return;

    if (roomRef.current?.is_playing) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }

  function seekBy(seconds: number) {
    const player = playerRef.current;

    if (!player) return;

    const target = Math.max(0, (player.getCurrentTime?.() ?? 0) + seconds);

    player.seekTo(target, true);

    saveRoom(roomRef.current?.is_playing ?? false, target);
  }

  function formatTime(total: number) {
    const value = Math.floor(total);

    const hours = Math.floor(value / 3600);

    const minutes = Math.floor((value % 3600) / 60);

    const seconds = String(value % 60).padStart(2, "0");

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`;
    }

    return `${minutes}:${seconds}`;
  }

  // Браузер без входа: просим код из бота (один раз)
  if (webSession === false && !insideTelegram()) {
    return (
      <View style={styles.loginWrap}>
        <Text style={styles.loginTitle}>Смотрим вместе</Text>

        <Text style={styles.loginText}>
          Чтобы войти, откройте чат с ботом Sweetly в Telegram: там пришёл код. Введите его здесь. Дальше код не понадобится.
        </Text>

        <TextInput
          style={styles.loginInput}
          placeholder="XXXXXXXX"
          placeholderTextColor={C.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          value={loginCode}
          onChangeText={(value) => setLoginCode(value.toUpperCase())}
        />

        {loginError === "expired" ? (
          <View style={styles.expiredBox}>
            <Text style={styles.loginError}>Код истёк или уже использован</Text>

            <Pressable style={styles.loginSecondary} onPress={() => Linking.openURL("https://t.me/sweetly_couple_bot")}>
              <Text style={styles.loginSecondaryText}>Открыть бота</Text>
            </Pressable>
          </View>
        ) : loginError ? (
          <Text style={styles.loginError}>{loginError}</Text>
        ) : null}

        <Pressable style={styles.loginButton} onPress={() => redeemLoginCode()} disabled={loginBusy}>
          <Text style={styles.loginButtonText}>{loginBusy ? "Проверяем..." : "Войти"}</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) return <SkeletonScreen />;

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

  const isPlaying = room?.is_playing ?? false;

  const hasVideo = !!room?.video_id;

  const ratio = progress.duration > 0 ? Math.min(1, progress.current / progress.duration) : 0;

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
            <Path d="M15 6l-6 6 6 6" fill="none" stroke={C.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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

        {hasVideo && !blockEmbed ? (
          <View nativeID="room-player" style={styles.player} />
        ) : (
          <View style={styles.playerEmpty}>
            <View style={styles.playCircle}>
              <Svg width={26} height={26} viewBox="0 0 24 24">
                <Path d="M8 5v14l11-7z" fill={C.accentOn} />
              </Svg>
            </View>
          </View>
        )}
      </View>

      {(embedError !== null || blockEmbed) && room?.video_id ? (
        <Pressable
          style={styles.openButton}
          onPress={() => openYoutube(`https://www.youtube.com/watch?v=${room.video_id}`)}
        >
          <Text style={styles.openButtonText}>Открыть в YouTube</Text>
        </Pressable>
      ) : null}

      {/* ============ НАЗВАНИЕ И ПРОГРЕСС ============ */}

      <Text style={styles.videoTitle}>Видео с YouTube</Text>

      <View style={styles.trackWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
        </View>

        {reactions.map((item) => {
          const left = progress.duration > 0 ? (item.at_seconds / progress.duration) * 100 : 0;

          const mine = item.user_id === userIdRef.current;

          return (
            <Pressable
              key={item.id}
              style={[styles.mark, { left: `${left}%`, backgroundColor: mine ? C.accent : C.text }]}
              onPress={() => playerRef.current?.seekTo?.(item.at_seconds, true)}
              accessibilityLabel={`Реакция на ${item.at_seconds} секунде`}
            />
          );
        })}
      </View>

      {activeReaction ? (
        <View style={styles.activeReaction}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d={REACTION_PATHS[activeReaction.kind]}
              fill="none"
              stroke={activeReaction.user_id === userIdRef.current ? C.accent : C.text}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.activeReactionText}>
            {activeReaction.user_id === userIdRef.current ? "Вы" : "Партнёр"} отметил(а) момент
          </Text>
        </View>
      ) : null}

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(progress.current)}</Text>
        <Text style={styles.timeText}>{formatTime(progress.duration)}</Text>
      </View>

      {/* ============ УПРАВЛЕНИЕ ============ */}

      <View style={styles.controlsRow}>
        <Pressable style={styles.seekButton} onPress={() => seekBy(-12)} disabled={!hasVideo}>
          <Svg width={26} height={26} viewBox="0 0 24 24">
            <Path d="M4 12a8 8 0 102.3-5.7M4 4v4h4" fill="none" stroke={C.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>

        <Pressable style={styles.mainButton} onPress={togglePlay} disabled={!hasVideo}>
          {isPlaying ? (
            <Svg width={30} height={30} viewBox="0 0 24 24">
              <Path d="M7 5h3v14H7zM14 5h3v14h-3z" fill={C.accentOn} />
            </Svg>
          ) : (
            <Svg width={30} height={30} viewBox="0 0 24 24">
              <Path d="M8 5v14l11-7z" fill={C.accentOn} />
            </Svg>
          )}
        </Pressable>

        <Pressable style={styles.seekButton} onPress={() => seekBy(12)} disabled={!hasVideo}>
          <Svg width={26} height={26} viewBox="0 0 24 24">
            <Path d="M20 12a8 8 0 11-2.3-5.7M20 4v4h-4" fill="none" stroke={C.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      </View>

      {/* ============ ССЫЛКА ============ */}

      <View style={styles.linkRow}>
        <TextInput
          style={styles.linkInput}
          placeholder="Вставьте ссылку на видео"
          placeholderTextColor={C.muted}
          value={linkDraft}
          onChangeText={setLinkDraft}
          autoCapitalize="none"
        />

        <Pressable style={styles.connectButton} onPress={startVideo}>
          <Text style={styles.connectText}>Включить</Text>
        </Pressable>
      </View>

      {/* ============ РЕАКЦИИ ============ */}

      <View style={styles.reactionsRow}>
        {[
          "M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z",
          "M12 3a9 9 0 100 18 9 9 0 000-18zM8 14s1.5 2.5 4 2.5S16 14 16 14M9 9.5h.01M15 9.5h.01",
          "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2-4.5-4.4 6.2-.9z",
          "M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5.5c1 0 1.8.9 1.6 2l-1.3 7c-.2 1-1 1.8-2 1.8H7",
        ].map((d, index) => (
          <Pressable
            key={index}
            style={styles.reactionPill}
            onPress={() => addReaction(REACTION_KINDS[index])}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Path d={d} fill="none" stroke={C.accentText} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = liveStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },

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
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },

  emptyTitle: {
    color: C.text,
    fontFamily: "Manrope_700Bold",
    fontSize: 20,
    marginBottom: 8,
    textAlign: "center",
  },

  emptyText: {
    color: C.muted,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    flex: 1,
    color: C.text,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
  },

  playerCard: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 28,
    backgroundColor: C.videoBg,
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
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 4,
  },

  syncPill: {
    position: "absolute",
    top: 14,
    left: 14,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.accentPale,
  },

  syncDotOnline: {
    backgroundColor: C.accentPale,
  },

  syncText: {
    color: C.accentOn,
    fontSize: 13,
    fontFamily: "Manrope_700Bold",
  },

  loginWrap: {
    flex: 1,
    backgroundColor: C.background,
    paddingHorizontal: 22,
    paddingTop: 60,
    gap: 16,
  },

  loginTitle: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 34,
  },

  loginText: {
    color: C.muted,
    fontFamily: FONTS.text,
    fontSize: 15,
    lineHeight: 22,
  },

  loginInput: {
    height: 56,
    borderRadius: 28,
    backgroundColor: C.card,
    paddingHorizontal: 22,
    fontSize: 22,
    letterSpacing: 6,
    color: C.text,
    textAlign: "center",
  },

  loginError: {
    color: C.error,
    fontFamily: FONTS.textBold,
    fontSize: 14,
  },

  expiredBox: {
    gap: 10,
  },

  loginSecondary: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: C.text,
    alignItems: "center",
    justifyContent: "center",
  },

  loginSecondaryText: {
    color: C.text,
    fontFamily: FONTS.textBold,
    fontSize: 15,
  },

  loginButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  loginButtonText: {
    color: C.accentOn,
    fontFamily: FONTS.textBold,
    fontSize: 16,
  },

  openButton: {
    marginTop: 12,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  openButtonText: {
    color: C.accentOn,
    fontFamily: FONTS.textBold,
    fontSize: 15,
  },

  videoTitle: {
    color: C.text,
    fontFamily: "Manrope_700Bold",
    fontSize: 20,
    marginTop: 18,
  },

  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: C.divider,
    marginTop: 12,
    overflow: "hidden",
  },

  trackWrap: {
    height: 14,
    justifyContent: "center",
  },

  mark: {
    position: "absolute",
    top: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
    borderWidth: 1.5,
    borderColor: C.background,
  },

  activeReaction: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: C.card,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  activeReactionText: {
    color: C.text,
    fontFamily: FONTS.textBold,
    fontSize: 13,
  },

  progressFill: {
    height: 5,
    borderRadius: 3,
    backgroundColor: C.accent,
  },

  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },

  timeText: {
    color: C.muted,
    fontSize: 14,
  },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    marginTop: 22,
  },

  seekButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
  },

  mainButton: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 22,
    width: "100%",
  },

  linkInput: {
    flex: 1,
    minWidth: 0,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.card,
    paddingHorizontal: 22,
    fontSize: 15,
    color: C.text,
  },

  connectButton: {
    height: 52,
    paddingHorizontal: 20,
    flexShrink: 0,
    borderRadius: 26,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  connectText: {
    color: C.accentOn,
    fontSize: 16,
    fontFamily: "Manrope_700Bold",
  },

  reactionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },

  reactionPill: {
    flex: 1,
    height: 56,
    marginHorizontal: 4,
    borderRadius: 28,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
  },
}));
