/**
 * Base helpers V3 — shared header/footer/utility for all secondary documents.
 * Matches creditNoteTemplate / refundNoticeTemplate visual standard.
 */
import { jsPDF } from "jspdf";
import { NIVRA } from "./companyInfo";
import {
  safeText,
  safeMoney,
  safeDate as sanitizeSafeDate,
} from "./_pdfSanitize";

export const NAVY: [number, number, number] = [30, 64, 120];
export const TEAL: [number, number, number] = [20, 184, 166];
export const RED: [number, number, number] = [180, 50, 50];
export const ORANGE: [number, number, number] = [217, 119, 6];
export const GREEN: [number, number, number] = [22, 163, 74];
export const GREY_BG: [number, number, number] = [248, 250, 252];
export const GREY_BORDER: [number, number, number] = [226, 232, 240];

/**
 * Formats numbers as Canadian currency. Accepts null/undefined/NaN safely.
 *   fmtCAD(123.4)  → "123,40 $"
 *   fmtCAD(0)      → "0,00 $"
 *   fmtCAD(null)   → "—"
 *
 * Previously the old `amount || 0` collapsed null → 0,00 $ which hid bugs;
 * we now use the central safeMoney() so the placeholder appears when data
 * is genuinely missing.
 */
export const fmtCAD = (amount: number | null | undefined): string => safeMoney(amount);

/**
 * Formats a date string (YYYY-MM-DD or ISO) as "23 mai 2026".
 * Returns "—" when the input is missing/invalid — never crashes on bad data.
 */
export const fmtDate = (dateStr: string | undefined | null): string =>
  sanitizeSafeDate(dateStr, "long", "fr-CA");

export function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  // Coerce nullish to empty so splitTextToSize doesn't choke; downstream
  // callers should still prefer safeText() for explicit placeholders.
  return doc.splitTextToSize(safeText(text, ""), maxWidth) as string[];
}

/**
 * Drop-in wrapper for `doc.text(value, x, y, opts)` that NEVER writes
 * "null" / "undefined" / "NaN" / garbage. Always coerces to safeText first.
 *
 *   safeDrawText(doc, profile?.full_name, 15, 50)
 *   // renders "—" if full_name is null instead of literal "null"
 */
export function safeDrawText(
  doc: jsPDF,
  value: unknown,
  x: number,
  y: number,
  opts?: { align?: "left" | "right" | "center"; maxWidth?: number; fallback?: string },
): void {
  const out = safeText(value, opts?.fallback ?? "—");
  // jsPDF's TextOptionsLight matches the shape we pass.
  doc.text(out, x, y, opts as any);
}

/** Standard 40mm navy header. */
export function drawHeader(doc: jsPDF, docTitle: string, docNumber: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, pw, 40, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("NIVRA TELECOM", 15, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(docTitle.toUpperCase(), 15, 28);

  if (docNumber) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`No ${docNumber}`, pw - 15, 18, { align: "right" });
  }
}

/** Canonical legal footer. */
export function drawFooter(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `${NIVRA.tradeName} Inc. | ${NIVRA.email} | ${NIVRA.website}`,
    pw / 2, ph - 18, { align: "center" }
  );
  doc.text(
    `${NIVRA.tpsLabel} | ${NIVRA.tvqLabel}`,
    pw / 2, ph - 13, { align: "center" }
  );
  doc.text(
    `${NIVRA.address}`,
    pw / 2, ph - 8, { align: "center" }
  );
}

/** Client info block (returns new Y position). */
export function drawClientBlock(
  doc: jsPDF,
  startY: number,
  client: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    province?: string;
    postal?: string;
    account_number?: string;
  }
): number {
  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Client", 15, y);
  if (client.address) doc.text("Adresse de service", 110, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(client.name, 15, y);
  if (client.address) doc.text(client.address, 110, y);
  y += 5;

  if (client.email) { doc.text(client.email, 15, y); }
  if (client.city) {
    doc.text(`${client.city}, ${client.province || "QC"} ${client.postal || ""}`, 110, y);
  }
  y += 5;

  if (client.phone) { doc.text(client.phone, 15, y); y += 5; }

  if (client.account_number) {
    doc.setFontSize(8);
    doc.text(`Compte: ${client.account_number}`, 15, y);
    y += 6;
  }
  return y + 4;
}

/** Section title (small bold heading). */
export function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(title, 15, y);
  doc.setTextColor(0, 0, 0);
  return y + 6;
}

/** Boxed paragraph. */
export function drawBoxedText(
  doc: jsPDF,
  text: string,
  y: number,
  options: { fillColor?: [number, number, number]; borderColor?: [number, number, number]; textColor?: [number, number, number] } = {}
): number {
  const lines = wrapText(doc, text, 165);
  const h = Math.max(8, lines.length * 4.5 + 4);
  const fill = options.fillColor || GREY_BG;
  const border = options.borderColor || GREY_BORDER;
  doc.setFillColor(fill[0], fill[1], fill[2]);
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.roundedRect(15, y, 170, h, 1, 1, "FD");
  const tc = options.textColor || [40, 40, 40];
  doc.setTextColor(tc[0], tc[1], tc[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let ly = y + 5;
  for (const line of lines) {
    doc.text(line, 17, ly);
    ly += 4.5;
  }
  doc.setTextColor(0, 0, 0);
  return y + h + 6;
}

/** Key-value row (two columns). */
export function drawKeyValue(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(label, 15, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(value || "—", 80, y);
  return y + 6;
}
