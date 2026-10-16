import { useState } from "react";

import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import SecureImage from "@/components/secure-image";
import SoloProfile from "@/components/solo-profile";
import SkeletonScreen from "@/components/skeleton-screen";
import { ScreenTitle } from "@/components/sweetly-ui";
import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { refreshAppData, useAppData } from "@/lib/app-data";
import { notify } from "@/lib/dialogs";
import { shareInvite } from "@/lib/invite";
import { logMiss } from "@/lib/miss-log";
import { supabase } from "@/lib/supabase";

function daysSince(value?: string | null) {
  if (!value) return 0;

  const start = new Date(`${value}T00:00:00`).getTime();

  return Math.max(0, Math.floor((Date.now() - start) / 86400000));
}

function initialOf(name?: string | null) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

const CHEVRON = "M9 6l6 6-6 6";

export default function ProfileScreen() {
  const router = useRouter();

  const app = useAppData();

  const [uploading, setUploading] = useState(false);

  const [busy, setBusy] = useState(false);

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

  async function pressMiss() {
    if (!app.coupleId || busy) return;

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

  const rows = hasPartner
    ? [
        { title: "Данные пары", sub: "Статус, имена, даты", path: "/profile-pair" },
        { title: "Даты и таймеры", sub: "Годовщины и важные дни", path: "/profile-dates" },
        { title: "Настройки", sub: "Аккаунт и уведомления", path: "/settings" },
      ]
    : [
        { title: "Ввести код партнёра", sub: "Если партнёр уже прислал код", path: "/connect" },
        { title: "Настройки", sub: "Аккаунт и уведомления", path: "/settings" },
      ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenTitle>Профиль</ScreenTitle>

      {/* ============ ВЫ ============ */}

      <View style={styles.meRow}>
        <Pressable style={styles.avatarWrap} onPress={pickAvatar}>
          <SecureImage
            bucket="avatars"
            path={app.me?.avatar_url}
            style={styles.avatarImage}
            fallback={
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarLetter}>{initialOf(app.me?.name)}</Text>
              </View>
            }
          />

          <View style={styles.camera}>
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path
                d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
                fill="none"
                stroke={SWEETLY.accent}
                strokeWidth={1.8}
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </Pressable>

        <View style={styles.meText}>
          <Text style={styles.name}>{uploading ? "Загружаем..." : app.me?.name || "Без имени"}</Text>
          <Text style={styles.account}>Аккаунт Sweetly</Text>
        </View>
      </View>

      {hasPartner ? (
        <>
          {/* ============ ПАРА ============ */}

          <View style={styles.pairCard}>
            <View style={styles.avatars}>
              <View style={[styles.smallAvatar, { left: 0 }]}>
                <SecureImage
                  bucket="avatars"
                  path={app.me?.avatar_url}
                  style={styles.avatarImage}
                  fallback={<Text style={styles.smallLetter}>{initialOf(app.me?.name)}</Text>}
                />
              </View>

              <View style={[styles.smallAvatar, { left: 26 }]}>
                <SecureImage
                  bucket="avatars"
                  path={app.partner?.avatar_url}
                  style={styles.avatarImage}
                  fallback={<Text style={styles.smallLetter}>{initialOf(app.partner?.name)}</Text>}
                />
              </View>
            </View>

            <Text style={styles.pairText} numberOfLines={2}>
              Вы вместе с {app.partner?.name}
            </Text>

            <View style={styles.pairDays}>
              <Text style={styles.pairNumber}>{days}</Text>
              <Text style={styles.pairUnit}>дн</Text>
            </View>
          </View>

          {/* ============ СКУЧАЮ ============ */}

          <View style={styles.missCard}>
            <View style={styles.missTop}>
              <View>
                <Text style={styles.missLabel}>СКУЧАЮ</Text>
                <Text style={styles.missTotal}>{total} раз</Text>
              </View>

              <Pressable style={styles.heart} onPress={pressMiss} disabled={busy}>
                <Svg width={24} height={24} viewBox="0 0 24 24">
                  <Path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" fill="#FFFFFF" />
                </Svg>
              </Pressable>
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
        </>
      ) : (
        <>
          {/* ============ ПАРТНЁР НЕ ПОДКЛЮЧЁН ============ */}

          <View style={styles.soloCard}>
            <Text style={styles.soloTitle}>Партнёр не подключён</Text>

            <Text style={styles.soloText}>
              Пригласите его, чтобы видеть общие дни, настроение и воспоминания.
            </Text>

            <Pressable style={styles.soloButton} onPress={() => shareInvite(app.couple?.invite_code)}>
              <Text style={styles.soloButtonText}>Пригласить партнёра</Text>
            </Pressable>
          </View>

          <View style={styles.codeRow}>
            <View>
              <Text style={styles.codeLabel}>МОЙ КОД ПРИГЛАШЕНИЯ</Text>
              <Text style={styles.code}>{app.couple?.invite_code ?? "—"}</Text>
            </View>
          </View>
        </>
      )}

      {/* ============ РАЗДЕЛЫ ============ */}

      <View style={styles.list}>
        {rows.map((row, index) => (
          <Pressable
            key={row.title}
            style={[styles.row, index < rows.length - 1 && styles.rowBorder]}
            onPress={() => router.push(row.path as any)}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowSub}>{row.sub}</Text>
            </View>

            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path d={CHEVRON} fill="none" stroke={SWEETLY.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SWEETLY.background },

  content: {
    paddingHorizontal: 22,
    paddingTop: 55,
    paddingBottom: 70,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: 14,
  },

  meRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 4,
  },

  avatarWrap: { width: 76, height: 76 },

  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 38,
  },

  avatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: SWEETLY.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarLetter: {
    color: "#FFFFFF",
    fontFamily: FONTS.display,
    fontSize: 32,
  },

  camera: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SWEETLY.card,
    alignItems: "center",
    justifyContent: "center",
  },

  meText: { flex: 1 },

  name: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 28,
  },

  account: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 14,
    marginTop: 2,
  },

  pairCard: {
    backgroundColor: SWEETLY.accent,
    borderRadius: 28,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  avatars: { width: 80, height: 52 },

  smallAvatar: {
    position: "absolute",
    top: 0,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: SWEETLY.peach,
    borderWidth: 3,
    borderColor: SWEETLY.accent,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  smallLetter: {
    color: SWEETLY.accent,
    fontFamily: FONTS.display,
    fontSize: 20,
  },

  pairText: {
    flex: 1,
    color: "#FFFFFF",
    fontFamily: FONTS.textBold,
    fontSize: 17,
  },

  pairDays: { alignItems: "center" },

  pairNumber: {
    color: "#FFFFFF",
    fontFamily: FONTS.display,
    fontSize: 34,
    lineHeight: 36,
  },

  pairUnit: {
    color: "#FFFFFF",
    fontFamily: FONTS.text,
    fontSize: 13,
    opacity: 0.85,
  },

  missCard: {
    backgroundColor: SWEETLY.card,
    borderRadius: 28,
    padding: 18,
    gap: 16,
  },

  missTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  missLabel: {
    color: SWEETLY.muted,
    fontFamily: FONTS.textBold,
    fontSize: 13,
    letterSpacing: 0.4,
  },

  missTotal: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 30,
    marginTop: 2,
  },

  heart: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SWEETLY.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  statsRow: {
    flexDirection: "row",
    gap: 8,
  },

  stat: {
    flex: 1,
    backgroundColor: SWEETLY.background,
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: "center",
  },

  statNumber: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 24,
  },

  statLabel: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 12,
    marginTop: 2,
  },

  soloCard: {
    backgroundColor: SWEETLY.peach,
    borderRadius: 28,
    padding: 20,
    gap: 8,
  },

  soloTitle: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 24,
  },

  soloText: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 14,
    lineHeight: 20,
  },

  soloButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: SWEETLY.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },

  soloButtonText: {
    color: "#FFFFFF",
    fontFamily: FONTS.textBold,
    fontSize: 16,
  },

  codeRow: {
    backgroundColor: SWEETLY.card,
    borderRadius: 22,
    padding: 18,
  },

  codeLabel: {
    color: SWEETLY.muted,
    fontFamily: FONTS.textBold,
    fontSize: 12,
    letterSpacing: 0.4,
  },

  code: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 28,
    letterSpacing: 3,
    marginTop: 4,
  },

  list: {
    backgroundColor: SWEETLY.card,
    borderRadius: 28,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 64,
  },

  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: SWEETLY.divider,
  },

  rowText: { flex: 1 },

  rowTitle: {
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 17,
  },

  rowSub: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 13,
    marginTop: 2,
  },
});
