import { Slot, usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

const TABS = [
  { route: "/", label: "Главная", icon: "🏠" },
  { route: "/room", label: "Комната", icon: "🛋️" },
  { route: "/mood", label: "Настроение", icon: "🙂" },
  { route: "/chat", label: "Чат", icon: "💬" },
  { route: "/profile", label: "Профиль", icon: "👤" },
];

// Отступ сверху на вебе: место под кнопки Telegram («Закрыть» и «···»),
// которые заканчиваются примерно на 85px. У главной свой верхний отступ экрана
// (55px против 65px у остальных), поэтому её отступ отдельный.
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
