import { useState } from "react";

import * as Clipboard from "expo-clipboard";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { inviteLink } from "@/lib/invite";

// Готовая ссылка-приглашение: открывает бота и приложение с кодом пары
export default function InviteLinkRow({ code }: { code?: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!code) return null;

  const link = inviteLink(code);

  async function copy() {
    await Clipboard.setStringAsync(link);

    setCopied(true);

    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={styles.box}>
      <Text style={styles.label}>ССЫЛКА-ПРИГЛАШЕНИЕ</Text>

      <Text style={styles.link} numberOfLines={1} selectable>
        {link}
      </Text>

      <Pressable style={styles.button} onPress={copy}>
        <Text style={styles.buttonText}>{copied ? "Ссылка скопирована" : "Скопировать ссылку"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: SWEETLY.card,
    borderRadius: 22,
    padding: 16,
    gap: 8,
  },

  label: {
    color: SWEETLY.muted,
    fontFamily: FONTS.textBold,
    fontSize: 12,
    letterSpacing: 0.4,
  },

  link: {
    color: SWEETLY.text,
    fontFamily: FONTS.text,
    fontSize: 13,
  },

  button: {
    height: 44,
    borderRadius: 22,
    backgroundColor: SWEETLY.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  buttonText: {
    color: "#FFFFFF",
    fontFamily: FONTS.textBold,
    fontSize: 15,
  },
});
