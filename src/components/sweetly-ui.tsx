import { ReactNode } from 'react';
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

import { FONTS, SIZE, SWEETLY } from '@/constants/sweetly-theme';

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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primary,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={styles.primaryText}>{title}</Text>
    </Pressable>
  );
}

// Вторичная кнопка: белая пилюля
export function SecondaryButton({
  title,
  onPress,
  style,
}: {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, pressed && styles.pressed, style]}
    >
      <Text style={styles.secondaryText}>{title}</Text>
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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.dark, pressed && styles.pressed, style]}
    >
      <Text style={styles.primaryText}>{title}</Text>
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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.circle,
        active && styles.circleActive,
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

// Карточка: белая, скругление 28
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// Поле ввода: белая пилюля
export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={SWEETLY.muted}
      style={styles.field}
      {...props}
    />
  );
}

// Переключатель
export function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[styles.toggle, { backgroundColor: value ? SWEETLY.accent : SWEETLY.toggleOff }]}
    >
      <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
    </Pressable>
  );
}

// Заголовок подраздела: маленькие заглавные буквы
export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

// Заголовок экрана: Playfair Display 40
export function ScreenTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.screenTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  primary: {
    height: SIZE.buttonHeight,
    borderRadius: SIZE.buttonHeight / 2,
    backgroundColor: SWEETLY.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dark: {
    height: SIZE.pillHeight,
    paddingHorizontal: 26,
    borderRadius: SIZE.pillHeight / 2,
    backgroundColor: SWEETLY.plum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    height: SIZE.pillHeight,
    borderRadius: SIZE.pillHeight / 2,
    backgroundColor: SWEETLY.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontFamily: FONTS.textBold,
    fontSize: 16,
  },
  secondaryText: {
    color: SWEETLY.text,
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
    backgroundColor: SWEETLY.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    backgroundColor: SWEETLY.accent,
  },
  card: {
    backgroundColor: SWEETLY.card,
    borderRadius: SIZE.cardRadius,
    padding: 18,
  },
  field: {
    height: SIZE.pillHeight,
    borderRadius: SIZE.pillHeight / 2,
    backgroundColor: SWEETLY.card,
    paddingHorizontal: 20,
    fontSize: 15,
    color: SWEETLY.text,
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
    color: SWEETLY.muted,
    fontFamily: FONTS.textBold,
    fontSize: 14,
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  screenTitle: {
    color: SWEETLY.text,
    fontFamily: FONTS.display,
    fontSize: 40,
  },
});
