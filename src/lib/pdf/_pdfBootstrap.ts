/**
 * PDF bootstrap — install once, protect every jsPDF instance forever.
 *
 * This module monkey-patches `jsPDF.prototype.text` so any value passed to
 * `doc.text()` is run through `safeText()` BEFORE being rendered. The result:
 * no existing template needs to change, but no `doc.text(null)` ever again
 * writes the literal string "null" / "undefined" / "NaN" / "[object Object]"
 * into a customer-facing PDF.
 *
 * Why a prototype patch (vs. factory or refactor):
 *   - We have 30+ templates that already call `new jsPDF(...)` directly.
 *   - Refactoring each to use a factory takes hours and one missed file
 *     silently regresses.
 *   - A single prototype patch is one-time work and covers everything,
 *     including future templates we haven't written yet.
 *
 * Safety:
 *   - Patches once (idempotent — guarded by a module-level flag).
 *   - Sanitizer is a no-op on already-safe strings, so templates that already
 *     use `safeText()` explicitly are unaffected.
 *   - Original `text()` is preserved internally; the wrapper only changes
 *     the first argument and forwards the rest unchanged.
 *
 * Loading:
 *   Import this file ONCE at app startup. We do it from `src/lib/pdf/index.ts`
 *   so any code that touches `@/lib/pdf` automatically gets the patch.
 */
import { jsPDF } from "jspdf";
import { safeText } from "./_pdfSanitize";

const PATCH_FLAG_KEY = "__nivra_jspdf_text_hardened__";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var __nivra_jspdf_text_hardened__: boolean | undefined;
}

/**
 * Install the prototype patch. Safe to call multiple times — only the first
 * call mutates jsPDF. Returns true if it actually installed, false if it
 * was already in place.
 */
export function installPdfTextHardener(fallback: string = "—"): boolean {
  // Idempotency check on the jsPDF class itself (in case the module is
  // loaded twice via different bundles).
  const jsPDFProto = (jsPDF as unknown as { prototype: Record<string, unknown> }).prototype;
  if (jsPDFProto[PATCH_FLAG_KEY]) return false;
  jsPDFProto[PATCH_FLAG_KEY] = true;

  const originalText = jsPDFProto.text as (
    text: unknown,
    x: number,
    y: number,
    options?: unknown,
    transform?: unknown,
  ) => jsPDF;

  jsPDFProto.text = function patchedText(
    this: jsPDF,
    text: unknown,
    x: number,
    y: number,
    options?: unknown,
    transform?: unknown,
  ): jsPDF {
    let safe: string | string[];
    if (Array.isArray(text)) {
      safe = text.map((line) => safeText(line, fallback));
    } else {
      safe = safeText(text, fallback);
    }
    return originalText.call(this, safe, x, y, options, transform);
  } as typeof jsPDFProto.text;

  // Also expose on globalThis for cross-bundle observability (e.g. tests).
  globalThis.__nivra_jspdf_text_hardened__ = true;

  return true;
}

// AUTO-INSTALL on module import. Any code path that touches the PDF library
// (via `@/lib/pdf/index.ts` or directly) will trigger this and get protection
// for free. There's no reason to opt out — sanitization is always safer than
// raw `doc.text(null)`.
installPdfTextHardener();
