import { useState } from "react";

import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CalendarGrid, FadeIn, formatDateISO, formatDateRu } from "@/components/date-field";
import SkeletonScreen from "@/components/skeleton-screen";
import SubHeader from "@/components/sub-header";
import { Field, PrimaryButton, SectionLabel } from "@/components/sweetly-ui";
import { FONTS, SWEETLY } from "@/constants/sweetly-theme";
import { refreshAppData, useAppData } from "@/lib/app-data";
import { notify } from "@/lib/dialogs";
import { supabase } from "@/lib/supabase";

const STATUSES = ["Встречаемся", "В отношениях", "Живём вместе", "Помолвлены", "Женаты"];

// Ближайшая годовщина от даты начала отношений
function nextAnniversary(start?: string | null) {
  if (!start) return null;

  const base = new Date(`${start}T00:00:00`);

  const now = new Date();

  let next = new Date(now.getFullYear(), base.getMonth(), base.getDate());

  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    next = new Date(now.getFullYear() + 1, base.getMonth(), base.getDate());
  }

  return next;
}

// Строка с датой: по нажатию раскрывает календарь, «Сохранить» записывает значение
function DateRow({
  label,
  value,
  editable,
  onSave,
}: {
  label: string;
  value: string | null;
  editable: boolean;
  onSave?: (value: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const [draft, setDraft] = useState(value ?? formatDateISO(new Date()));

  const [saving, setSaving] = useState(false);

  return (
    <View>
      <Pressable
        style={styles.dateRow}
        onPress={() => editable && setOpen((current) => !current)}
        disabled={!editable}
      >
        <View style={styles.flex}>
          <Text style={styles.dateLabel}>{label}</Text>
          <Text style={styles.dateValue}>{value ? formatDateRu(value) : "не указана"}</Text>
        </View>

        {editable && <Text style={styles.edit}>{open ? "Закрыть" : "Изменить"}</Text>}
      </Pressable>

      {open && (
        <FadeIn>
          <View style={styles.calendarBox}>
            <CalendarGrid value={draft} onChange={setDraft} />

            <PrimaryButton
              title={saving ? "Сохраняем..." : "Сохранить"}
              disabled={saving}
              onPress={async () => {
                setSaving(true);

                await onSave?.(draft);

                setSaving(false);
                setOpen(false);
              }}
              style={styles.saveButton}
            />
          </View>
        </FadeIn>
      )}
    </View>
  );
}

export default function PairDataScreen() {
  const app = useAppData();

  const [nameDraft, setNameDraft] = useState<string | null>(null);

  const [savingName, setSavingName] = useState(false);

  if (!app.ready) return <SkeletonScreen />;

  const name = nameDraft ?? app.me?.name ?? "";

  const anniversary = nextAnniversary(app.couple?.relationship_date);

  async function setStatus(status: string) {
    if (!app.coupleId) return;

    const { data, error } = await supabase
      .from("couples")
      .update({ relationship_status: status })
      .eq("id", app.coupleId)
      .select("id");

    if (error || !data || data.length === 0) {
      notify("Не удалось сохранить", error?.message ?? "Нет доступа к изменению пары");

      return;
    }

    await refreshAppData();
  }

  async function saveName() {
    const trimmed = name.trim();

    if (!trimmed || !app.userId) {
      notify("Ошибка", "Имя не может быть пустым");

      return;
    }

    setSavingName(true);

    const { error } = await supabase.from("profiles").update({ name: trimmed }).eq("id", app.userId);

    setSavingName(false);

    if (error) {
      notify("Ошибка", error.message);

      return;
    }

    setNameDraft(null);

    await refreshAppData();
  }

  async function saveStart(value: string) {
    if (!app.coupleId) return;

    const { error } = await supabase
      .from("couples")
      .update({ relationship_date: value })
      .eq("id", app.coupleId);

    if (error) {
      notify("Ошибка", error.message);

      return;
    }

    await refreshAppData();
  }

  async function saveBirthday(value: string) {
    if (!app.userId) return;

    const { error } = await supabase.from("profiles").update({ birthday: value }).eq("id", app.userId);

    if (error) {
      notify("Ошибка", error.message);

      return;
    }

    await refreshAppData();
  }

  const currentStatus = app.couple?.relationship_status ?? "";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SubHeader title="Данные пары" />

      <View>
        <SectionLabel>СТАТУС ОТНОШЕНИЙ</SectionLabel>

        <View style={styles.chips}>
          {STATUSES.map((status) => {
            const active = currentStatus.toLowerCase() === status.toLowerCase();

            return (
              <Pressable
                key={status}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setStatus(status)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{status}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.gap}>
        <SectionLabel>ИМЕНА</SectionLabel>

        <Field value={name} onChangeText={setNameDraft} placeholder="Ваше имя" />

        {nameDraft !== null && nameDraft !== app.me?.name && (
          <PrimaryButton title={savingName ? "Сохраняем..." : "Сохранить имя"} onPress={saveName} disabled={savingName} />
        )}

        <View style={styles.partnerField}>
          <Text style={styles.partnerValue}>{app.partner?.name ?? "Партнёр не подключён"}</Text>
          <Text style={styles.partnerHint}>Своё имя партнёр меняет сам</Text>
        </View>
      </View>

      <View>
        <SectionLabel>ВАША ИСТОРИЯ</SectionLabel>

        <View style={styles.card}>
          <DateRow
            label="Начало отношений"
            value={app.couple?.relationship_date ?? null}
            editable
            onSave={saveStart}
          />

          <View style={styles.divider} />

          <View style={styles.dateRow}>
            <View style={styles.flex}>
              <Text style={styles.dateLabel}>Ближайшая годовщина</Text>
              <Text style={styles.dateValue}>{anniversary ? formatDateRu(formatDateISO(anniversary)) : "не указана"}</Text>
            </View>
          </View>
        </View>
      </View>

      <View>
        <SectionLabel>ДНИ РОЖДЕНИЯ</SectionLabel>

        <View style={styles.card}>
          <DateRow label={app.me?.name || "Вы"} value={app.me?.birthday ?? null} editable onSave={saveBirthday} />

          <View style={styles.divider} />

          <DateRow label={app.partner?.name || "Партнёр"} value={app.partner?.birthday ?? null} editable={false} />
        </View>
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
    gap: 22,
  },

  flex: { flex: 1 },

  gap: { gap: 10 },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  chip: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: SWEETLY.card,
    alignItems: "center",
    justifyContent: "center",
  },

  chipActive: { backgroundColor: SWEETLY.accent },

  chipText: {
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 15,
  },

  chipTextActive: { color: "#FFFFFF" },

  partnerField: {
    backgroundColor: SWEETLY.card,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 12,
    opacity: 0.8,
  },

  partnerValue: {
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 16,
  },

  partnerHint: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 12,
    marginTop: 2,
  },

  card: {
    backgroundColor: SWEETLY.card,
    borderRadius: 28,
    overflow: "hidden",
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 64,
  },

  dateLabel: {
    color: SWEETLY.muted,
    fontFamily: FONTS.text,
    fontSize: 13,
  },

  dateValue: {
    color: SWEETLY.text,
    fontFamily: FONTS.textBold,
    fontSize: 17,
    marginTop: 2,
  },

  edit: {
    color: SWEETLY.accent,
    fontFamily: FONTS.textBold,
    fontSize: 14,
  },

  divider: {
    height: 1,
    backgroundColor: SWEETLY.divider,
    marginHorizontal: 20,
  },

  calendarBox: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    gap: 12,
  },

  saveButton: { height: 48 },
});
