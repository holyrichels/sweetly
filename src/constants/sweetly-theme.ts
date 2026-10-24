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

// ---------- Темы и акценты ----------

export type ThemeName = 'light' | 'dark' | 'auto';

export type ResolvedTheme = 'light' | 'dark';

export type AccentName = 'rose' | 'berry' | 'coral' | 'plum';

export const ACCENTS: Record<AccentName, { label: string; color: string }> = {
  rose: { label: 'Роза', color: '#C23A62' },
  berry: { label: 'Ягода', color: '#B5304F' },
  coral: { label: 'Коралл', color: '#E0654A' },
  plum: { label: 'Слива', color: '#8E4585' },
};

// Осветляет цвет к белому на заданную долю: для текста и иконок акцента в тёмной теме
export function lighten(hex: string, amount: number): string {
  const value = hex.replace('#', '');

  const channels = [0, 2, 4].map((index) => parseInt(value.substring(index, index + 2), 16));

  const mixed = channels.map((channel) => Math.round(channel + (255 - channel) * amount));

  return '#' + mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export type Palette = {
  background: string;
  card: string;
  peach: string;
  peachLight: string;
  divider: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  accentPale: string;
  accentOn: string;
  dashed: string;
  error: string;
  toggleOff: string;
  bottomBar: string;
  videoBg: string;
  plumCard: string;
  onPlumCard: string;
};

// Палитра для темы и акцента. Coral: текст на заливке тёмный.
export function getPalette(theme: ResolvedTheme, accent: AccentName): Palette {
  const color = ACCENTS[accent].color;

  // Текст на акцентной заливке белый для всех акцентов, как в макете
  const onAccent = '#FFFFFF';

  if (theme === 'dark') {
    return {
      background: '#1E1218',
      card: '#2E1E26',
      peach: '#4A2C36',
      peachLight: '#3A2430',
      divider: '#3E2A33',
      text: '#FBE9EF',
      muted: '#B89AA6',
      accent: color,
      accentText: lighten(color, 0.4),
      accentPale: SWEETLY.accentPale,
      accentOn: onAccent,
      dashed: '#7A5A66',
      error: '#FF8FA3',
      toggleOff: '#5A4550',
      bottomBar: '#2E1E26',
      videoBg: '#120A0E',
      plumCard: '#4A2C36',
      onPlumCard: '#FBE9EF',
    };
  }

  return {
    background: '#FFF1F0',
    card: '#FFFFFF',
    peach: '#FFD9C9',
    peachLight: '#FFE6DB',
    divider: '#F3DCDD',
    text: '#3B1F2B',
    muted: '#7A5A66',
    accent: color,
    accentText: color,
    accentPale: SWEETLY.accentPale,
    accentOn: onAccent,
    dashed: '#D98BA0',
    error: '#B5304F',
    toggleOff: '#D9C3CA',
    bottomBar: '#FFFFFF',
    videoBg: '#3B1F2B',
    plumCard: '#3B1F2B',
    onPlumCard: '#FFFFFF',
  };
}

// ---------- Живая палитра: текущая тема доступна везде, включая вспомогательные компоненты ----------

// Текущая палитра. Обновляется провайдером темы при смене темы или акцента.
export const C: Palette = { ...getPalette('light', 'rose') };

let paletteVersion = 0;

export function setLive(next: Palette) {
  const changed = (Object.keys(next) as (keyof Palette)[]).some((key) => C[key] !== next[key]);

  if (changed) {
    Object.assign(C, next);
    paletteVersion += 1;
  }
}

// Стили, которые пересчитываются при смене темы. Используются как обычный объект styles.
export function liveStyles<T extends object>(factory: (palette: Palette) => T): T {
  let cache: { version: number; value: T } | null = null;

  return new Proxy({} as T, {
    get(_target, key) {
      if (!cache || cache.version !== paletteVersion) {
        cache = { version: paletteVersion, value: factory(C) };
      }

      return (cache.value as any)[key];
    },
  });
}
