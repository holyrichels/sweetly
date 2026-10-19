import { ReactNode, useMemo } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { FONTS, SIZE } from '@/constants/sweetly-theme';
import { useColors } from '@/lib/theme';

type Colors = ReturnType<typeof useColors>;

// Стили строятся по текущей теме: цвета берутся только из токенов
function makeStyles(c: Colors) {
  return StyleSheet.create({
    primary: {
      height: SIZE.buttonHeight,
      borderRadius: SIZE.buttonHeight / 2,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dark: {
      height: SIZE.pillHeight,
      paddingHorizontal: 26,
      borderRadius: SIZE.pillHeight / 2,
      backgroundColor: c.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondary: {
      height: SIZE.pillHeight,
      borderRadius: SIZE.pillHeight / 2,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: {
      color: c.accentOn,
      fontFamily: FONTS.textBold,
      fontSize: 16,
    },
    darkText: {
      color: c.background,
      fontFamily: FONTS.textBold,
      fontSize: 16,
    },
    secondaryText: {
      color: c.text,
      fontFamily: FONTS.textBold,
      fontSize: 16,
    },
    pressed: {
      opacity: 0.8,
    },
    disabled: {
      opacity: 0.5,
    },
    circle: {
      width: SIZE.circleButton,
      height: SIZE.circleButton,
      borderRadius: SIZE.circleButton / 2,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleActive: {
      backgroundColor: c.accent,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: SIZE.cardRadius,
      padding: 18,
    },
    field: {
      height: SIZE.pillHeight,
      borderRadius: SIZE.pillHeight / 2,
      backgroundColor: c.card,
      paddingHorizontal: 20,
      fontSize: 15,
      color: c.text,
      fontFamily: FONTS.text,
    },
    toggle: {
      width: 51,
      height: 31,
      borderRadius: 16,
      padding: 2,
      justifyContent: 'center',
    },
    toggleKnob: {
      width: 27,
      height: 27,
      borderRadius: 14,
      backgroundColor: '#FFFFFF',
    },
    toggleKnobOn: {
      alignSelf: 'flex-end',
    },
    sectionLabel: {
      color: c.muted,
      fontFamily: FONTS.textBold,
      fontSize: 14,
      letterSpacing: 0.4,
      marginBottom: 10,
    },
    screenTitle: {
      color: c.text,
      fontFamily: FONTS.display,
      fontSize: 40,
    },
  });
}

// Основная кнопка: акцентная пилюля
export function PrimaryButton({
  title,
  onPress,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.primary, pressed && s.pressed, disabled && s.disabled, style]}
    >
      <Text style={s.primaryText}>{title}</Text>
    </Pressable>
  );
}

// Вторичная кнопка: пилюля на карточке
export function SecondaryButton({
  title,
  onPress,
  style,
}: {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.secondary, pressed && s.pressed, style]}>
      <Text style={s.secondaryText}>{title}</Text>
    </Pressable>
  );
}

// Тёмная кнопка (например, «Включить» в комнате)
export function DarkButton({
  title,
  onPress,
  style,
}: {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.dark, pressed && s.pressed, style]}>
      <Text style={s.darkText}>{title}</Text>
    </Pressable>
  );
}

// Круглая кнопка с иконкой (44–48 px)
export function CircleButton({
  onPress,
  children,
  active,
  style,
}: {
  onPress: () => void;
  children: ReactNode;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.circle, active && s.circleActive, pressed && s.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

// Карточка: скругление 28
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return <View style={[s.card, style]}>{children}</View>;
}

// Поле ввода: пилюля
export function Field(props: TextInputProps) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return <TextInput placeholderTextColor={c.muted} style={s.field} {...props} />;
}

// Переключатель
export function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[s.toggle, { backgroundColor: value ? c.accent : c.toggleOff }]}
    >
      <View style={[s.toggleKnob, value && s.toggleKnobOn]} />
    </Pressable>
  );
}

// Подпись раздела
export function SectionLabel({ children }: { children: ReactNode }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return <Text style={s.sectionLabel}>{children}</Text>;
}

// Заголовок экрана
export function ScreenTitle({ children }: { children: ReactNode }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return <Text style={s.screenTitle}>{children}</Text>;
}
