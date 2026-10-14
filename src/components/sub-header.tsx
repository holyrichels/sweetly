import { useEffect, useState } from "react";

import { useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { FONTS, SWEETLY } from "@/constants/sweetly-theme";

// Шапка подэкрана. Внутри Telegram работает его нативная кнопка «назад»,
// в обычном браузере показываем свою круглую кнопку.
export default function SubHeader({ title }: { title: string }) {
  const router = useRouter();

  const [inTelegram, setInTelegram] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    let attempts = 0;

    let timer: ReturnType<typeof setTimeout> | null = null;

    let tg: any = null;

    const goBack = () => router.back();

    // Скрипт Telegram может загрузиться чуть позже, поэтому ждём его
    const attach = () => {
      tg = (window as any).Telegram?.WebApp;

      if (!tg?.initData) {
        attempts += 1;

        if (attempts < 20) timer = setTimeout(attach, 150);

        return;
      }

      setInTelegram(true);
      tg.BackButton?.show();
      tg.BackButton?.onClick(goBack);
    };

    attach();

    return () => {
      if (timer) clearTimeout(timer);

      tg?.BackButton?.offClick?.(goBack);
      tg?.BackButton?.hide?.();
    };
  }, []);

  return (
    <View style={styles.row}>
      {!inTelegram && (
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path d="M15 6l-6 6 6 6" fill="none" stroke={SWEETLY.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      )}

      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },

  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SWEETLY.card,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    flex: 1,
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 30,
  },
});
