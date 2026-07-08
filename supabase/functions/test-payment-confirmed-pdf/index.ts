/**
 * One-shot test: send a REAL payment_confirmed email through the canonical
 * Violet Bold template path (`queueRenderedEmail`) WITH the invoice PDF
 * attached. Recipient: support@nivra-telecom.ca.
 *
 * Uses the most recent paid invoice from billing_invoices.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { queueRenderedEmail } from "../_shared/templateRenderer.ts";
import { buildReceiptPdfAttachment } from "../_shared/pdfFromDb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const result: Record<string, unknown> = { steps: [] as unknown[] };
  const steps = result.steps as unknown[];

  try {
    // STEP 1 â€” find most recent paid invoice
    const { data: inv, error: invErr } = await supabase
      .from("billing_invoices")
      .select("id, invoice_number, order_id, total, paid_at, customer_id")
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (invErr || !inv) throw new Error(`No paid invoice: ${invErr?.message}`);
    steps.push({ step: 1, found_invoice: inv.invoice_number, id: inv.id });

    // STEP 2 â€” build PDF
    const pdf = await buildReceiptPdfAttachment(inv.id, "recu-paiement");
    steps.push({ step: 2, pdf_generated: !!pdf, pdf_size: pdf?.content.length });
    if (!pdf) throw new Error("PDF generation failed");

    // STEP 3 â€” fetch client name
    const { data: cust } = await supabase
      .from("billing_customers")
      .select("first_name, last_name, email")
      .eq("id", inv.customer_id)
      .single();
    const clientName = cust ? `${cust.first_name} ${cust.last_name}`.trim() : "Client";

    // STEP 4 â€” send through canonical Violet Bold template
    const eventKey = `test_payment_confirmed_pdf_${inv.id}_${Date.now()}`;
    const sendRes = await queueRenderedEmail({
      eventKey,
      templateKey: "payment_confirmed",
      toEmail: "support@nivra-telecom.ca",
      templateVars: {
        client_name: clientName,
        invoice_number: inv.invoice_number,
        order_number: inv.order_id?.slice(0, 8) || "â€”",
        amount_paid_today: inv.total,
        payment_method: "Square",
        payment_date: inv.paid_at,
        reference: inv.invoice_number,
      },
      attachments: [pdf],
    });
    steps.push({ step: 3, queue_success: sendRes.success, message_id: sendRes.id, error: sendRes.error });

    result.success = sendRes.success;
    result.invoice_used = inv.invoice_number;
    result.recipient = "support@nivra-telecom.ca";
  } catch (e) {
    result.success = false;
    result.error = e.message;
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
