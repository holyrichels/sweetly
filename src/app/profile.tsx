import { useRef, useState } from "react";

import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import SecureImage from "@/components/secure-image";
import SkeletonScreen from "@/components/skeleton-screen";
import SoloProfile from "@/components/solo-profile";
import { C, FONTS, liveStyles } from "@/constants/sweetly-theme";
import { refreshAppData, useAppData } from "@/lib/app-data";
import { notify } from "@/lib/dialogs";
import { logMiss } from "@/lib/miss-log";
import { supabase } from "@/lib/supabase";

const HEART = "M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z";
const CALENDAR = "M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zM3 10h18M8 3v4M16 3v4";
const SLIDERS = "M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6";
const CHEVRON = "M9 6l6 6-6 6";

function daysSince(value?: string | null) {
  if (!value) return 0;

  const start = new Date(`${value}T00:00:00`).getTime();

  return Math.max(0, Math.floor((Date.now() - start) / 86400000));
}

function initialOf(name?: string | null) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

function Icon({ d, color, size = 22 }: { d: string; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ProfileScreen() {
  const router = useRouter();

  const app = useAppData();

  const [uploading, setUploading] = useState(false);

  const [busy, setBusy] = useState(false);

  // Анимация «Скучаю»: кнопка сжимается и возвращается, над ней поднимается сердечко
  const missScale = useRef(new Animated.Value(1)).current;

  const missFloat = useRef(new Animated.Value(0)).current;

  function playMissAnimation() {
    missScale.setValue(1);

    Animated.sequence([
      Animated.timing(missScale, { toValue: 0.88, duration: 90, useNativeDriver: true }),
      Animated.spring(missScale, { toValue: 1, friction: 3, tension: 180, useNativeDriver: true }),
    ]).start();

    missFloat.setValue(0);

    Animated.timing(missFloat, { toValue: 1, duration: 900, useNativeDriver: true }).start();
  }

  const burstOpacity = missFloat.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] });

  const burstY = missFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -70] });

  if (!app.ready) return <SkeletonScreen />;

  const hasPartner = !!app.partner;

  if (!hasPartner) return <SoloProfile />;

  const days = daysSince(app.couple?.relationship_date);

  const total = app.missMine + app.missPartner;

  // Смена аватарки: фото уходит в приватное хранилище
  async function pickAvatar() {
    if (!app.userId || uploading) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted && permission.canAskAgain !== false) {
      notify("Нужен доступ", "Разрешите доступ к фото, чтобы выбрать аватарку.");

      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);

    try {
      const response = await fetch(result.assets[0].uri);

      const bytes = await response.arrayBuffer();

      const path = `${app.userId}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: true });

      if (uploadError) {
        notify("Ошибка", uploadError.message);

        return;
      }

      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", app.userId);

      if (error) {
        notify("Ошибка", error.message);

        return;
      }

      await refreshAppData();
    } catch (error) {
      notify("Ошибка", (error as Error).message);
    } finally {
      setUploading(false);
    }
  }

  // Нажатие «Скучаю»: считаем, пишем в журнал и отправляем уведомление партнёру
  async function pressMiss() {
    if (!app.coupleId || busy) return;

    playMissAnimation();

    setBusy(true);

    try {
      const { error } = await supabase.rpc("increment_miss_count", {
        target_couple_id: app.coupleId,
      });

      if (error) {
        notify("Ошибка", error.message);

        return;
      }

      await logMiss(app.coupleId, app.userId ?? "");

      supabase.functions.invoke("notify-partner", { body: { kind: "miss" } }).catch(() => {});

      await refreshAppData();
    } finally {
      setBusy(false);
    }
  }

  const rows = [
    { title: "Данные пары", icon: HEART, path: "/profile-pair" },
    { title: "Даты и таймеры", icon: CALENDAR, path: "/profile-dates" },
    { title: "Настройки", icon: SLIDERS, path: "/settings" },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Профиль</Text>

      <Pressable style={styles.me} onPress={pickAvatar}>
        <View style={styles.avatar}>
          <SecureImage
            bucket="avatars"
            path={app.me?.avatar_url}
            style={styles.avatarImage}
            fallback={<Text style={styles.avatarLetter}>{initialOf(app.me?.name)}</Text>}
          />
        </View>

        <Text style={styles.name}>{uploading ? "Загружаем..." : app.me?.name || "Без имени"}</Text>
        <Text style={styles.nick}>{app.telegramUsername ? `@${app.telegramUsername}` : "Аккаунт Sweetly"}</Text>
      </Pressable>

      {/* ============ ВЫ ВМЕСТЕ ============ */}

      <View style={styles.card}>
        <View style={styles.pairLeft}>
          <View style={styles.pairAvatars}>
            <View style={[styles.miniAvatar, styles.miniBack]}>
              <Text style={styles.miniLetter}>{initialOf(app.me?.name)}</Text>
            </View>

            <View style={[styles.miniAvatar, styles.miniFront]}>
              <SecureImage
                bucket="avatars"
                path={app.partner?.avatar_url}
                style={styles.avatarImage}
                fallback={<Icon d={HEART} color={C.accent} size={16} />}
              />
            </View>
          </View>

          <View style={styles.flex}>
            <Text style={styles.pairSmall}>Вы вместе с</Text>
            <Text style={styles.pairName} numberOfLines={1}>
              {app.partner?.name}
            </Text>
          </View>
        </View>

        <View style={styles.daysBox}>
          <Text style={styles.daysNumber}>{days}</Text>
          <Text style={styles.daysUnit}>дн</Text>
        </View>
      </View>

      {/* ============ СКУЧАЮ ============ */}

      <View style={styles.card}>
        <View style={styles.missTop}>
          <View style={styles.flex}>
            <Text style={styles.missLabel}>Скучаю</Text>
            <Text style={styles.missTotal}>
              {total} <Text style={styles.missUnit}>раз</Text>
            </Text>
          </View>

          <Animated.View style={{ transform: [{ scale: missScale }] }}>
            <Pressable style={styles.missButton} onPress={pressMiss} disabled={busy}>
              <Icon d={HEART} color={C.accentOn} size={18} />
              <Text style={styles.missButtonText}>Скучаю</Text>
            </Pressable>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[styles.burst, { opacity: burstOpacity, transform: [{ translateY: burstY }] }]}
          >
            <Icon d={HEART} color={C.accent} size={26} />
          </Animated.View>
        </View>

        <View style={styles.statsRow}>
          {[
            { n: total, label: "общее" },
            { n: app.missMine, label: "моё" },
            { n: app.missPartner, label: "партнёра" },
          ].map((item) => (
            <View key={item.label} style={styles.stat}>
              <Text style={styles.statNumber}>{item.n}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ============ РАЗДЕЛЫ ============ */}

      <View style={styles.list}>
        {rows.map((row, index) => (
          <Pressable
            key={row.title}
            style={[styles.row, index < rows.length - 1 && styles.border]}
            onPress={() => router.push(row.path as any)}
          >
            <Icon d={row.icon} color={C.dashed} size={22} />
            <Text style={styles.rowTitle}>{row.title}</Text>
            <Icon d={CHEVRON} color={C.muted} size={20} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = liveStyles(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.background },

    content: {
      paddingHorizontal: 22,
      paddingTop: 55,
      paddingBottom: 70,
      width: "100%",
      maxWidth: 520,
      alignSelf: "center",
      gap: 14,
    },

    flex: { flex: 1 },

    title: {
      color: C.text,
      fontFamily: FONTS.display,
      fontSize: 36,
    },

    me: {
      alignItems: "center",
      gap: 6,
      marginTop: 4,
    },

    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: C.accent,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },

    avatarImage: {
      width: "100%",
      height: "100%",
    },

    avatarLetter: {
      color: C.accentOn,
      fontFamily: FONTS.display,
      fontSize: 40,
    },

    name: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 22,
      marginTop: 6,
    },

    nick: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 14,
    },

    card: {
      backgroundColor: C.card,
      borderRadius: 24,
      padding: 18,
      gap: 14,
    },

    pairLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

    pairAvatars: {
      width: 64,
      height: 40,
    },

    miniAvatar: {
      position: "absolute",
      top: 0,
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: C.card,
    },

    miniBack: {
      left: 0,
      backgroundColor: C.peach,
    },

    miniFront: {
      left: 22,
      backgroundColor: C.peachLight,
    },

    miniLetter: {
      color: C.text,
      fontFamily: FONTS.display,
      fontSize: 16,
    },

    pairSmall: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 12,
    },

    pairName: {
      color: C.text,
      fontFamily: FONTS.textBold,
      fontSize: 16,
      marginTop: 2,
    },

    daysBox: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 4,
    },

    daysNumber: {
      color: C.text,
      fontFamily: FONTS.display,
      fontSize: 32,
    },

    daysUnit: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 14,
    },

    missTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    missLabel: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 13,
    },

    missTotal: {
      color: C.text,
      fontFamily: FONTS.display,
      fontSize: 30,
      marginTop: 2,
    },

    missUnit: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 14,
    },

    missButton: {
      height: 44,
      paddingHorizontal: 18,
      borderRadius: 22,
      backgroundColor: C.accent,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    burst: {
      position: "absolute",
      right: 40,
      top: 18,
    },

    missButtonText: {
      color: C.accentOn,
      fontFamily: FONTS.textBold,
      fontSize: 15,
    },

    statsRow: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: C.divider,
      paddingTop: 14,
    },

    stat: {
      flex: 1,
      alignItems: "center",
      gap: 2,
    },

    statNumber: {
      color: C.text,
      fontFamily: FONTS.display,
      fontSize: 24,
    },

    statLabel: {
      color: C.muted,
      fontFamily: FONTS.text,
      fontSize: 12,
    },

    list: {
      backgroundColor: C.card,
      borderRadius: 24,
      overflow: "hidden",
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 18,
    },

    border: {
      borderBottomWidth: 1,
      borderBottomColor: C.divider,
    },

    rowTitle: {
      flex: 1,
      color: C.text,
      fontFamily: FONTS.text,
      fontSize: 16,
    },
  })
);
