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

/**
 * Premium Telus-style header — 42mm navy band with logo mark, brand wordmark,
 * document title, document number, and the date on the right.
 *
 *   ┌────────────────────────────────────────────────────────────────────┐
 *   │  ▌ NIVRA TELECOM                              FACTURE  No 12345    │
 *   │    Service à la clientèle                              23 mai 2026 │
 *   └────────────────────────────────────────────────────────────────────┘
 */
export function drawHeader(
  doc: jsPDF,
  docTitle: string,
  docNumber: string,
  options: { docDate?: string | Date | null; subtitle?: string } = {},
) {
  const pw = doc.internal.pageSize.getWidth();

  // Navy band (slightly taller for premium feel)
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, pw, 42, "F");

  // Accent vertical bar — Telus uses a coloured stripe on the left of the wordmark
  doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.rect(0, 0, 3, 42, "F");

  // Wordmark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("NIVRA TELECOM", 12, 17);

  // Subtitle (division / tagline)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(180, 200, 220);
  doc.text(safeText(options.subtitle, NIVRA.division), 12, 23);

  // Document title (right side, prominent)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(safeText(docTitle, "DOCUMENT").toUpperCase(), pw - 12, 17, { align: "right" });

  // Document number + date (right side, under title)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 215, 230);
  if (docNumber) {
    doc.text(`No ${safeText(docNumber, "—")}`, pw - 12, 23, { align: "right" });
  }
  if (options.docDate) {
    const dateStr = fmtDate(
      options.docDate instanceof Date ? options.docDate.toISOString().split("T")[0] : String(options.docDate),
    );
    doc.text(dateStr, pw - 12, 29, { align: "right" });
  }

  // Reset for body content
  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(0.2);
}

/**
 * Canonical legal footer — appears on every page.
 *
 * Line 1: Company legal name + NEQ + email
 * Line 2: GST (TPS) + QST (TVQ) registrations
 * Line 3: Postal address
 * Line 4: Page x of y (if pageInfo provided)
 *
 * Call once per page (drawFooter is automatically idempotent — wraps in
 * setPage). For multi-page documents, prefer drawFooterOnAllPages() below.
 */
export function drawFooter(
  doc: jsPDF,
  pageInfo?: { current: number; total: number },
) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Top thin separator line
  doc.setDrawColor(GREY_BORDER[0], GREY_BORDER[1], GREY_BORDER[2]);
  doc.setLineWidth(0.3);
  doc.line(15, ph - 26, pw - 15, ph - 26);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);

  // Line 1 — legal identity
  doc.text(
    `${NIVRA.legalName} | NEQ ${NIVRA.neq} | ${NIVRA.email} | ${NIVRA.website}`,
    pw / 2, ph - 20, { align: "center" },
  );

  // Line 2 — tax registrations
  doc.setTextColor(110, 110, 110);
  doc.text(
    `${NIVRA.tpsLabel} | ${NIVRA.tvqLabel}`,
    pw / 2, ph - 15, { align: "center" },
  );

  // Line 3 — postal address
  doc.text(safeText(NIVRA.address, ""), pw / 2, ph - 10, { align: "center" });

  // Line 4 — page x of y (if multi-page)
  if (pageInfo && pageInfo.total > 1) {
    doc.setFontSize(7);
    doc.text(
      `Page ${pageInfo.current} sur ${pageInfo.total}`,
      pw - 15, ph - 5, { align: "right" },
    );
  }

  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(0.2);
}

/**
 * Convenience: draw the footer on every page of a multi-page document.
 * Call this AFTER all body content is rendered.
 */
export function drawFooterOnAllPages(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, { current: i, total });
  }
}

/**
 * Client info block (returns new Y position).
 *
 * Telus-style two-column layout:
 *   ┌─ Client ────────────────────┐ ┌─ Adresse de service ────────────────┐
 *   │ Jean Tremblay               │ │ 123 rue Example                    │
 *   │ jean@example.com            │ │ Laval, QC H7T 2Y5                  │
 *   │ (514) 555-1234              │ │                                    │
 *   │ Compte: NIV-ACCT-000123     │ │                                    │
 *   └─────────────────────────────┘ └────────────────────────────────────┘
 *
 * Every field is run through safeText() so missing data never renders as
 * "null" or empty space.
 */
