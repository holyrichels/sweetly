import { useState } from "react";

import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CalendarGrid, FadeIn, formatDateISO, formatDateRu } from "@/components/date-field";
import SkeletonScreen from "@/components/skeleton-screen";
import SubHeader from "@/components/sub-header";
import { Field, PrimaryButton, SecondaryButton } from "@/components/sweetly-ui";
import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { refreshAppData, useAppData } from "@/lib/app-data";
import { confirmAction, notify } from "@/lib/dialogs";
import { supabase } from "@/lib/supabase";

function daysSince(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(`${value}T00:00:00`).getTime()) / 86400000));
}

type Item = { id: string; title: string; date: string; isMain: boolean };

export default function DatesScreen() {
  const app = useAppData();

  // null — форма закрыта; "new" — создаём; иначе id редактируемого таймера
  const [editing, setEditing] = useState<string | null>(null);

  const [title, setTitle] = useState("");

  const [date, setDate] = useState(formatDateISO(new Date()));

  const [selectedId, setSelectedId] = useState("main");

  const [saving, setSaving] = useState(false);

  if (!app.ready) return <SkeletonScreen />;

  const items: Item[] = [
    {
      id: "main",
      title: app.partner ? `Влюблённые с ${app.partner.name}` : "Наша история",
      date: app.couple?.relationship_date ?? formatDateISO(new Date()),
      isMain: true,
    },
    ...app.timers.map((timer) => ({
      id: timer.id,
      title: timer.title,
      date: timer.start_date,
      isMain: false,
    })),
  ];

  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  function openNew() {
    setEditing("new");
    setTitle("");
    setDate(formatDateISO(new Date()));
  }

  function openEdit() {
    setEditing(selected.id);
    setTitle(selected.isMain ? "" : selected.title);
    setDate(selected.date);
  }

  async function save() {
    if (!app.coupleId || !app.userId) return;

    if (editing !== "main" && !title.trim()) {
      notify("Ошибка", "Введите название таймера");

      return;
    }

    setSaving(true);

    try {
      let error;

      if (editing === "main") {
        ({ error } = await supabase.from("couples").update({ relationship_date: date }).eq("id", app.coupleId));
      } else if (editing === "new") {
        ({ error } = await supabase.from("couple_timers").insert({
          couple_id: app.coupleId,
          title: title.trim(),
          start_date: date,
          created_by: app.userId,
        }));
      } else {
        ({ error } = await supabase
          .from("couple_timers")
          .update({ title: title.trim(), start_date: date })
          .eq("id", editing));
      }

      if (error) {
        notify("Ошибка", error.message);

        return;
      }

      setEditing(null);

      await refreshAppData();
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    if (selected.isMain) return;

    confirmAction("Удалить таймер?", "Это действие нельзя отменить.", async () => {
      const { error } = await supabase.from("couple_timers").delete().eq("id", selected.id);

      if (error) {
        notify("Ошибка", error.message);

        return;
      }

      setSelectedId("main");

      await refreshAppData();
    }, "Удалить");
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SubHeader title="Даты и таймеры" />

      <View style={styles.list}>
        {items.map((item) => {
          const active = item.id === selected.id;

          return (
            <Pressable
              key={item.id}
              style={[styles.card, active && styles.cardActive]}
              onPress={() => setSelectedId(item.id)}
            >
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDate}>{formatDateRu(item.date)}</Text>
              </View>

              <Text style={styles.cardNumber}>
                {daysSince(item.date)} <Text style={styles.cardUnit}>дн</Text>
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <SecondaryButton title="Изменить" onPress={openEdit} style={styles.flex} />

        {!selected.isMain && <SecondaryButton title="Удалить" onPress={remove} style={styles.flex} />}
      </View>

      <Pressable style={styles.addButton} onPress={openNew}>
        <Text style={styles.addText}>+  Новый таймер</Text>
      </Pressable>

      {editing !== null && (
        <FadeIn>
          <View style={styles.form}>
            <Text style={styles.formTitle}>
              {editing === "new" ? "Новый таймер" : editing === "main" ? "Начало отношений" : "Изменить таймер"}
            </Text>

            {editing !== "main" && (
              <Field placeholder="Название, например «Первая поездка»" value={title} onChangeText={setTitle} />
            )}

            <CalendarGrid value={date} onChange={setDate} />

            <View style={styles.actions}>
              <SecondaryButton title="Отмена" onPress={() => setEditing(null)} style={styles.flex} />

              <PrimaryButton
                title={saving ? "Сохраняем..." : "Сохранить"}
                onPress={save}
                disabled={saving}
                style={styles.flex}
              />
            </View>
          </View>
        </FadeIn>
      )}
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
    gap: 14,
  },

  flex: { flex: 1 },

  list: { gap: 10 },

  card: {
    backgroundColor: SWEETLY.card,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },

  cardActive: { borderColor: SWEETLY.accent },

  cardTitle: {
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 17,
  },

  cardDate: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 13,
    marginTop: 2,
  },

  cardNumber: {
    color: SWEETLY.accent,
    fontFamily: FONTS.display,
    fontSize: 28,
  },

  cardUnit: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 14,
  },

  actions: {
    flexDirection: "row",
    gap: 10,
  },

  addButton: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: SWEETLY.dashed,
    alignItems: "center",
    justifyContent: "center",
  },

  addText: {
    color: SWEETLY.accent,
    fontFamily: FONTS.textBold,
    fontSize: 16,
  },

  form: {
    backgroundColor: SWEETLY.card,
    borderRadius: 28,
    padding: 16,
    gap: 12,
  },

  formTitle: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 22,
  },
});
