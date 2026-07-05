/**
 * Nivra Invoice Template V5 — PREMIUM 5-PAGE LAYOUT (2026-07-01)
 *
 * Page 1 — Cover: header, account block, sommaire, MONTANT DÛ hero, comment payer
 * Page 2 — Détail: services table, rabais, frais uniques (si présents), résumé taxes
 * Page 3 — Modalités de paiement
 * Page 4 — Politique de remboursement & prorata
 * Page 5 — Termes et conditions + merci
 *
 * Uses jsPDF built-in helvetica (Latin-1 safe). Data contract unchanged (InvoiceDataV2).
 */

import jsPDFModule from "npm:jspdf@2.5.2";
const jsPDF = (jsPDFModule as any).default || jsPDFModule;
type jsPDF = any;
import type { InvoiceDataV2, PDFGenerationResult } from "./types.ts";
import { NIVRA } from "./companyInfo.ts";

// ============================================================================
// BRAND
// ============================================================================
const BLUE: [number, number, number] = [0, 102, 204];       // #0066CC corporate
const BLUE_DARK: [number, number, number] = [0, 76, 153];
const INK: [number, number, number] = [17, 24, 39];         // near-black text
const MUTED: [number, number, number] = [107, 114, 128];    // secondary text
const RULE: [number, number, number] = [229, 231, 235];     // light divider
const SOFT: [number, number, number] = [243, 246, 250];     // pale bg
const GREEN: [number, number, number] = [16, 128, 80];
const RED: [number, number, number] = [190, 30, 45];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;

