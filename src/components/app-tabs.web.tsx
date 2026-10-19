import { useEffect, useMemo, useRef } from "react";
import { Slot, usePathname, useRouter } from "expo-router";
import { Animated, PanResponder, Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useColors } from "@/lib/theme";

// Иконки из макета (линейные, 24x24)
const TABS = [
  { route: "/", label: "Главная", d: "M3 11l9-8 9 8M5 10v10h14V10" },
  { route: "/room", label: "Комната", d: "M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16M3 21h18M15 12.5h.01" },
  { route: "/mood", label: "Настроение", d: "M3 12a9 9 0 1018 0 9 9 0 10-18 0M8 14s1.5 2.5 4 2.5S16 14 16 14M9 9.5h.01M15 9.5h.01" },
  { route: "/memories", label: "Воспоминания", d: "M6 5h12a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3V8a3 3 0 013-3zM7.5 10.5a1.5 1.5 0 103 0 1.5 1.5 0 10-3 0M21 16l-5-5-8 8" },
  { route: "/profile", label: "Профиль", d: "M8 8a4 4 0 108 0 4 4 0 10-8 0M4 21c1-4 4.5-6 8-6s7 2 8 6" },
];

// Отступ сверху на вебе: место под кнопки Telegram («Закрыть» и «···»).
// Одинаковый для всех страниц, как на главной.
const TOP_OFFSET = 40;

// Минимальная длина свайпа и скорость анимации
const SWIPE_DISTANCE = 60;
const SLIDE_DISTANCE = 28;
const ANIMATION_MS = 240;

export default function AppTabs() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const pathname = usePathname();
  const router = useRouter();

  const topOffset = TOP_OFFSET;

  const currentIndex = TABS.findIndex((tab) => tab.route === pathname);

  // Анимация перехода: новая страница выезжает с той стороны, куда пошло переключение
  const slide = useRef(new Animated.Value(0)).current;

  const fade = useRef(new Animated.Value(1)).current;

  const lastIndex = useRef(currentIndex);

  useEffect(() => {
    const previous = lastIndex.current;

    const direction = previous === -1 || currentIndex === -1 || currentIndex >= previous ? 1 : -1;

    lastIndex.current = currentIndex;

    slide.setValue(direction * SLIDE_DISTANCE);
    fade.setValue(0);

    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: ANIMATION_MS, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: ANIMATION_MS, useNativeDriver: true }),
    ]).start();
  }, [pathname]);

  // Свайп по основным страницам: влево — следующая вкладка, вправо — предыдущая
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.8,

      onPanResponderRelease: (_event, gesture) => {
        const index = lastIndex.current;

        if (index === -1) return;

        if (gesture.dx < -SWIPE_DISTANCE && index < TABS.length - 1) {
          router.navigate(TABS[index + 1].route as any);
        } else if (gesture.dx > SWIPE_DISTANCE && index > 0) {
          router.navigate(TABS[index - 1].route as any);
        }
      },
    }),
  ).current;

  return (
    <View style={styles.root}>
      <Animated.View
        style={[styles.content, { paddingTop: topOffset, opacity: fade, transform: [{ translateX: slide }] }]}
        {...swipe.panHandlers}
      >
        <Slot />
      </Animated.View>

      <View style={styles.bar}>
        {TABS.map((tab) => {
          const active = pathname === tab.route;
          const color = active ? c.accent : c.muted;

          return (
            <Pressable
              key={tab.route}
              style={styles.item}
              accessibilityLabel={tab.label}
              onPress={() => router.navigate(tab.route as any)}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24">
                <Path
                  d={tab.d}
                  fill="none"
                  stroke={color}
                  strokeWidth={active ? 2 : 1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.background,
  },

  content: {
    flex: 1,
  },

  bar: {
    height: 88,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: c.bottomBar,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },

  item: {
    width: 66,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
});
}
