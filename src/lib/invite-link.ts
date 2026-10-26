import { Platform } from "react-native";

const KEY = "sweetly_pending_invite";

// Код приглашения из ссылки t.me/бот?startapp=КОД (Telegram передаёт его в start_param)
export function readInviteFromTelegram(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;

  const raw = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;

  if (typeof raw !== "string") return null;

  const value = decodeURIComponent(raw.trim());

  return value.length > 0 ? value : null;
}

export function savePendingInvite(code: string) {
  if (typeof window === "undefined") return;

  const normalized = String(code ?? "").trim().toUpperCase();

  if (!normalized) {
    window.localStorage.removeItem(KEY);
    return;
  }

  window.localStorage.setItem(KEY, normalized);
}

export function getPendingInvite(): string | null {
  if (typeof window === "undefined") return null;

  return window.localStorage.getItem(KEY);
}

export function clearPendingInvite() {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
}
