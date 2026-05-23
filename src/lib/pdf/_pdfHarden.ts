/**
 * PDF document hardener — single-line protection for every jsPDF document.
 *
 *   const doc = new jsPDF();
 *   hardenDoc(doc);                           // ← add this ONE line
 *   doc.text(profile?.full_name, 15, 50);     // never renders "null" again
 *
 * What it does:
 *   - Wraps `doc.text()` so it sanitizes every value through `safeText()`
 *     before passing to the original implementation. null / undefined / NaN
 *     / "null" / "undefined" / "[object Object]" / control chars all become
 *     a safe placeholder ("—" by default).
 *   - Idempotent: calling hardenDoc() twice on the same instance is a no-op.
 *   - Zero impact on rendering performance — String coercion is fast.
 *
 * Why a global wrapper instead of refactoring 45 templates:
 *   Each template has dozens of `doc.text(value)` calls. Refactoring all of
 *   them manually is 3+ hours of mechanical work and one missed line silently
 *   regresses. Hardening at the document level is one line per template and
 *   protects 100% of text calls forever.
 *
 * Templates that already use safeText() explicitly are unaffected — the
 * sanitizer is idempotent (safeText on an already-safe string returns it
 * unchanged).
 */
import type { jsPDF } from "jspdf";
import { safeText } from "./_pdfSanitize";

const HARDENED_FLAG = "__nivra_hardened__";

/**
 * Wrap `doc.text` so any value is sanitized before rendering.
 *
 * @param doc      jsPDF instance returned from `new jsPDF()`.
 * @param options  Per-document options.
 *   - fallback: string shown when a value is missing (default "—").
 *
 * Returns the same `doc` for chaining: `const doc = hardenDoc(new jsPDF())`.
 */
export function hardenDoc(
  doc: jsPDF,
  options: { fallback?: string } = {},
): jsPDF {
  // Idempotency — never wrap twice (would cause double-sanitization which is
  // a no-op but wastes work and pollutes the prototype chain mental model).
  const flagged = doc as unknown as Record<string, unknown>;
  if (flagged[HARDENED_FLAG]) return doc;
  flagged[HARDENED_FLAG] = true;

  const fallback = options.fallback ?? "—";
  const originalText = doc.text.bind(doc);

  // jsPDF.text accepts (string | string[], x, y, options?) plus a few legacy
  // overloads. We sanitize the first argument and forward everything else
  // unchanged.
  (doc as unknown as { text: unknown }).text = function patchedText(
    this: jsPDF,
    text: unknown,
    x: number,
    y: number,
    optionsArg?: unknown,
    transform?: unknown,
  ) {
    let safe: string | string[];
    if (Array.isArray(text)) {
      safe = text.map((line) => safeText(line, fallback));
    } else {
      safe = safeText(text, fallback);
    }
    return originalText(safe as never, x, y, optionsArg as never, transform as never);
  };

  return doc;
}

/**
 * Check whether a document was already hardened. Useful for tests / debug
 * panels ("did we forget to harden this template?").
 */
export function isDocHardened(doc: jsPDF): boolean {
  return Boolean((doc as unknown as Record<string, unknown>)[HARDENED_FLAG]);
}
