/**
 * Base helpers - Corporate Blue standard (#0066CC).
 * Reskinned to match approved v6/Lot1 corporate mockups.
 * All shared helpers keep their original signatures for backward compat;
 * new helpers (drawHeaderV2, drawMetaGrid, drawHeroBox, drawZebraTable,
 * drawInfoBox, drawSignatureBlock, drawFooterV2) power the new layouts.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import { NIVRA } from "./companyInfo.ts";

// ---------------------------------------------------------------------------
// COLOR PALETTE - Corporate Blue standard
// ---------------------------------------------------------------------------

export const BLUE:        [number, number, number] = [0, 102, 204];    // #0066CC - primary
export const NAVY:        [number, number, number] = [10, 37, 64];     // #0A2540 - dark
export const BLUE_LIGHT:  [number, number, number] = [232, 241, 250];  // #E8F1FA
export const BLUE_TINT:   [number, number, number] = [207, 225, 245];  // #CFE1F5 - header sub
export const LIGHT_BG:    [number, number, number] = [245, 248, 252];  // #F5F8FC
export const BORDER:      [number, number, number] = [216, 225, 236];  // #D8E1EC
export const MUTED:       [number, number, number] = [91, 107, 128];   // #5B6B80
export const TEAL:        [number, number, number] = [0, 102, 204];    // alias -> BLUE
export const GREEN:       [number, number, number] = [34, 120, 60];    // #22783C
export const GREEN_LIGHT: [number, number, number] = [220, 240, 226];
export const RED:         [number, number, number] = [180, 45, 45];
export const RED_LIGHT:   [number, number, number] = [253, 232, 232];
export const AMBER:       [number, number, number] = [180, 83, 9];     // #B45309
export const AMBER_BG:    [number, number, number] = [254, 243, 199];  // #FEF3C7
export const ORANGE:      AMBER;
export const ORANGE_LIGHT:AMBER_BG;
export const GREY_BG      = LIGHT_BG;
export const GREY_BORDER  = BORDER;
export const BLUE_DARK    = NAVY;
export const VIOLET       = BLUE;
export const VIOLET_LIGHT = BLUE_LIGHT;
export const TEXT_DARK:   [number, number, number] = [26, 26, 26];
export const TEXT_MUTED   = MUTED;

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
  return String(dateStr);
};

export function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text || "", maxWidth) as string[];
}

// ---------------------------------------------------------------------------
// HEADER V2 - Corporate blue band + navy subtitle strip
// ---------------------------------------------------------------------------

export interface HeaderOptions {
  title: string;         // upper-right big word ex: "FACTURE"
  subtitle?: string;     // grey navy strip below ex: "Confirmation d'activation"
  docNumber?: string;    // ex: "ACT-100234"
  docDate?: string;      // ex: "1 juillet 2026"
  accent?: [number, number, number]; // default BLUE
}

export function drawHeaderV2(doc: jsPDF, opts: HeaderOptions): number {
  const pw = doc.internal.pageSize.getWidth();
  const accent = opts.accent || BLUE;

  // Blue band 30mm
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, pw, 30, "F");

  // Logo left
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text("NIVRA", 15, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("TELECOM", 15, 19);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(BLUE_TINT[0], BLUE_TINT[1], BLUE_TINT[2]);
  doc.text("Prépayé - Sans engagement - Québec", 15, 25);

  // Right big title
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text((opts.title || "").toUpperCase(), pw - 15, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (opts.docNumber) doc.text(`No ${opts.docNumber}`, pw - 15, 19, { align: "right" });
  if (opts.docDate)   doc.text(`Émis le ${opts.docDate}`, pw - 15, 24, { align: "right" });

  // Navy subtitle strip 8mm
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 30, pw, 8, "F");
  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(opts.subtitle, 15, 35.5);
  }

  doc.setTextColor(0, 0, 0);
  return 46; // starting y for content
}

/** Backward-compat drawHeader - keeps signature for older callers */
export function drawHeader(doc: jsPDF, docTitle: string, docNumber: string) {
  drawHeaderV2(doc, {
    title: docTitle,
    subtitle: docTitle.charAt(0).toUpperCase() + docTitle.slice(1).toLowerCase(),
    docNumber,
  });
}

// ---------------------------------------------------------------------------
// FOOTER V2 - fine border, tax IDs, page number
// ---------------------------------------------------------------------------

