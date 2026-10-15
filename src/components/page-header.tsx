import { useState } from "react";

import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";

import SecureImage from "@/components/secure-image";
import { logMiss } from "@/lib/miss-log";
import { refreshAppData, useAppData } from "@/lib/app-data";
import { supabase } from "@/lib/supabase";

type ProfileItem = { id: string; name: string; avatar_url?: string | null };

function getInitials(value?: string) {
  if (!value) return "?";

  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

// Общая шапка страниц: аватарки слева, название по центру, «Скучаю» справа.
export default function PageHeader({ title }: { title: string }) {
  // Всё нужное (пара, аватарки, счётчик) уже есть в общем хранилище
  const appData = useAppData();

  const userId = appData.userId;

  const coupleId = appData.coupleId;

  const me = appData.me;

  const partner = appData.partner;

  const myMiss = appData.missMine;

  const partnerMiss = appData.missPartner;

  const [busy, setBusy] = useState(false);

  async function pressMiss() {
    if (!coupleId || !userId || busy) return;

    setBusy(true);

    try {
      const { error } = await supabase.rpc("increment_miss_count", {
        target_couple_id: coupleId,
      });

      if (error) {
        Alert.alert("Ошибка", error.message);

        return;
      }

      if (coupleId && userId) await logMiss(coupleId, userId);

      // Уведомляем партнёра в Telegram
      supabase.functions
        .invoke("notify-partner", { body: { kind: "miss" } })
        .catch(() => {});

      await refreshAppData();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.header}>
      <View style={styles.avatars}>
        <View style={styles.avatarBack}>
          <SecureImage bucket="avatars" path={partner?.avatar_url} style={styles.avatarImage} fallback={<Text style={styles.avatarText}>{getInitials(partner?.name)}</Text>} />
        </View>

        <View style={styles.avatarFront}>
          <SecureImage bucket="avatars" path={me?.avatar_url} style={styles.avatarImage} fallback={<Text style={styles.avatarText}>{getInitials(me?.name)}</Text>} />
        </View>
      </View>

      <View style={styles.titleWrap} pointerEvents="none">
        <View style={styles.titlePill}>
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>

      <View style={styles.right}>
        <View style={styles.missCounter}>
          <Text style={styles.missLabel}>Скучаю</Text>
          <Text style={styles.missValue}>
            {myMiss}/{partnerMiss}
          </Text>
        </View>

        <Pressable style={styles.heartButton} onPress={pressMiss}>
          <Text style={styles.heartText}>♥</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 58,
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
    borderColor: "#FFF1F0",
    overflow: "hidden",
  },

  avatarFront: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#C23A62",
    position: "absolute",
    left: 27,
    top: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFF1F0",
    overflow: "hidden",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
  },

  avatarText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },

  titleWrap: {
    position: "absolute",
    left: 96,
    right: 96,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  titlePill: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: "100%",
    shadowColor: "#9b6676",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  titleText: {
    color: "#704e59",
    fontSize: 12,
    fontWeight: "700",
  },

  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  missCounter: {
    alignItems: "flex-end",
  },

  missLabel: {
    color: "#7A5A66",
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
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  heartText: {
    color: "#C23A62",
    fontSize: 20,
  },
});
