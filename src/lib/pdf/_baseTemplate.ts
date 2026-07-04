/**
 * Base helpers V3 officiel — shell corporate bleu (#0066CC) pour TOUS les documents.
 * Les anciennes signatures sont conservées pour que chaque template existant
 * passe automatiquement par le nouveau design sans ancien rendu navy/teal.
 */
import { jsPDF } from "jspdf";
import { NIVRA } from "./companyInfo";
import { safeText, safeMoney, safeDate as sanitizeSafeDate } from "./_pdfSanitize";

export const BLUE: [number, number, number] = [0, 102, 204];
export const NAVY: [number, number, number] = [10, 37, 64];
export const BLUE_LIGHT: [number, number, number] = [232, 241, 250];
export const BLUE_TINT: [number, number, number] = [207, 225, 245];
export const LIGHT_BG: [number, number, number] = [245, 248, 252];
export const BORDER: [number, number, number] = [216, 225, 236];
export const MUTED: [number, number, number] = [91, 107, 128];
export const TEAL = BLUE;
export const GREEN: [number, number, number] = [34, 120, 60];
export const GREEN_LIGHT: [number, number, number] = [220, 240, 226];
export const RED: [number, number, number] = [180, 45, 45];
export const RED_LIGHT: [number, number, number] = [253, 232, 232];
export const AMBER: [number, number, number] = [180, 83, 9];
export const AMBER_BG: [number, number, number] = [254, 243, 199];
export const ORANGE = AMBER;
export const ORANGE_LIGHT = AMBER_BG;
export const GREY_BG = LIGHT_BG;
export const GREY_BORDER = BORDER;
export const BLUE_DARK = NAVY;
export const VIOLET = BLUE;
export const VIOLET_LIGHT = BLUE_LIGHT;
export const TEXT_DARK: [number, number, number] = [26, 26, 26];
export const TEXT_MUTED = MUTED;

export const fmtCAD = (amount: number | null | undefined): string => safeMoney(amount ?? 0);
export const fmtDate = (dateStr: string | undefined | null): string =>
  sanitizeSafeDate(dateStr, "long", "fr-CA");

export function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(safeText(text, ""), maxWidth) as string[];
}

export function safeDrawText(
  doc: jsPDF,
  value: unknown,
  x: number,
  y: number,
  opts?: { align?: "left" | "right" | "center"; maxWidth?: number; fallback?: string },
): void {
  doc.text(safeText(value, opts?.fallback ?? "—"), x, y, opts as any);
}

export interface HeaderOptions {
  title: string;
  subtitle?: string;
  docNumber?: string;
  docDate?: string;
  accent?: [number, number, number];
}

export function drawHeaderV2(doc: jsPDF, opts: HeaderOptions): number {
  const pw = doc.internal.pageSize.getWidth();
  const accent = opts.accent || BLUE;

  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, pw, 30, "F");

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

  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(safeText(opts.title, "DOCUMENT").toUpperCase(), pw - 15, 13, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (opts.docNumber) doc.text(`No ${safeText(opts.docNumber, "—")}`, pw - 15, 19, { align: "right" });
  if (opts.docDate) doc.text(`Émis le ${safeText(opts.docDate, "—")}`, pw - 15, 24, { align: "right" });

  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 30, pw, 8, "F");
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(safeText(opts.subtitle, NIVRA.tagline), 15, 35.5);

  doc.setTextColor(0, 0, 0);
  return 46;
}

export function drawHeader(
  doc: jsPDF,
  docTitle: string,
  docNumber: string,
  options: { docDate?: string | Date | null; subtitle?: string } = {},
) {
  drawHeaderV2(doc, {
    title: docTitle,
    subtitle: options.subtitle || docTitle.charAt(0).toUpperCase() + docTitle.slice(1).toLowerCase(),
    docNumber,
    docDate: options.docDate
      ? fmtDate(options.docDate instanceof Date ? options.docDate.toISOString().slice(0, 10) : String(options.docDate))
      : undefined,
  });
}

export function drawFooterV2(doc: jsPDF, pageNo = 1, totalPages = 1, hash?: string) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.2);
  doc.line(15, ph - 18, pw - 15, ph - 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`${NIVRA.legalName} - ${NIVRA.email} - ${NIVRA.website}`, 15, ph - 13);
  doc.text(`NEQ ${NIVRA.neq} - ${NIVRA.tpsLabel} - ${NIVRA.tvqLabel}`, 15, ph - 9);
  doc.text(`Page ${pageNo} sur ${totalPages}`, pw - 15, ph - 13, { align: "right" });
  doc.text("Document généré automatiquement", pw - 15, ph - 9, { align: "right" });
  if (hash) {
    doc.setFontSize(6);
    doc.setTextColor(170, 180, 195);
    doc.text(`SHA-256: ${hash.slice(0, 48)}`, pw / 2, ph - 4, { align: "center" });
  }
  doc.setTextColor(0, 0, 0);
}

