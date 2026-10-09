import { Slot, usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const TABS = [
  { route: "/", label: "Главная", icon: "🏠" },
  { route: "/room", label: "Комната", icon: "🛋️" },
  { route: "/mood", label: "Настроение", icon: "🙂" },
  { route: "/chat", label: "Чат", icon: "💬" },
  { route: "/profile", label: "Профиль", icon: "👤" },
];

// Отступ сверху, который занимает интерфейс Telegram (кнопки «Закрыть» и «···»)
// и системная полоса устройства. Telegram сообщает эти размеры сам.
function useTelegramTopInset() {
  const [top, setTop] = useState(0);

  useEffect(() => {
    let tg: any = null;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Запасной отступ: Telegram в полноэкранном режиме рисует свои кнопки
    // «Закрыть» и «···» поверх верха приложения. Если он не передал размер,
    // берём оценку по высоте этих кнопок. Значение подбирается по макету.
    const FULLSCREEN_FALLBACK = 64;

    const update = () => {
      if (!tg) return;

      const reported =
        (tg.safeAreaInset?.top ?? 0) + (tg.contentSafeAreaInset?.top ?? 0);

      if (reported > 0) {
        setTop(reported);

        return;
      }

      setTop(tg.isFullscreen ? FULLSCREEN_FALLBACK : 0);
    };

    // Скрипт Telegram загружается асинхронно, поэтому ждём его появления
    const attach = () => {
      tg = (window as any).Telegram?.WebApp;

      if (!tg) {
        attempts += 1;

        if (attempts < 40) timer = setTimeout(attach, 150);

        return;
      }

      update();
      tg.onEvent?.("safeAreaChanged", update);
      tg.onEvent?.("contentSafeAreaChanged", update);
      tg.onEvent?.("fullscreenChanged", update);
    };

    attach();

    return () => {
      if (timer) clearTimeout(timer);
      tg?.offEvent?.("safeAreaChanged", update);
      tg?.offEvent?.("contentSafeAreaChanged", update);
      tg?.offEvent?.("fullscreenChanged", update);
    };
  }, []);

  return top;
}

export default function AppTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const topInset = useTelegramTopInset();

  return (
    <View style={styles.root}>
      <View style={[styles.content, { paddingTop: topInset }]}>
        <Slot />
      </View>

      <View style={styles.bar}>
        {TABS.map((tab) => {
          const active = pathname === tab.route;

          return (
            <Pressable
              key={tab.route}
              style={styles.item}
              onPress={() => router.navigate(tab.route as any)}
            >
              <Text style={[styles.icon, active && styles.iconActive]}>
                {tab.icon}
              </Text>
              <Text style={[styles.label, active && styles.labelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff5f8",
  },
  content: {
    flex: 1,
  },
  bar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f0dde4",
    paddingTop: 8,
    paddingBottom: 14,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 20,
    opacity: 0.55,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    fontSize: 10,
    color: "#a0838c",
    marginTop: 2,
    fontWeight: "700",
  },
  labelActive: {
    color: "#e98ca8",
  },
});
