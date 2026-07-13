/**
 * PDF sanitization helpers — the safety net between raw business data and
 * `doc.text()`.
 */

/** What we show when a non-critical field is genuinely missing. */
export const PDF_MISSING_VALUE_PLACEHOLDER = "—" as const;

/** What we show when a required field is missing — louder than `—`. */
export const PDF_REQUIRED_FIELD_FALLBACK = "Non fourni" as const;

/**
 * Coerces any value to a PDF-safe string.
 */
export function safeText(value: unknown, fallback: string = PDF_MISSING_VALUE_PLACEHOLDER): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return fallback;
    return String(value);
  }
  if (typeof value === "boolean") return value ? "Oui" : "Non";

  const s = String(value).trim();
  if (s.length === 0) return fallback;
  
  // Common leaks from upstream serialization bugs.
  if (s === "null" || s === "undefined" || s === "NaN" || s === "[object Object]") {
    return fallback;
  }

  // Strip Minecraft/legacy formatting codes (&1, &e, &r, etc.)
  const deMinecrafted = s.replace(/[&§][0-9a-fk-or]/gi, "");
  
  return sanitizeForPdfText(deMinecrafted);
}

/**
 * Clean up a string for safe rendering in a jsPDF document.
 */
export function sanitizeForPdfText(s: string): string {
  return s
    // Strip ASCII control chars except newline + tab
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    // Curly single quotes → straight apostrophe
    .replace(/[‘’]/g, "'")
    // Curly double quotes → straight
    .replace(/[“”]/g, '"')
    // Ellipsis char → three dots
    .replace(/…/g, "...")
    // Trim BUT preserve a single trailing newline if intentional
    .replace(/\s+$/g, "");
}

/** People / company names. */
export function safeName(value: unknown): string {
  return safeText(value, PDF_REQUIRED_FIELD_FALLBACK);
}

/** Multi-line address. */
export function safeAddress(
  value: any | null | undefined,
): string {
  if (value == null) return PDF_REQUIRED_FIELD_FALLBACK;
  if (typeof value === "string") return safeText(value, PDF_REQUIRED_FIELD_FALLBACK);

  const parts: string[] = [];
  const line = safeText(value.line1 ?? value.address, "");
  if (line) parts.push(line);
  if (value.line2) parts.push(safeText(value.line2, ""));
  const cityLine = [
    safeText(value.city, ""),
    safeText(value.province, ""),
    safeText(value.postal_code ?? value.postalCode, ""),
  ]
    .filter(Boolean)
    .join(", ");
  if (cityLine) parts.push(cityLine);
  return parts.length > 0 ? parts.join("\n") : PDF_REQUIRED_FIELD_FALLBACK;
}

/** CAD currency formatter. */
export function safeMoney(value: unknown, currency: "CAD" | "USD" = "CAD"): string {
  if (value === null || value === undefined) return PDF_MISSING_VALUE_PLACEHOLDER;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(n)) return PDF_MISSING_VALUE_PLACEHOLDER;
  try {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} $`;
  }
}

/** Locale-aware date formatter. */
export function safeDate(
  value: unknown,
  style: "long" | "short" | "medium" = "long",
  locale: string = "fr-CA",
): string {
  if (value === null || value === undefined) return PDF_MISSING_VALUE_PLACEHOLDER;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return PDF_MISSING_VALUE_PLACEHOLDER;
  try {
    if (style === "short") {
      return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
    }
    if (style === "medium") {
      return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
    }
    return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return d.toISOString().split("T")[0];
  }
}

/** Phone formatter. */
export function safePhone(value: unknown): string {
  if (value === null || value === undefined) return PDF_MISSING_VALUE_PLACEHOLDER;
  const raw = String(value).replace(/[^\d]/g, "");
  if (raw.length === 10) {
    return `(${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
  }
  if (raw.length === 11 && raw.startsWith("1")) {
    return `+1 (${raw.slice(1, 4)}) ${raw.slice(4, 7)}-${raw.slice(7)}`;
  }
  return safeText(value, PDF_MISSING_VALUE_PLACEHOLDER);
}

/** Email — normalised to lowercase, trimmed. */
export function safeEmail(value: unknown): string {
  if (value === null || value === undefined) return PDF_MISSING_VALUE_PLACEHOLDER;
  const s = String(value).trim().toLowerCase();
  if (s.length === 0 || !s.includes("@")) return PDF_MISSING_VALUE_PLACEHOLDER;
  return s;
}

/** Run a "missing fields" check before generating a PDF. */
export function checkRequiredFields<T extends Record<string, unknown>>(
  data: T,
  required: (keyof T)[],
): (keyof T)[] {
  const missing: (keyof T)[] = [];
  for (const key of required) {
    const v = data[key];
    if (v === null || v === undefined) {
      missing.push(key);
      continue;
    }
    if (typeof v === "string" && v.trim() === "") missing.push(key);
  }
  return missing;
}
