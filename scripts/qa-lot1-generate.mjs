/**
 * QA Lot 1 — Génère les 5 PDFs avec les vraies données de Table Lakay
 * Output: /mnt/documents/qa-lot1/*.pdf
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { generateCreditNotePDF } from "../src/lib/pdf/creditNoteTemplate.ts";
import { generateRefundNoticePDF } from "../src/lib/pdf/refundNoticeTemplate.ts";
import { generateLateNoticePDF } from "../src/lib/pdf/lateNoticeTemplate.ts";
import { generateAccountStatementPDF } from "../src/lib/pdf/accountStatementTemplate.ts";
import { generateAnnualTaxSummaryPDF } from "../src/lib/pdf/annualTaxSummaryTemplate.ts";

const OUT = "/mnt/documents/qa-lot1";
mkdirSync(OUT, { recursive: true });

const client = {
  client_name: "Table Lakay",
  client_email: "tablelakay@gmail.com",
  client_phone: "(438) 792-3288",
  account_number: "200711",
  client_province: "QC",
};

const save = (name, res) => {
  if (!res.success || !res.blob) { console.error("FAIL", name, res.error); return; }
  const buf = Buffer.from(res.blob);
  writeFileSync(`${OUT}/${res.filename || name}`, buf);
  console.log("OK   ", res.filename || name);
};

// 1. Note de crédit (sur facture pending #4225368, motif: ajustement)
save("credit", generateCreditNotePDF({
  credit_note_number: "NC-2026-0001",
  issue_date: "2026-04-21",
  invoice_number: "4225368",
  ...client,
  reason: "Ajustement de service suite à interruption temporaire du service Internet survenue entre le 5 et le 7 avril 2026.",
  items: [
    { description: "Crédit prorata Internet (3 jours)", quantity: 1, unit_price: 9.00, line_total: 9.00 },
  ],
  subtotal: 9.00,
  tps_amount: 0.45,
  tvq_amount: 0.90,
  total: 10.35,
  application: "Crédit appliqué sur la prochaine facture mensuelle.",
}));

// 2. Avis de remboursement (paiement Interac échoué = refund manuel)
save("refund", generateRefundNoticePDF({
  refund_number: "REM-2026-0001",
  processed_date: "2026-04-21",
  invoice_number: "5206737",
  ...client,
  amount: 23.00,
  method: "interac",
  reference: "INT-REF-7842915",
  expected_arrival_days: 3,
}));

// 3. Avis de retard (sur facture #4225368, 218.45$ pending due 2026-04-21)
save("late", generateLateNoticePDF({
  notice_number: "AR-2026-0001",
  notice_date: "2026-04-21",
  stage: "first",
  invoice_number: "4225368",
  invoice_date: "2026-04-18",
  due_date: "2026-04-21",
  ...client,
  amount_due: 218.45,
  days_late: 0,
  late_fee: 0,
  suspension_date: "2026-05-05",
}));

// 4. Relevé de compte (3 factures + 2 paiements confirmés)
save("statement", generateAccountStatementPDF({
  statement_number: "REL-2026-0421",
  period_start: "2026-03-01",
  period_end: "2026-04-21",
  issue_date: "2026-04-21",
  ...client,
  opening_balance: 0,
  transactions: [
    { date: "2026-03-21", type: "invoice", reference: "5206737", description: "Facture initiale (Mobile + GIGA TV + équipement)", debit: 137.97, credit: 0 },
    { date: "2026-03-21", type: "payment", reference: "PAY-001", description: "Paiement manuel reçu", debit: 0, credit: 160.97 },
    { date: "2026-03-21", type: "invoice", reference: "8890186", description: "Facture additionnelle (Mobile second ligne)", debit: 57.49, credit: 0 },
    { date: "2026-03-21", type: "payment", reference: "PAY-002", description: "Paiement PayPal reçu", debit: 0, credit: 57.49 },
    { date: "2026-04-18", type: "invoice", reference: "4225368", description: "Facture renouvellement avril (Mobile + GIGA TV)", debit: 218.45, credit: 0 },
  ],
  closing_balance: 195.45,
}));

// 5. Sommaire fiscal annuel 2026 (basé sur les 3 factures payees/dues)
save("tax_summary", generateAnnualTaxSummaryPDF({
  summary_number: "FISC-2026",
  fiscal_year: 2026,
  issue_date: "2026-04-21",
  ...client,
  monthly_breakdown: [
    { month: "Janvier", subtotal: 0, tps: 0, tvq: 0, total: 0 },
    { month: "Février", subtotal: 0, tps: 0, tvq: 0, total: 0 },
    { month: "Mars", subtotal: 170.00, tps: 8.50, tvq: 16.96, total: 195.46 },
    { month: "Avril", subtotal: 190.00, tps: 9.50, tvq: 18.95, total: 218.45 },
    { month: "Mai", subtotal: 0, tps: 0, tvq: 0, total: 0 },
    { month: "Juin", subtotal: 0, tps: 0, tvq: 0, total: 0 },
    { month: "Juillet", subtotal: 0, tps: 0, tvq: 0, total: 0 },
    { month: "Août", subtotal: 0, tps: 0, tvq: 0, total: 0 },
    { month: "Septembre", subtotal: 0, tps: 0, tvq: 0, total: 0 },
    { month: "Octobre", subtotal: 0, tps: 0, tvq: 0, total: 0 },
    { month: "Novembre", subtotal: 0, tps: 0, tvq: 0, total: 0 },
    { month: "Décembre", subtotal: 0, tps: 0, tvq: 0, total: 0 },
  ],
  totals: { subtotal: 360.00, tps: 18.00, tvq: 35.91, total: 413.91 },
}));

console.log("\nDone — PDFs in", OUT);