export function drawFooter(doc: jsPDF, pageInfoOrHash?: { current: number; total: number } | string) {
  if (typeof pageInfoOrHash === "object" && pageInfoOrHash) {
    drawFooterV2(doc, pageInfoOrHash.current, pageInfoOrHash.total);
    return;
  }
  drawFooterV2(doc, 1, 1, pageInfoOrHash);
}

export function drawFooterOnAllPages(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooterV2(doc, i, total);
  }
}

export function drawMetaGrid(doc: jsPDF, y: number, rows: Array<[string, string]>): number {
  const pw = doc.internal.pageSize.getWidth();
  const marginX = 15;
  const colW = (pw - 2 * marginX) / 2;
  const rowH = 15;
  const innerW = colW - 6;

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
    doc.text(safeText(rows[i][0], "").toUpperCase(), x + 3, yy + 5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    let value = safeText(rows[i][1], "—");
    let fs = 9;
    doc.setFontSize(fs);
    while (doc.getTextWidth(value) > innerW && fs > 7) {
      fs -= 0.5;
      doc.setFontSize(fs);
    }
    if (doc.getTextWidth(value) > innerW) {
      while (value.length > 4 && doc.getTextWidth(value + "…") > innerW) value = value.slice(0, -1);
      value += "…";
    }
    doc.text(value, x + 3, yy + 11);
  }
  doc.setTextColor(0, 0, 0);
  return y + Math.ceil(rows.length / 2) * rowH + 4;
}

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
  },
): number {
  const rows: Array<[string, string]> = [["Client", safeText(client.name, "—")]];
  if (client.account_number) rows.push(["N° de compte", safeText(client.account_number, "—")]);
  if (client.email) rows.push(["Courriel", safeText(client.email, "—")]);
  if (client.phone) rows.push(["Téléphone", safeText(client.phone, "—")]);
  if (client.address) {
    rows.push(["Adresse", [client.address, client.city, client.province, client.postal].filter(Boolean).join(", ")]);
  }
  return drawMetaGrid(doc, startY, rows);
}

export function drawSectionTitle(doc: jsPDF, title: string, y: number, accent = BLUE): number {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(15, y, 3, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(safeText(title, "").toUpperCase(), 20, y + 4.5);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.2);
  doc.line(15, y + 8, pw - 15, y + 8);
  doc.setTextColor(0, 0, 0);
  return y + 12;
}

export interface HeroBoxOpts {
  label: string;
  value: string;
  sublabel?: string;
  bg?: [number, number, number];
  height?: number;
}

export function drawHeroBox(doc: jsPDF, y: number, opts: HeroBoxOpts): number {
  const pw = doc.internal.pageSize.getWidth();
  const h = opts.height ?? 26;
  const bg = opts.bg || BLUE;
  doc.setFillColor(bg[0], bg[1], bg[2]);
  doc.rect(15, y, pw - 30, h, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(BLUE_TINT[0], BLUE_TINT[1], BLUE_TINT[2]);
  doc.text(safeText(opts.label, "").toUpperCase(), 21, y + 7);
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(safeText(opts.value, "—"), 21, y + h / 2 + 6);
  if (opts.sublabel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(BLUE_TINT[0], BLUE_TINT[1], BLUE_TINT[2]);
    doc.text(safeText(opts.sublabel, ""), 21, y + h - 4);
  }
  doc.setTextColor(0, 0, 0);
  return y + h + 6;
}

export function drawZebraTable(
  doc: jsPDF,
  y: number,
  headers: string[],
  rows: Array<Array<string | number>>,
  colWidths: number[],
  accent = BLUE,
): number {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const headerH = 7;
  const rowH = 6.5;
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(15, y, totalW, headerH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  let x = 15;
  for (let i = 0; i < headers.length; i++) {
    doc.text(safeText(headers[i], "").toUpperCase(), x + 2, y + 4.8);
    x += colWidths[i];
  }
  y += headerH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  for (let r = 0; r < rows.length; r++) {
    if (r % 2 === 0) {
      doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]);
      doc.rect(15, y, totalW, rowH, "F");
    }
    x = 15;
    for (let i = 0; i < rows[r].length; i++) {
      doc.text(safeText(rows[r][i], ""), x + 2, y + 4.4);
      x += colWidths[i];
    }
    y += rowH;
  }
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.2);
  doc.rect(15, y - headerH - rows.length * rowH, totalW, headerH + rows.length * rowH, "S");
  doc.setTextColor(0, 0, 0);
  return y + 4;
}

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
  const w = pw - 30;
  const bg = opts.bg || BLUE_LIGHT;
  const border = opts.border || BLUE;
  const accent = opts.accent || border;
  const lines = wrapText(doc, safeText(opts.body, ""), w - 8);
  const hasTitle = Boolean(opts.title);
  const h = (hasTitle ? 10 : 5) + lines.length * 4.2;
  doc.setFillColor(bg[0], bg[1], bg[2]);
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.setLineWidth(0.4);
  doc.rect(15, y, w, h, "FD");
  let ly = y + 5;
  if (hasTitle) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text(safeText(opts.title, ""), 19, ly);
    ly += 5.5;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const tc = opts.textColor || [40, 40, 40];
  doc.setTextColor(tc[0], tc[1], tc[2]);
  for (const line of lines) {
    doc.text(line, 19, ly);
    ly += 4.2;
  }
  doc.setTextColor(0, 0, 0);
  return y + h + 5;
}

