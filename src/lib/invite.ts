import { Share } from "react-native";

// Имя бота без @. Должно совпадать с настройками в BotFather.
export const BOT_USERNAME = "sweetly_couple_bot";

// Ссылка-приглашение: открывает бота и приложение с кодом пары
export function inviteLink(code: string) {
  return `https://t.me/${BOT_USERNAME}?startapp=${encodeURIComponent(code)}`;
}

// Системное окно «Поделиться» с приглашением: сначала текст, потом ссылка
export async function shareInvite(code: string | null | undefined) {
  if (!code) return;

  const message = `Присоединяйся ко мне в Sweetly ❤️\n\n${inviteLink(code)}`;

  await Share.share({ message });
}
