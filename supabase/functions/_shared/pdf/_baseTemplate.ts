/**
 * Base helpers V4 — Nivra corporate design for all secondary documents.
 * Palette: #0066CC blue + #7C3AED violet accents.
 * All 20 auto-doc templates import from here — change here, changes everywhere.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import { NIVRA } from "./companyInfo.ts";

// ─────────────────────────────────────────────────────────────────────────────
// COLOR PALETTE
// ─────────────────────────────────────────────────────────────────────────────

export const BLUE:         [number, number, number] = [0, 102, 204];   // #0066CC
export const BLUE_DARK:    [number, number, number] = [0, 76, 153];    // #004C99
export const BLUE_LIGHT:   [number, number, number] = [230, 240, 250]; // #E6F0FA
export const VIOLET:       [number, number, number] = [124, 58, 237];  // #7C3AED
export const VIOLET_LIGHT: [number, number, number] = [245, 243, 255]; // #F5F3FF
export const GREEN:        [number, number, number] = [22, 163, 74];   // #16A34A
export const GREEN_LIGHT:  [number, number, number] = [240, 253, 244]; // #F0FDF4
export const RED:          [number, number, number] = [180, 50, 50];
export const RED_LIGHT:    [number, number, number] = [254, 242, 242];
export const ORANGE:       [number, number, number] = [217, 119, 6];
export const ORANGE_LIGHT: [number, number, number] = [255, 251, 235];
export const GREY_BG:      [number, number, number] = [248, 250, 252];
export const GREY_BORDER:  [number, number, number] = [226, 232, 240];
export const TEXT_DARK:    [number, number, number] = [26, 26, 26];
export const TEXT_MUTED:   [number, number, number] = [100, 116, 139];

/** Legacy aliases — older callers that import NAVY/TEAL continue to compile. */
export const NAVY = BLUE;
export const TEAL = GREEN;

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────────────────────────

export const fmtCAD = (amount: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(amount || 0);

export const fmtDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "—";
  const ymd = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return `${d.getDate()} ${d.toLocaleString("fr-CA", { month: "long" })} ${d.getFullYear()}`;
  }
  return "—";
};

export function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text || "", maxWidth) as string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER — #0066CC blue band (40 mm) with 4 mm violet accent strip at bottom
// Content starts at y = 50 (unchanged from V3 — no template edits needed).
// ─────────────────────────────────────────────────────────────────────────────
export function drawHeader(doc: jsPDF, docTitle: string, docNumber: string) {
  const pw = doc.internal.pageSize.getWidth();

  // Blue main zone (0 – 36 mm)
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.rect(0, 0, pw, 36, "F");

  // Violet accent strip (36 – 40 mm)
  doc.setFillColor(VIOLET[0], VIOLET[1], VIOLET[2]);
  doc.rect(0, 36, pw, 4, "F");

  // "NIVRA TELECOM" — bold white, top-left
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("NIVRA TELECOM", 15, 17);

  // Doc number — top-right, white bold
  if (docNumber) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(`No ${docNumber}`, pw - 15, 17, { align: "right" });
  }

  // Doc title — bottom of blue zone, slightly muted
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(200, 220, 245);
  doc.text(docTitle.toUpperCase(), 15, 29);

  // Website — bottom-right, small
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 220, 245);
  doc.text(NIVRA.website, pw - 15, 29, { align: "right" });

  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER — violet accent line + light-grey band + optional SHA-256 hash
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw the canonical footer. Pass `hash` (first 32 hex chars is enough) to
 * display the SHA-256 integrity hash under the contact block.
 */
