import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

export type ProfileData = {
  id: string;
  name: string;
  gender: string | null;
  birthday: string | null;
  avatar_url: string | null;
};

export type CoupleData = {
  id: string;
  relationship_status: string | null;
  relationship_date: string | null;
  invite_code?: string | null;
} | null;

export type MemoryData = {
  id: string;
  created_by: string;
  photo_path: string;
  caption: string;
  memory_date: string;
  media_type: "image" | "video";
};

export type AppData = {
  // true, когда первая загрузка завершена (даже если пары нет)
  ready: boolean;
  userId: string | null;
  email: string | null;
  coupleId: string | null;
  me: ProfileData | null;
  partner: ProfileData | null;
  couple: CoupleData;
  timersCount: number;
  missMine: number;
  missPartner: number;
  memories: MemoryData[];
};

const emptyData: AppData = {
  ready: false,
  userId: null,
  email: null,
  coupleId: null,
  me: null,
  partner: null,
  couple: null,
  timersCount: 0,
  missMine: 0,
  missPartner: 0,
  memories: [],
};

let data: AppData = emptyData;

const listeners = new Set<() => void>();

let inFlight: Promise<void> | null = null;

function emit() {
  listeners.forEach((fn) => fn());
}

export function getAppData(): AppData {
  return data;
}

export function clearAppData() {
  data = { ...emptyData, ready: true };
  emit();
}

// Все данные пары одним пакетом. Параллельные вызовы не запускают лишних запросов.
export function refreshAppData(): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = loadAll().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

async function loadAll() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      data = { ...emptyData, ready: true };
      emit();

      return;
    }

    const uid = session.user.id;

    const rawEmail = session.user.email ?? null;

    const email = rawEmail && !rawEmail.endsWith("@telegram.user") ? rawEmail : null;

    const [meRes, memberRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, name, gender, birthday, avatar_url")
        .eq("id", uid)
        .maybeSingle(),
      supabase.from("couple_members").select("couple_id").eq("user_id", uid).maybeSingle(),
    ]);

    // Если запрос упал, не стираем уже загруженные данные
    if (meRes.error || memberRes.error) {
      console.log("App data error:", meRes.error ?? memberRes.error);

      data = { ...data, ready: true };
      emit();

      return;
    }

    const me = (meRes.data as ProfileData | null) ?? null;

    const coupleId = memberRes.data?.couple_id ?? null;

    if (!coupleId) {
      data = { ...emptyData, ready: true, userId: uid, email, me };
      emit();

      return;
    }

    const [coupleRes, membersRes, timersRes, missRes, memoriesRes] = await Promise.all([
      supabase
        .from("couples")
        .select("id, relationship_status, relationship_date, invite_code")
        .eq("id", coupleId)
        .maybeSingle(),
      supabase.from("couple_members").select("user_id").eq("couple_id", coupleId),
      supabase.from("couple_timers").select("id").eq("couple_id", coupleId),
      supabase
        .from("couple_miss_counts")
        .select("*")
        .eq("couple_id", coupleId)
        .maybeSingle(),
      supabase
        .from("couple_memories")
        .select("id, created_by, photo_path, caption, memory_date, media_type")
        .eq("couple_id", coupleId)
        .order("memory_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (coupleRes.error || membersRes.error || timersRes.error || missRes.error || memoriesRes.error) {
      console.log("App data error:", coupleRes.error ?? membersRes.error ?? timersRes.error ?? missRes.error ?? memoriesRes.error);

      data = { ...data, ready: true };
      emit();

      return;
    }

    const partnerId = membersRes.data?.find((item) => item.user_id !== uid)?.user_id ?? null;

    let partner: ProfileData | null = null;

    if (partnerId) {
      const { data: partnerProfile } = await supabase
        .from("profiles")
        .select("id, name, gender, birthday, avatar_url")
        .eq("id", partnerId)
        .maybeSingle();

      partner = (partnerProfile as ProfileData | null) ?? {
        id: partnerId,
        name: "Партнёр",
        gender: null,
        birthday: null,
        avatar_url: null,
      };
    }

    const miss = missRes.data;

    let missMine = 0;

    let missPartner = 0;

    if (miss) {
      if (miss.user_one_id === uid) {
        missMine = miss.user_one_count;
        missPartner = miss.user_two_count;
      } else {
        missMine = miss.user_two_count;
        missPartner = miss.user_one_count;
      }
    }

    data = {
      ready: true,
      userId: uid,
      email,
      coupleId,
      me,
      partner,
      couple: (coupleRes.data as CoupleData) ?? null,
      timersCount: (timersRes.data?.length ?? 0) + 1,
      missMine,
      missPartner,
      memories: (memoriesRes.data as MemoryData[]) ?? [],
    };

    emit();
  } catch (error) {
    console.log("App data load error:", error);

    data = { ...data, ready: true };
    emit();
  }
}

// Подписка на Realtime: любое изменение пары обновляет общие данные
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);

  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    refreshAppData();
  }, 200);
}

export function startAppRealtime(userId: string): () => void {
  const channel = supabase
    .channel(`app-data-${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "couples" }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "couple_members" }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "couple_miss_counts" }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "couple_timers" }, scheduleRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "couple_memories" }, scheduleRefresh)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Хук: компонент перерисовывается, когда общие данные меняются
export function useAppData(): AppData {
  const [state, setState] = useState<AppData>(getAppData());

  useEffect(() => {
    const update = () => setState(getAppData());

    listeners.add(update);

    update();

    return () => {
      listeners.delete(update);
    };
  }, []);

  return state;
}
