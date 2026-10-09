import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
    Animated,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

export function formatDateISO(date: Date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseDateISO(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }

  return new Date();
}

// Барабан выбора даты (день / месяц / год) как в таймере на iPhone.
// Значение хранится строкой ГГГГ-ММ-ДД, чтобы остальной код не менялся.
// Плавное появление блока (календарь раскрывается без резкого скачка)
export function FadeIn({ children }: { children: ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [anim]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [-8, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

const MONTH_NAMES = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
];

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function formatDateRu(value: string) {
  return parseDateISO(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Календарь: месяцы, годы и сетка дней. Будущие даты недоступны.
export function CalendarGrid({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = parseDateISO(value);

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const year = selected.getFullYear();
  const month = selected.getMonth();
  const day = selected.getDate();

  // Выбираем дату, не выходя за пределы: день не больше числа дней в месяце
  // и не позже сегодняшнего дня
  function pickDate(newYear: number, newMonth: number, newDay: number) {
    const maxDay = new Date(newYear, newMonth + 1, 0).getDate();
    let next = new Date(newYear, newMonth, Math.min(newDay, maxDay));

    if (next > todayStart) next = todayStart;

    onChange(formatDateISO(next));
  }

  const years: number[] = [];

  for (let y = today.getFullYear(); y >= today.getFullYear() - 80; y--) {
    years.push(y);
  }

  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View style={styles.calendar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {MONTH_NAMES.map((name, index) => {
          const active = index === month;

          return (
            <Pressable
              key={name}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => pickDate(year, index, day)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {years.map((item) => {
          const active = item === year;

          return (
            <Pressable
              key={item}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => pickDate(item, month, day)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((weekday) => (
          <Text key={weekday} style={styles.weekText}>
            {weekday}
          </Text>
        ))}
      </View>

      <View style={styles.daysGrid}>
        {cells.map((cell, index) => {
          if (cell === null) {
            return <View key={`empty-${index}`} style={styles.dayCell} />;
          }

          const isSelected = cell === day;
          const isFuture = new Date(year, month, cell) > todayStart;

          return (
            <Pressable
              key={cell}
              style={[styles.dayCell, isSelected && styles.dayCellActive]}
              disabled={isFuture}
              onPress={() => pickDate(year, month, cell)}
            >
              <Text
                style={[
                  styles.dayText,
                  isSelected && styles.dayTextActive,
                  isFuture && styles.dayTextDisabled,
                ]}
              >
                {cell}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: {
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#f2dfe5",
    padding: 10,
  },

  chipRow: {
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },

  chip: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff5f8",
    alignItems: "center",
    justifyContent: "center",
  },

  chipActive: {
    backgroundColor: "#e98ca8",
  },

  chipText: {
    color: "#8a6b74",
    fontSize: 13,
    fontWeight: "700",
  },

  chipTextActive: {
    color: "#ffffff",
  },

  weekRow: {
    flexDirection: "row",
    marginTop: 10,
  },

  weekText: {
    flex: 1,
    textAlign: "center",
    color: "#b49ba3",
    fontSize: 12,
    fontWeight: "700",
  },

  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },

  dayCell: {
    width: "14.2857%",
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  dayCellActive: {
    backgroundColor: "#e98ca8",
    borderRadius: 20,
  },

  dayText: {
    color: "#35242a",
    fontSize: 15,
    fontWeight: "600",
  },

  dayTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },

  dayTextDisabled: {
    color: "#d9c7cd",
  },
});