// ============================================================================
// HELPERS
// ============================================================================
const fmt = (n: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(n || 0);

const fmtDate = (d: string | undefined | null): string => {
  if (!d) return "—";
  const m = String(d).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "—";
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${dt.getDate()} ${dt.toLocaleString("fr-CA", { month: "long" })} ${dt.getFullYear()}`;
};

const fmtDateShort = (d: string | undefined | null): string => {
  if (!d) return "—";
  const m = String(d).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const typeLabel = (cat: string): string => {
  const k = (cat || "").toLowerCase();
  if (["internet", "mobile", "tv", "security", "service", "recurring", "streaming"].includes(k)) return "Service";
  if (["equipment", "phone"].includes(k)) return "Équipement";
  if (["fee", "fees", "frais", "onetime", "one_time", "one-time"].includes(k)) return "Frais unique";
  if (["adjustment", "ajustement", "proration", "prorata"].includes(k)) return "Ajustement";
  return cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : "Service";
};

const setFill = (doc: jsPDF, c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
const setText = (doc: jsPDF, c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
const setDraw = (doc: jsPDF, c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

// ============================================================================
// HEADER / FOOTER (repeated on every page)
// ============================================================================
function drawHeader(doc: jsPDF, invoiceNumber: string) {
  // Blue band
  setFill(doc, BLUE);
  doc.rect(0, 0, PAGE_W, 32, "F");
  setFill(doc, BLUE_DARK);
  doc.rect(0, 32, PAGE_W, 2, "F");

  // Wordmark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  setText(doc, [255, 255, 255]);
  doc.text("NIVRA", MARGIN, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("TELECOM", MARGIN + 25, 18);

  doc.setFontSize(8);
  setText(doc, [200, 220, 245]);
  doc.text("Fournisseur de services de télécommunications — Québec", MARGIN, 25);

  // Right: FACTURE badge + number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setText(doc, [255, 255, 255]);
  doc.text("FACTURE", PAGE_W - MARGIN, 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, [200, 220, 245]);
  doc.text(`N° ${invoiceNumber}`, PAGE_W - MARGIN, 22, { align: "right" });
}

function drawFooter(doc: jsPDF, pageNum: number, pageTotal: number) {
  setDraw(doc, RULE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, PAGE_H - 15, PAGE_W - MARGIN, PAGE_H - 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setText(doc, MUTED);
  doc.text(
    `Nivra Communications Inc.  •  ${NIVRA.email}  •  ${NIVRA.website}`,
    MARGIN, PAGE_H - 10,
  );
  doc.text(
    `TPS: 732287291 RT0001  •  TVQ: 1229249786 TQ0001  •  NEQ: 2291249786`,
    MARGIN, PAGE_H - 6,
  );
  doc.text(`Page ${pageNum} / ${pageTotal}`, PAGE_W - MARGIN, PAGE_H - 6, { align: "right" });
}

function newPage(doc: jsPDF, invoiceNumber: string) {
  doc.addPage();
  drawHeader(doc, invoiceNumber);
}

// ============================================================================
// PAGE 1 — COVER
// ============================================================================
function drawPage1(doc: jsPDF, data: InvoiceDataV2 & { order_number?: string }) {
  let y = 44;

  // ── Client / Adresse row ────────────────────────────────────────────────
  const colW = (PAGE_W - MARGIN * 2 - 6) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colW + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setText(doc, MUTED);
  doc.text("FACTURÉ À", leftX, y);
  doc.text("ADRESSE DE SERVICE", rightX, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setText(doc, INK);
  doc.text(data.customer.full_name || "—", leftX, y);
  const svcLines = doc.splitTextToSize(
    [
      data.customer.address_line1 || "—",
      [data.customer.city, data.customer.province, data.customer.postal_code].filter(Boolean).join(" "),
      "Canada",
    ].filter(Boolean).join("\n"),
    colW,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(svcLines, rightX, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (data.customer.email) { doc.text(data.customer.email, leftX, y); y += 4; }
  if (data.customer.phone) { doc.text(data.customer.phone, leftX, y); y += 4; }

  y = Math.max(y, 44 + 5 + 5 + svcLines.length * 4 + 2);

  // ── Meta grid (compte / dates / période) ────────────────────────────────
  y += 4;
  setDraw(doc, RULE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;

  const cellW = (PAGE_W - MARGIN * 2) / 4;
  const metas: Array<[string, string]> = [
    ["N° DE COMPTE", data.account_number || "—"],
    ["DATE D'ÉMISSION", fmtDate(data.invoice_date)],
    ["DATE D'ÉCHÉANCE", fmtDate(data.due_date)],
    ["PÉRIODE", data.billing_period_start && data.billing_period_end
      ? `${fmtDateShort(data.billing_period_start)} au ${fmtDateShort(data.billing_period_end)}`
      : (data as any).order_number ? `Cmde ${(data as any).order_number}` : "—"],
  ];
  metas.forEach(([label, value], i) => {
    const x = MARGIN + cellW * i;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setText(doc, MUTED);
    doc.text(label, x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setText(doc, INK);
    const val = doc.splitTextToSize(value, cellW - 3);
    doc.text(val, x, y + 5);
  });
  y += 14;

  setDraw(doc, RULE);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  // ── Sommaire du compte ──────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setText(doc, INK);
  doc.text("Sommaire du compte", MARGIN, y);
  y += 6;

  const boxX = MARGIN;
  const boxW = PAGE_W - MARGIN * 2;
  const rows: Array<[string, number, boolean?]> = [
    ["Nouveaux frais (services & équipements)", data.subtotal || 0],
    ["TPS (5%)", data.taxes?.gst_amount || 0],
    ["TVQ (9,975%)", data.taxes?.qst_amount || 0],
  ];
  const paid = data.payments_total || 0;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setText(doc, INK);
  rows.forEach(([label, amt]) => {
    doc.text(label, boxX + 3, y + 5);
    doc.text(fmt(amt), boxX + boxW - 3, y + 5, { align: "right" });
    setDraw(doc, RULE);
    doc.line(boxX, y + 8, boxX + boxW, y + 8);
    y += 8;
  });

  // Total facture line
  y += 1;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Total de la facture", boxX + 3, y + 5);
  doc.text(fmt(data.total || 0), boxX + boxW - 3, y + 5, { align: "right" });
  y += 8;

  if (paid > 0) {
    setText(doc, GREEN);
    doc.setFont("helvetica", "normal");
    doc.text("Paiement reçu", boxX + 3, y + 5);
    doc.text(`- ${fmt(paid)}`, boxX + boxW - 3, y + 5, { align: "right" });
    y += 8;
    setText(doc, INK);
  }

  y += 4;

  // ── MONTANT DÛ hero ─────────────────────────────────────────────────────
  const heroH = 32;
  setFill(doc, BLUE);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, heroH, 3, 3, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, [200, 220, 245]);
  doc.text("MONTANT DÛ", MARGIN + 5, y + 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  setText(doc, [255, 255, 255]);
  doc.text(fmt(data.balance_due || 0), MARGIN + 5, y + 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, [200, 220, 245]);
  doc.text("À payer avant le", PAGE_W - MARGIN - 5, y + 12, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setText(doc, [255, 255, 255]);
  doc.text(fmtDate(data.due_date), PAGE_W - MARGIN - 5, y + 20, { align: "right" });

  y += heroH + 8;

  // ── Comment payer (3 tuiles) ────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setText(doc, INK);
  doc.text("Comment payer", MARGIN, y);
  y += 5;

  const tiles: Array<[string, string, string]> = [
    ["1. Portail client", "portal.nivra-telecom.ca", "Interac, carte ou PayPal — instantané"],
    ["2. Virement Interac", "support@nivra-telecom.ca", "Question : votre n° de compte"],
    ["3. PayPal", "PayPal.Me/nivratelecom", "Indiquez votre n° de facture"],
  ];
  const tileW = (PAGE_W - MARGIN * 2 - 8) / 3;
  const tileH = 26;
  tiles.forEach(([t, url, sub], i) => {
    const x = MARGIN + (tileW + 4) * i;
    setFill(doc, SOFT);
    setDraw(doc, RULE);
    doc.roundedRect(x, y, tileW, tileH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(doc, BLUE_DARK);
    doc.text(t, x + 3, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(doc, INK);
    doc.text(url, x + 3, y + 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText(doc, MUTED);
    const wrapped = doc.splitTextToSize(sub, tileW - 6);
    doc.text(wrapped, x + 3, y + 19);
  });
  y += tileH + 6;

  // Note prépayé
  setFill(doc, [255, 249, 224]);
  setDraw(doc, [230, 200, 100]);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 12, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setText(doc, [140, 100, 0]);
  doc.text("Rappel — Modèle prépayé", MARGIN + 3, y + 5);
  doc.setFont("helvetica", "normal");
  setText(doc, [90, 65, 0]);
  doc.text(
    "Le paiement doit être confirmé avant la date d'échéance pour éviter la suspension du service.",
    MARGIN + 3, y + 10,
  );
}

// ============================================================================
// PAGE 2 — DÉTAIL DES SERVICES
// ============================================================================
function drawPage2(doc: jsPDF, data: InvoiceDataV2 & { order_number?: string }) {
  let y = 44;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setText(doc, INK);
  doc.text("Détail de votre facture", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, MUTED);
  doc.text(
    `Période : ${data.billing_period_start && data.billing_period_end
      ? `${fmtDate(data.billing_period_start)} au ${fmtDate(data.billing_period_end)}`
      : "Frais uniques"}`,
    MARGIN, y + 6,
  );
  y += 14;

  // Table header
  const cx = { desc: MARGIN + 3, type: MARGIN + 105, qty: MARGIN + 130, unit: MARGIN + 150, amt: PAGE_W - MARGIN - 3 };
  setFill(doc, BLUE);
  doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setText(doc, [255, 255, 255]);
  doc.text("DESCRIPTION", cx.desc, y + 5.5);
  doc.text("TYPE", cx.type, y + 5.5);
  doc.text("QTÉ", cx.qty, y + 5.5, { align: "right" });
  doc.text("PRIX", cx.unit, y + 5.5, { align: "right" });
  doc.text("MONTANT", cx.amt, y + 5.5, { align: "right" });
  y += 8;

  const drawItem = (
    description: string,
    subDesc: string | null,
    typeCol: string,
    qty: number,
    unit: number,
    amount: number,
    color: [number, number, number],
  ): void => {
    const descLines: string[] = doc.splitTextToSize(description, 95);
    const subLines: string[] = subDesc ? doc.splitTextToSize(subDesc, 95) : [];
    const rowH = Math.max(9, descLines.length * 4.5 + subLines.length * 3.8 + 4);

    if (y + rowH > PAGE_H - 60) return; // avoid overflow into totals

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(doc, color);
    doc.text(descLines, cx.desc, y + 5);

    if (subLines.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setText(doc, MUTED);
      doc.text(subLines, cx.desc, y + 5 + descLines.length * 4.5);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setText(doc, color);
    doc.text(typeCol, cx.type, y + 5);
    doc.text(String(qty), cx.qty, y + 5, { align: "right" });
    doc.text(fmt(unit), cx.unit, y + 5, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(fmt(amount), cx.amt, y + 5, { align: "right" });

    setDraw(doc, RULE);
    doc.setLineWidth(0.15);
    doc.line(MARGIN, y + rowH, PAGE_W - MARGIN, y + rowH);
    y += rowH;
  };

  // Items
  for (const item of data.items || []) {
    const t = typeLabel(String(item.category));
    // Sub-description = period line if provided
    const sub = item.period ? `Période : ${item.period}` : null;
    drawItem(item.description || "Service", sub, t, Number(item.qty || 1), Number(item.unit_price || 0), Number(item.amount || 0), INK);
  }

  // Discounts
  if (data.discounts && data.discounts.length) {
    for (const d of data.discounts) {
      drawItem(d.label || "Rabais", null, "Rabais", 1, -Math.abs(d.amount), -Math.abs(d.amount), GREEN);
    }
  }

  // ── Résumé (right-aligned box) ──────────────────────────────────────────
  y += 8;
  const boxW = 80;
  const boxX = PAGE_W - MARGIN - boxW;
  const rows: Array<[string, string, [number, number, number]?]> = [
    ["Sous-total", fmt(data.subtotal || 0)],
    ["TPS (5%)", fmt(data.taxes?.gst_amount || 0)],
    ["TVQ (9,975%)", fmt(data.taxes?.qst_amount || 0)],
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, INK);
  rows.forEach(([l, v]) => {
    doc.text(l, boxX + 3, y + 5);
    doc.text(v, boxX + boxW - 3, y + 5, { align: "right" });
    setDraw(doc, RULE);
    doc.line(boxX, y + 7.5, boxX + boxW, y + 7.5);
    y += 7.5;
  });

  // Total
  y += 1;
  setFill(doc, BLUE);
  doc.rect(boxX, y, boxW, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setText(doc, [255, 255, 255]);
  doc.text("TOTAL", boxX + 3, y + 7);
  doc.text(fmt(data.total || 0), boxX + boxW - 3, y + 7, { align: "right" });
  y += 12;

  const paid = data.payments_total || 0;
  if (paid > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setText(doc, GREEN);
    doc.text("Paiement reçu", boxX + 3, y + 5);
    doc.text(`- ${fmt(paid)}`, boxX + boxW - 3, y + 5, { align: "right" });
    y += 7;
    doc.setFont("helvetica", "bold");
    setText(doc, INK);
    doc.text("Solde", boxX + 3, y + 5);
    doc.text(fmt(data.balance_due || 0), boxX + boxW - 3, y + 5, { align: "right" });
  }
}

// ============================================================================
// PAGES 3-5 — POLITIQUES (statiques)
// ============================================================================
function drawSectionTitle(doc: jsPDF, y: number, title: string, subtitle?: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setText(doc, INK);
  doc.text(title, MARGIN, y);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setText(doc, MUTED);
    doc.text(subtitle, MARGIN, y + 5);
    y += 5;
  }
  y += 3;
  setFill(doc, BLUE);
  doc.rect(MARGIN, y, 30, 1.2, "F");
  return y + 8;
}

function drawParagraphs(doc: jsPDF, y: number, blocks: Array<{ h?: string; p: string }>): number {
  for (const b of blocks) {
    if (b.h) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setText(doc, BLUE_DARK);
      doc.text(b.h, MARGIN, y);
      y += 5;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setText(doc, INK);
    const lines = doc.splitTextToSize(b.p, PAGE_W - MARGIN * 2);
    doc.text(lines, MARGIN, y);
    y += lines.length * 4.5 + 4;
  }
  return y;
}

function drawPage3Modalites(doc: jsPDF) {
  let y = drawSectionTitle(doc, 44, "Modalités de paiement", "Comment et quand payer votre facture Nivra");
  y = drawParagraphs(doc, y, [
    { h: "Modèle prépayé",
      p: "Nivra est un fournisseur prépayé. Chaque cycle mensuel doit être payé à l'avance. Le paiement doit être confirmé au plus tard à la date d'échéance indiquée sur cette facture pour éviter la suspension du service." },
    { h: "Méthodes acceptées",
      p: "• Virement Interac (support@nivra-telecom.ca) — instantané.\n• PayPal (PayPal.Me/nivratelecom) — indiquez votre numéro de facture.\n• Carte de crédit / débit via le portail client (portal.nivra-telecom.ca).\n• Paiement automatique (PAD) — activable dans votre portail." },
    { h: "Cycle de facturation",
      p: "Le cycle commence à la date de confirmation du paiement initial. La date de renouvellement (J0) est identique chaque mois. Une facture de renouvellement est émise 7 jours avant J0." },
    { h: "Retard de paiement",
      p: "Aucun intérêt ni frais de retard sur non-renouvellement normal (service simplement non renouvelé). Des frais de 15 $ + intérêt 5 %/mois s'appliquent uniquement en cas de litige bancaire ou rétrofacturation." },
    { h: "Réactivation",
      p: "Après suspension, la réactivation est possible sur simple paiement du solde. Après 90 jours sans renouvellement, un numéro mobile peut devenir irrécupérable (un nouveau numéro sera attribué)." },
  ]);
}

function drawPage4Remboursement(doc: jsPDF) {
  let y = drawSectionTitle(doc, 44, "Politique de remboursement et prorata", "Vos droits en cas d'annulation, de changement ou d'insatisfaction");
  y = drawParagraphs(doc, y, [
    { h: "Garantie 30 jours",
      p: "Si vous n'êtes pas satisfait de votre service Internet ou TV dans les 30 premiers jours suivant l'activation, vous pouvez demander un remboursement complet du service (les équipements doivent être retournés en bon état)." },
    { h: "Annulation en cours de cycle",
      p: "Vous pouvez annuler à tout moment. Un crédit au prorata des jours non utilisés est automatiquement appliqué à votre compte (jours restants × prix journalier). Ce crédit peut être remboursé ou reporté sur une facture future." },
    { h: "Changement de forfait",
      p: "• Upgrade : la différence entre l'ancien et le nouveau forfait est facturée au prorata pour la fin du cycle en cours.\n• Downgrade : la différence est créditée au compte pour la fin du cycle." },
    { h: "Équipements",
      p: "Les équipements (borne WiFi, terminal TV, SIM) restent la propriété du client. Aucun remboursement d'équipement passé 30 jours, sauf défaut de fabrication couvert par la garantie constructeur (12 mois)." },
    { h: "Frais d'installation",
      p: "Les frais d'installation, d'activation et de déplacement sont non remboursables une fois le service activé, sauf annulation dans la fenêtre de 30 jours." },
    { h: "Comment demander un remboursement",
      p: "Écrivez à support@nivra-telecom.ca en indiquant votre numéro de compte et le motif. Traitement sous 5 à 10 jours ouvrables sur la méthode de paiement d'origine." },
  ]);
}

function drawPage5Termes(doc: jsPDF) {
  let y = drawSectionTitle(doc, 44, "Termes et conditions", "Extraits — version complète : nivra-telecom.ca/legal");
  y = drawParagraphs(doc, y, [
    { h: "1. Utilisation du service",
      p: "Le service est destiné à un usage résidentiel/personnel. Toute revente, hébergement commercial ou utilisation abusive (spam, minage crypto continu, saturation intentionnelle du réseau) est interdite et peut entraîner la suspension immédiate." },
    { h: "2. Équipements",
      p: "Les équipements loués ou vendus par Nivra doivent être maintenus en bon état. En cas de perte, vol ou dommage causé par le client, un remplacement est facturable au tarif catalogue en vigueur." },
    { h: "3. Réseau et performance",
      p: "Les vitesses annoncées sont des vitesses maximales théoriques. La performance réelle dépend de facteurs externes (câblage, WiFi, appareils, réseau distant). Nivra s'engage à maintenir un service raisonnable et à corriger toute panne signalée." },
    { h: "4. Confidentialité (Loi 25)",
      p: "Nivra collecte, utilise et conserve vos données personnelles conformément à la Loi 25 du Québec. Vous pouvez consulter, corriger ou faire supprimer vos données via votre portail ou en écrivant à privacy@nivra-telecom.ca." },
    { h: "5. Modification des tarifs",
      p: "Nivra peut modifier ses tarifs avec un préavis de 30 jours. Aucune modification ne s'applique rétroactivement à un cycle déjà payé." },
    { h: "6. Résiliation",
      p: "Le client peut résilier à tout moment sans pénalité. Nivra peut résilier en cas de non-paiement, fraude, usurpation d'identité ou violation des présentes conditions." },
    { h: "7. Litiges",
      p: "Tout litige est régi par les lois de la province de Québec. Le client peut également saisir la CPRST (Commission des plaintes relatives aux services de télécom-télévision) : www.ccts-cprst.ca." },
  ]);

  // Merci banner
  const bannerY = PAGE_H - 45;
  setFill(doc, BLUE);
  doc.rect(0, bannerY, PAGE_W, 20, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setText(doc, [255, 255, 255]);
  doc.text("Merci de faire confiance à Nivra Telecom", PAGE_W / 2, bannerY + 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, [200, 220, 245]);
  doc.text("Une question sur cette facture ? support@nivra-telecom.ca", PAGE_W / 2, bannerY + 14, { align: "center" });
}

// ============================================================================
// MAIN
// ============================================================================
export function generateInvoiceV3PDF(data: InvoiceDataV2 & { order_number?: string }): PDFGenerationResult {
  try {
    if (!data.invoice_number) return { success: false, error: "Numéro de facture manquant" };
    if (!data.items || data.items.length === 0) return { success: false, error: "Aucun item à facturer" };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Page 1
    drawHeader(doc, data.invoice_number);
    drawPage1(doc, data);

    // Page 2
    newPage(doc, data.invoice_number);
    drawPage2(doc, data);

    // Pages 3–5 (policies)
    newPage(doc, data.invoice_number); drawPage3Modalites(doc);
    newPage(doc, data.invoice_number); drawPage4Remboursement(doc);
    newPage(doc, data.invoice_number); drawPage5Termes(doc);

    // Footers with page numbers
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      drawFooter(doc, i, total);
    }

    const blob = doc.output("blob");
    return {
      success: true,
      blob,
      filename: `Facture_${data.invoice_number}_Nivra.pdf`,
    };
  } catch (error: any) {
    console.error("[InvoiceV5] Generation error:", error);
    return { success: false, error: error?.message || "Erreur de génération" };
  }
}

// Backward-compat exports
export function generateInvoiceMonthlyV3PDF(data: InvoiceDataV2): PDFGenerationResult {
  return generateInvoiceV3PDF({ ...data, invoice_type: "MONTHLY" });
}
export function generateInvoiceOneTimeV3PDF(data: InvoiceDataV2): PDFGenerationResult {
  return generateInvoiceV3PDF({ ...data, invoice_type: "ONETIME" });
}
export default generateInvoiceV3PDF;
