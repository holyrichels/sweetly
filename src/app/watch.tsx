import SkeletonScreen from "@/components/skeleton-screen";
import { C, FONTS, liveStyles } from "@/constants/sweetly-theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Svg, { Path } from "react-native-svg";

import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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
  const match = input.match(
    /(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}

// Загружаем API плеера YouTube один раз
// На Android проверка «не бот» от YouTube появляется во встроенном плеере,
// поэтому там не встраиваем плеер, а даём кнопку «Открыть в YouTube»
const isAndroid =
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

// Открываем видео во внешнем браузере: Telegram openLink выводит ссылку из своего окна
function openYoutube(url: string) {
  const tg = (globalThis as any).Telegram?.WebApp;

  if (tg?.openLink) {
    tg.openLink(url);
  } else {
    Linking.openURL(url);
  }
}

// Контурная иконка по пути SVG
function Ico({
  d,
  color,
  size = 20,
  stroke = 1.8,
}: {
  d: string;
  color: string;
  size?: number;
  stroke?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const ICON_SLIDERS = "M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6";
const ICON_FOLDER =
  "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z";
const ICON_BUBBLE = "M4 5h16v11H9l-5 4z";
const ICON_FULL = "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5";
const ICON_PLAY = "M8 5v14l11-7z";
const ICON_PAUSE = "M7 5h3v14H7zM14 5h3v14h-3z";
const ICON_SEND = "M3 11l18-8-8 18-2-8-8-2z";

// Реакции: сердце, смешно, звезда, класс (порядок совпадает с кнопками)
const REACTION_KINDS = ["heart", "funny", "star", "like"] as const;

type ReactionKind = (typeof REACTION_KINDS)[number];

type ReactionRow = {
  id: string;
  user_id: string;
  kind: ReactionKind;
  at_seconds: number;
};

const REACTION_PATHS: Record<ReactionKind, string> = {
  heart: "M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z",
  funny:
    "M12 3a9 9 0 100 18 9 9 0 000-18zM8 14s1.5 2.5 4 2.5S16 14 16 14M9 9.5h.01M15 9.5h.01",
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
        {
          event: "*",
          schema: "public",
          table: "room_state",
          filter: `couple_id=eq.${coupleId}`,
        },
        (payload: any) => {
          if (payload.new) setRoom(payload.new as RoomState);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_messages",
          filter: `couple_id=eq.${coupleId}`,
        },
        (payload: any) => {
          const message = payload.new as Message;

          setMessages((previous) =>
            previous.some((item) => item.id === message.id)
              ? previous
              : [...previous, message],
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
    if (
      room.updated_by &&
      room.updated_by === userIdRef.current &&
      loadedVideoRef.current === room.video_id
    )
      return;

    if (blockEmbed) return;

    let cancelled = false;

    (async () => {
      await loadYoutubeApi();

      if (cancelled) return;

      // Сколько прошло с последнего изменения, чтобы догнать время
      const elapsed = Math.max(
        0,
        (Date.now() - new Date(room.updated_at).getTime()) / 1000,
      );
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

  // Параметры со страницы видео: ?youtube=ID&t=секунды
  const params = useLocalSearchParams<{ youtube?: string; t?: string }>();

  // Сохранённые видео пары с количеством реакций по видам
  const [savedVideos, setSavedVideos] = useState<any[]>([]);

  // Сохранённое видео пары и его реакции
  const [videoRowId, setVideoRowId] = useState<string | null>(null);

  const [reactions, setReactions] = useState<ReactionRow[]>([]);

  // Реакция, до которой дошло воспроизведение: показываем её на две секунды
  const [activeReaction, setActiveReaction] = useState<ReactionRow | null>(
    null,
  );

  const reactionsRef = useRef<ReactionRow[]>([]);

  reactionsRef.current = reactions;

  const lastTimeRef = useRef(0);

  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Код ошибки плеера: показываем кнопку «Открыть в YouTube», а не переходим сами
  const [embedError, setEmbedError] = useState<number | null>(null);

  // Проверка «не бот» от YouTube появляется только на Android внутри Telegram
  const [blockEmbed] = useState(
    () => isAndroid && !!(globalThis as any).Telegram?.WebApp?.initData,
  );

  // Экран «Смотреть вместе» на Android внутри Telegram: код, таймер, состояния
  const [androidCode, setAndroidCode] = useState<string | null>(null);

  const [codeExpiresAt, setCodeExpiresAt] = useState(0);

  const [androidError, setAndroidError] = useState<string | null>(null);

  const [linkState, setLinkState] = useState<
    "unknown" | "linked" | "notLinked"
  >("unknown");

  const [nowTs, setNowTs] = useState(Date.now());

  // Ориентация: горизонтально — плеер слева, чат справа
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const landscape = screenWidth > screenHeight;

  // Список сохранённых видео открывается кнопкой с папкой
  const [savedOpen, setSavedOpen] = useState(false);

  // Выдаём одноразовый код: живёт 10 минут
  async function requestAndroidCode() {
    setAndroidError(null);

    setAndroidCode(null);

    const { data, error } =
      await supabase.functions.invoke("request-web-login");

    if (error || !data?.code) {
      setAndroidError("Не получилось получить код. Попробуйте ещё раз.");

      return;
    }

    setAndroidCode(data.code);

    setCodeExpiresAt(Date.now() + 10 * 60 * 1000);

    setLinkState("linked");
  }

  useEffect(() => {
    if (!blockEmbed) return;

    requestAndroidCode();

    const timer = setInterval(() => setNowTs(Date.now()), 1000);

    return () => clearInterval(timer);
  }, [blockEmbed]);

  const codeLeft = Math.max(0, Math.floor((codeExpiresAt - nowTs) / 1000));

  const codeExpired = !!androidCode && codeLeft === 0;

  function openInBrowser() {
    const tg = (globalThis as any).Telegram?.WebApp;

    tg?.openLink?.(`${window.location.origin}/watch?code=${androidCode}`);
  }

  function copyAndroidCode() {
    if (androidCode && typeof navigator !== "undefined")
      navigator.clipboard?.writeText(androidCode);
  }

  // Realtime: реакции партнёра появляются сразу
  useEffect(() => {
    if (!videoRowId) return;

    const channel = supabase
      .channel(`reactions-${videoRowId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "watch_reactions",
          filter: `video_id=eq.${videoRowId}`,
        },
        (payload: any) => {
          const row = payload.new as ReactionRow;

          setReactions((previous) =>
            previous.some((item) => item.id === row.id)
              ? previous
              : [...previous, row],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [videoRowId]);

  // Со страницы видео: ставим нужное видео и момент в общий плеер
  useEffect(() => {
    const cid = coupleIdRef.current;

    const uid = userIdRef.current;

    if (!params.youtube || !cid || !uid) return;

    supabase
      .from("room_state")
      .upsert(
        {
          couple_id: cid,
          video_id: params.youtube,
          is_playing: true,
          position_seconds: Number(params.t) || 0,
          updated_by: uid,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "couple_id" },
      )
      .then(() => {});
  }, [params.youtube, params.t, coupleId]);

  // Список сохранённых видео: новые сверху, у каждого плашки реакций
  useEffect(() => {
    const cid = coupleIdRef.current;

    if (!cid) return;

    (async () => {
      const { data: videos } = await supabase
        .from("watch_videos")
        .select("id, youtube_id, title, watched_at, duration_seconds")
        .eq("couple_id", cid)
        .order("watched_at", { ascending: false });

      const list = (videos as any[]) ?? [];

      if (list.length === 0) {
        setSavedVideos([]);

        return;
      }

      const { data: reactions } = await supabase
        .from("watch_reactions")
        .select("video_id, kind")
        .in(
          "video_id",
          list.map((item) => item.id),
        );

      const byVideo: Record<string, Record<string, number>> = {};

      (reactions ?? []).forEach((item: any) => {
        byVideo[item.video_id] = byVideo[item.video_id] ?? {};

        byVideo[item.video_id][item.kind] =
          (byVideo[item.video_id][item.kind] ?? 0) + 1;
      });

      setSavedVideos(
        list.map((item) => ({ ...item, counts: byVideo[item.id] ?? {} })),
      );
    })();
  }, [coupleId, room?.video_id]);

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
    supabase.auth
      .getSession()
      .then(({ data }) => setWebSession(!!data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) =>
      setWebSession(!!session),
    );

    return () => subscription.unsubscribe();
  }, []);

  // Меняем одноразовый код из бота на вход в аккаунт
  async function redeemLoginCode(value?: string) {
    const code = (value ?? loginCode).trim().toUpperCase();

    setLoginError(null);

    setLoginBusy(true);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/redeem-web-login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
          body: JSON.stringify({ code }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.token_hash) {
        // Код истёк, уже использован или введён неверно
        setLoginError("expired");

        return;
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: result.token_hash,
        type: "magiclink",
      });

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
          Чтобы войти, откройте чат с ботом Sweetly в Telegram: там пришёл код.
          Введите его здесь. Дальше код не понадобится.
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

            <Pressable
              style={styles.loginSecondary}
              onPress={() => Linking.openURL("https://t.me/sweetly_couple_bot")}
            >
              <Text style={styles.loginSecondaryText}>Открыть бота</Text>
            </Pressable>
          </View>
        ) : loginError ? (
          <Text style={styles.loginError}>{loginError}</Text>
        ) : null}

        <Pressable
          style={styles.loginButton}
          onPress={() => redeemLoginCode()}
          disabled={loginBusy}
        >
          <Text style={styles.loginButtonText}>
            {loginBusy ? "Проверяем..." : "Войти"}
          </Text>
        </Pressable>
      </View>
    );
  }

  // Android внутри Telegram: код, таймер и кнопка открыть в браузере
  if (blockEmbed) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Смотреть вместе</Text>

        <Text style={styles.loginText}>
          Откройте комнату на Android в браузере
        </Text>

        {linkState === "notLinked" ? (
          <View style={styles.androidCard}>
            <Text style={styles.androidTitle}>Telegram не привязан</Text>
            <Text style={styles.loginText}>
              Привяжите Telegram один раз через бота, либо войдите в аккаунт на
              сайте.
            </Text>

            <Pressable
              style={styles.loginButton}
              onPress={() => Linking.openURL("https://t.me/sweetly_couple_bot")}
            >
              <Text style={styles.loginButtonText}>Привязать Telegram</Text>
            </Pressable>

            <Pressable
              style={styles.loginSecondary}
              onPress={() => notify("Скоро", "Вход в аккаунт появится позже")}
            >
              <Text style={styles.loginSecondaryText}>Войти в аккаунт</Text>
            </Pressable>
          </View>
        ) : androidCode ? (
          <View style={styles.androidCard}>
            <View style={styles.statusPill}>
              <View style={styles.syncDot} />
              <Text style={styles.statusText}>Telegram привязан</Text>
            </View>

            <View style={styles.codeCells}>
              {androidCode.split("").map((char, index) => (
                <View
                  key={index}
                  style={[
                    styles.codeCell,
                    codeExpired && styles.codeCellExpired,
                  ]}
                >
                  <Text style={styles.codeChar}>{codeExpired ? "" : char}</Text>
                </View>
              ))}
            </View>

            {codeExpired ? (
              <Text style={styles.expiredText}>Код истёк</Text>
            ) : (
              <Text style={styles.timerText}>
                Действует ещё {Math.floor(codeLeft / 60)}:
                {String(codeLeft % 60).padStart(2, "0")}
              </Text>
            )}

            <Text style={styles.loginText}>
              Код можно не вводить: браузер откроется сам
            </Text>

            <Pressable
              style={styles.loginSecondary}
              onPress={copyAndroidCode}
              disabled={codeExpired}
            >
              <Text style={styles.loginSecondaryText}>Скопировать код</Text>
            </Pressable>

            <Pressable
              style={styles.loginButton}
              onPress={openInBrowser}
              disabled={codeExpired}
            >
              <Text style={styles.loginButtonText}>Открыть в браузере</Text>
            </Pressable>

            {codeExpired ? (
              <Pressable
                style={styles.loginSecondary}
                onPress={requestAndroidCode}
              >
                <Text style={styles.loginSecondaryText}>Обновить код</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.androidCard}>
            <Text style={styles.loginText}>
              {androidError ?? "Готовим код…"}
            </Text>

            {androidError ? (
              <Pressable
                style={styles.loginButton}
                onPress={requestAndroidCode}
              >
                <Text style={styles.loginButtonText}>Обновить код</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    );
  }

  if (loading) return <SkeletonScreen />;

  if (!coupleId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Сначала создайте пару</Text>
        <Text style={styles.emptyText}>
          Совместный просмотр доступен, когда вы в паре.
        </Text>
      </View>
    );
  }

  if (!isWeb) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Совместный просмотр</Text>
        <Text style={styles.emptyText}>
          Пока открывается в браузере или в Telegram. В приложении на iPhone
          добавим позже.
        </Text>
      </View>
    );
  }

  const isPlaying = room?.is_playing ?? false;

  const hasVideo = !!room?.video_id;

  const ratio =
    progress.duration > 0
      ? Math.min(1, progress.current / progress.duration)
      : 0;

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
            <Path
              d="M15 6l-6 6 6 6"
              fill="none"
              stroke={C.text}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>

        <Text style={styles.title}>Смотрим вместе</Text>
      </View>

      {(() => {
        const code = getAppData().couple?.invite_code ?? "";

        const status = partnerOnline ? "Вы вдвоём" : "Вы одни";

        const playerCard = (
          <View style={[styles.roomPlayer, landscape && styles.roomPlayerWide]}>
            {hasVideo && !blockEmbed ? (
              <View nativeID="room-player" style={styles.roomPlayerFrame} />
            ) : null}

            <View style={styles.roomTop}>
              <View style={styles.roomAvatar}>
                <Text style={styles.roomAvatarText}>К</Text>
              </View>

              <View style={styles.flex}>
                <Text style={styles.roomVideoTitle} numberOfLines={1}>
                  {room?.video_id ? "Видео с YouTube" : "Название видео"}
                </Text>
                <Text style={styles.roomChannel}>канал</Text>
              </View>

              {landscape ? (
                <View style={styles.roomCodePill}>
                  <View style={styles.roomDot} />
                  <Text style={styles.roomCodePillText}>
                    {status} · {code}
                  </Text>
                </View>
              ) : null}

              <Pressable
                style={styles.roomIconBtn}
                onPress={() =>
                  notify("Скоро", "Настройки видео появятся позже")
                }
              >
                <Ico d={ICON_SLIDERS} color="#FFFFFF" size={18} />
              </Pressable>
            </View>

            <View style={styles.roomCenter}>
              <Pressable
                style={styles.roomPlay}
                onPress={togglePlay}
                disabled={!hasVideo}
              >
                <Ico
                  d={isPlaying ? ICON_PAUSE : ICON_PLAY}
                  color="#FFFFFF"
                  size={24}
                  stroke={0}
                />
              </Pressable>
            </View>

            <View style={styles.roomBottom}>
              <View style={styles.roomTimeRow}>
                <Text style={styles.roomTime}>
                  {formatTime(progress.current)} /{" "}
                  {formatTime(progress.duration)}
                </Text>

                <Pressable
                  style={styles.roomFsBtn}
                  onPress={() =>
                    (document as any).documentElement?.requestFullscreen?.()
                  }
                >
                  <Ico d={ICON_FULL} color="#FFFFFF" size={16} />
                </Pressable>
              </View>

              <View style={styles.trackWrap}>
                <View style={styles.roomTrack}>
                  <View
                    style={[styles.roomFill, { width: `${ratio * 100}%` }]}
                  />
                </View>

                {reactions.map((item) => {
                  const left =
                    progress.duration > 0
                      ? (item.at_seconds / progress.duration) * 100
                      : 0;

                  const mine = item.user_id === userIdRef.current;

                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.roomMark,
                        {
                          left: `${left}%`,
                          backgroundColor: mine ? C.accentPale : "#FFFFFF",
                        },
                      ]}
                      onPress={() =>
                        playerRef.current?.seekTo?.(item.at_seconds, true)
                      }
                    />
                  );
                })}
              </View>
            </View>
          </View>
        );

        const linkInput = (
          <TextInput
            style={styles.roomLinkInput}
            placeholder="Вставьте ссылку на видео"
            placeholderTextColor={C.muted}
            value={linkDraft}
            onChangeText={setLinkDraft}
            autoCapitalize="none"
          />
        );

        const folderButton = (
          <Pressable
            style={styles.roomSquareBtn}
            onPress={() => setSavedOpen((value) => !value)}
          >
            <Ico d={ICON_FOLDER} color={C.text} size={20} />
          </Pressable>
        );

        const reactionButtons = REACTION_KINDS.map((kind, index) => (
          <Pressable
            key={kind}
            style={styles.roomReactBtn}
            onPress={() => addReaction(kind)}
          >
            <Ico d={REACTION_PATHS[kind]} color={C.accentText} size={20} />
          </Pressable>
        ));

        const connectButton = (
          <Pressable style={styles.roomConnect} onPress={startVideo}>
            <Text style={styles.roomConnectText}>Включить</Text>
          </Pressable>
        );

        const savedList = savedOpen ? (
          <View style={styles.roomSaved}>
            <Text style={styles.roomSavedLabel}>СОХРАНЁННЫЕ ВИДЕО</Text>

            {savedVideos.length === 0 ? (
              <Text style={styles.roomSavedEmpty}>
                Видео появятся здесь после просмотра
              </Text>
            ) : (
              savedVideos.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.roomSavedCard}
                  onPress={() =>
                    router.push(`/watch-video?id=${item.id}` as any)
                  }
                >
                  <Image
                    source={{
                      uri: `https://i.ytimg.com/vi/${item.youtube_id}/mqdefault.jpg`,
                    }}
                    style={styles.roomSavedThumb}
                  />

                  <View style={styles.flex}>
                    <Text style={styles.roomSavedTitle} numberOfLines={1}>
                      {item.title || "Видео"}
                    </Text>
                    <Text style={styles.roomSavedDate}>
                      {new Date(item.watched_at).toLocaleDateString("ru-RU")}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        ) : null;

        const chat = (
          <View style={[styles.roomChat, landscape && styles.flex]}>
            <View style={styles.roomChatHeader}>
              <Text style={styles.roomChatTitle}>Чат</Text>
              <Text style={styles.roomChatSub}>
                {partnerOnline ? "вдвоём" : "вы одни"}
              </Text>
            </View>

            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.roomChatList}
            >
              {messages.length === 0 ? (
                <Text style={styles.roomChatEmpty}>
                  Здесь пока пусто. Напишите первым.
                </Text>
              ) : (
                messages.map((message) => {
                  const mine = message.user_id === userIdRef.current;

                  return (
                    <View
                      key={message.id}
                      style={[
                        styles.bubble,
                        mine ? styles.bubbleMine : styles.bubbleOther,
                      ]}
                    >
                      <Text
                        style={[
                          styles.bubbleText,
                          mine && styles.bubbleTextMine,
                        ]}
                      >
                        {message.text}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.roomChatInput}>
              <TextInput
                style={styles.roomChatField}
                placeholder="Написать..."
                placeholderTextColor={C.muted}
                value={messageDraft}
                onChangeText={setMessageDraft}
                onSubmitEditing={sendMessage}
              />

              <Pressable style={styles.roomSend} onPress={sendMessage}>
                <Ico d={ICON_SEND} color="#FFFFFF" size={18} stroke={0} />
              </Pressable>
            </View>
          </View>
        );

        if (!landscape) {
          return (
            <View style={styles.roomColumn}>
              {playerCard}

              <View style={styles.roomStatusRow}>
                <View style={styles.roomPill}>
                  <View style={styles.roomDot} />
                  <Text style={styles.roomPillText}>{status}</Text>
                </View>

                <Text style={styles.roomCode}>Код: {code}</Text>
              </View>

              <View style={styles.roomInputRow}>
                {linkInput}
                {folderButton}
              </View>

              <View style={styles.roomReactRow}>
                {connectButton}
                {reactionButtons}
              </View>

              {savedList}

              <View style={styles.roomChatWrap}>{chat}</View>
            </View>
          );
        }

        return (
          <View style={styles.wideRow}>
            <View style={styles.wideLeft}>
              {playerCard}

              <View style={styles.roomInputRow}>
                {linkInput}
                {folderButton}
                <Pressable
                  style={styles.roomSquareBtn}
                  onPress={() => setSavedOpen((value) => !value)}
                >
                  <Ico d={ICON_BUBBLE} color={C.text} size={20} />
                </Pressable>
                <Pressable
                  style={styles.roomSquareBtn}
                  onPress={() =>
                    (document as any).documentElement?.requestFullscreen?.()
                  }
                >
                  <Ico d={ICON_FULL} color={C.text} size={20} />
                </Pressable>
              </View>

              <View style={styles.roomReactRow}>
                {connectButton}
                {reactionButtons}
              </View>

              {savedList}
            </View>

            <View style={styles.wideRight}>{chat}</View>
          </View>
        );
      })()}
    </ScrollView>
  );
}

const styles = liveStyles(() =>
  StyleSheet.create({
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
      backgroundColor: C.accent,
    },

    syncDotOnline: {
      backgroundColor: C.accent,
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

    flex: {
      flex: 1,
    },

    roomColumn: {
      gap: 12,
    },

    roomPlayer: {
      height: 212,
      borderRadius: 22,
      backgroundColor: C.videoBg,
      overflow: "hidden",
    },

    roomPlayerWide: {
      width: "100%",
      height: undefined,
      aspectRatio: 16 / 9,
    },

    roomPlayerFrame: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },

    roomTop: {
      position: "absolute",
      left: 14,
      right: 12,
      top: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      zIndex: 2,
    },

    roomAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
    },

    roomAvatarText: {
      color: C.accentOn,
      fontFamily: FONTS.textBold,
      fontSize: 13,
    },

    roomVideoTitle: {
      color: "#FFFFFF",
      fontFamily: FONTS.textBold,
      fontSize: 13,
    },

    roomChannel: {
      color: "#FFFFFF",
      fontFamily: FONTS.text,
      fontSize: 11,
      opacity: 0.75,
    },

    roomIconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },

    roomCodePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(255,255,255,0.9)",
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },

    roomCodePillText: {
      color: "#3B1F2B",
      fontFamily: FONTS.textBold,
      fontSize: 12,
    },

    roomCenter: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },

    roomPlay: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },

    roomBottom: {
      position: "absolute",
      left: 14,
      right: 14,
      bottom: 10,
      gap: 6,
    },

    roomTimeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    roomTime: {
      color: "#FFFFFF",
      fontFamily: FONTS.textBold,
      fontSize: 12,
    },

    roomFsBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },

    roomTrack: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 3,
      height: 6,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.3)",
    },

    roomFill: {
      position: "absolute",
      left: 0,
      top: 0,
      height: 6,
      borderRadius: 3,
      backgroundColor: C.accent,
    },

    roomMark: {
      position: "absolute",
      top: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      marginLeft: -6,
      borderWidth: 2,
      borderColor: "#3B1F2B",
    },

    roomStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    roomPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: C.card,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },

    roomPillText: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 12,
    },

    roomDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: C.muted,
    },

    roomCode: {
      color: C.muted,
      fontFamily: FONTS.textBold,
      fontSize: 12,
      letterSpacing: 1,
    },

    roomInputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    roomLinkInput: {
      flex: 1,
      minWidth: 140,
      height: 48,
      borderRadius: 24,
      backgroundColor: C.card,
      paddingHorizontal: 20,
      fontSize: 14,
      color: C.text,
    },

    roomSquareBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: C.card,
      alignItems: "center",
      justifyContent: "center",
    },

    roomReactRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    roomConnect: {
      flex: 1,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
    },

    roomConnectText: {
      color: C.accentOn,
      fontFamily: FONTS.textBold,
      fontSize: 15,
    },

    roomReactBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.card,
      alignItems: "center",
      justifyContent: "center",
    },

    roomChatWrap: {
      flex: 1,
      minHeight: 260,
    },

    roomChat: {
      flex: 1,
      minHeight: 260,
      backgroundColor: C.card,
      borderRadius: 22,
      overflow: "hidden",
    },

    roomChatHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
    },

    roomChatTitle: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 15,
    },

    roomChatSub: {
      color: C.muted,
      fontFamily: FONTS.textBold,
      fontSize: 12,
    },

    roomChatList: {
      flexGrow: 1,
      gap: 8,
      paddingHorizontal: 16,
      justifyContent: "center",
    },

    roomChatEmpty: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 13,
      textAlign: "center",
      paddingHorizontal: 40,
      lineHeight: 20,
    },

    roomChatInput: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 10,
    },

    roomChatField: {
      flex: 1,
      minWidth: 0,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.background,
      paddingHorizontal: 20,
      fontSize: 14,
      color: C.text,
    },

    roomSend: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
    },

    roomSaved: {
      backgroundColor: C.card,
      borderRadius: 22,
      padding: 14,
      gap: 8,
    },

    roomSavedLabel: {
      color: C.muted,
      fontFamily: FONTS.textBold,
      fontSize: 12,
      letterSpacing: 0.4,
    },

    roomSavedEmpty: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 13,
    },

    roomSavedCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    roomSavedThumb: {
      width: 80,
      height: 48,
      borderRadius: 10,
    },

    roomSavedTitle: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 13,
    },

    roomSavedDate: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 11,
      marginTop: 2,
    },

    wideRow: {
      flexDirection: "row",
      gap: 16,
      alignItems: "stretch",
    },

    wideLeft: {
      flex: 1,
      minWidth: 0,
      alignSelf: "stretch",
      gap: 10,
    },

    wideRight: {
      width: 300,
      minWidth: 260,
      alignSelf: "stretch",
    },

    androidCard: {
      backgroundColor: C.card,
      borderRadius: 24,
      padding: 18,
      gap: 12,
    },

    androidTitle: {
      color: C.text,
      fontFamily: FONTS.display,
      fontSize: 22,
    },

    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      alignSelf: "flex-start",
      backgroundColor: C.background,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },

    codeCells: {
      flexDirection: "row",
      justifyContent: "space-between",
    },

    codeCell: {
      width: 38,
      height: 48,
      borderRadius: 12,
      backgroundColor: C.background,
      alignItems: "center",
      justifyContent: "center",
    },

    codeCellExpired: {
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: C.dashed,
      backgroundColor: "transparent",
    },

    codeChar: {
      color: C.text,
      fontFamily: FONTS.display,
      fontSize: 22,
    },

    timerText: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 13,
    },

    expiredText: {
      color: C.error,
      fontFamily: FONTS.textBold,
      fontSize: 14,
    },

    savedEmpty: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 14,
    },

    savedCard: {
      backgroundColor: C.card,
      borderRadius: 22,
      padding: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 8,
    },

    savedThumb: {
      width: 96,
      height: 60,
      borderRadius: 12,
    },

    savedTitle: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 15,
    },

    savedDate: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 12,
      marginTop: 2,
    },

    savedPills: {
      flexDirection: "row",
      gap: 6,
      marginTop: 6,
    },

    savedPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: C.background,
      borderRadius: 12,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },

    savedPillText: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 11,
    },

    sectionLabel: {
      color: C.muted,
      fontFamily: FONTS.textBold,
      fontSize: 13,
      letterSpacing: 0.4,
      marginTop: 18,
      marginBottom: 8,
    },

    statusLine: {
      marginTop: 12,
    },

    statusText: {
      color: C.muted,
      fontFamily: FONTS.textBold,
      fontSize: 13,
    },

    chatCard: {
      backgroundColor: C.card,
      borderRadius: 22,
      padding: 14,
      height: 260,
    },

    chatHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },

    chatTitle: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 15,
    },

    chatSub: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 12,
    },

    chatList: {
      flex: 1,
    },

    chatListContent: {
      gap: 8,
      paddingBottom: 6,
    },

    chatEmpty: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 14,
      textAlign: "center",
      marginTop: 80,
    },

    bubble: {
      maxWidth: "78%",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
    },

    bubbleMine: {
      alignSelf: "flex-end",
      backgroundColor: C.accent,
      borderBottomRightRadius: 4,
    },

    bubbleOther: {
      alignSelf: "flex-start",
      backgroundColor: C.peachLight,
      borderBottomLeftRadius: 4,
    },

    bubbleText: {
      color: C.text,
      fontFamily: FONTS.text,
      fontSize: 14,
    },

    bubbleTextMine: {
      color: C.accentOn,
    },

    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 10,
    },

    messageInput: {
      flex: 1,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.background,
      paddingHorizontal: 16,
      fontSize: 15,
      color: C.text,
    },

    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
    },

    sendText: {
      color: C.accentOn,
      fontSize: 16,
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
  }),
);
