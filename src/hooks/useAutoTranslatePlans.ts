/**
 * useAutoTranslatePlans — Translates `name`, `description` and `features`
 * fields of plan-like records into the active language. French is passthrough.
 */
import { useMemo } from "react";
import { useAutoTranslate } from "./useAutoTranslate";

export function useAutoTranslatePlans<T extends { name?: string; description?: string; features?: string[] }>(
  plans: T[],
): { plans: T[]; isLoading: boolean } {
  // Flatten all strings into a single array, preserving order.
  const flat = useMemo(() => {
    const arr: string[] = [];
    plans.forEach((p) => {
      arr.push(p.name || "");
      arr.push(p.description || "");
      (p.features || []).forEach((f) => arr.push(f || ""));
    });
    return arr;
  }, [plans]);

  const { translated, isLoading } = useAutoTranslate(flat);

  const out = useMemo(() => {
    let cursor = 0;
    return plans.map((p) => {
      const name = translated[cursor++] ?? p.name;
      const description = translated[cursor++] ?? p.description;
      const features = (p.features || []).map(() => translated[cursor++] ?? "");
      return { ...p, name, description, features } as T;
    });
  }, [plans, translated]);

  return { plans: out, isLoading };
}