export function drawFooter(doc: jsPDF, hash?: string) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Violet accent line
  doc.setFillColor(VIOLET[0], VIOLET[1], VIOLET[2]);
  doc.rect(0, ph - 27, pw, 2, "F");

  // Light-grey background band
  doc.setFillColor(248, 250, 252);
  doc.rect(0, ph - 25, pw, 25, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);

  doc.text(
    `${NIVRA.legalName} | ${NIVRA.email} | ${NIVRA.website}`,
    pw / 2, ph - 18, { align: "center" },
  );
  doc.text(
    `${NIVRA.tpsLabel} | ${NIVRA.tvqLabel}`,
    pw / 2, ph - 12.5, { align: "center" },
  );
  doc.text(
    NIVRA.address,
    pw / 2, ph - 7, { align: "center" },
  );

  if (hash) {
    doc.setFontSize(6);
    doc.setTextColor(170, 180, 195);
    doc.text(`SHA-256: ${hash.slice(0, 48)}`, pw / 2, ph - 1.5, { align: "center" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT INFO BLOCK — blue-light background + violet account label
// ─────────────────────────────────────────────────────────────────────────────

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
  const pw = doc.internal.pageSize.getWidth();

  // Pre-calculate block height for background
  let bh = 14; // header row (6) + name row (5.5) + email row (5) – base
  if (client.phone) bh += 5;
  if (client.account_number) bh += 6;

  // Blue-light background panel
  doc.setFillColor(BLUE_LIGHT[0], BLUE_LIGHT[1], BLUE_LIGHT[2]);
  doc.rect(0, startY - 5, pw, bh + 8, "F");

  // 3 mm violet left-edge bar
  doc.setFillColor(VIOLET[0], VIOLET[1], VIOLET[2]);
  doc.rect(0, startY - 5, 3, bh + 8, "F");

  let y = startY;

  // Column headers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("CLIENT", 17, y);
  if (client.address) doc.text("ADRESSE DE SERVICE", 112, y);
  y += 6;

  // Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text(client.name || "—", 17, y);
  if (client.address) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(client.address, 112, y);
  }
  y += 5.5;

  // Email + city/province/postal
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  if (client.email) doc.text(client.email, 17, y);
  if (client.city) {
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.text(`${client.city}, ${client.province || "QC"} ${client.postal || ""}`, 112, y);
  }
  y += 5;

  // Phone
  if (client.phone) {
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(client.phone, 17, y);
    y += 5;
  }

  // Account number (violet accent)
  if (client.account_number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(VIOLET[0], VIOLET[1], VIOLET[2]);
    doc.text(`Compte: ${client.account_number}`, 17, y);
    y += 6;
  }

  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  return y + 5;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION TITLE — violet left bar + blue text
// ─────────────────────────────────────────────────────────────────────────────

export function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  // Violet 2 mm-wide left accent bar
  doc.setFillColor(VIOLET[0], VIOLET[1], VIOLET[2]);
  doc.rect(15, y - 3.5, 2, 7, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text(title, 21, y);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  return y + 7;
}

// ─────────────────────────────────────────────────────────────────────────────
// BOXED TEXT — rounded rectangle with optional color overrides
// ─────────────────────────────────────────────────────────────────────────────

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
  const lines = wrapText(doc, text, 163);
  const h = Math.max(9, lines.length * 4.5 + 5);
  const fill   = options.fillColor   || GREY_BG;
  const border = options.borderColor || GREY_BORDER;

  doc.setFillColor(fill[0], fill[1], fill[2]);
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, y, 175, h, 2, 2, "FD");

  const tc = options.textColor || TEXT_DARK;
  doc.setTextColor(tc[0], tc[1], tc[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let ly = y + 5.5;
  for (const line of lines) {
    doc.text(line, 19, ly);
    ly += 4.5;
  }

  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.setLineWidth(0.2);
  return y + h + 6;
}

// ─────────────────────────────────────────────────────────────────────────────
// KEY-VALUE ROW — muted label + subtle alternating background
// ─────────────────────────────────────────────────────────────────────────────

export function drawKeyValue(doc: jsPDF, label: string, value: string, y: number): number {
  // Subtle row background
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(GREY_BORDER[0], GREY_BORDER[1], GREY_BORDER[2]);
  doc.rect(15, y - 4, 175, 7, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text(label, 17, y);

  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text(value || "—", 80, y);

  return y + 6;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIVIDER LINE
// ─────────────────────────────────────────────────────────────────────────────

export function drawDivider(doc: jsPDF, y: number): number {
  doc.setDrawColor(GREY_BORDER[0], GREY_BORDER[1], GREY_BORDER[2]);
  doc.setLineWidth(0.3);
  doc.line(15, y, doc.internal.pageSize.getWidth() - 15, y);
  return y + 5;
}
