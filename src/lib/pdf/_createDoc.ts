/**
 * createDoc() — factory for jsPDF documents that are automatically hardened
 * against null/undefined/garbage values in `doc.text()`.
 *
 * Use this EVERYWHERE we'd otherwise do `new jsPDF(...)`. Functionally
 * identical to the jsPDF constructor — just adds the sanitizer wrapper
 * before returning.
 *
 *   import { createDoc } from "@/lib/pdf/_createDoc";
 *
 *   const doc = createDoc();                           // A4 portrait default
 *   const doc = createDoc({ format: "letter" });       // 8.5×11 US letter
 *   const doc = createDoc({ orientation: "landscape" });
 *
 * Without this wrapper a template that does `doc.text(profile.full_name)`
 * with a null full_name would write the literal string "null" into the
 * PDF. With it, the safeText fallback (default "—") is written instead,
 * AND a billing_system_alerts row may be raised by the dispatcher's
 * validator for incomplete payloads.
 */
import { jsPDF, type jsPDFOptions } from "jspdf";
import { hardenDoc } from "./_pdfHarden";

/**
 * Create a new jsPDF document with the same constructor options, then
 * harden it so all `doc.text()` calls are sanitized.
 *
 * Defaults:
 *   - orientation: "portrait"
 *   - unit:        "mm"
 *   - format:      "a4"
 *   - putOnlyUsedFonts: true (smaller files)
 */
export function createDoc(options: jsPDFOptions = {}): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    putOnlyUsedFonts: true,
    ...options,
  });
  return hardenDoc(doc);
}
