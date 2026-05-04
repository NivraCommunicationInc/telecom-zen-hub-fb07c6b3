/**
 * useAutoTranslate — Translates DB-sourced strings (plan names/descriptions,
 * features) into the user's active language via the `translate-text` edge
 * function. Heavy localStorage caching (per-language, hash-keyed).
 *
 * Source language is assumed to be French (`fr`). Returns identical strings
 * when language === 'fr' or input is empty.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const CACHE_PREFIX = "nivra_tr_";
const CACHE_VERSION = "v1";

const hashKey = (text: string) => {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h << 5) - h + text.charCodeAt(i) | 0;
  return Math.abs(h).toString(36);
};

const readCache = (lang: string, text: string): string | null => {
  try {
    return localStorage.getItem(`${CACHE_PREFIX}${CACHE_VERSION}_${lang}_${hashKey(text)}`);
  } catch { return null; }
};
const writeCache = (lang: string, text: string, value: string) => {
  try { localStorage.setItem(`${CACHE_PREFIX}${CACHE_VERSION}_${lang}_${hashKey(text)}`, value); } catch { /* ignore */ }
};

export function useAutoTranslate(texts: string[]): { translated: string[]; isLoading: boolean } {
  const { language } = useLanguage();
  const [translated, setTranslated] = useState<string[]>(texts);
  const [isLoading, setIsLoading] = useState(false);
  const lastKey = useRef<string>("");

  useEffect(() => {
    const key = `${language}|${texts.join("\u0001")}`;
    if (lastKey.current === key) return;
    lastKey.current = key;

    if (language === "fr" || texts.length === 0) {
      setTranslated(texts);
      return;
    }

    // Hydrate from cache
    const cached: (string | null)[] = texts.map((t) => (t ? readCache(language, t) : ""));
    const missingIdx: number[] = [];
    cached.forEach((v, i) => { if (v == null && texts[i]) missingIdx.push(i); });

    const initial = texts.map((t, i) => cached[i] ?? t);
    setTranslated(initial);

    if (missingIdx.length === 0) return;

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const slice = missingIdx.map((i) => texts[i]);
        const { data, error } = await supabase.functions.invoke("translate-text", {
          body: { texts: slice, targetLang: language, sourceLang: "fr" },
        });
        if (cancelled || error) return;
        const out: string[] = Array.isArray(data?.translations) ? data.translations : slice;
        const next = [...initial];
        missingIdx.forEach((idx, k) => {
          const value = out[k] || texts[idx];
          next[idx] = value;
          writeCache(language, texts[idx], value);
        });
        setTranslated(next);
      } catch (e) {
        // keep source on error
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [language, texts.join("\u0001")]); // eslint-disable-line react-hooks/exhaustive-deps

  return { translated, isLoading };
}
