import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { FONTS, C, liveStyles } from "@/constants/sweetly-theme";

// Экран «нет сети»: показывается, пока нет подключения к интернету
export default function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.screen}>
      <View style={styles.icon}>
        <Svg width={38} height={38} viewBox="0 0 24 24">
          <Path
            d="M2 9a15 15 0 0120 0M5.5 12.5a10 10 0 0113 0M9 16a5 5 0 016 0M12 19.5h.01M3 3l18 18"
            fill="none"
            stroke={C.accent}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
      </View>

      <Text style={styles.title}>Нет подключения</Text>

      <Text style={styles.text}>Проверьте интернет. Данные обновятся, как только появится сеть.</Text>

      <Pressable style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Повторить</Text>
      </Pressable>
    </View>
  );
}

const styles = liveStyles(() => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 14,
  },

  icon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.peach,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 30,
    textAlign: "center",
  },

  text: {
    color: C.muted,
    fontFamily: FONTS.text,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },

  button: {
    height: 52,
    paddingHorizontal: 34,
    borderRadius: 26,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },

  buttonText: {
    color: C.accentOn,
    fontFamily: FONTS.textBold,
    fontSize: 16,
  },
}));
