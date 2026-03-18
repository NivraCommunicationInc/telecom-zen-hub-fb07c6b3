import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import jsPDF from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Company info
const NIVRA = {
  legalName: "NIVRA COMMUNICATIONS INC.",
  tradeName: "Nivra Telecom",
  neq: "2291249786",
  tps: "TPS : 732287291 RT0001",
  tvq: "TVQ : 1229249786 TQ0001",
  email: "Support@nivra-telecom.ca",
  website: "www.nivra-telecom.ca",
  address: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  division: "Service à la clientèle — Division facturation",
  tagline: "Fournisseur de services de télécommunications — Province de Québec",
};

const fmt = (amount: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount || 0);

const fmtDate = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  try { return new Date(dateStr).toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return dateStr; }
};

const fmtPayMethod = (m: string): string => {
  const map: Record<string, string> = { PayPal: "PayPal", paypal: "PayPal", Interac: "Virement Interac", interac: "Virement Interac", e_transfer: "Virement Interac", card: "Carte de crédit", "Credit Card": "Carte de crédit" };
  return map[m] || m;
};

// ═══════════════════════════════════════════════════════════════════
// 1. INVOICE — Pure billing document (no receipt section)
// ═══════════════════════════════════════════════════════════════════
function generateInvoice(data: any): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 15;
  const cw = pw - m * 2;

  // NAVY HEADER
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pw, 32, "F");
  doc.setFillColor(20, 184, 166);
  doc.rect(0, 32, pw, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(255, 255, 255);
  doc.text(NIVRA.legalName, m, 12);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(180, 190, 210);
  doc.text(NIVRA.division, m, 18);
  doc.text(NIVRA.tagline, m, 23);
  doc.text(`${NIVRA.address} | ${NIVRA.email}`, m, 28);
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(20, 184, 166);
  doc.text("FACTURE", pw - m, 14, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(160, 170, 190);
  doc.text(`NEQ: ${NIVRA.neq} | ${NIVRA.tps} | ${NIVRA.tvq}`, pw - m, 22, { align: "right" });

  let y = 40;
  const colW = (cw - 8) / 2;

  // LEFT: Client Info
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(m, y, colW, 52, 2, 2, "F");
  doc.setFillColor(20, 184, 166);
  doc.rect(m, y, 3, 52, "F");
  let ly = y + 8;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
  doc.text("FACTURÉ À", m + 7, ly); ly += 7;

  const fields = [["Nom", data.client_name], ["Courriel", data.client_email], ["Téléphone", data.client_phone || "—"], ["Adresse", data.address || "—"], ["Compte #", data.account_number]];
  fields.forEach(([label, value]: any) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
    doc.text(label, m + 7, ly);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(30, 41, 59);
    doc.text((value || "—").substring(0, 35), m + 32, ly);
    ly += 5.5;
  });

  // RIGHT: Invoice Details
  const rx = m + colW + 8;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rx, y, colW, 52, 2, 2, "F");
  doc.setFillColor(0, 102, 204);
  doc.rect(rx, y, 3, 52, "F");
  let ry = y + 8;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
  doc.text("DÉTAILS FACTURE", rx + 7, ry); ry += 7;

  const rFields = [["N° facture", data.invoice_number], ["Émission", fmtDate(data.invoice_date)], ["Échéance", fmtDate(data.due_date)], ["Période", `${fmtDate(data.cycle_start)} au ${fmtDate(data.cycle_end)}`], ["Statut", data.status === "paid" ? "Payée" : "En attente"]];
  rFields.forEach(([label, value]: any) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
    doc.text(label, rx + 7, ry);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(30, 41, 59);
    doc.text((value || "—").substring(0, 25), rx + 40, ry);
    ry += 5.5;
  });

  y += 58;

  // ITEMS TABLE
  doc.setFillColor(248, 250, 252);
  doc.rect(m, y, cw, 7, "F");
  doc.setFillColor(20, 184, 166);
  doc.rect(m, y, 3, 7, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
  doc.text("DÉTAIL DES SERVICES ET FRAIS", m + 7, y + 5);
  y += 10;

  // Table header
  doc.setFillColor(15, 23, 42);
  doc.rect(m, y, cw, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  doc.text("Description", m + 3, y + 5);
  doc.text("Qté", m + 120, y + 5);
  doc.text("P.U.", m + 133, y + 5);
  doc.text("Montant", m + 153, y + 5);
  y += 9;

  (data.lines || []).forEach((line: any, i: number) => {
    if (i % 2 === 0) { doc.setFillColor(250, 250, 252); doc.rect(m, y - 1, cw, 7, "F"); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(30, 41, 59);
    doc.text((line.description || "—").substring(0, 55), m + 3, y + 4);
    doc.text(String(line.quantity || 1), m + 120, y + 4);
    doc.text(fmt(line.unit_price), m + 133, y + 4);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(line.line_total), m + 153, y + 4);
    y += 7;
  });

  // Discounts
  (data.discounts || []).forEach((d: any) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(30, 41, 59);
    doc.text(d.description, m + 3, y + 4);
    doc.setFont("helvetica", "bold"); doc.setTextColor(22, 163, 74);
    doc.text(fmt(d.line_total), m + 153, y + 4);
    y += 7;
  });

  // FINANCIAL SUMMARY
  y += 5;
  const tx = m + cw - 90;
  const drawLine = (label: string, value: string, opts: any = {}) => {
    if (opts.bg) { doc.setFillColor(...opts.bg); doc.roundedRect(tx - 3, y - 2, 96, 9, 1, 1, "F"); doc.setTextColor(255, 255, 255); }
    else { doc.setTextColor(...(opts.color || [30, 41, 59])); }
    doc.setFont("helvetica", opts.bold ? "bold" : "normal"); doc.setFontSize(opts.size || 9);
    doc.text(label, tx, y + 4);
    doc.text(value, tx + 90, y + 4, { align: "right" });
    y += opts.bg ? 12 : 6.5;
  };

  drawLine("Sous-total", fmt(data.subtotal), { bold: true });
  if (data.discount_total && data.discount_total < 0) drawLine("Rabais", fmt(data.discount_total), { color: [22, 163, 74] });
  drawLine("TPS (5%)", fmt(data.tps_amount));
  drawLine("TVQ (9,975%)", fmt(data.tvq_amount));
  drawLine("SOLDE À PAYER", fmt(data.total), { bold: true, bg: [15, 23, 42], size: 10 });

  // Brief note (NO receipt section)
  y += 4;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
  doc.text("Un reçu de paiement distinct sera émis lors de la confirmation du paiement.", m, y);

  // FOOTER
  doc.setFillColor(15, 23, 42);
  doc.rect(0, ph - 20, pw, 20, "F");
  doc.setFillColor(20, 184, 166);
  doc.rect(0, ph - 20, pw, 1.5, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
  doc.text("Le cycle de facturation commence à la date de confirmation du paiement. Services prépayés — paiement requis avant activation.", m, ph - 13);
  doc.text("Aucun intérêt ni frais de réactivation pour non-renouvellement normal. Garantie équipement: 12 mois fabricant dès activation.", m, ph - 9);
  doc.setFontSize(7);
  doc.text(`${NIVRA.legalName} — ${NIVRA.address}`, pw / 2, ph - 4, { align: "center" });

  return doc.output("arraybuffer") as unknown as Uint8Array;
}

// ═══════════════════════════════════════════════════════════════════
// 2. RECEIPT — Compact payment proof (NOT invoice)
// ═══════════════════════════════════════════════════════════════════
function generateReceipt(data: any): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 20;

  // GREEN HEADER
  doc.setFillColor(22, 163, 74);
  doc.rect(0, 0, pw, 36, "F");
  doc.setFillColor(34, 197, 94);
  doc.rect(0, 36, pw, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
  doc.text(NIVRA.legalName, m, 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(220, 252, 231);
  doc.text(NIVRA.address, m, 21);
  doc.text(`${NIVRA.email} | ${NIVRA.website}`, m, 27);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(255, 255, 255);
  doc.text("REÇU DE PAIEMENT", pw - m, 16, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(220, 252, 231);
  doc.text(`NEQ: ${NIVRA.neq}`, pw - m, 24, { align: "right" });

  let y = 48;
  const cardW = 140;
  const cardX = (pw - cardW) / 2;

  // Receipt number banner
  doc.setFillColor(22, 163, 74);
  doc.roundedRect(cardX, y, cardW, 14, 3, 3, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text(`Reçu Nº ${data.payment_number}`, pw / 2, y + 9, { align: "center" });
  y += 22;

  // Payment info card
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208); doc.setLineWidth(0.5);
  doc.roundedRect(cardX, y, cardW, 54, 3, 3, "FD");
  doc.setLineWidth(0.2);

  let fy = y + 10;
  const drawField = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
    doc.text(label, cardX + 12, fy);
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(bold ? 10 : 9); doc.setTextColor(15, 23, 42);
    doc.text(value, cardX + cardW - 12, fy, { align: "right" });
    fy += 9;
  };

  drawField("Date de paiement", fmtDate(data.payment_date));
  drawField("Mode de paiement", fmtPayMethod(data.payment_method));
  drawField("Montant payé", fmt(data.amount_paid), true);

  doc.setDrawColor(187, 247, 208);
  doc.line(cardX + 12, fy - 3, cardX + cardW - 12, fy - 3);
  fy += 3;

  drawField("Facture Nº", data.invoice_number);
  drawField("Total facture", fmt(data.invoice_total));

  y += 62;

  // Client reference card
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(cardX, y, cardW, 28, 3, 3, "F");
  fy = y + 8;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(15, 23, 42);
  doc.text("CLIENT", cardX + 12, fy); fy += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(30, 41, 59);
  doc.text(data.client_name, cardX + 12, fy); fy += 5;
  doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
  doc.text(`${data.client_email} | Compte: ${data.account_number}`, cardX + 12, fy);

  y += 38;

  // Legal note
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
  doc.text("Ce reçu confirme la réception du paiement. Il ne remplace pas la facture officielle.", cardX, y);
  doc.text(`Pour toute question : ${NIVRA.email}`, cardX, y + 4);

  // GREEN FOOTER
  doc.setFillColor(22, 163, 74);
  doc.rect(0, ph - 16, pw, 16, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
  doc.text(`${NIVRA.legalName} — ${NIVRA.address}`, pw / 2, ph - 10, { align: "center" });
  doc.text(`${NIVRA.tps} | ${NIVRA.tvq}`, pw / 2, ph - 5.5, { align: "center" });

  return doc.output("arraybuffer") as unknown as Uint8Array;
}

// ═══════════════════════════════════════════════════════════════════
// 3. ORDER SUMMARY — Pre-billing confirmation (card layout, NOT invoice)
// ═══════════════════════════════════════════════════════════════════
function generateOrderSummary(data: any): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 15;
  const cw = pw - m * 2;

  // BLUE HEADER
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pw, 34, "F");
  doc.setFillColor(96, 165, 250);
  doc.rect(0, 34, pw, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
  doc.text("NIVRA TELECOM", m, 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(191, 219, 254);
  doc.text("Confirmation de votre commande", m, 21);
  doc.text(`${NIVRA.email} | ${NIVRA.website}`, m, 27);
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
  doc.text("SOMMAIRE DE COMMANDE", pw - m, 14, { align: "right" });

  let y = 44;

  // Order banner
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(m, y, cw, 18, 3, 3, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(15, 23, 42);
  doc.text(`Commande #${data.order_number}`, m + 8, y + 8);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
  doc.text(`Passée le ${fmtDate(data.order_date)}`, m + 8, y + 14);

  // Status pill
  const statusLabel = data.order_status === "confirmed" || data.order_status === "paid" ? "CONFIRMÉE" : "EN ATTENTE";
  const statusColor = data.order_status === "confirmed" || data.order_status === "paid" ? [22, 163, 74] : [245, 158, 11];
  const pillW = 30;
  doc.setFillColor(...statusColor as [number, number, number]);
  doc.roundedRect(pw - m - pillW - 4, y + 5, pillW, 8, 4, 4, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(255, 255, 255);
  doc.text(statusLabel, pw - m - pillW / 2 - 4, y + 10.5, { align: "center" });
  y += 24;

  // CLIENT + DELIVERY (2 cards)
  const colW2 = (cw - 6) / 2;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254); doc.setLineWidth(0.3);
  doc.roundedRect(m, y, colW2, 36, 2, 2, "FD");
  doc.setLineWidth(0.2);

  let ly = y + 7;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(37, 99, 235);
  doc.text("VOS INFORMATIONS", m + 6, ly); ly += 7;
  const clientFields = [["Nom", data.client_name], ["Courriel", data.client_email], ["Compte", data.account_number]];
  clientFields.forEach(([label, value]: any) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
    doc.text(label, m + 6, ly);
    doc.setFontSize(8); doc.setTextColor(30, 41, 59);
    doc.text((value || "—").substring(0, 30), m + 6, ly + 4);
    ly += 9;
  });

  const rx2 = m + colW2 + 6;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254); doc.setLineWidth(0.3);
  doc.roundedRect(rx2, y, colW2, 36, 2, 2, "FD");
  doc.setLineWidth(0.2);
  let ry2 = y + 7;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(37, 99, 235);
  doc.text("LIVRAISON", rx2 + 6, ry2); ry2 += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100, 116, 139);
  doc.text("Adresse de service", rx2 + 6, ry2);
  doc.setFontSize(7.5); doc.setTextColor(30, 41, 59);
  const addrLines = doc.splitTextToSize(data.address || "—", colW2 - 14);
  doc.text(addrLines.slice(0, 2), rx2 + 6, ry2 + 4);

  y += 42;

  // SERVICES — card-based (NOT table)
  if (data.lines && data.lines.length > 0) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(37, 99, 235);
    doc.text("Ce que vous avez commandé", m, y + 4);
    y += 10;

    data.lines.forEach((line: any) => {
      if (line.line_total < 0) return; // Skip discounts here
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3);
      doc.roundedRect(m, y, cw, 14, 2, 2, "FD");
      doc.setLineWidth(0.2);

      // Type badge
      const type = (line.line_type || "service").toUpperCase();
      doc.setFillColor(37, 99, 235);
      doc.roundedRect(m + 4, y + 3, 24, 5, 1, 1, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(5.5); doc.setTextColor(255, 255, 255);
      doc.text(type.substring(0, 10), m + 16, y + 6.5, { align: "center" });

      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(15, 23, 42);
      doc.text((line.description || "—").substring(0, 45), m + 32, y + 7);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(37, 99, 235);
      doc.text(fmt(line.line_total), pw - m - 4, y + 7, { align: "right" });
      y += 16;
    });
  }

  // ESTIMATED TOTAL (blue card)
  y += 4;
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(pw / 2, y, pw / 2 - m, 20, 3, 3, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(191, 219, 254);
  doc.text("Sous-total", pw / 2 + 8, y + 7);
  doc.text(fmt(data.subtotal), pw - m - 8, y + 7, { align: "right" });
  doc.setDrawColor(96, 165, 250);
  doc.line(pw / 2 + 8, y + 10, pw - m - 8, y + 10);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text("Total estimé (taxes incl.)", pw / 2 + 8, y + 16);
  doc.text(fmt(data.total), pw - m - 8, y + 16, { align: "right" });

  y += 28;

  // Next steps
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(253, 224, 71); doc.setLineWidth(0.3);
  doc.roundedRect(m, y, cw, 18, 2, 2, "FD");
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(161, 98, 7);
  doc.text("PROCHAINES ÉTAPES", m + 6, y + 7);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(120, 83, 9);
  doc.text("1. Confirmation de paiement → 2. Activation du service → 3. Facture officielle et contrat", m + 6, y + 12);
  doc.text(`Pour toute question : ${NIVRA.email}`, m + 6, y + 16);

  // BLUE FOOTER
  doc.setFillColor(37, 99, 235);
  doc.rect(0, ph - 14, pw, 14, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
  doc.text(`${NIVRA.legalName} — ${NIVRA.address}`, pw / 2, ph - 9, { align: "center" });
  doc.text("Ce sommaire est un document informatif et ne constitue pas une facture.", pw / 2, ph - 5, { align: "center" });

  return doc.output("arraybuffer") as unknown as Uint8Array;
}

// ═══════════════════════════════════════════════════════════════════
// 4. CONTRACT — Legal agreement with mandatory clauses
// ═══════════════════════════════════════════════════════════════════
function generateContract(data: any): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 15;
  const cw = pw - m * 2;

  // NAVY HEADER
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pw, 28, "F");
  doc.setFillColor(20, 184, 166);
  doc.rect(0, 28, pw, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
  doc.text(NIVRA.legalName, m, 12);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(180, 190, 210);
  doc.text(NIVRA.address, m, 19);
  doc.text(NIVRA.email, m, 24);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(20, 184, 166);
  doc.text("CONTRAT DE SERVICE", pw - m, 14, { align: "right" });

  let y = 36;

  // Contract ID banner
  doc.setFillColor(0, 102, 204);
  doc.roundedRect(m, y, cw, 16, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(`Contrat Nº CTR-${data.order_number}`, pw / 2, y + 7, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(`Date: ${fmtDate(data.order_date)} | Commande: ${data.order_number}`, pw / 2, y + 13, { align: "center" });
  y += 22;

  // Client info section
  doc.setFillColor(248, 250, 252);
  doc.rect(m, y, cw, 7, "F");
  doc.setFillColor(20, 184, 166);
  doc.rect(m, y, 3, 7, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
  doc.text("INFORMATIONS DU CLIENT", m + 7, y + 5);
  y += 10;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(m, y, cw, 36, 2, 2, "F");
  let fy = y + 6;
  const cFields = [["Nom complet", data.client_name], ["Courriel", data.client_email], ["Téléphone", data.client_phone || "—"], ["Adresse de service", data.address || "—"], ["N° compte", data.account_number]];
  cFields.forEach(([label, value]: any) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
    doc.text(`${label}:`, m + 5, fy);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(30, 41, 59);
    doc.text((value || "—").substring(0, 55), m + 48, fy);
    fy += 6;
  });
  y += 40;

  // Services section
  if (data.lines && data.lines.length > 0) {
    doc.setFillColor(248, 250, 252);
    doc.rect(m, y, cw, 7, "F");
    doc.setFillColor(20, 184, 166);
    doc.rect(m, y, 3, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
    doc.text("SERVICES SOUSCRITS", m + 7, y + 5);
    y += 10;

    data.lines.filter((l: any) => l.line_total >= 0).forEach((line: any, i: number) => {
      if (i % 2 === 0) { doc.setFillColor(250, 250, 252); doc.rect(m, y - 1, cw, 7, "F"); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(30, 41, 59);
      doc.text((line.description || "—").substring(0, 55), m + 5, y + 4);
      doc.setFont("helvetica", "bold");
      doc.text(fmt(line.line_total), pw - m - 3, y + 4, { align: "right" });
      y += 7;
    });
    y += 5;
  }

  // Financial reference (brief — NOT duplicating invoice)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3);
  doc.roundedRect(m, y, cw, 14, 2, 2, "FD");
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(15, 23, 42);
  doc.text("RÉFÉRENCE FINANCIÈRE", m + 5, y + 6);
  doc.setFont("helvetica", "italic"); doc.setFontSize(6.5); doc.setTextColor(100, 116, 139);
  doc.text("Le détail complet des montants, taxes et frais est présenté sur la facture officielle jointe.", m + 5, y + 11);
  y += 18;

  // Footer for page 1
  doc.setFillColor(15, 23, 42);
  doc.rect(0, ph - 14, pw, 14, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
  doc.text(`${NIVRA.legalName} — ${NIVRA.address}`, pw / 2, ph - 9, { align: "center" });
  doc.text(`NEQ: ${NIVRA.neq} | ${NIVRA.tps} | ${NIVRA.tvq}`, pw / 2, ph - 5, { align: "center" });
  doc.setFontSize(7);
  doc.text("Page 1 / 2", pw - m, ph - 7, { align: "right" });

  // === PAGE 2: CONDITIONS GÉNÉRALES ===
  doc.addPage();
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, pw, ph, "F");

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pw, 28, "F");
  doc.setFillColor(20, 184, 166);
  doc.rect(0, 28, pw, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
  doc.text(NIVRA.legalName, m, 12);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(180, 190, 210);
  doc.text(NIVRA.address, m, 19);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(20, 184, 166);
  doc.text("CONDITIONS GÉNÉRALES", pw - m, 14, { align: "right" });

  y = 36;

  const terms = [
    { title: "1. DURÉE ET RÉSILIATION", content: "Le présent contrat est sans engagement. Le client peut résilier en tout temps avec un préavis de 30 jours. Aucuns frais de résiliation." },
    { title: "2. PAIEMENT ET FACTURATION", content: "Services prépayés. Le paiement doit être confirmé avant activation ou renouvellement. Sans paiement à la date de cycle, le service expire." },
    { title: "3. PAIEMENT AUTOMATIQUE (AUTOPAY)", content: "Le client peut activer le prélèvement automatique mensuel. Un rabais de 5,00 $/mois est appliqué tant que l'autopay est actif. Ce rabais est retiré immédiatement si l'autopay est désactivé et n'est jamais rétroactif." },
    { title: "4. SUSPENSION POUR NON-PAIEMENT", content: "Sans paiement au renouvellement, le service passe à « Expiré ». Après 90 jours, le numéro peut devenir irrécupérable. Intérêts de 5%/mois + 15$ frais de réactivation UNIQUEMENT en cas de litige bancaire." },
    { title: "5. ÉQUIPEMENT", content: "L'équipement demeure propriété de Nivra et doit être retourné en bon état à la résiliation. Garantie fabricant de 12 mois." },
    { title: "6. MODIFICATIONS TARIFAIRES", content: "Nivra peut modifier les tarifs avec 30 jours de préavis écrit. Le client peut résilier sans frais s'il refuse les modifications." },
    { title: "7. LIMITATION DE RESPONSABILITÉ", content: "Nivra n'est pas responsable des dommages indirects. Responsabilité limitée aux frais payés au cours des 3 derniers mois. Disponibilité cible: 99,5%." },
    { title: "8. LOI APPLICABLE", content: "Ce contrat est régi par les lois du Québec et les lois fédérales du Canada. Juridiction exclusive: tribunaux du Québec, district de Laval." },
  ];

  terms.forEach(term => {
    if (y > ph - 40) return;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(15, 23, 42);
    doc.text(term.title, m, y);
    y += 4;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(term.content, cw);
    doc.text(lines, m, y);
    y += lines.length * 3.5 + 5;
  });

  // Signature section
  y += 5;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
  doc.text("ACCEPTATION", m, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(30, 41, 59);
  doc.text("En procédant à la commande, le client confirme avoir lu et accepté les conditions ci-dessus.", m, y);
  y += 10;

  const boxW = (cw - 15) / 2;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(m, y, boxW, 30, 2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(15, 23, 42);
  doc.text("CLIENT", m + 5, y + 8);
  doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(0, 102, 204);
  doc.text(data.client_name, m + 10, y + 18);
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(100, 116, 139);
  doc.text(`Accepté le: ${fmtDate(data.order_date)}`, m + 10, y + 24);

  const agentX = m + boxW + 15;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(agentX, y, boxW, 30, 2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(15, 23, 42);
  doc.text("REPRÉSENTANT NIVRA", agentX + 5, y + 8);
  doc.setDrawColor(100, 116, 139);
  doc.line(agentX + 10, y + 20, agentX + boxW - 10, y + 20);
  doc.setFontSize(6.5); doc.setTextColor(100, 116, 139);
  doc.text("Signature", agentX + 10, y + 25);

  // Footer page 2
  doc.setFillColor(15, 23, 42);
  doc.rect(0, ph - 14, pw, 14, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
  doc.text(`${NIVRA.legalName} — ${NIVRA.address}`, pw / 2, ph - 9, { align: "center" });
  doc.text(`NEQ: ${NIVRA.neq} | ${NIVRA.tps} | ${NIVRA.tvq}`, pw / 2, ph - 5, { align: "center" });
  doc.setFontSize(7);
  doc.text("Page 2 / 2", pw - m, ph - 7, { align: "right" });

  return doc.output("arraybuffer") as unknown as Uint8Array;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    const { email } = await req.json();
    if (!email) throw new Error("Missing email");

    // Get latest real invoice with lines
    const { data: invoice } = await supabase
      .from("billing_invoices")
      .select("*, billing_customers(first_name, last_name, email, phone)")
      .eq("environment", "live")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!invoice) throw new Error("No live invoice found");

    const { data: lines } = await supabase
      .from("billing_invoice_lines")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("created_at", { ascending: true });

    const { data: payment } = await supabase
      .from("billing_payments")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", invoice.order_id)
      .maybeSingle();

    const { data: account } = await supabase
      .from("accounts")
      .select("account_number")
      .eq("client_id", order?.user_id)
      .maybeSingle();

    const customer = invoice.billing_customers as any;
    const clientName = `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim();

    const positiveLines = (lines || []).filter((l: any) => l.line_total >= 0);
    const discountLines = (lines || []).filter((l: any) => l.line_total < 0);

    const commonData = {
      client_name: clientName,
      client_email: customer?.email || "",
      client_phone: customer?.phone || "",
      account_number: account?.account_number || invoice.billing_snapshot_account_number || "—",
      address: order?.shipping_address ? `${order.shipping_address}, ${order.shipping_city || ""}, QC ${order.shipping_postal_code || ""}` : "—",
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.created_at,
      due_date: invoice.due_date,
      cycle_start: invoice.cycle_start_date,
      cycle_end: invoice.cycle_end_date,
      status: invoice.status,
      subtotal: invoice.subtotal,
      tps_amount: invoice.tps_amount,
      tvq_amount: invoice.tvq_amount,
      total: invoice.total,
      discount_total: discountLines.reduce((s: number, l: any) => s + l.line_total, 0),
      lines: positiveLines,
      discounts: discountLines,
      order_number: order?.order_number?.toString() || "—",
      order_date: order?.created_at || invoice.created_at,
      order_status: order?.status || "confirmed",
      payment_method: payment?.method || order?.payment_method || "Interac",
      payment_number: payment?.payment_number || payment?.reference || invoice.invoice_number,
      payment_date: payment?.received_at || payment?.created_at || invoice.paid_at,
      amount_paid: payment?.amount || invoice.amount_paid || invoice.total,
      invoice_total: invoice.total,
    };

    // Generate 4 distinct PDFs
    const invoicePdf = generateInvoice(commonData);
    const receiptPdf = generateReceipt(commonData);
    const summaryPdf = generateOrderSummary(commonData);
    const contractPdf = generateContract(commonData);

    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    // Send 4 separate emails
    const docs = [
      { name: "Facture", filename: `Facture_${invoice.invoice_number}_Nivra.pdf`, pdf: invoicePdf, subject: `Nivra Telecom — Facture ${invoice.invoice_number}` },
      { name: "Reçu de paiement", filename: `Recu_${commonData.payment_number}_Nivra.pdf`, pdf: receiptPdf, subject: `Nivra Telecom — Reçu de paiement` },
      { name: "Sommaire de commande", filename: `Sommaire_${commonData.order_number}_Nivra.pdf`, pdf: summaryPdf, subject: `Nivra Telecom — Sommaire de commande #${commonData.order_number}` },
      { name: "Contrat de service", filename: `Contrat_CTR-${commonData.order_number}_Nivra.pdf`, pdf: contractPdf, subject: `Nivra Telecom — Contrat de service` },
    ];

    const results = [];
    for (const d of docs) {
      const base64 = btoa(String.fromCharCode(...new Uint8Array(d.pdf)));
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Nivra Telecom <no-reply@nivra-telecom.ca>",
          to: [email],
          subject: d.subject,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <div style="background:#0F172A;padding:20px;border-radius:8px 8px 0 0;">
              <h1 style="color:white;margin:0;font-size:18px;">NIVRA COMMUNICATIONS INC.</h1>
              <p style="color:#94a3b8;margin:4px 0 0;font-size:12px;">Service à la clientèle — Division facturation</p>
            </div>
            <div style="padding:24px;border:1px solid #e2e8f0;border-top:none;">
              <h2 style="color:#0F172A;margin:0 0 12px;font-size:16px;">${d.name}</h2>
              <p style="color:#334155;line-height:1.6;">Bonjour ${clientName},</p>
              <p style="color:#334155;line-height:1.6;">Veuillez trouver ci-joint votre <strong>${d.name.toLowerCase()}</strong>.</p>
              <p style="color:#334155;line-height:1.6;">Pour consulter votre dossier ou gérer votre compte, visitez votre <a href="https://nivra-telecom.ca/portal" style="color:#14B8A6;">portail client</a>.</p>
              <p style="color:#64748b;font-size:13px;margin-top:24px;">Cordialement,<br/>L'équipe Nivra Telecom</p>
            </div>
            <div style="background:#f8fafc;padding:16px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
              <p style="color:#94a3b8;font-size:11px;margin:0;">NIVRA COMMUNICATIONS INC. — 1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5<br/>Support@nivra-telecom.ca | www.nivra-telecom.ca</p>
            </div>
          </div>`,
          attachments: [{ filename: d.filename, content: base64 }],
        }),
      });
      const result = await res.json();
      results.push({ doc: d.name, status: res.ok ? "sent" : "failed", id: result.id });
    }

    return new Response(JSON.stringify({ success: true, results, invoice_number: invoice.invoice_number, order_number: commonData.order_number }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
