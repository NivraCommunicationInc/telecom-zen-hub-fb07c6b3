/**
 * Base helpers V3 -- shared header/footer/utility for all secondary documents.
 * Design: navy header (#1E4078), teal accent, no violet.
 * Restored from original design (before Phase 2 visual redesign).
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import { NIVRA } from "./companyInfo.ts";

// ---------------------------------------------------------------------------
// COLOR PALETTE
// ---------------------------------------------------------------------------

export const NAVY:        [number, number, number] = [30, 64, 120];   // #1E4078
export const TEAL:        [number, number, number] = [20, 184, 166];  // #14B8A6
export const GREEN:       [number, number, number] = [22, 163, 74];   // #16A34A
export const RED:         [number, number, number] = [180, 50, 50];
export const ORANGE:      [number, number, number] = [217, 119, 6];
export const GREY_BG:     [number, number, number] = [248, 250, 252];
export const GREY_BORDER: [number, number, number] = [226, 232, 240];

/** Kept for any template that imported these from the V4 palette */
export const BLUE         = NAVY;
export const BLUE_DARK    = NAVY;
export const BLUE_LIGHT:  [number, number, number] = [230, 240, 250];
export const VIOLET       = NAVY;
export const VIOLET_LIGHT = GREY_BG;
export const GREEN_LIGHT: [number, number, number] = [240, 253, 244];
export const RED_LIGHT:   [number, number, number] = [254, 242, 242];
export const ORANGE_LIGHT:[number, number, number] = [255, 251, 235];
export const TEXT_DARK:   [number, number, number] = [26, 26, 26];
export const TEXT_MUTED:  [number, number, number] = [100, 116, 139];

// ---------------------------------------------------------------------------
// FORMATTERS
// ---------------------------------------------------------------------------

export const fmtCAD = (amount: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(amount || 0);

export const fmtDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "--";
  const ymd = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return `${d.getDate()} ${d.toLocaleString("fr-CA", { month: "long" })} ${d.getFullYear()}`;
  }
  return "--";
};

export function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text || "", maxWidth) as string[];
}

// ---------------------------------------------------------------------------
// HEADER -- 40 mm navy band
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// FOOTER -- canonical legal footer. Pass hash to display SHA-256 integrity.
// ---------------------------------------------------------------------------

export function drawFooter(doc: jsPDF, hash?: string) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `${NIVRA.tradeName} Inc. | ${NIVRA.email} | ${NIVRA.website}`,
    pw / 2, ph - 18, { align: "center" },
  );
  doc.text(
    `${NIVRA.tpsLabel} | ${NIVRA.tvqLabel}`,
    pw / 2, ph - 13, { align: "center" },
  );
  doc.text(
    `${NIVRA.address}`,
    pw / 2, ph - 8, { align: "center" },
  );

  if (hash) {
    doc.setFontSize(6);
    doc.setTextColor(170, 180, 195);
    doc.text(`SHA-256: ${hash.slice(0, 48)}`, pw / 2, ph - 2.5, { align: "center" });
  }
}

// ---------------------------------------------------------------------------
// CLIENT INFO BLOCK
// Always shows: name, email, phone, full address, account number.
// Returns new Y position.
// ---------------------------------------------------------------------------

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
  },
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
  doc.text(client.name || "--", 15, y);
  if (client.address) doc.text(client.address, 110, y);
  y += 5;

  if (client.email) doc.text(client.email, 15, y);
  if (client.city) {
    doc.text(`${client.city} ${client.province || "QC"} ${client.postal || ""}, Canada`, 110, y);
  }
  y += 5;

  if (client.phone) { doc.text(client.phone, 15, y); y += 5; }

  if (client.account_number) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`Compte: ${client.account_number}`, 15, y);
    y += 6;
  }

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  return y + 4;
}

// ---------------------------------------------------------------------------
// SECTION TITLE
// ---------------------------------------------------------------------------

export function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(title, 15, y);
  doc.setTextColor(0, 0, 0);
  return y + 6;
}

// ---------------------------------------------------------------------------
// BOXED TEXT
// ---------------------------------------------------------------------------

export function drawBoxedText(
  doc: jsPDF,
  text: string,
  y: number,
  options: {
    fillColor?: [number, number, number];
    borderColor?: [number, number, number];
    textColor?: [number, number, number];
  } = {},
): number {
  const lines = wrapText(doc, text, 165);
  const h = Math.max(8, lines.length * 4.5 + 4);
  const fill   = options.fillColor   || GREY_BG;
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

// ---------------------------------------------------------------------------
// KEY-VALUE ROW
// ---------------------------------------------------------------------------

export function drawKeyValue(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(label, 15, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(value || "--", 80, y);
  return y + 6;
}

// ---------------------------------------------------------------------------
// DIVIDER LINE
// ---------------------------------------------------------------------------

export function drawDivider(doc: jsPDF, y: number): number {
  doc.setDrawColor(GREY_BORDER[0], GREY_BORDER[1], GREY_BORDER[2]);
  doc.setLineWidth(0.3);
  doc.line(15, y, doc.internal.pageSize.getWidth() - 15, y);
  return y + 5;
}
