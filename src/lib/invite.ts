import { Linking } from "react-native";

// Имя бота без @. Должно совпадать с настройками в BotFather.
export const BOT_USERNAME = "sweetly_couple_bot";

// Ссылка-приглашение: открывает бота и приложение с кодом пары
export function inviteLink(code: string) {
  return `https://t.me/${BOT_USERNAME}?startapp=${code}`;
}

// Открывает выбор чата в Telegram с готовым приглашением
export function shareInvite(code: string | null | undefined) {
  if (!code) return;

  // Текст и ссылка в одном сообщении: сначала текст, потом ссылка
  const message = `Присоединяйся ко мне в Sweetly ❤️\n\n${inviteLink(code)}`;

  Linking.openURL(`https://t.me/share/url?text=${encodeURIComponent(message)}`);
}
