/**
 * test-pdf-emails — One-shot test that sends 5 emails (each with a PDF
 * attachment) using REAL records from the database to validate the PDF
 * attachment pipeline introduced by FIX 1-5.
 *
 * Recipients: nivratelecom@gmail.com + support@nivra-telecom.ca
 *
 * Returns a JSON report of all 5 tests.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildInvoicePdfAttachment,
  buildReceiptPdfAttachment,
  buildContractPdfAttachment,
  buildSummaryPdfAttachment,
} from "../_shared/pdfFromDb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEST_RECIPIENTS = ["nivratelecom@gmail.com", "support@nivra-telecom.ca"];
const FROM = "Nivra Telecom <support@nivra-telecom.ca>";

interface TestResult {
  test: string;
  record: { id: string; number: string };
  pdfGenerated: boolean;
  pdfSize?: number;
  emailQueued: boolean;
  queueIds?: string[];
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: TestResult[] = [];
  const ts = Date.now();

  async function queueEmail(
    label: string,
    subject: string,
    html: string,
    attachment: { filename: string; content: string; contentType: string } | null,
  ): Promise<{ queued: boolean; ids: string[]; error?: string }> {
    if (!attachment) return { queued: false, ids: [], error: "No PDF attachment" };
    const ids: string[] = [];
    for (const to of TEST_RECIPIENTS) {
      const { data, error } = await supabase
        .from("email_queue")
        .insert({
          event_key: `test_pdf_${label}_${to}_${ts}`,
          to_email: to,
          from_email: FROM,
          subject,
          template_key: "custom_html",
          template_vars: { html, subject },
          attachments: [attachment],
          message_type: "test_pdf_attachment",
          status: "queued",
        })
        .select("id")
        .single();
      if (error) return { queued: false, ids, error: error.message };
      ids.push(data!.id);
    }
    return { queued: true, ids };
  }

  // ── TEST 1 — Payment receipt PDF ───────────────────────────────
  try {
    const { data: inv } = await supabase
      .from("billing_invoices")
      .select("id, invoice_number, order_id")
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!inv) throw new Error("No paid invoice found");

    const pdf = await buildReceiptPdfAttachment(inv.id, "TEST-recu-paiement");
    const subject = `[TEST] Reçu de paiement — Facture ${inv.invoice_number}`;
    const html = `<p>Test reçu paiement — facture <b>${inv.invoice_number}</b>. PDF en pièce jointe.</p>`;
    const sent = await queueEmail("receipt", subject, html, pdf);

    results.push({
      test: "TEST 1 — Payment receipt",
      record: { id: inv.id, number: inv.invoice_number },
      pdfGenerated: !!pdf,
      pdfSize: pdf?.content.length,
      emailQueued: sent.queued,
      queueIds: sent.ids,
      error: sent.error,
    });
  } catch (e: any) {
    results.push({
      test: "TEST 1 — Payment receipt",
      record: { id: "?", number: "?" },
      pdfGenerated: false,
      emailQueued: false,
      error: e.message,
    });
  }

  // ── TEST 2 — Invoice PDF ───────────────────────────────────────
  try {
    const { data: inv } = await supabase
      .from("billing_invoices")
      .select("id, invoice_number, order_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!inv) throw new Error("No invoice found");

    const pdf = await buildInvoicePdfAttachment(inv.id, "TEST-facture");
    const subject = `[TEST] Facture ${inv.invoice_number}`;
    const html = `<p>Test facture <b>${inv.invoice_number}</b>. PDF en pièce jointe.</p>`;
    const sent = await queueEmail("invoice", subject, html, pdf);

    results.push({
      test: "TEST 2 — Invoice",
      record: { id: inv.id, number: inv.invoice_number },
      pdfGenerated: !!pdf,
      pdfSize: pdf?.content.length,
      emailQueued: sent.queued,
      queueIds: sent.ids,
      error: sent.error,
    });
  } catch (e: any) {
    results.push({
      test: "TEST 2 — Invoice",
      record: { id: "?", number: "?" },
      pdfGenerated: false,
      emailQueued: false,
      error: e.message,
    });
  }

  // ── TEST 3 — Contract PDF ──────────────────────────────────────
  try {
    const { data: ord } = await supabase
      .from("orders")
      .select("id, order_number")
      .not("status", "in", "(cancelled,draft)")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!ord) throw new Error("No eligible order found for contract");

    const pdf = await buildContractPdfAttachment(ord.id, {
      contractNumber: `CTR-TEST-${ord.order_number}`,
      filenamePrefix: "TEST-contrat-service",
    });
    const subject = `[TEST] Contrat de service — Commande ${ord.order_number}`;
    const html = `<p>Test contrat — commande <b>${ord.order_number}</b>. PDF en pièce jointe.</p>`;
    const sent = await queueEmail("contract", subject, html, pdf);

    results.push({
      test: "TEST 3 — Contract",
      record: { id: ord.id, number: ord.order_number },
      pdfGenerated: !!pdf,
      pdfSize: pdf?.content.length,
      emailQueued: sent.queued,
      queueIds: sent.ids,
      error: sent.error,
    });
  } catch (e: any) {
    results.push({
      test: "TEST 3 — Contract",
      record: { id: "?", number: "?" },
      pdfGenerated: false,
      emailQueued: false,
      error: e.message,
    });
  }

  // ── TEST 4 — Service activation PDF ────────────────────────────
  try {
    const { data: ord } = await supabase
      .from("orders")
      .select("id, order_number")
      .in("status", ["activated", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!ord) throw new Error("No activated/completed order found");

    const pdf = await buildSummaryPdfAttachment(ord.id, "TEST-confirmation-activation");
    const subject = `[TEST] Service activé — Commande ${ord.order_number}`;
    const html = `<p>Test activation service — commande <b>${ord.order_number}</b>. Sommaire PDF en pièce jointe.</p>`;
    const sent = await queueEmail("activation", subject, html, pdf);

    results.push({
      test: "TEST 4 — Service activation",
      record: { id: ord.id, number: ord.order_number },
      pdfGenerated: !!pdf,
      pdfSize: pdf?.content.length,
      emailQueued: sent.queued,
      queueIds: sent.ids,
      error: sent.error,
    });
  } catch (e: any) {
    results.push({
      test: "TEST 4 — Service activation",
      record: { id: "?", number: "?" },
      pdfGenerated: false,
      emailQueued: false,
      error: e.message,
    });
  }

  // ── TEST 5 — Shipment PDF ──────────────────────────────────────
  try {
    const { data: ord } = await supabase
      .from("orders")
      .select("id, order_number, tracking_number")
      .not("tracking_number", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!ord) throw new Error("No order with tracking_number found");

    const pdf = await buildSummaryPdfAttachment(ord.id, "TEST-expedition");
    const subject = `[TEST] Expédition — Commande ${ord.order_number}`;
    const html = `<p>Test expédition — commande <b>${ord.order_number}</b>. Suivi: <b>${ord.tracking_number}</b>. Sommaire PDF en pièce jointe.</p>`;
    const sent = await queueEmail("shipment", subject, html, pdf);

    results.push({
      test: "TEST 5 — Shipment",
      record: { id: ord.id, number: `${ord.order_number} (${ord.tracking_number})` },
      pdfGenerated: !!pdf,
      pdfSize: pdf?.content.length,
      emailQueued: sent.queued,
      queueIds: sent.ids,
      error: sent.error,
    });
  } catch (e: any) {
    results.push({
      test: "TEST 5 — Shipment",
      record: { id: "?", number: "?" },
      pdfGenerated: false,
      emailQueued: false,
      error: e.message,
    });
  }

  return new Response(
    JSON.stringify(
      {
        recipients: TEST_RECIPIENTS,
        ran_at: new Date().toISOString(),
        results,
      },
      null,
      2,
    ),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
