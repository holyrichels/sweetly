import { createContext, ReactNode, useContext } from "react";

import { AccentName, getPalette, ThemeName } from "@/constants/sweetly-theme";
import { useAppData } from "@/lib/app-data";

type ThemeValue = {
  theme: ThemeName;
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

  const theme: ThemeName = app.me?.theme === "dark" ? "dark" : "light";

  const accent: AccentName = (["rose", "berry", "coral", "plum"] as const).includes(app.me?.accent as AccentName)
    ? (app.me?.accent as AccentName)
    : "rose";

  return (
    <ThemeContext.Provider value={{ theme, accent, colors: getPalette(theme, accent) }}>
      {children}
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
