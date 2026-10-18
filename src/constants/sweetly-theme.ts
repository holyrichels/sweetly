// Дизайн-система Sweetly, вариант «Blush». Все цвета и размеры меняются здесь.
export const SWEETLY = {
  // Фоны
  background: '#FFF1F0',
  card: '#FFFFFF',
  peach: '#FFD9C9',
  divider: '#F3DCDD',

  // Текст
  text: '#3B1F2B',
  muted: '#7A5A66',

  // Акцент
  accent: '#C23A62',
  accentLight: '#E87A94',
  accentPale: '#F4B1C0',

  // Служебные
  dashed: '#D98BA0',
  error: '#B5304F',
  toggleOff: '#D9C3CA',
  plum: '#3B1F2B',
};

// Шрифты: Playfair Display для заголовков и больших цифр, Manrope для остального
export const FONTS = {
  text: 'Manrope_500Medium',
  textBold: 'Manrope_700Bold',
  display: 'PlayfairDisplay_700Bold',
  displayItalic: 'PlayfairDisplay_600SemiBold_Italic',
};

// Размеры из макета
export const SIZE = {
  screenPadding: 22,
  gap: 14,
  cardRadius: 28,
  smallCardRadius: 22,
  buttonHeight: 56,
  pillHeight: 52,
  circleButton: 48,
  tabBarHeight: 88,
  minTouch: 44,
};

// ---------- Светлая и тёмная тема, акцентные цвета ----------

export type ThemeName = 'light' | 'dark';

export type AccentName = 'rose' | 'berry' | 'coral' | 'plum';

// Акцентные цвета: выбирает пользователь, применяются ко всей палитре темы
export const ACCENTS: Record<AccentName, { label: string; color: string; light: string }> = {
  rose: { label: 'Роза', color: '#C23A62', light: '#E87A94' },
  berry: { label: 'Ягода', color: '#B5304F', light: '#D9667F' },
  coral: { label: 'Коралл', color: '#E0654A', light: '#F09A86' },
  plum: { label: 'Слива', color: '#8E4585', light: '#B57AAE' },
};

type Palette = {
  background: string;
  card: string;
  peach: string;
  divider: string;
  text: string;
  muted: string;
  accent: string;
  accentLight: string;
  accentPale: string;
  dashed: string;
  error: string;
  toggleOff: string;
  plum: string;
};

// Палитра для выбранной темы и акцента
export function getPalette(theme: ThemeName, accent: AccentName): Palette {
  const picked = ACCENTS[accent];

  if (theme === 'dark') {
    return {
      background: '#1E1218',
      card: '#2E1E26',
      peach: '#4A2C36',
      divider: '#3E2A33',
      text: '#FBE9EF',
      muted: '#B89AA6',
      accent: picked.color,
      accentLight: picked.light,
      accentPale: '#5A3442',
      dashed: '#7A5A66',
      error: '#FF8FA3',
      toggleOff: '#5A4550',
      plum: '#FBE9EF',
    };
  }

  return {
    background: '#FFF1F0',
    card: '#FFFFFF',
    peach: '#FFD9C9',
    divider: '#F3DCDD',
    text: '#3B1F2B',
    muted: '#7A5A66',
    accent: picked.color,
    accentLight: picked.light,
    accentPale: '#F4B1C0',
    dashed: '#D98BA0',
    error: '#B5304F',
    toggleOff: '#D9C3CA',
    plum: '#3B1F2B',
  };
}
