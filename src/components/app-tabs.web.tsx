import { Slot, usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { SWEETLY } from "@/constants/sweetly-theme";

// Иконки из макета (линейные, 24x24)
const TABS = [
  { route: "/", label: "", d: "M3 11l9-8 9 8M5 10v10h14V10" },
  {
    route: "/room",
    label: "",
    d: "M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16M3 21h18M15 12.5h.01",
  },
  {
    route: "/mood",
    label: "",
    d: "M3 12a9 9 0 1018 0 9 9 0 10-18 0M8 14s1.5 2.5 4 2.5S16 14 16 14M9 9.5h.01M15 9.5h.01",
  },
  {
    route: "/memories",
    label: "",
    d: "M6 5h12a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3V8a3 3 0 013-3zM7.5 10.5a1.5 1.5 0 103 0 1.5 1.5 0 10-3 0M21 16l-5-5-8 8",
  },
  {
    route: "/profile",
    label: "",
    d: "M8 8a4 4 0 108 0 4 4 0 10-8 0M4 21c1-4 4.5-6 8-6s7 2 8 6",
  },
];

// Отступ сверху на вебе: место под кнопки Telegram («Закрыть» и «···»).
// У главной свой верхний отступ экрана, поэтому её отступ отдельный.
const TOP_OFFSET = 20;
const MAIN_TOP_OFFSET = 40;

export default function AppTabs() {
  const pathname = usePathname();
  const router = useRouter();

  const topOffset = pathname === "/" ? MAIN_TOP_OFFSET : TOP_OFFSET;

  return (
    <View style={styles.root}>
      <View style={[styles.content, { paddingTop: topOffset }]}>
        <Slot />
      </View>

      <View style={styles.bar}>
        {TABS.map((tab) => {
          const active = pathname === tab.route;
          const color = active ? SWEETLY.accent : SWEETLY.muted;

          return (
            <Pressable
              key={tab.route}
              style={styles.item}
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
              <Text
                style={[
                  styles.label,
                  { color, fontWeight: active ? "700" : "600" },
                ]}
              >
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
    backgroundColor: SWEETLY.background,
  },

  content: {
    flex: 1,
  },

  bar: {
    height: 88,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: SWEETLY.card,
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
    gap: 3,
  },

  label: {
    fontSize: 11,
  },
});