export function drawFooterV2(doc: jsPDF, pageNo = 1, totalPages = 1, hash?: string) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.2);
  doc.line(15, ph - 18, pw - 15, ph - 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);

  doc.text(
    `${NIVRA.legalName} - ${NIVRA.email} - ${NIVRA.website}`,
    15, ph - 13,
  );
  doc.text(
    `NEQ ${NIVRA.neq} - ${NIVRA.tpsLabel} - ${NIVRA.tvqLabel}`,
    15, ph - 9,
  );
  doc.text(`Page ${pageNo} sur ${totalPages}`, pw - 15, ph - 13, { align: "right" });
  doc.text("Document généré automatiquement", pw - 15, ph - 9, { align: "right" });

  if (hash) {
    doc.setFontSize(6);
    doc.setTextColor(170, 180, 195);
    doc.text(`SHA-256: ${hash.slice(0, 48)}`, pw / 2, ph - 4, { align: "center" });
  }
  doc.setTextColor(0, 0, 0);
}

/** Backward-compat wrapper */
export function drawFooter(doc: jsPDF, hash?: string) {
  drawFooterV2(doc, 1, 1, hash);
}

// ---------------------------------------------------------------------------
// META GRID - 2-column boxed key/value grid
// ---------------------------------------------------------------------------

export function drawMetaGrid(
  doc: jsPDF,
  y: number,
  rows: Array<[string, string]>,
): number {
  const pw = doc.internal.pageSize.getWidth();
  const marginX = 15;
  const colW = (pw - 2 * marginX) / 2;
  const rowH = 15;                  // taller cells so labels + values never touch
  const innerW = colW - 6;          // usable text width inside the cell

  for (let i = 0; i < rows.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = marginX + col * colW;
    const yy = y + row * rowH;

    doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]);
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.2);
    doc.rect(x, yy, colW - 2, rowH - 2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(rows[i][0].toUpperCase(), x + 3, yy + 5);

    // Auto-fit value: shrink from 9pt down to 7pt to keep it inside the cell
    doc.setFont("helvetica", "bold");
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    const value = rows[i][1] || "--";
    let fs = 9;
    doc.setFontSize(fs);
    while (doc.getTextWidth(value) > innerW && fs > 7) {
      fs -= 0.5;
      doc.setFontSize(fs);
    }
    let printed = value;
    if (doc.getTextWidth(printed) > innerW) {
      while (printed.length > 4 && doc.getTextWidth(printed + "…") > innerW) {
        printed = printed.slice(0, -1);
      }
      printed = printed + "…";
    }
    doc.text(printed, x + 3, yy + 11);
  }
  doc.setTextColor(0, 0, 0);
  const totalRows = Math.ceil(rows.length / 2);
  return y + totalRows * rowH + 4;
}

// ---------------------------------------------------------------------------
// SECTION TITLE - blue marker + navy uppercase + underline
// ---------------------------------------------------------------------------

export function drawSectionTitle(doc: jsPDF, title: string, y: number, accent = BLUE): number {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(15, y, 3, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(title.toUpperCase(), 20, y + 4.5);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.2);
  doc.line(15, y + 8, pw - 15, y + 8);
  doc.setTextColor(0, 0, 0);
  return y + 12;
}

// ---------------------------------------------------------------------------
// HERO BOX - big colored callout (green/blue) with big value + labels
// ---------------------------------------------------------------------------

export interface HeroBoxOpts {
  label: string;         // top small label
  value: string;         // big center value
  sublabel?: string;     // bottom small text
  bg?: [number, number, number];
  height?: number;       // mm
}

export function drawHeroBox(doc: jsPDF, y: number, opts: HeroBoxOpts): number {
  const pw = doc.internal.pageSize.getWidth();
  const h = opts.height ?? 26;
  const bg = opts.bg || BLUE;
  const marginX = 15;

  doc.setFillColor(bg[0], bg[1], bg[2]);
  doc.rect(marginX, y, pw - 2 * marginX, h, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(BLUE_TINT[0], BLUE_TINT[1], BLUE_TINT[2]);
  doc.text(opts.label.toUpperCase(), marginX + 6, y + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(opts.value, marginX + 6, y + h / 2 + 6);

  if (opts.sublabel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(BLUE_TINT[0], BLUE_TINT[1], BLUE_TINT[2]);
    doc.text(opts.sublabel, marginX + 6, y + h - 4);
  }
  doc.setTextColor(0, 0, 0);
  return y + h + 6;
}

// ---------------------------------------------------------------------------
// ZEBRA TABLE - header band + alternating rows + border
// ---------------------------------------------------------------------------

export function drawZebraTable(
  doc: jsPDF,
  y: number,
  headers: string[],
  rows: Array<Array<string | number>>,
  colWidths: number[],           // in mm, must sum to pageWidth - 30
  accent = BLUE,
): number {
  const marginX = 15;
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const headerH = 7;
  const rowH = 6.5;

  // Header
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(marginX, y, totalW, headerH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  let x = marginX;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i].toUpperCase(), x + 2, y + 4.8);
    x += colWidths[i];
  }
  y += headerH;

  // Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  for (let r = 0; r < rows.length; r++) {
    if (r % 2 === 0) {
      doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]);
      doc.rect(marginX, y, totalW, rowH, "F");
    }
    x = marginX;
    for (let i = 0; i < rows[r].length; i++) {
      const cell = String(rows[r][i] ?? "");
      doc.text(cell, x + 2, y + 4.4);
      x += colWidths[i];
    }
    y += rowH;
  }

  // Border
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.2);
  doc.rect(marginX, y - headerH - rows.length * rowH, totalW, headerH + rows.length * rowH, "S");

  doc.setTextColor(0, 0, 0);
  return y + 4;
}

