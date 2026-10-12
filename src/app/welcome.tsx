import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { PrimaryButton, SecondaryButton } from "@/components/sweetly-ui";
import { SWEETLY, FONTS } from "@/constants/sweetly-theme";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.ringOuter}>
          <View style={styles.ringInner}>
            <Svg width={68} height={68} viewBox="0 0 24 24">
              <Path
                d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"
                fill="#FFFFFF"
                stroke="#FFFFFF"
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </View>

        <Text style={styles.brand}>Sweetly</Text>
        <Text style={styles.tagline}>Ваше общее пространство для двоих</Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton title="Создать аккаунт" onPress={() => router.push("/register" as any)} />
        <SecondaryButton title="Войти" onPress={() => router.push("/login" as any)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SWEETLY.background,
    paddingHorizontal: 22,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: "space-between",
  },

  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },

  ringOuter: {
    width: 208,
    height: 208,
    borderRadius: 104,
    backgroundColor: "#FFE0D6",
    alignItems: "center",
    justifyContent: "center",
  },

  ringInner: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: SWEETLY.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  brand: {
    color: SWEETLY.accent,
    fontFamily: FONTS.displayItalic,
    fontSize: 52,
    marginTop: 8,
  },

  tagline: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 17,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 24,
  },

  actions: {
    gap: 12,
  },
});