export function drawClientBlock(
  doc: jsPDF,
  startY: number,
  client: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    postal?: string | null;
    account_number?: string | null;
  }
): number {
  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text("Client", 15, y);
  if (client.address) doc.text("Adresse de service", 110, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  // Names + address — safeText handles null gracefully
  doc.text(safeText(client.name, "Non fourni"), 15, y);
  if (client.address) doc.text(safeText(client.address, "—"), 110, y);
  y += 5;

  if (client.email) { doc.text(safeText(client.email, "—").toLowerCase(), 15, y); }
  if (client.city || client.province || client.postal) {
    const cityLine = [
      safeText(client.city, ""),
      safeText(client.province, "QC"),
      safeText(client.postal, ""),
    ].filter(Boolean).join(", ");
    doc.text(cityLine || "—", 110, y);
  }
  y += 5;

  if (client.phone) {
    // Format E.164 / 10-digit into "(514) 555-1234"
    const phoneRaw = String(client.phone).replace(/\D/g, "");
    const phoneFmt =
      phoneRaw.length === 10
        ? `(${phoneRaw.slice(0, 3)}) ${phoneRaw.slice(3, 6)}-${phoneRaw.slice(6)}`
        : safeText(client.phone, "—");
    doc.text(phoneFmt, 15, y);
    y += 5;
  }

  if (client.account_number) {
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Compte: ${safeText(client.account_number, "—")}`, 15, y);
    y += 6;
  }
  doc.setTextColor(0, 0, 0);
  return y + 4;
}

/**
 * Totals block (Telus-style) — subtotal, discounts, taxes, total.
 * Right-aligned column, takes a row list. Pass nulls safely.
 *
 *   drawTotalsBlock(doc, y, [
 *     { label: "Sous-total",      amount: 100 },
 *     { label: "Rabais bienvenue", amount: -100, muted: true },
 *     { label: "TPS (5%)",         amount: 0 },
 *     { label: "TVQ (9,975%)",     amount: 0 },
 *     { label: "Total",            amount: 0, bold: true, separator: true },
 *   ])
 */
export function drawTotalsBlock(
  doc: jsPDF,
  startY: number,
  rows: Array<{
    label: string;
    amount: number | null | undefined;
    bold?: boolean;
    muted?: boolean;
    separator?: boolean; // draw line above this row
  }>,
  options: { rightAlign?: number; leftAlign?: number } = {},
): number {
  const rightX = options.rightAlign ?? 195;
  const leftX = options.leftAlign ?? 115;
  let y = startY;

  for (const row of rows) {
    if (row.separator) {
      doc.setDrawColor(GREY_BORDER[0], GREY_BORDER[1], GREY_BORDER[2]);
      doc.line(leftX, y - 1, rightX, y - 1);
      y += 2;
    }
    if (row.bold) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(row.muted ? 110 : 40, row.muted ? 110 : 40, row.muted ? 110 : 40);
    }
    doc.text(row.label, leftX, y);
    doc.text(fmtCAD(row.amount ?? 0), rightX, y, { align: "right" });
    y += row.bold ? 7 : 5;
  }
  doc.setTextColor(0, 0, 0);
  return y + 3;
}

/**
 * Premium amount-due box — used on invoices, suspension notices, refund
 * receipts. Big rounded card with the amount in large type.
 */
export function drawAmountDueBox(
  doc: jsPDF,
  y: number,
  amount: number | null | undefined,
  label: string,
  options: { tone?: "primary" | "warning" | "success" | "error" } = {},
): number {
  const pw = doc.internal.pageSize.getWidth();
  const tone = options.tone ?? "primary";
  const fillMap: Record<string, [number, number, number]> = {
    primary: [240, 248, 255],
    warning: [255, 247, 230],
    success: [232, 246, 235],
    error:   [253, 233, 233],
  };
  const borderMap: Record<string, [number, number, number]> = {
    primary: NAVY,
    warning: ORANGE,
    success: GREEN,
    error:   RED,
  };
  const fill = fillMap[tone];
  const border = borderMap[tone];

  doc.setFillColor(fill[0], fill[1], fill[2]);
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(15, y, pw - 30, 24, 3, 3, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(label, 22, y + 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(border[0], border[1], border[2]);
  doc.text(fmtCAD(amount ?? 0), pw - 22, y + 16, { align: "right" });

  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(0.2);
  return y + 30;
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