// ---------------------------------------------------------------------------
// INFO BOX - colored border + tinted bg + title + body text
// ---------------------------------------------------------------------------

export interface InfoBoxOpts {
  title: string;
  body: string;
  bg?: [number, number, number];
  border?: [number, number, number];
  accent?: [number, number, number];
  textColor?: [number, number, number];
}

export function drawInfoBox(doc: jsPDF, y: number, opts: InfoBoxOpts): number {
  const pw = doc.internal.pageSize.getWidth();
  const marginX = 15;
  const w = pw - 2 * marginX;
  const bg = opts.bg || BLUE_LIGHT;
  const border = opts.border || BLUE;
  const accent = opts.accent || border;
  const textColor = opts.textColor || [40, 40, 40];

  const lines = wrapText(doc, opts.body, w - 8);
  const h = 10 + lines.length * 4.2;

  doc.setFillColor(bg[0], bg[1], bg[2]);
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.setLineWidth(0.4);
  doc.rect(marginX, y, w, h, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text(opts.title, marginX + 4, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  let ly = y + 10.5;
  for (const line of lines) {
    doc.text(line, marginX + 4, ly);
    ly += 4.2;
  }

  doc.setTextColor(0, 0, 0);
  return y + h + 5;
}

// ---------------------------------------------------------------------------
// SIGNATURE BLOCK - two signature lines (or one) with labels
// ---------------------------------------------------------------------------

export function drawSignatureBlock(
  doc: jsPDF,
  y: number,
  opts: {
    leftLabel?: string;
    rightLabel?: string;
    autoSignName?: string;       // if set, render italic scripted signature above left line
    autoSignDate?: string;       // subtitle below left line
  } = {},
): number {
  const pw = doc.internal.pageSize.getWidth();
  const marginX = 15;
  const lineW = 70;

  if (opts.autoSignName) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(14);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(opts.autoSignName, marginX, y);
    y += 2;
  } else {
    y += 4;
  }

  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setLineWidth(0.3);
  doc.line(marginX, y + 6, marginX + lineW, y + 6);
  doc.line(pw - marginX - lineW, y + 6, pw - marginX, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(opts.leftLabel || "Signature", marginX, y + 10);
  doc.text(opts.rightLabel || "Signature du client", pw - marginX, y + 10, { align: "right" });

  if (opts.autoSignDate) {
    doc.text(opts.autoSignDate, marginX, y + 14);
  }

  doc.setTextColor(0, 0, 0);
  return y + 20;
}

// ---------------------------------------------------------------------------
// BACKWARD-COMPAT helpers (kept for other 14 templates)
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
  const rows: Array<[string, string]> = [
    ["Client", client.name || "--"],
    ["N° de compte", client.account_number || "--"],
  ];
  if (client.email)   rows.push(["Courriel", client.email]);
  if (client.phone)   rows.push(["Téléphone", client.phone]);
  if (client.address) {
    const full = [client.address, client.city, client.province, client.postal].filter(Boolean).join(", ");
    rows.push(["Adresse", full]);
  }
  return drawMetaGrid(doc, startY, rows);
}

export function drawKeyValue(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(label, 15, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(value || "--", 80, y);
  doc.setTextColor(0, 0, 0);
  return y + 6;
}

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
  return drawInfoBox(doc, y, {
    title: "",
    body: text,
    bg: options.fillColor,
    border: options.borderColor,
    accent: options.borderColor,
    textColor: options.textColor,
  });
}

export function drawDivider(doc: jsPDF, y: number): number {
  const pw = doc.internal.pageSize.getWidth();
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.2);
  doc.line(15, y, pw - 15, y);
  return y + 5;
}
