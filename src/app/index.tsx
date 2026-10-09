import { useEffect, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SymbolView } from "expo-symbols";

import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "register";
type CoupleMode = "menu" | "create" | "join";

const SCREEN_HEIGHT = Dimensions.get("window").height;

function capitalizeFirst(text: string) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function formatDateISO(date: Date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateISO(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }

  return new Date();
}

// Барабан выбора даты (день / месяц / год) как в таймере на iPhone.
// Значение хранится строкой ГГГГ-ММ-ДД, чтобы остальной код не менялся.
// Плавное появление блока (календарь раскрывается без резкого скачка)
function FadeIn({ children }: { children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [anim]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [-8, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

const MONTH_NAMES = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
];

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function formatDateRu(value: string) {
  return parseDateISO(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Календарь: месяцы, годы и сетка дней. Будущие даты недоступны.
function CalendarGrid({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = parseDateISO(value);

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const year = selected.getFullYear();
  const month = selected.getMonth();
  const day = selected.getDate();

  // Выбираем дату, не выходя за пределы: день не больше числа дней в месяце
  // и не позже сегодняшнего дня
  function pickDate(newYear: number, newMonth: number, newDay: number) {
    const maxDay = new Date(newYear, newMonth + 1, 0).getDate();
    let next = new Date(newYear, newMonth, Math.min(newDay, maxDay));

    if (next > todayStart) next = todayStart;

    onChange(formatDateISO(next));
  }

  const years: number[] = [];

  for (let y = today.getFullYear(); y >= today.getFullYear() - 80; y--) {
    years.push(y);
  }

  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View style={styles.calendar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {MONTH_NAMES.map((name, index) => {
          const active = index === month;

          return (
            <Pressable
              key={name}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => pickDate(year, index, day)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {years.map((item) => {
          const active = item === year;

          return (
            <Pressable
              key={item}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => pickDate(item, month, day)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((weekday) => (
          <Text key={weekday} style={styles.weekText}>
            {weekday}
          </Text>
        ))}
      </View>

      <View style={styles.daysGrid}>
        {cells.map((cell, index) => {
          if (cell === null) {
            return <View key={`empty-${index}`} style={styles.dayCell} />;
          }

          const isSelected = cell === day;
          const isFuture = new Date(year, month, cell) > todayStart;

          return (
            <Pressable
              key={cell}
              style={[styles.dayCell, isSelected && styles.dayCellActive]}
              disabled={isFuture}
              onPress={() => pickDate(year, month, cell)}
            >
              <Text
                style={[
                  styles.dayText,
                  isSelected && styles.dayTextActive,
                  isFuture && styles.dayTextDisabled,
                ]}
              >
                {cell}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Поле даты: показывает выбранную дату, по нажатию раскрывает календарь.
// Значение остаётся строкой ГГГГ-ММ-ДД, как и раньше.
function DateWheel({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.dateWrapper}>
      <Pressable style={styles.dateField} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.dateFieldText}>{formatDateRu(value)}</Text>
        <Text style={styles.dateFieldIcon}>{open ? "▴" : "▾"}</Text>
      </Pressable>

      {open && (
        <FadeIn>
          <CalendarGrid value={value} onChange={onChange} />

          <Pressable style={styles.calendarDone} onPress={() => setOpen(false)}>
            <Text style={styles.calendarDoneText}>Готово</Text>
          </Pressable>
        </FadeIn>
      )}
    </View>
  );
}

type TimerIconName = "back" | "next" | "edit" | "add" | "delete";

const TIMER_ICONS: Record<
  TimerIconName,
  React.ComponentProps<typeof SymbolView>["name"]
> = {
  back: { ios: "chevron.left", android: "chevron_left", web: "chevron_left" },
  next: {
    ios: "chevron.right",
    android: "chevron_right",
    web: "chevron_right",
  },
  edit: { ios: "pencil", android: "edit", web: "edit" },
  add: { ios: "plus", android: "add", web: "add" },
  delete: { ios: "trash", android: "delete", web: "delete" },
};

// Круглая кнопка таймера в стиле кнопки «Старт» на iPhone
function TimerCircleButton({
  icon,
  onPress,
}: {
  icon: TimerIconName;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.timerCircleButton} onPress={onPress}>
      <SymbolView
        name={TIMER_ICONS[icon]}
        size={18}
        weight="semibold"
        tintColor="#ffffff"
      />
    </Pressable>
  );
}

// Та же кнопка, но плавно появляется/исчезает (ширина и отступы схлопываются в ноль)
function AnimatedTimerButton({
  visible,
  onPress,
  icon,
}: {
  visible: boolean;
  onPress: () => void;
  icon: TimerIconName;
}) {
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [visible, anim]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        width: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 42],
        }),
        marginHorizontal: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 5],
        }),
        overflow: "hidden",
      }}
    >
      <TimerCircleButton icon={icon} onPress={onPress} />
    </Animated.View>
  );
}

// Модалка с плавным появлением и исчезновением (на вебе встроенная fade не работает).
function FadeModal({
  visible,
  onRequestClose,
  children,
}: {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(visible);

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);

      Animated.timing(anim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, anim]);

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onRequestClose}
    >
      <Animated.View
        style={{
          flex: 1,
          opacity: anim,
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.94, 1],
              }),
            },
          ],
        }}
      >
        {children}
      </Animated.View>
    </Modal>
  );
}

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);

  const [session, setSession] = useState<any>(null);

  const [couple, setCouple] = useState<any>(null);

  const [profilesList, setProfilesList] = useState<
    { id: string; name: string; avatar_url?: string | null }[]
  >([]);

  const [memberCount, setMemberCount] = useState(0);

  const [authMode, setAuthMode] = useState<AuthMode>("login");

  const [coupleMode, setCoupleMode] = useState<CoupleMode>("menu");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [status, setStatus] = useState("влюбленные");

  const [relationshipDate, setRelationshipDate] = useState(
    formatDateISO(new Date()),
  );

  const [inviteCode, setInviteCode] = useState("");

  // =========================================================
  // СКУЧАЮ
  // =========================================================

  const [myMissCount, setMyMissCount] = useState(0);

  const [partnerMissCount, setPartnerMissCount] = useState(0);

  const [missLoading, setMissLoading] = useState(false);

  // =========================================================
  // ВРЕМЯ
  // =========================================================

  const [now, setNow] = useState(new Date());

  // =========================================================
  // ВЫБРАННЫЙ ДЕНЬ
  // =========================================================

  const [selectedDate, setSelectedDate] = useState(new Date());

  // =========================================================
  // ТАЙМЕРЫ (главный + дополнительные)
  // =========================================================

  const [customTimers, setCustomTimers] = useState<
    { id: string; title: string; start_date: string }[]
  >([]);

  const [activeTimerIndex, setActiveTimerIndex] = useState(0);

  const [statusModalVisible, setStatusModalVisible] = useState(false);

  const [statusSaving, setStatusSaving] = useState(false);

  const [timerModalVisible, setTimerModalVisible] = useState(false);

  const [timerModalMode, setTimerModalMode] = useState<"create" | "edit">(
    "create",
  );

  const [timerFormIsMain, setTimerFormIsMain] = useState(false);

  const [timerFormTitle, setTimerFormTitle] = useState("");

  const [timerFormDate, setTimerFormDate] = useState("");

  const [timerSaving, setTimerSaving] = useState(false);

  // =========================================================
  // TIMER
  // =========================================================

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // =========================================================
  // AUTH
  // =========================================================

  useEffect(() => {
    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);

      if (newSession) {
        await loadCouple(newSession.user.id);
      } else {
        setCouple(null);
        setProfilesList([]);
        setMemberCount(0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // =========================================================
  // REALTIME: подписка на изменения в паре
  // =========================================================

  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel(`couple-updates-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_members",
        },
        () => {
          loadCouple(session.user.id);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couples",
        },
        () => {
          loadCouple(session.user.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  // =========================================================
  // REALTIME: подписка на изменения счётчика "Скучаю"
  // =========================================================

  useEffect(() => {
    if (!session?.user?.id || !couple?.id) return;

    const missChannel = supabase
      .channel(`miss-updates-${couple.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_miss_counts",
          filter: `couple_id=eq.${couple.id}`,
        },
        () => {
          loadMissCount(couple.id, session.user.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(missChannel);
    };
  }, [session?.user?.id, couple?.id]);

  // =========================================================
  // REALTIME: подписка на изменения таймеров
  // =========================================================

  useEffect(() => {
    if (!session?.user?.id || !couple?.id) return;

    const timersChannel = supabase
      .channel(`timers-updates-${couple.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_timers",
          filter: `couple_id=eq.${couple.id}`,
        },
        () => {
          loadTimers(couple.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(timersChannel);
    };
  }, [session?.user?.id, couple?.id]);

  // =========================================================
  // =========================================================
  // REALTIME: изменения профилей (аватарки и имена партнёра)
  // =========================================================

  useEffect(() => {
    if (!session?.user?.id || !couple?.id) return;

    const profilesChannel = supabase
      .channel(`profiles-updates-${couple.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        () => {
          loadCouple(session.user.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
    };
  }, [session?.user?.id, couple?.id]);

  // =========================================================
  // LOAD SESSION
  // =========================================================

  async function loadSession() {
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      setSession(currentSession);

      if (currentSession) {
        await loadCouple(currentSession.user.id);
      }
    } catch (error) {
      console.log("Session error:", error);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // AUTH
  // =========================================================

  async function handleAuth() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Ошибка", "Введите email и пароль");

      return;
    }

    if (authMode === "register" && !name.trim()) {
      Alert.alert("Ошибка", "Введите ваше имя");

      return;
    }

    setLoading(true);

    try {
      if (authMode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: name.trim(),
            },
          },
        });

        if (error) {
          Alert.alert("Ошибка регистрации", error.message);

          return;
        }

        if (!data.session) {
          Alert.alert(
            "Проверьте почту ❤️",
            "Подтвердите email, после чего войдите в аккаунт.",
          );
        } else {
          setSession(data.session);

          await loadCouple(data.session.user.id);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          Alert.alert("Ошибка входа", error.message);

          return;
        }

        setSession(data.session);

        if (data.session) {
          await loadCouple(data.session.user.id);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // LOAD COUPLE
  // =========================================================

  async function loadCouple(userId: string) {
    try {
      const { data: member, error: memberError } = await supabase
        .from("couple_members")
        .select("couple_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (memberError) {
        console.log("Ошибка поиска пары:", memberError.message);

        return;
      }

      if (!member) {
        setCouple(null);
        setProfilesList([]);
        setMemberCount(0);

        return;
      }

      const { data: coupleData, error: coupleError } = await supabase
        .from("couples")
        .select("*")
        .eq("id", member.couple_id)
        .maybeSingle();

      if (coupleError) {
        console.log("Ошибка загрузки пары:", coupleError.message);

        return;
      }

      if (!coupleData) {
        setCouple(null);

        return;
      }

      setCouple(coupleData);

      // Загружаем участников

      const { data: members, error: membersError } = await supabase
        .from("couple_members")
        .select("user_id")
        .eq("couple_id", member.couple_id);

      if (membersError) {
        console.log("Ошибка участников:", membersError.message);

        return;
      }

      const userIds = members?.map((item) => item.user_id) ?? [];

      setMemberCount(userIds.length);

      // Загружаем имена

      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, name, avatar_url")
          .in("id", userIds);

        if (!profilesError) {
          setProfilesList(profiles ?? []);
        }
      }

      // Загружаем Скучаю

      await loadMissCount(member.couple_id, userId);

      // Загружаем таймеры

      await loadTimers(member.couple_id);
    } catch (error) {
      console.log("Load couple error:", error);
    }
  }

  // =========================================================
  // LOAD TIMERS
  // =========================================================

  async function loadTimers(coupleId: string) {
    const { data, error } = await supabase
      .from("couple_timers")
      .select("id, title, start_date")
      .eq("couple_id", coupleId)
      .order("created_at", { ascending: true });

    if (error) {
      console.log("Ошибка загрузки таймеров:", error.message);

      return [];
    }

    setCustomTimers(data ?? []);

    return data ?? [];
  }

  // =========================================================
  // LOAD MISS COUNT
  // =========================================================

  async function loadMissCount(coupleId: string, userId: string) {
    try {
      const { data, error } = await supabase
        .from("couple_miss_counts")
        .select("*")
        .eq("couple_id", coupleId)
        .maybeSingle();

      if (error) {
        console.log("Ошибка Скучаю:", error.message);

        return;
      }

      if (!data) {
        setMyMissCount(0);
        setPartnerMissCount(0);

        return;
      }

      if (data.user_one_id === userId) {
        setMyMissCount(data.user_one_count);

        setPartnerMissCount(data.user_two_count);
      } else {
        setMyMissCount(data.user_two_count);

        setPartnerMissCount(data.user_one_count);
      }
    } catch (error) {
      console.log("Miss count error:", error);
    }
  }

  // =========================================================
  // НАЖАТИЕ СКУЧАЮ
  // =========================================================

  async function pressMiss() {
    if (!couple?.id || !session?.user?.id || missLoading) {
      return;
    }

    setMissLoading(true);

    // Сразу показываем изменение на экране

    setMyMissCount((value) => value + 1);

    try {
      const { data, error } = await supabase.rpc("increment_miss_count", {
        target_couple_id: couple.id,
      });

      if (error) {
        // Откатываем локальное изменение

        setMyMissCount((value) => Math.max(0, value - 1));

        Alert.alert("Ошибка", error.message);

        return;
      }

      if (data) {
        const userId = session.user.id;

        if (data.user_one_id === userId) {
          setMyMissCount(data.user_one_count);

          setPartnerMissCount(data.user_two_count);
        } else {
          setMyMissCount(data.user_two_count);

          setPartnerMissCount(data.user_one_count);
        }
      }
    } finally {
      setMissLoading(false);
    }
  }

  // =========================================================
  // CREATE COUPLE
  // =========================================================

  async function createCouple() {
    if (!session?.user?.id) {
      Alert.alert("Ошибка", "Сессия пользователя не найдена");

      return;
    }

    if (!relationshipDate.trim()) {
      Alert.alert("Ошибка", "Введите дату начала отношений");

      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(relationshipDate.trim())) {
      Alert.alert(
        "Неверная дата",
        "Используйте формат ГГГГ-ММ-ДД\nНапример: 2026-09-01",
      );

      return;
    }

    setLoading(true);

    try {
      const generatedCode = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      const { data: newCouple, error: coupleError } = await supabase
        .from("couples")
        .insert({
          invite_code: generatedCode,
          relationship_status: status,
          relationship_date: relationshipDate.trim(),
        })
        .select()
        .single();

      if (coupleError) {
        Alert.alert("Ошибка", coupleError.message);

        return;
      }

      const { error: memberError } = await supabase
        .from("couple_members")
        .insert({
          couple_id: newCouple.id,
          user_id: session.user.id,
        });

      if (memberError) {
        Alert.alert("Ошибка", memberError.message);

        return;
      }

      // Создаём пустой счётчик

      await supabase.from("couple_miss_counts").insert({
        couple_id: newCouple.id,
        user_one_id: session.user.id,
        user_one_count: 0,
        user_two_count: 0,
      });

      setCouple(newCouple);
      setMemberCount(1);
      setCoupleMode("menu");

      await loadCouple(session.user.id);

      Alert.alert(
        "Пара создана ❤️",
        `Код приглашения:\n\n${generatedCode}\n\nОтправь его своему партнёру.`,
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // JOIN
  // =========================================================

  async function joinCouple() {
    const code = inviteCode.trim().toUpperCase();

    if (!code) {
      Alert.alert("Ошибка", "Введите код приглашения");

      return;
    }

    if (!session?.user?.id) {
      Alert.alert("Ошибка", "Сессия пользователя не найдена");

      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc("join_couple_by_code", {
        code,
      });

      if (error) {
        Alert.alert("Не получилось присоединиться", error.message);

        return;
      }

      if (!data) {
        Alert.alert("Ошибка", "Не удалось получить данные пары");

        return;
      }

      setCouple(data);

      setInviteCode("");

      setCoupleMode("menu");

      await loadCouple(session.user.id);

      Alert.alert("Вы вместе ❤️", "Ты успешно присоединился к паре!");
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // SHARE
  // =========================================================

  async function shareInviteCode() {
    if (!couple?.invite_code) {
      return;
    }

    await Share.share({
      message:
        `Присоединяйся к нашей паре в Couple ❤️\n\n` +
        `Код приглашения: ${couple.invite_code}`,
    });
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  async function logout() {
    await supabase.auth.signOut();

    setSession(null);
    setCouple(null);
    setProfilesList([]);
    setMemberCount(0);
    setCoupleMode("menu");
    setAuthMode("login");
  }

  // =========================================================
  // RELATIONSHIP TIME
  // =========================================================

  function getRelationshipDate() {
    if (!couple?.relationship_date) {
      return new Date();
    }

    return new Date(`${couple.relationship_date}T00:00:00`);
  }

  function getTimeSince(start: Date) {
    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    // Проверяем, прошёл ли полный месяц
    const currentDay = now.getDate();
    const startDay = start.getDate();

    if (
      currentDay < startDay ||
      (currentDay === startDay &&
        (now.getHours() < start.getHours() ||
          (now.getHours() === start.getHours() &&
            (now.getMinutes() < start.getMinutes() ||
              (now.getMinutes() === start.getMinutes() &&
                now.getSeconds() < start.getSeconds())))))
    ) {
      months--;

      if (months < 0) {
        years--;
        months = 11;
      }
    }

    // Дата после вычитания лет и месяцев
    const baseDate = new Date(start);

    baseDate.setFullYear(start.getFullYear() + years);

    baseDate.setMonth(start.getMonth() + months);

    // Остаток времени после лет и месяцев
    let difference = now.getTime() - baseDate.getTime();

    difference = Math.max(0, difference);

    const totalSeconds = Math.floor(difference / 1000);

    const days = Math.floor(totalSeconds / 86400);

    const hours = Math.floor((totalSeconds % 86400) / 3600);

    const minutes = Math.floor((totalSeconds % 3600) / 60);

    const seconds = totalSeconds % 60;

    return {
      years,
      months,
      days,
      hours,
      minutes,
      seconds,
    };
  }

  function getDaysSince(start: Date) {
    const nowValue = new Date();

    return Math.max(
      0,
      Math.floor((nowValue.getTime() - start.getTime()) / 86400000),
    );
  }

  function formatNumber(value: number) {
    return String(value).padStart(2, "0");
  }

  // =========================================================
  // NAMES
  // =========================================================

  function getInitials(value?: string) {
    if (!value) return "?";

    return value
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }

  const myName = session?.user?.user_metadata?.name || name || "Вы";

  const myAvatarUrl =
    profilesList.find((profile) => profile.id === session?.user?.id)
      ?.avatar_url || null;

  const partnerAvatarUrl =
    profilesList.find((profile) => profile.id !== session?.user?.id)
      ?.avatar_url || null;

  const partnerName =
    profilesList.find((profile) => profile.id !== session?.user?.id)?.name ||
    "Партнёр";

  // =========================================================
  // HORIZONTAL DATE STRIP
  // =========================================================

  const daysStripRef = useRef<FlatList<Date>>(null);

  const todayButtonAnim = useRef(new Animated.Value(0)).current;

  const [todayButtonHeight, setTodayButtonHeight] = useState(0);

  const DAY_ITEM_WIDTH = 60;

  const [daysScrollX, setDaysScrollX] = useState(0);
  const [daysStripWidth, setDaysStripWidth] = useState(0);

  const dates = useMemo(() => {
    const result = [];

    const today = new Date();

    // Крайняя правая дата — всегда сегодня.
    // Влево показываем достаточно большой запас дней (~3 года),
    // чтобы прокрутка ощущалась как "без ограничений".
    const daysBack = 1095;

    for (let i = -daysBack; i <= 0; i++) {
      const date = new Date(today);

      date.setDate(today.getDate() + i);

      result.push(date);
    }

    return result;
  }, []);

  // Полная ширина ленты известна заранее — каждый элемент занимает
  // фиксированный слот DAY_ITEM_WIDTH, без необходимости ждать событий layout
  const daysContentWidth = dates.length * DAY_ITEM_WIDTH;

  function isSameDate(first: Date, second: Date) {
    return (
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate()
    );
  }

  function goToToday() {
    const today = new Date();

    setSelectedDate(today);

    daysStripRef.current?.scrollToIndex({
      index: dates.length - 1,
      animated: true,
    });
  }

  const maxDaysScrollX = Math.max(0, daysContentWidth - daysStripWidth);

  // Кнопка "Сегодня" появляется, когда лента прокручена достаточно далеко
  // влево и сегодняшний день (крайний правый элемент) уже не виден
  const showTodayButton =
    daysStripWidth > 0 && maxDaysScrollX - daysScrollX > DAY_ITEM_WIDTH;

  useEffect(() => {
    Animated.timing(todayButtonAnim, {
      toValue: showTodayButton ? 1 : 0,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [showTodayButton, todayButtonAnim]);

  // =========================================================
  // СПИСОК ТАЙМЕРОВ (главный + дополнительные)
  // =========================================================

  type TimerItem = {
    id: string;
    title: string;
    date: Date;
    isMain: boolean;
  };

  const timers: TimerItem[] = [
    {
      id: "main",
      title: `Влюблённые с ${partnerName}`,
      date: getRelationshipDate(),
      isMain: true,
    },
    ...customTimers.map((item) => ({
      id: item.id,
      title: item.title,
      date: new Date(`${item.start_date}T00:00:00`),
      isMain: false,
    })),
  ];

  const clampedTimerIndex = Math.min(activeTimerIndex, timers.length - 1);

  const activeTimer = timers[clampedTimerIndex];

  const relationshipTime = getTimeSince(activeTimer.date);

  const hasPartner = memberCount >= 2;

  // =========================================================
  // УПРАВЛЕНИЕ ТАЙМЕРАМИ
  // =========================================================

  function formatDateForInput(date: Date) {
    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  async function changeCoupleStatus(newStatus: string) {
    if (!couple?.id || statusSaving) {
      return;
    }

    if (newStatus === couple.relationship_status) {
      setStatusModalVisible(false);

      return;
    }

    setStatusSaving(true);

    try {
      const { data, error } = await supabase
        .from("couples")
        .update({ relationship_status: newStatus })
        .eq("id", couple.id)
        .select("id");

      if (error) {
        Alert.alert("Ошибка", error.message);

        return;
      }

      if (!data || data.length === 0) {
        Alert.alert(
          "Не удалось сохранить",
          "У таблицы couples нет политики на изменение (UPDATE). Добавьте её в Supabase.",
        );

        return;
      }

      setCouple((previous: any) =>
        previous ? { ...previous, relationship_status: newStatus } : previous,
      );

      setStatusModalVisible(false);
    } finally {
      setStatusSaving(false);
    }
  }

  function openCreateTimer() {
    setTimerModalMode("create");
    setTimerFormIsMain(false);
    setTimerFormTitle("");
    setTimerFormDate(formatDateISO(new Date()));
    setTimerModalVisible(true);
  }

  function openEditTimer() {
    setTimerModalMode("edit");
    setTimerFormIsMain(activeTimer.isMain);
    setTimerFormTitle(activeTimer.isMain ? "" : activeTimer.title);
    setTimerFormDate(formatDateForInput(activeTimer.date));
    setTimerModalVisible(true);
  }

  async function saveTimerForm() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(timerFormDate.trim())) {
      Alert.alert(
        "Неверная дата",
        "Используйте формат ГГГГ-ММ-ДД\nНапример: 2026-09-01",
      );

      return;
    }

    if (!timerFormIsMain && !timerFormTitle.trim()) {
      Alert.alert("Ошибка", "Введите название таймера");

      return;
    }

    if (!couple?.id || !session?.user?.id) {
      return;
    }

    setTimerSaving(true);

    try {
      if (timerFormIsMain) {
        // Редактируем главный таймер - дату начала отношений

        const { error } = await supabase
          .from("couples")
          .update({ relationship_date: timerFormDate.trim() })
          .eq("id", couple.id);

        if (error) {
          Alert.alert("Ошибка", error.message);

          return;
        }

        setCouple((previous: any) =>
          previous
            ? { ...previous, relationship_date: timerFormDate.trim() }
            : previous,
        );
      } else if (timerModalMode === "create") {
        const { error } = await supabase.from("couple_timers").insert({
          couple_id: couple.id,
          title: timerFormTitle.trim(),
          start_date: timerFormDate.trim(),
          created_by: session.user.id,
        });

        if (error) {
          Alert.alert("Ошибка", error.message);

          return;
        }

        const updated = await loadTimers(couple.id);

        // Переключаемся на только что созданный таймер (он последний)

        setActiveTimerIndex(updated.length);
      } else {
        const { error } = await supabase
          .from("couple_timers")
          .update({
            title: timerFormTitle.trim(),
            start_date: timerFormDate.trim(),
          })
          .eq("id", activeTimer.id);

        if (error) {
          Alert.alert("Ошибка", error.message);

          return;
        }

        await loadTimers(couple.id);
      }

      setTimerModalVisible(false);
    } finally {
      setTimerSaving(false);
    }
  }

  function deleteActiveTimer() {
    if (activeTimer.isMain || !couple?.id) {
      return;
    }

    const timerId = activeTimer.id;

    Alert.alert("Удалить таймер?", "Это действие нельзя отменить.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("couple_timers")
            .delete()
            .eq("id", timerId);

          if (error) {
            Alert.alert("Ошибка", error.message);

            return;
          }

          const updated = await loadTimers(couple.id);

          setActiveTimerIndex((previous) => Math.min(previous, updated.length));
        },
      },
    ]);
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#e98ca8" />
      </View>
    );
  }

  // =========================================================
  // AUTH SCREEN
  // =========================================================

  if (!session) {
    return (
      <KeyboardAvoidingView
        style={styles.authContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.authScroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.authLogo}>
            <View style={[styles.authAvatar, styles.authAvatarLeft]}>
              <Text style={styles.authAvatarText}>Я</Text>
            </View>

            <View style={[styles.authAvatar, styles.authAvatarRight]}>
              <Text style={styles.authAvatarText}>♥</Text>
            </View>
          </View>

          <Text style={styles.authTitle}>Ваш общий мир</Text>

          <Text style={styles.authSubtitle}>Место только для вас двоих ❤️</Text>

          <View style={styles.authCard}>
            {authMode === "register" && (
              <TextInput
                style={styles.input}
                placeholder="Ваше имя"
                placeholderTextColor="#b9a2aa"
                value={name}
                onChangeText={setName}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#b9a2aa"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              style={styles.input}
              placeholder="Пароль"
              placeholderTextColor="#b9a2aa"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Pressable style={styles.primaryButton} onPress={handleAuth}>
              <Text style={styles.primaryButtonText}>
                {authMode === "login" ? "Войти →" : "Создать аккаунт →"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                setAuthMode(authMode === "login" ? "register" : "login")
              }
            >
              <Text style={styles.switchAuthText}>
                {authMode === "login"
                  ? "Нет аккаунта? Создать"
                  : "Уже есть аккаунт? Войти"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // =========================================================
  // NO COUPLE
  // =========================================================

  if (!couple) {
    return (
      <View style={styles.menuScreen}>
        <View style={styles.menuHeader}>
          <Text style={styles.menuSmallText}>Добро пожаловать ❤️</Text>

          <Text style={styles.menuTitle}>Создадим ваш общий мир?</Text>

          <Text style={styles.menuSubtitle}>Выберите, как начать</Text>
        </View>

        {coupleMode === "menu" && (
          <View style={styles.menuButtons}>
            <Pressable
              style={styles.bigMenuButton}
              onPress={() => setCoupleMode("create")}
            >
              <View>
                <Text style={styles.bigMenuTitle}>Создать пару</Text>

                <Text style={styles.bigMenuSubtitle}>
                  Создай пространство для вас двоих
                </Text>
              </View>

              <Text style={styles.bigMenuArrow}>→</Text>
            </Pressable>

            <Pressable
              style={styles.bigMenuButton}
              onPress={() => setCoupleMode("join")}
            >
              <View>
                <Text style={styles.bigMenuTitle}>Ввести код</Text>

                <Text style={styles.bigMenuSubtitle}>
                  Присоединись к уже созданной паре
                </Text>
              </View>

              <Text style={styles.bigMenuArrow}>→</Text>
            </Pressable>
          </View>
        )}

        {coupleMode === "create" && (
          <View style={styles.formCard}>
            <Pressable onPress={() => setCoupleMode("menu")}>
              <Text style={styles.backText}>← Назад</Text>
            </Pressable>

            <Text style={styles.formTitle}>Создать пару</Text>

            <Text style={styles.formLabel}>Статус отношений</Text>

            <View style={styles.statusRow}>
              {["влюбленные", "женаты", "друзья"].map((item) => (
                <Pressable
                  key={item}
                  style={[
                    styles.statusButton,
                    status === item && styles.statusButtonActive,
                  ]}
                  onPress={() => setStatus(item)}
                >
                  <Text
                    style={[
                      styles.statusText,
                      status === item && styles.statusTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.formLabel}>Дата начала отношений</Text>

            <DateWheel
              value={relationshipDate}
              onChange={setRelationshipDate}
            />

            <Pressable style={styles.primaryButton} onPress={createCouple}>
              <Text style={styles.primaryButtonText}>Создать пару ❤️</Text>
            </Pressable>
          </View>
        )}

        {coupleMode === "join" && (
          <View style={styles.formCard}>
            <Pressable onPress={() => setCoupleMode("menu")}>
              <Text style={styles.backText}>← Назад</Text>
            </Pressable>

            <Text style={styles.formTitle}>Войти в пару</Text>

            <Text style={styles.formDescription}>
              Введи код, который отправил тебе партнёр.
            </Text>

            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="ABC123"
              placeholderTextColor="#b9a2aa"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              maxLength={6}
            />

            <Pressable style={styles.primaryButton} onPress={joinCouple}>
              <Text style={styles.primaryButtonText}>Присоединиться ❤️</Text>
            </Pressable>
          </View>
        )}

        <Pressable style={styles.logoutSmall} onPress={logout}>
          <Text style={styles.logoutSmallText}>Выйти из аккаунта</Text>
        </Pressable>
      </View>
    );
  }

  // =========================================================
  // MAIN SCREEN
  // =========================================================

  return (
    <View style={styles.mainScreen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.mainScroll,
          {
            minHeight: SCREEN_HEIGHT + 150,
          },
        ]}
      >
        {/* ================================================= */}
        {/* TOP */}
        {/* ================================================= */}

        <View style={styles.topBar}>
          <View style={styles.avatars}>
            <View style={styles.avatarBack}>
              {partnerAvatarUrl ? (
                <Image
                  source={{ uri: partnerAvatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {getInitials(partnerName)}
                </Text>
              )}
            </View>

            <View style={styles.avatarFront}>
              {myAvatarUrl ? (
                <Image
                  source={{ uri: myAvatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>{getInitials(myName)}</Text>
              )}
            </View>
          </View>

          <Pressable
            style={styles.statusPill}
            onPress={() => setStatusModalVisible(true)}
          >
            <Text style={styles.statusPillText}>
              {capitalizeFirst(couple.relationship_status || "влюбленные")}
            </Text>

            <Text style={styles.statusArrow}>⌄</Text>
          </Pressable>

          <View style={styles.missContainer}>
            <View style={styles.missCounter}>
              <Text style={styles.missLabel}>Скучаю</Text>

              <Text style={styles.missValue}>
                {myMissCount}/{partnerMissCount}
              </Text>
            </View>

            <Pressable
              style={[
                styles.heartButton,
                missLoading && styles.heartButtonDisabled,
              ]}
              onPress={pressMiss}
            >
              <Text style={styles.heartText}>♥</Text>
            </Pressable>
          </View>
        </View>

        {/* ================================================= */}
        {/* ДНИ — ГОРИЗОНТАЛЬНАЯ ЛЕНТА */}
        {/* ================================================= */}

        <View style={styles.daysStripWrapper}>
          <FlatList
            ref={daysStripRef}
            data={dates}
            keyExtractor={(date, index) => `${date.getTime()}-${index}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={DAY_ITEM_WIDTH}
            decelerationRate="fast"
            contentContainerStyle={styles.daysStrip}
            scrollEventThrottle={32}
            initialScrollIndex={dates.length - 1}
            getItemLayout={(_, index) => ({
              length: DAY_ITEM_WIDTH,
              offset: DAY_ITEM_WIDTH * index,
              index,
            })}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={7}
            removeClippedSubviews
            onLayout={(event) => {
              setDaysStripWidth(event.nativeEvent.layout.width);
            }}
            onScroll={(event) => {
              setDaysScrollX(event.nativeEvent.contentOffset.x);
            }}
            renderItem={({ item: date, index }) => {
              const selected = isSameDate(date, selectedDate);

              const today = isSameDate(date, new Date());

              const weekday = date.toLocaleDateString("ru-RU", {
                weekday: "short",
              });

              return (
                <Pressable
                  style={[styles.dayItem, selected && styles.dayItemSelected]}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text
                    style={[styles.dayWeek, selected && styles.dayWeekSelected]}
                  >
                    {weekday.slice(0, 2).toUpperCase()}
                  </Text>

                  <Text
                    style={[
                      styles.dayNumber,
                      selected && styles.dayNumberSelected,
                    ]}
                  >
                    {date.getDate()}
                  </Text>

                  {today && <View style={styles.todayDot} />}
                </Pressable>
              );
            }}
          />

          <Animated.View
            style={{
              alignItems: "center",
              opacity: todayButtonAnim,
              height: todayButtonAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, todayButtonHeight || 40],
              }),
              overflow: "hidden",
            }}
          >
            <Pressable
              style={styles.todayButton}
              onPress={goToToday}
              onLayout={(event) => {
                const measuredHeight = event.nativeEvent.layout.height + 20;

                if (Math.abs(measuredHeight - todayButtonHeight) > 1) {
                  setTodayButtonHeight(measuredHeight);
                }
              }}
            >
              <Text style={styles.todayButtonText}>Сегодня →</Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* ================================================= */}
        {/* ПЕРЕКЛЮЧАТЕЛЬ ТАЙМЕРОВ */}
        {/* ================================================= */}

        <Text style={styles.timerActiveLabel}>{activeTimer.title}</Text>

        <View style={styles.timerSwitcherRow}>
          <AnimatedTimerButton
            visible={clampedTimerIndex > 0}
            onPress={() => setActiveTimerIndex((value) => value - 1)}
            icon="back"
          />

          <View style={styles.timerFixedSlot}>
            <TimerCircleButton icon="edit" onPress={openEditTimer} />
          </View>

          <View style={styles.timerFixedSlot}>
            <TimerCircleButton icon="add" onPress={openCreateTimer} />
          </View>

          <AnimatedTimerButton
            visible={!activeTimer.isMain}
            onPress={deleteActiveTimer}
            icon="delete"
          />

          <AnimatedTimerButton
            visible={clampedTimerIndex < timers.length - 1}
            onPress={() => setActiveTimerIndex((value) => value + 1)}
            icon="next"
          />
        </View>

        {/* ================================================= */}
        {/* RELATIONSHIP */}
        {/* ================================================= */}

        <View style={styles.relationshipCard}>
          <Text style={styles.bigHeart}>♥</Text>

          <Text style={styles.daysNumber}>
            {getDaysSince(activeTimer.date)}
          </Text>

          <Text style={styles.daysLabel}>
            {getDaysSince(activeTimer.date) === 1 ? "день" : "дней"}
            {activeTimer.isMain ? " вместе" : ""}
          </Text>

          <View style={styles.timeTogether}>
            <View style={styles.timeMainRow}>
              <View style={styles.timeUnit}>
                <Text style={styles.timeNumber}>{relationshipTime.years}</Text>

                <Text style={styles.timeLabel}>
                  {relationshipTime.years === 1
                    ? "год"
                    : relationshipTime.years >= 2 && relationshipTime.years <= 4
                      ? "года"
                      : "лет"}
                </Text>
              </View>

              <View style={styles.timeUnit}>
                <Text style={styles.timeNumber}>{relationshipTime.months}</Text>

                <Text style={styles.timeLabel}>
                  {relationshipTime.months === 1
                    ? "месяц"
                    : relationshipTime.months >= 2 &&
                        relationshipTime.months <= 4
                      ? "месяца"
                      : "месяцев"}
                </Text>
              </View>

              <View style={styles.timeUnit}>
                <Text style={styles.timeNumber}>{relationshipTime.days}</Text>

                <Text style={styles.timeLabel}>
                  {relationshipTime.days === 1
                    ? "день"
                    : relationshipTime.days >= 2 && relationshipTime.days <= 4
                      ? "дня"
                      : "дней"}
                </Text>
              </View>
            </View>

            <View style={styles.timeSecondsRow}>
              <View style={styles.smallTimeUnit}>
                <Text style={styles.smallTimeNumber}>
                  {String(relationshipTime.hours).padStart(2, "0")}
                </Text>

                <Text style={styles.smallTimeLabel}>часов</Text>
              </View>

              <Text style={styles.timeSeparator}>:</Text>

              <View style={styles.smallTimeUnit}>
                <Text style={styles.smallTimeNumber}>
                  {String(relationshipTime.minutes).padStart(2, "0")}
                </Text>

                <Text style={styles.smallTimeLabel}>минут</Text>
              </View>

              <Text style={styles.timeSeparator}>:</Text>

              <View style={styles.smallTimeUnit}>
                <Text style={styles.smallTimeNumber}>
                  {String(relationshipTime.seconds).padStart(2, "0")}
                </Text>

                <Text style={styles.smallTimeLabel}>секунд</Text>
              </View>
            </View>
          </View>

          <View style={styles.historyLine} />

          <Text style={styles.historyTitle}>{activeTimer.title}</Text>

          <Text style={styles.historyDate}>
            {activeTimer.date.toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>

        {/* ================================================= */}
        {/* INVITE */}
        {/* ================================================= */}

        {!hasPartner && (
          <View style={styles.inviteCard}>
            <Text style={styles.inviteEmoji}>💌</Text>

            <View style={styles.inviteContent}>
              <Text style={styles.inviteTitle}>Пригласи партнёра</Text>

              <Text style={styles.inviteDescription}>
                Отправь этот код, чтобы вы оказались в одном пространстве.
              </Text>

              <Text style={styles.inviteCode}>{couple.invite_code}</Text>

              <Pressable style={styles.shareButton} onPress={shareInviteCode}>
                <Text style={styles.shareButtonText}>Поделиться кодом</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ================================================= */}
        {/* PARTNER */}
        {/* ================================================= */}

        {hasPartner && (
          <View style={styles.partnerCard}>
            <View style={styles.partnerAvatar}>
              <Text style={styles.partnerAvatarText}>
                {getInitials(partnerName)}
              </Text>
            </View>

            <View style={styles.partnerInfo}>
              <Text style={styles.partnerTitle}>Вы вместе ❤️</Text>

              <Text style={styles.partnerName}>{partnerName}</Text>
            </View>

            <Text style={styles.partnerCheck}>✓</Text>
          </View>
        )}

        {/* ================================================= */}
        {/* BOTTOM */}
        {/* ================================================= */}

        <View style={styles.bottomArea}>
          <Text style={styles.bottomText}>Ваш маленький мир ❤️</Text>

          <Pressable style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutButtonText}>Выйти из аккаунта</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ================================================= */}
      {/* МОДАЛКА СТАТУСА ПАРЫ */}
      {/* ================================================= */}

      <FadeModal
        visible={statusModalVisible}
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setStatusModalVisible(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Статус отношений</Text>

            <View style={styles.statusRow}>
              {["влюбленные", "женаты", "друзья"].map((item) => {
                const active =
                  (couple.relationship_status || "влюбленные") === item;

                return (
                  <Pressable
                    key={item}
                    style={[
                      styles.statusButton,
                      active && styles.statusButtonActive,
                    ]}
                    onPress={() => changeCoupleStatus(item)}
                    disabled={statusSaving}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        active && styles.statusTextActive,
                      ]}
                    >
                      {capitalizeFirst(item)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable onPress={() => setStatusModalVisible(false)}>
              <Text style={styles.modalCancelText}>Отмена</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </FadeModal>

      {/* ================================================= */}
      {/* МОДАЛКА ТАЙМЕРА */}
      {/* ================================================= */}

      <FadeModal
        visible={timerModalVisible}
        onRequestClose={() => setTimerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {timerFormIsMain
                ? "Дата начала отношений"
                : timerModalMode === "create"
                  ? "Новый таймер"
                  : "Изменить таймер"}
            </Text>

            {!timerFormIsMain && (
              <TextInput
                style={styles.input}
                placeholder="Название (например, Переезд)"
                placeholderTextColor="#b9a2aa"
                value={timerFormTitle}
                onChangeText={setTimerFormTitle}
              />
            )}

            <DateWheel value={timerFormDate} onChange={setTimerFormDate} />

            <Pressable
              style={styles.primaryButton}
              onPress={saveTimerForm}
              disabled={timerSaving}
            >
              <Text style={styles.primaryButtonText}>
                {timerSaving ? "Сохраняем..." : "Сохранить"}
              </Text>
            </Pressable>

            <Pressable onPress={() => setTimerModalVisible(false)}>
              <Text style={styles.modalCancelText}>Отмена</Text>
            </Pressable>
          </View>
        </View>
      </FadeModal>
    </View>
  );
}

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: "#fff5f8",
    alignItems: "center",
    justifyContent: "center",
  },

  // =======================================================
  // AUTH
  // =======================================================

  authContainer: {
    flex: 1,
    backgroundColor: "#fff5f8",
  },

  authScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 50,
  },

  authLogo: {
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  authAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#fff5f8",
  },

  authAvatarLeft: {
    backgroundColor: "#f3b3c5",
    transform: [
      {
        translateX: -23,
      },
    ],
  },

  authAvatarRight: {
    backgroundColor: "#e98ca8",
    transform: [
      {
        translateX: 23,
      },
    ],
  },

  authAvatarText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },

  authTitle: {
    textAlign: "center",
    fontSize: 34,
    fontWeight: "800",
    color: "#35242a",
  },

  authSubtitle: {
    textAlign: "center",
    marginTop: 8,
    marginBottom: 30,
    fontSize: 15,
    color: "#92767f",
  },

  authCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 20,
    shadowColor: "#9b6676",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 4,
  },

  input: {
    height: 54,
    backgroundColor: "#fff7f9",
    borderRadius: 16,
    paddingHorizontal: 17,
    fontSize: 16,
    color: "#35242a",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f4dce3",
  },

  primaryButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#e98ca8",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    shadowColor: "#d86f91",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 3,
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },

  switchAuthText: {
    textAlign: "center",
    color: "#d56e91",
    marginTop: 20,
    fontSize: 14,
    fontWeight: "700",
  },

  // =======================================================
  // MENU
  // =======================================================

  menuScreen: {
    flex: 1,
    backgroundColor: "#fff5f8",
    paddingHorizontal: 20,
    paddingTop: 80,
  },

  menuHeader: {
    marginBottom: 35,
  },

  menuSmallText: {
    color: "#d97896",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },

  menuTitle: {
    color: "#35242a",
    fontSize: 31,
    fontWeight: "800",
    lineHeight: 37,
  },

  menuSubtitle: {
    color: "#92767f",
    fontSize: 16,
    marginTop: 10,
  },

  menuButtons: {
    gap: 14,
  },

  bigMenuButton: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#9b6676",
    shadowOpacity: 0.07,
    shadowRadius: 15,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 3,
  },

  bigMenuTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#35242a",
  },

  bigMenuSubtitle: {
    fontSize: 13,
    color: "#9c828a",
    marginTop: 5,
    maxWidth: 260,
  },

  bigMenuArrow: {
    fontSize: 28,
    color: "#e98ca8",
  },

  formCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 22,
  },

  backText: {
    color: "#d66f90",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 22,
  },

  formTitle: {
    fontSize: 27,
    color: "#35242a",
    fontWeight: "800",
    marginBottom: 20,
  },

  formDescription: {
    color: "#92767f",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },

  formLabel: {
    color: "#624850",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },

  statusRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },

  statusButton: {
    flex: 1,
    backgroundColor: "#fff4f7",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f4dce3",
  },

  statusButtonActive: {
    backgroundColor: "#e98ca8",
    borderColor: "#e98ca8",
  },

  statusText: {
    color: "#9c7c86",
    fontSize: 12,
    fontWeight: "700",
  },

  statusTextActive: {
    color: "#fff",
  },

  codeInput: {
    textAlign: "center",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 4,
  },

  logoutSmall: {
    marginTop: 35,
    alignItems: "center",
  },

  logoutSmallText: {
    color: "#aa8d96",
    fontSize: 13,
  },

  // =======================================================
  // MAIN
  // =======================================================

  mainScreen: {
    flex: 1,
    backgroundColor: "#fff5f8",
  },

  mainScroll: {
    paddingHorizontal: 18,
    paddingTop: 55,
    paddingBottom: 70,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },

  avatars: {
    width: 78,
    height: 58,
    position: "relative",
  },

  avatarBack: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f4c2d1",
    position: "absolute",
    left: 0,
    top: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff5f8",
  },

  avatarFront: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e98ca8",
    position: "absolute",
    left: 27,
    top: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff5f8",
  },

  avatarText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
  },

  statusPill: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    shadowColor: "#9b6676",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 2,
  },

  statusPillText: {
    color: "#704e59",
    fontSize: 12,
    fontWeight: "700",
  },

  statusArrow: {
    color: "#b8949f",
    fontSize: 15,
  },

  missContainer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },

  missCounter: {
    alignItems: "flex-end",
  },

  missLabel: {
    color: "#a0838c",
    fontSize: 10,
    fontWeight: "700",
  },

  missValue: {
    color: "#6d4b55",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },

  heartButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#9b6676",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 2,
  },

  heartButtonDisabled: {
    opacity: 0.5,
  },

  heartText: {
    color: "#e98ca8",
    fontSize: 20,
  },

  // =======================================================
  // DAYS STRIP
  // =======================================================

  daysStripWrapper: {
    position: "relative",
  },

  todayButton: {
    alignSelf: "center",
    marginTop: 8,
    backgroundColor: "#e98ca8",
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 14,
    shadowColor: "#9b6676",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 4,
  },

  todayButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },

  daysStrip: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 8,
    marginBottom: 5,
  },

  dayItem: {
    width: 52,
    height: 67,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  dayItemSelected: {
    backgroundColor: "#e98ca8",
  },

  dayWeek: {
    color: "#a78b94",
    fontSize: 9,
    fontWeight: "800",
    marginBottom: 4,
  },

  dayWeekSelected: {
    color: "#ffeef3",
  },

  dayNumber: {
    color: "#49333b",
    fontSize: 20,
    fontWeight: "800",
  },

  dayNumberSelected: {
    color: "#fff",
  },

  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e98ca8",
    position: "absolute",
    bottom: 5,
  },

  timerActiveLabel: {
    textAlign: "center",
    color: "#9c7c86",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 7,
    marginBottom: 10,
  },

  timerSwitcherRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  timerFixedSlot: {
    marginHorizontal: 5,
  },

  timerCircleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#e98ca8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#9b6676",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 4,
  },

  androidDateField: {
    justifyContent: "center",
  },

  androidDateText: {
    color: "#35242a",
    fontSize: 16,
  },

  dateWheel: {
    height: 170,
    alignSelf: "stretch",
    marginBottom: 8,
  },

  dateWrapper: {
    marginBottom: 12,
  },

  dateField: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ead5dc",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dateFieldText: {
    color: "#35242a",
    fontSize: 16,
    fontWeight: "700",
  },

  dateFieldIcon: {
    color: "#c98aa0",
    fontSize: 14,
    fontWeight: "800",
  },

  calendar: {
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#f2dfe5",
    padding: 10,
  },

  chipRow: {
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },

  chip: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff5f8",
    alignItems: "center",
    justifyContent: "center",
  },

  chipActive: {
    backgroundColor: "#e98ca8",
  },

  chipText: {
    color: "#8a6b74",
    fontSize: 13,
    fontWeight: "700",
  },

  chipTextActive: {
    color: "#ffffff",
  },

  weekRow: {
    flexDirection: "row",
    marginTop: 10,
  },

  weekText: {
    flex: 1,
    textAlign: "center",
    color: "#b49ba3",
    fontSize: 12,
    fontWeight: "700",
  },

  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },

  dayCell: {
    width: "14.2857%",
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  dayCellActive: {
    backgroundColor: "#e98ca8",
    borderRadius: 20,
  },

  dayText: {
    color: "#35242a",
    fontSize: 15,
    fontWeight: "600",
  },

  dayTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },

  dayTextDisabled: {
    color: "#d9c7cd",
  },

  calendarDone: {
    marginTop: 10,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#e98ca8",
    alignItems: "center",
    justifyContent: "center",
  },

  calendarDoneText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(53, 36, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  modalCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 26,
    padding: 22,
  },

  modalTitle: {
    color: "#35242a",
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 16,
  },

  modalCancelText: {
    textAlign: "center",
    color: "#a0838c",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 14,
  },

  // =======================================================
  // RELATIONSHIP CARD
  // =======================================================

  relationshipCard: {
    backgroundColor: "#fff",
    borderRadius: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 30,
    shadowColor: "#9b6676",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 7,
    },
    elevation: 3,
  },

  bigHeart: {
    color: "#ed9ab2",
    fontSize: 29,
    marginBottom: 5,
  },

  daysNumber: {
    color: "#35242a",
    fontSize: 68,
    lineHeight: 74,
    fontWeight: "800",
  },

  daysLabel: {
    color: "#92767f",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 25,
  },

  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  timerBlock: {
    alignItems: "center",
    minWidth: 45,
  },

  timerNumber: {
    color: "#4d343c",
    fontSize: 19,
    fontWeight: "800",
  },

  timerLabel: {
    color: "#b49ba3",
    fontSize: 8,
    fontWeight: "700",
    marginTop: 2,
  },

  timerColon: {
    color: "#d4a7b4",
    fontSize: 19,
    fontWeight: "800",
    marginHorizontal: 2,
    marginBottom: 10,
  },

  historyLine: {
    width: "70%",
    height: 1,
    backgroundColor: "#f2dfe5",
    marginVertical: 24,
  },

  historyTitle: {
    color: "#967983",
    fontSize: 12,
    fontWeight: "600",
  },

  historyDate: {
    color: "#513943",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 5,
  },
  timeTogether: {
    alignItems: "center",
    marginTop: 5,
  },

  timeMainRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 10,
    width: "100%",
  },

  timeUnit: {
    alignItems: "center",
    flexShrink: 1,
    minWidth: 0,
  },

  timeNumber: {
    color: "#49333b",
    fontSize: 24,
    fontWeight: "800",
  },

  timeLabel: {
    color: "#a0838c",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },

  timeSecondsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },

  smallTimeUnit: {
    alignItems: "center",
    minWidth: 44,
  },

  smallTimeNumber: {
    color: "#60434c",
    fontSize: 17,
    fontWeight: "800",
  },

  smallTimeLabel: {
    color: "#b49ba3",
    fontSize: 9,
    marginTop: 2,
  },

  timeSeparator: {
    color: "#d4a7b4",
    fontSize: 18,
    fontWeight: "800",
    marginHorizontal: 2,
    marginBottom: 12,
  },

  // =======================================================
  // INVITE
  // =======================================================

  inviteCard: {
    marginTop: 15,
    backgroundColor: "#fff",
    borderRadius: 25,
    padding: 20,
    flexDirection: "row",
    gap: 14,
  },

  inviteEmoji: {
    fontSize: 29,
  },

  inviteContent: {
    flex: 1,
  },

  inviteTitle: {
    color: "#49333b",
    fontSize: 17,
    fontWeight: "800",
  },

  inviteDescription: {
    color: "#9b7d87",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },

  inviteCode: {
    color: "#e27f9d",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 4,
    marginTop: 12,
  },

  shareButton: {
    alignSelf: "flex-start",
    backgroundColor: "#fff0f4",
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 10,
  },

  shareButtonText: {
    color: "#d66f90",
    fontSize: 12,
    fontWeight: "800",
  },

  // =======================================================
  // PARTNER
  // =======================================================

  partnerCard: {
    marginTop: 15,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },

  partnerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#f0aec3",
    alignItems: "center",
    justifyContent: "center",
  },

  partnerAvatarText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },

  partnerInfo: {
    marginLeft: 13,
    flex: 1,
  },

  partnerTitle: {
    color: "#a0838c",
    fontSize: 11,
    fontWeight: "600",
  },

  partnerName: {
    color: "#49333b",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 2,
  },

  partnerCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e9f7ee",
    color: "#68ad7e",
    textAlign: "center",
    lineHeight: 30,
    fontWeight: "900",
  },

  // =======================================================
  // BOTTOM
  // =======================================================

  bottomArea: {
    alignItems: "center",
    paddingTop: 55,
  },

  bottomText: {
    color: "#c0a6af",
    fontSize: 12,
    marginBottom: 25,
  },

  logoutButton: {
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#f1dce3",
  },

  logoutButtonText: {
    color: "#a0838c",
    fontSize: 13,
    fontWeight: "700",
  },
});
