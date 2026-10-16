import { ReactNode } from "react";

import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { FONTS, SWEETLY } from "@/constants/sweetly-theme";

// Иконки строк (контурные, 24 px)
export const ICON = {
  clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2",
  door: "M6 3h10a2 2 0 012 2v16H6zM6 21h12M14 12h.01",
  smile: "M12 3a9 9 0 100 18 9 9 0 000-18zM8.5 14s1.5 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01",
  photo: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4",
  calendar: "M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zM3 10h18M8 3v4M16 3v4",
  gift: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-3 0-4-4-1.5-4S12 7 12 7zM12 7c3 0 4-4 1.5-4S12 7 12 7z",
  pin: "M12 21s-6-5.5-6-11a6 6 0 0112 0c0 5.5-6 11-6 11zM10 10a2 2 0 104 0 2 2 0 10-4 0",
  doc: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 118 0v3",
  heart: "M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z",
};

// Шапка главной без пары: Sweetly и отключённая кнопка «Скучаю»
export function SoloBrandHeader() {
  return (
    <View style={styles.brandRow}>
      <Text style={styles.brand}>Sweetly</Text>

      <View style={styles.missPill}>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" fill={SWEETLY.accent} />
        </Svg>
        <Text style={styles.missText}>Скучаю</Text>
      </View>
    </View>
  );
}

// Заголовок раздела: крупный Playfair и подпись
export function SoloTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// Акцентная карточка: белый кружок с иконкой, заголовок, текст и содержимое
export function AccentCard({
  icon,
  title,
  text,
  children,
}: {
  icon: string;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.accent}>
      <View style={styles.accentIcon}>
        <Svg width={28} height={28} viewBox="0 0 24 24">
          <Path d={icon} fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>

      <Text style={styles.accentTitle}>{title}</Text>
      <Text style={styles.accentText}>{text}</Text>

      {children}
    </View>
  );
}

// Строка списка: персиковый кружок с иконкой и название
export function SoloRow({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path d={icon} fill="none" stroke="#B5304F" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>

      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

// Белая кнопка на акцентной карточке
export function WhiteButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable style={styles.whiteButton} onPress={onPress}>
      <Text style={styles.whiteText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  brand: {
    color: SWEETLY.accent,
    fontFamily: FONTS.displayItalic,
    fontSize: 30,
  },

  missPill: {
    height: 44,
    paddingLeft: 14,
    paddingRight: 18,
    borderRadius: 22,
    backgroundColor: SWEETLY.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    opacity: 0.45,
  },

  missText: {
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 15,
  },

  titleBlock: { gap: 6 },

  title: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 34,
  },

  subtitle: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 15,
  },

  accent: {
    backgroundColor: SWEETLY.accent,
    borderRadius: 32,
    padding: 24,
    gap: 10,
  },

  accentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },

  accentTitle: {
    color: "#FFFFFF",
    fontFamily: FONTS.display,
    fontSize: 30,
    lineHeight: 34,
    marginTop: 4,
  },

  accentText: {
    color: "#FFFFFF",
    fontFamily: FONTS.text,
    fontSize: 15,
    lineHeight: 21,
    opacity: 0.95,
  },

  row: {
    backgroundColor: SWEETLY.card,
    borderRadius: 22,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SWEETLY.peach,
    alignItems: "center",
    justifyContent: "center",
  },

  rowTitle: {
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 16,
  },

  rowHint: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 12,
    marginTop: 2,
  },

  whiteButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },

  whiteText: {
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 16,
  },
});
