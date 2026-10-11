import { useEffect, useState } from "react";

import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";

import SecureImage from "@/components/secure-image";
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
  const [userId, setUserId] = useState<string | null>(null);

  const [coupleId, setCoupleId] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<ProfileItem[]>([]);

  const [myMiss, setMyMiss] = useState(0);

  const [partnerMiss, setPartnerMiss] = useState(0);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
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

    await loadAll(member.couple_id, uid);
  }

  async function loadAll(cid: string, uid: string) {
    const { data: members } = await supabase
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", cid);

    const ids = members?.map((item) => item.user_id) ?? [];

    if (ids.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", ids);

      setProfiles(data ?? []);
    }

    const { data: miss } = await supabase
      .from("couple_miss_counts")
      .select("*")
      .eq("couple_id", cid)
      .maybeSingle();

    if (!miss) {
      setMyMiss(0);
      setPartnerMiss(0);

      return;
    }

    if (miss.user_one_id === uid) {
      setMyMiss(miss.user_one_count);
      setPartnerMiss(miss.user_two_count);
    } else {
      setMyMiss(miss.user_two_count);
      setPartnerMiss(miss.user_one_count);
    }
  }

  // Realtime: счётчик и аватарки обновляются сразу у обоих
  useEffect(() => {
    if (!coupleId || !userId) return;

    const channel = supabase
      .channel(`header-${coupleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "couple_miss_counts",
          filter: `couple_id=eq.${coupleId}`,
        },
        () => {
          loadAll(coupleId, userId);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => {
          loadAll(coupleId, userId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId, userId]);

  async function pressMiss() {
    if (!coupleId || !userId || busy) return;

    setBusy(true);

    setMyMiss((value) => value + 1);

    try {
      const { data, error } = await supabase.rpc("increment_miss_count", {
        target_couple_id: coupleId,
      });

      if (error) {
        setMyMiss((value) => Math.max(0, value - 1));

        Alert.alert("Ошибка", error.message);

        return;
      }

      // Уведомляем партнёра в Telegram
      supabase.functions
        .invoke("notify-partner", { body: { kind: "miss" } })
        .catch(() => {});

      if (data) {
        if (data.user_one_id === userId) {
          setMyMiss(data.user_one_count);
          setPartnerMiss(data.user_two_count);
        } else {
          setMyMiss(data.user_two_count);
          setPartnerMiss(data.user_one_count);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const me = profiles.find((item) => item.id === userId);

  const partner = profiles.find((item) => item.id !== userId);

  return (
    <View style={styles.header}>
      <View style={styles.avatars}>
        <View style={styles.avatarBack}>
          {partner?.avatar_url ? (
            <SecureImage bucket="avatars" path={partner.avatar_url} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{getInitials(partner?.name)}</Text>
          )}
        </View>

        <View style={styles.avatarFront}>
          {me?.avatar_url ? (
            <SecureImage bucket="avatars" path={me.avatar_url} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{getInitials(me?.name)}</Text>
          )}
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
    borderColor: "#fff5f8",
    overflow: "hidden",
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
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  heartText: {
    color: "#e98ca8",
    fontSize: 20,
  },
});
