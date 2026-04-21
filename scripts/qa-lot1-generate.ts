/**
 * QA Lot 1 — Génère les 5 PDFs avec vraies données Table Lakay
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

const save = (name: string, res: any) => {
  if (!res.success || !res.blob) { console.error("FAIL", name, res.error); return; }
  // jsPDF blob in Node — convert via arrayBuffer
  res.blob.arrayBuffer().then((ab: ArrayBuffer) => {
    writeFileSync(`${OUT}/${res.filename || name}.pdf`, Buffer.from(ab));
    console.log("OK   ", res.filename || name);
  });
};

// 1. Note de credit
save("credit", generateCreditNotePDF({
  credit_note_number: "NC-2026-0001",
  issue_date: "2026-04-21",
  invoice_number: "4225368",
  invoice_date: "2026-04-18",
  ...client,
  reason: "Ajustement de service suite a interruption temporaire du service Internet survenue entre le 5 et le 7 avril 2026.",
  items: [
    { description: "Credit prorata Internet (3 jours)", amount: 9.00 },
  ],
  subtotal: 9.00,
  tps_amount: 0.45,
  tvq_amount: 0.90,
  total: 10.35,
  application_type: "account_credit",
}));

// 2. Avis de remboursement
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

// 3. Avis de retard
save("late", generateLateNoticePDF({
  notice_number: "AR-2026-0001",
  issue_date: "2026-04-21",
  stage: "first",
  invoice_number: "4225368",
  invoice_date: "2026-04-18",
  due_date: "2026-04-21",
  amount_due: 218.45,
  days_overdue: 0,
  late_fee_amount: 0,
  total_with_fees: 218.45,
  ...client,
  pay_by_date: "2026-05-05",
}));

// 4. Releve de compte
save("statement", generateAccountStatementPDF({
  statement_number: "REL-2026-0421",
  issue_date: "2026-04-21",
  period_start: "2026-03-01",
  period_end: "2026-04-21",
  ...client,
  opening_balance: 0,
  closing_balance: 195.45,
  total_invoiced: 413.91,
  total_paid: 218.46,
  total_credits: 0,
  transactions: [
    { date: "2026-03-21", reference: "5206737", description: "Facture initiale (Mobile + GIGA TV + equipement)", debit: 137.97 },
    { date: "2026-03-21", reference: "PAY-001",  description: "Paiement manuel recu",                              credit: 160.97 },
    { date: "2026-03-21", reference: "8890186", description: "Facture additionnelle (Mobile second ligne)",       debit: 57.49 },
    { date: "2026-03-21", reference: "PAY-002",  description: "Paiement PayPal recu",                              credit: 57.49 },
    { date: "2026-04-18", reference: "4225368", description: "Facture renouvellement avril (Mobile + GIGA TV)",   debit: 218.45 },
  ],
}));

// 5. Sommaire fiscal annuel
save("tax_summary", generateAnnualTaxSummaryPDF({
  summary_number: "FISC-2026",
  issue_date: "2026-04-21",
  fiscal_year: 2026,
  ...client,
  total_subtotal: 360.00,
  total_tps: 18.00,
  total_tvq: 35.91,
  total_paid: 218.46,
  total_invoice_count: 3,
  monthly: [
    { month: 1,  invoice_count: 0, subtotal: 0,      tps_amount: 0,    tvq_amount: 0,     total: 0 },
    { month: 2,  invoice_count: 0, subtotal: 0,      tps_amount: 0,    tvq_amount: 0,     total: 0 },
    { month: 3,  invoice_count: 2, subtotal: 170.00, tps_amount: 8.50, tvq_amount: 16.96, total: 195.46 },
    { month: 4,  invoice_count: 1, subtotal: 190.00, tps_amount: 9.50, tvq_amount: 18.95, total: 218.45 },
    { month: 5,  invoice_count: 0, subtotal: 0,      tps_amount: 0,    tvq_amount: 0,     total: 0 },
    { month: 6,  invoice_count: 0, subtotal: 0,      tps_amount: 0,    tvq_amount: 0,     total: 0 },
    { month: 7,  invoice_count: 0, subtotal: 0,      tps_amount: 0,    tvq_amount: 0,     total: 0 },
    { month: 8,  invoice_count: 0, subtotal: 0,      tps_amount: 0,    tvq_amount: 0,     total: 0 },
    { month: 9,  invoice_count: 0, subtotal: 0,      tps_amount: 0,    tvq_amount: 0,     total: 0 },
    { month: 10, invoice_count: 0, subtotal: 0,      tps_amount: 0,    tvq_amount: 0,     total: 0 },
    { month: 11, invoice_count: 0, subtotal: 0,      tps_amount: 0,    tvq_amount: 0,     total: 0 },
    { month: 12, invoice_count: 0, subtotal: 0,      tps_amount: 0,    tvq_amount: 0,     total: 0 },
  ],
}));

setTimeout(() => console.log("\nDone — PDFs in", OUT), 500);
