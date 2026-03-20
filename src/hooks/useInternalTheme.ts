import { useEffect, useMemo, useState } from "react";

export type InternalTheme = "light" | "dark";

const STORAGE_KEY = "nivra_internal_theme";
const THEME_EVENT = "nivra_internal_theme_change";

const applyDocumentTheme = (theme: InternalTheme) => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("theme-light", "theme-dark");
  document.documentElement.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
};

const readStoredTheme = (): InternalTheme => {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
};

export function useInternalTheme() {
  const [theme, setTheme] = useState<InternalTheme>(() => readStoredTheme());

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncFromStorage = () => {
      const next = readStoredTheme();
      setTheme(next);
      applyDocumentTheme(next);
    };

    const onThemeEvent = (event: Event) => {
      const customEvent = event as CustomEvent<InternalTheme>;
      if (customEvent.detail === "dark" || customEvent.detail === "light") {
        setTheme(customEvent.detail);
        applyDocumentTheme(customEvent.detail);
      } else {
        syncFromStorage();
      }
    };

    window.addEventListener("storage", syncFromStorage);
    window.addEventListener(THEME_EVENT, onThemeEvent);
    syncFromStorage();

    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener(THEME_EVENT, onThemeEvent);
    };
  }, []);

  const applyTheme = (next: InternalTheme) => {
    setTheme(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
      applyDocumentTheme(next);
      window.dispatchEvent(new CustomEvent<InternalTheme>(THEME_EVENT, { detail: next }));
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
