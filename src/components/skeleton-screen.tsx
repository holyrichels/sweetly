import { useEffect, useRef } from "react";

import { Animated, StyleSheet, View } from "react-native";

import { C, liveStyles } from "@/constants/sweetly-theme";

// Заготовка экрана на время загрузки: пульсирующие блоки вместо спиннера
export default function SkeletonScreen() {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: false }),
      ]),
    );

    loop.start();

    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.title, { opacity: pulse }]} />

      <View style={styles.weekRow}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Animated.View key={index} style={[styles.day, { opacity: pulse }]} />
        ))}
      </View>

      <Animated.View style={[styles.bigCard, { opacity: pulse }]} />

      <Animated.View style={[styles.card, { opacity: pulse }]} />

      <Animated.View style={[styles.card, { opacity: pulse }]} />
    </View>
  );
}

const styles = liveStyles(() => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.background,
    paddingHorizontal: 22,
    paddingTop: 55,
    gap: 14,
  },

  title: {
    width: 150,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.divider,
  },

  weekRow: {
    flexDirection: "row",
    gap: 8,
  },

  day: {
    flex: 1,
    height: 64,
    borderRadius: 18,
    backgroundColor: C.divider,
  },

  bigCard: {
    height: 210,
    borderRadius: 32,
    backgroundColor: C.divider,
  },

  card: {
    height: 64,
    borderRadius: 22,
    backgroundColor: C.divider,
  },
}));