export function drawBoxedText(
  doc: jsPDF,
  text: string,
  y: number,
  options: { fillColor?: [number, number, number]; borderColor?: [number, number, number]; textColor?: [number, number, number] } = {},
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

export function drawKeyValue(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(safeText(label, ""), 15, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(safeText(value, "—"), 80, y);
  doc.setTextColor(0, 0, 0);
  return y + 6;
}

export function drawSignatureBlock(
  doc: jsPDF,
  y: number,
  opts: { leftLabel?: string; rightLabel?: string; autoSignName?: string; autoSignDate?: string } = {},
): number {
  const pw = doc.internal.pageSize.getWidth();
  const lineW = 70;
  if (opts.autoSignName) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(14);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(safeText(opts.autoSignName, ""), 15, y);
    y += 2;
  } else {
    y += 4;
  }
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setLineWidth(0.3);
  doc.line(15, y + 6, 15 + lineW, y + 6);
  doc.line(pw - 15 - lineW, y + 6, pw - 15, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(safeText(opts.leftLabel, "Signature"), 15, y + 10);
  doc.text(safeText(opts.rightLabel, "Signature du client"), pw - 15, y + 10, { align: "right" });
  if (opts.autoSignDate) doc.text(safeText(opts.autoSignDate, ""), 15, y + 14);
  doc.setTextColor(0, 0, 0);
  return y + 20;
}

export function drawDivider(doc: jsPDF, y: number): number {
  const pw = doc.internal.pageSize.getWidth();
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.2);
  doc.line(15, y, pw - 15, y);
  return y + 5;
}

export function drawTotalsBlock(
  doc: jsPDF,
  startY: number,
  rows: Array<{ label: string; amount: number | null | undefined; bold?: boolean; muted?: boolean; separator?: boolean }>,
  options: { rightAlign?: number; leftAlign?: number } = {},
): number {
  const rightX = options.rightAlign ?? 195;
  const leftX = options.leftAlign ?? 115;
  let y = startY;
  for (const row of rows) {
    if (row.separator) {
      doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
      doc.line(leftX, y - 1, rightX, y - 1);
      y += 2;
    }
    doc.setFont("helvetica", row.bold ? "bold" : "normal");
    doc.setFontSize(row.bold ? 11 : 9);
    doc.setTextColor(row.bold ? NAVY[0] : row.muted ? 110 : 40, row.bold ? NAVY[1] : row.muted ? 110 : 40, row.bold ? NAVY[2] : row.muted ? 110 : 40);
    doc.text(safeText(row.label, ""), leftX, y);
    doc.text(fmtCAD(row.amount ?? 0), rightX, y, { align: "right" });
    y += row.bold ? 7 : 5;
  }
  doc.setTextColor(0, 0, 0);
  return y + 3;
}

export function drawAmountDueBox(
  doc: jsPDF,
  y: number,
  amount: number | null | undefined,
  label: string,
  options: { tone?: "primary" | "warning" | "success" | "error" } = {},
): number {
  const tone = options.tone ?? "primary";
  const fillMap: Record<string, [number, number, number]> = {
    primary: BLUE_LIGHT,
    warning: AMBER_BG,
    success: GREEN_LIGHT,
    error: RED_LIGHT,
  };
  const borderMap: Record<string, [number, number, number]> = {
    primary: BLUE,
    warning: AMBER,
    success: GREEN,
    error: RED,
  };
  return drawHeroBox(doc, y, {
    label,
    value: fmtCAD(amount ?? 0),
    bg: borderMap[tone],
    height: 24,
  });
}
