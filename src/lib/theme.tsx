import { createContext, Fragment, ReactNode, useContext, useEffect } from "react";

import { AccentName, getPalette, ResolvedTheme, setLive, ThemeName } from "@/constants/sweetly-theme";
import { useAppData } from "@/lib/app-data";

type ThemeValue = {
  theme: ResolvedTheme;
  accent: AccentName;
  colors: ReturnType<typeof getPalette>;
};

const DEFAULT: ThemeValue = {
  theme: "light",
  accent: "rose",
  colors: getPalette("light", "rose"),
};

const ThemeContext = createContext<ThemeValue>(DEFAULT);

// Тема пользователя из профиля: применяется ко всему приложению
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const app = useAppData();

  const stored: ThemeName = app.me?.theme === "dark" || app.me?.theme === "auto" ? (app.me.theme as ThemeName) : "light";

  // «auto» берёт тему из Telegram, а не из системы устройства
  const telegramScheme = (globalThis as any).Telegram?.WebApp?.colorScheme;

  const theme: ResolvedTheme =
    stored === "auto" ? (telegramScheme === "dark" ? "dark" : "light") : stored;

  const accent: AccentName = (["rose", "berry", "coral", "plum"] as const).includes(app.me?.accent as AccentName)
    ? (app.me?.accent as AccentName)
    : "rose";

  const colors = getPalette(theme, accent);

  // Обновляем живую палитру до отрисовки детей: все экраны берут цвета из неё
  setLive(colors);

  // Шапка и фон Telegram под текущую тему, чтобы кнопки Telegram не сливались с фоном
  useEffect(() => {
    const tg = (globalThis as any).Telegram?.WebApp;

    tg?.setHeaderColor?.(colors.background);
    tg?.setBackgroundColor?.(colors.background);
  }, [colors.background]);

  return (
    <ThemeContext.Provider value={{ theme, accent, colors }}>
      {/* При смене темы или акцента дерево перерисовывается целиком, чтобы все цвета обновились */}
      <Fragment key={`${theme}-${accent}`}>{children}</Fragment>
    </ThemeContext.Provider>
  );
}

// Цвета текущей темы: используйте внутри компонентов вместо SWEETLY
export function useColors() {
  return useContext(ThemeContext).colors;
}

export function useThemeName() {
  const value = useContext(ThemeContext);

  return { theme: value.theme, accent: value.accent };
}
