import { useState } from "react";

import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { CalendarGrid, FadeIn, formatDateISO, formatDateRu } from "@/components/date-field";
import SubHeader from "@/components/sub-header";
import { PrimaryButton, SecondaryButton, SectionLabel } from "@/components/sweetly-ui";
import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { refreshAppData, useAppData } from "@/lib/app-data";
import { notify } from "@/lib/dialogs";
import { supabase } from "@/lib/supabase";

type Picked = { uri: string; type: "image" | "video"; mimeType: string };

export default function MemoryNewScreen() {
  const router = useRouter();

  const app = useAppData();

  const [picked, setPicked] = useState<Picked | null>(null);

  const [title, setTitle] = useState("");

  const [date, setDate] = useState(formatDateISO(new Date()));

  const [showCalendar, setShowCalendar] = useState(false);

  const [saving, setSaving] = useState(false);

  async function pick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted && permission.canAskAgain !== false) {
      notify("Нужен доступ", "Разрешите доступ к фото и видео.");

      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.7,
      videoMaxDuration: 120,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];

    const type = asset.type === "video" ? "video" : "image";

    setPicked({
      uri: asset.uri,
      type,
      mimeType: asset.mimeType ?? (type === "video" ? "video/mp4" : "image/jpeg"),
    });
  }

  async function save() {
    if (!picked || !app.coupleId || !app.userId) {
      notify("Нет файла", "Выберите фото или видео для воспоминания.");

      return;
    }

    setSaving(true);

    try {
      const response = await fetch(picked.uri);

      const bytes = await response.arrayBuffer();

      const extension = picked.mimeType.split("/")[1]?.split("+")[0] ?? (picked.type === "video" ? "mp4" : "jpg");

      const path = `${app.coupleId}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("memories")
        .upload(path, bytes, { contentType: picked.mimeType });

      if (uploadError) {
        notify("Ошибка", uploadError.message);

        return;
      }

      const { error } = await supabase.from("couple_memories").insert({
        couple_id: app.coupleId,
        created_by: app.userId,
        photo_path: path,
        caption: title.trim(),
        memory_date: date,
        media_type: picked.type,
      });

      if (error) {
        notify("Ошибка", error.message);

        return;
      }

      await refreshAppData();

      router.back();
    } catch (error) {
      notify("Ошибка", (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SubHeader title="Новое воспоминание" />

      <Pressable style={styles.photo} onPress={pick}>
        {picked?.type === "image" ? (
          <Image source={{ uri: picked.uri }} style={styles.photoImage} />
        ) : (
          <Text style={styles.photoHint}>
            {picked?.type === "video" ? "Видео выбрано, нажмите, чтобы заменить" : "＋  Добавить фото или видео"}
          </Text>
        )}
      </Pressable>

      <View>
        <SectionLabel>НАЗВАНИЕ</SectionLabel>
        <TextInput
          style={styles.input}
          placeholder="Например, «Первое свидание»"
          placeholderTextColor={SWEETLY.muted}
          value={title}
          onChangeText={setTitle}
        />
      </View>

      <View>
        <SectionLabel>ДАТА</SectionLabel>

        <Pressable style={styles.input} onPress={() => setShowCalendar((value) => !value)}>
          <Text style={styles.inputText}>{formatDateRu(date)}</Text>
        </Pressable>

        {showCalendar && (
          <FadeIn>
            <View style={styles.calendar}>
              <CalendarGrid value={date} onChange={setDate} />
            </View>
          </FadeIn>
        )}
      </View>

      <View style={styles.actions}>
        <SecondaryButton title="Отмена" onPress={() => router.back()} style={styles.flex} />
        <PrimaryButton title={saving ? "Сохраняем..." : "Сохранить"} onPress={save} disabled={saving} style={styles.flex} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SWEETLY.background },

  content: {
    paddingHorizontal: 22,
    paddingTop: 55,
    paddingBottom: 70,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: 16,
  },

  flex: { flex: 1 },

  photo: {
    height: 240,
    borderRadius: 28,
    backgroundColor: SWEETLY.peach,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  photoImage: { width: "100%", height: "100%" },

  photoHint: {
    color: SWEETLY.accent,
    fontFamily: FONTS.textBold,
    fontSize: 16,
  },

  input: {
    height: 52,
    borderRadius: 26,
    backgroundColor: SWEETLY.card,
    paddingHorizontal: 20,
    justifyContent: "center",
    color: SWEETLY.text,
    fontFamily: FONTS.text,
    fontSize: 15,
  },

  inputText: {
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 15,
  },

  calendar: {
    marginTop: 10,
    backgroundColor: SWEETLY.card,
    borderRadius: 24,
    padding: 10,
  },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
});
