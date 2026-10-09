import { StyleSheet, Text, View } from "react-native";

export default function RoomScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.emoji}>🛋️</Text>

      <Text style={styles.title}>Комната</Text>

      <Text style={styles.text}>
        Скоро здесь появится ваше общее пространство.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff5f8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },

  emoji: {
    fontSize: 42,
    marginBottom: 14,
  },

  title: {
    color: "#35242a",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
  },

  text: {
    color: "#92767f",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
