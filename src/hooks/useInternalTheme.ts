import { useEffect, useMemo, useState } from "react";

export type InternalTheme = "light" | "dark";

const STORAGE_KEY = "nivra_internal_theme";

export function useInternalTheme() {
  const [theme, setTheme] = useState<InternalTheme>("light");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
    }
  }, []);

  const applyTheme = (next: InternalTheme) => {
    setTheme(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const toggleTheme = () => applyTheme(theme === "light" ? "dark" : "light");

  const themeClass = useMemo(() => (theme === "dark" ? "theme-dark" : "theme-light"), [theme]);

  return {
    theme,
    themeClass,
    setTheme: applyTheme,
    toggleTheme,
  };
}
