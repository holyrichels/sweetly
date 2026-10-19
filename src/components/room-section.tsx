import { useEffect, useState } from "react";

import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import SubHeader from "@/components/sub-header";
import { PrimaryButton } from "@/components/sweetly-ui";
import { FONTS, C, liveStyles } from "@/constants/sweetly-theme";
import { useAppData } from "@/lib/app-data";
import { notify } from "@/lib/dialogs";
import { supabase } from "@/lib/supabase";

// Настройки раздела: какая таблица и какие поля используются
export type SectionConfig = {
  title: string;
  table: "couple_plans" | "couple_wishes" | "couple_places" | "couple_notes";
  titleLabel: string;
  placeholder: string;
  extraCol?: "price" | "address";
  extraLabel?: string;
  toggleCol?: "done" | "pinned";
  emptyText: string;
};

type Row = {
  id: string;
  created_by: string;
  title?: string;
  text?: string;
  price?: string;
  address?: string;
  done?: boolean;
  pinned?: boolean;
  created_at: string;
};

// Общий каркас раздела комнаты: список, добавление, отметка и удаление
export default function RoomSection({ config }: { config: SectionConfig }) {
  const app = useAppData();

  const [rows, setRows] = useState<Row[]>([]);

  const [title, setTitle] = useState("");

  const [extra, setExtra] = useState("");

  const [saving, setSaving] = useState(false);

  const [adding, setAdding] = useState(false);

  const coupleId = app.coupleId;

  // Текст записи хранится в разных полях: у заметок это text, у остальных title
  const textOf = (row: Row) => (config.table === "couple_notes" ? row.text ?? "" : row.title ?? "");

  async function load() {
    if (!coupleId) return;

    const { data } = await supabase
      .from(config.table)
      .select("*")
      .eq("couple_id", coupleId)
      .order("created_at", { ascending: false });

    setRows((data as Row[]) ?? []);
  }

  useEffect(() => {
    load();
  }, [coupleId]);

  async function add() {
    if (!coupleId || !app.userId) return;

    const value = title.trim();

    if (!value) {
      notify("Пусто", "Напишите, что добавить");

      return;
    }

    setSaving(true);

    const payload: Record<string, unknown> = {
      couple_id: coupleId,
      created_by: app.userId,
    };

    if (config.table === "couple_notes") payload.text = value;
    else payload.title = value;

    if (config.extraCol) payload[config.extraCol] = extra.trim();

    const { error } = await supabase.from(config.table).insert(payload);

    setSaving(false);

    if (error) {
      notify("Ошибка", error.message);

      return;
    }

    setTitle("");
    setExtra("");
    setAdding(false);

    await load();
  }

  async function toggle(row: Row) {
    if (!config.toggleCol) return;

    const next = !row[config.toggleCol];

    const { error } = await supabase
      .from(config.table)
      .update({ [config.toggleCol]: next })
      .eq("id", row.id);

    if (error) {
      notify("Ошибка", error.message);

      return;
    }

    await load();
  }

  async function remove(row: Row) {
    const { error } = await supabase.from(config.table).delete().eq("id", row.id);

    if (error) {
      notify("Ошибка", error.message);

      return;
    }

    await load();
  }

  // Сортировка заметок: закреплённые сверху
  const sorted =
    config.table === "couple_notes"
      ? [...rows].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned))
      : rows;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SubHeader title={config.title} />

      {adding ? (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={config.placeholder}
            placeholderTextColor={C.muted}
            value={title}
            onChangeText={setTitle}
          />

          {config.extraCol ? (
            <TextInput
              style={styles.input}
              placeholder={config.extraLabel}
              placeholderTextColor={C.muted}
              value={extra}
              onChangeText={setExtra}
            />
          ) : null}

          <PrimaryButton title={saving ? "Сохраняем..." : "Добавить"} onPress={add} disabled={saving} />
        </View>
      ) : (
        <Pressable style={styles.addButton} onPress={() => setAdding(true)}>
          <Text style={styles.addText}>+ Добавить</Text>
        </Pressable>
      )}

      {sorted.length === 0 ? (
        <Text style={styles.empty}>{config.emptyText}</Text>
      ) : (
        <View style={styles.list}>
          {sorted.map((row) => {
            const pinned = config.table === "couple_notes" && !!row.pinned;

            const done = config.toggleCol === "done" && !!row.done;

            return (
              <View key={row.id} style={[styles.card, pinned && styles.cardPinned]}>
                {config.toggleCol ? (
                  <Pressable style={[styles.check, (done || pinned) && styles.checkOn]} onPress={() => toggle(row)}>
                    {(done || pinned) && (
                      <Svg width={14} height={14} viewBox="0 0 24 24">
                        <Path d="M5 12l5 5 9-10" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    )}
                  </Pressable>
                ) : null}

                <View style={styles.flex}>
                  <Text style={[styles.cardTitle, done && styles.cardDone]}>{textOf(row)}</Text>

                  {config.extraCol && row[config.extraCol] ? (
                    <Text style={styles.cardSub}>{row[config.extraCol]}</Text>
                  ) : null}
                </View>

                <Pressable onPress={() => remove(row)} hitSlop={10}>
                  <Text style={styles.remove}>×</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = liveStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },

  content: {
    paddingHorizontal: 22,
    paddingTop: 55,
    paddingBottom: 70,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: 14,
  },

  flex: { flex: 1 },

  addButton: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: C.dashed,
    alignItems: "center",
    justifyContent: "center",
  },

  addText: {
    color: C.accent,
    fontFamily: FONTS.textBold,
    fontSize: 16,
  },

  form: {
    backgroundColor: C.card,
    borderRadius: 28,
    padding: 16,
    gap: 10,
  },

  input: {
    height: 48,
    borderRadius: 24,
    backgroundColor: C.background,
    paddingHorizontal: 18,
    fontSize: 15,
    color: C.text,
  },

  empty: {
    color: C.muted,
    fontFamily: FONTS.text,
    fontSize: 15,
    textAlign: "center",
    marginTop: 30,
  },

  list: { gap: 10 },

  card: {
    backgroundColor: C.card,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  cardPinned: {
    backgroundColor: C.peach,
  },

  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  checkOn: {
    backgroundColor: C.accent,
  },

  cardTitle: {
    color: C.text,
    fontFamily: FONTS.textBold,
    fontSize: 16,
  },

  cardDone: {
    textDecorationLine: "line-through",
    color: C.muted,
  },

  cardSub: {
    color: C.muted,
    fontFamily: FONTS.text,
    fontSize: 13,
    marginTop: 2,
  },

  remove: {
    color: C.muted,
    fontSize: 22,
    paddingHorizontal: 4,
  },
}));
