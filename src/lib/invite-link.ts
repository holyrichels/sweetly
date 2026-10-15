import { Platform } from "react-native";

const KEY = "sweetly_pending_invite";

// Код приглашения из ссылки t.me/бот?startapp=КОД (Telegram передаёт его в start_param)
export function readInviteFromTelegram(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;

  const param = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;

  return typeof param === "string" && param.length > 0 ? param : null;
}

export function savePendingInvite(code: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, code.toUpperCase());
}

export function getPendingInvite(): string | null {
  if (typeof window === "undefined") return null;

  return window.localStorage.getItem(KEY);
}

export function clearPendingInvite() {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
}
