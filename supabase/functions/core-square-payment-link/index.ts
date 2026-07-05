/**
 * core-square-payment-link
 * Creates a field_payment_intent linked to an existing billing invoice or order,
 * optionally sends the payment URL by email, and returns the URL.
 *
 * Body: { invoice_id?, order_id?, customer_email?, customer_name?, mode?: 'email'|'direct' }
 * Returns: { ok, payment_url, email_sent }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://nivra-telecom.ca";
const SYSTEM_AGENT_ID = "00000000-0000-0000-0000-000000000001";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { invoice_id: rawInvoiceId, order_id, customer_email, customer_name, mode } = body;

    // Resolve invoice_id from order_id when available, but do not require it:
    // some Core orders exist before their billing invoice is materialized.
    let invoice_id: string | null = rawInvoiceId ?? null;
    let order: any = null;
    if (!invoice_id && order_id) {
      const { data: orderRow, error: orderErr } = await supabase
        .from("orders")
        .select(
          "id, order_number, total_amount, client_email, client_first_name, client_last_name, " +
          "client_phone, client_full_address, status, payment_status, service_type, equipment_details, " +
          "equipment_line_details, pricing_snapshot, selected_channels, created_at",
        )
        .eq("id", order_id)
        .maybeSingle();

      if (orderErr) {
        console.error("[core-square-payment-link] order lookup error:", orderErr);
      }
      if (orderRow) order = orderRow;

      const { data: invRow, error: invLookupErr } = await supabase
        .from("billing_invoices")
        .select("id, balance_due, total, status, created_at")
        .eq("order_id", order_id)
        .gt("balance_due", 0)
        .not("status", "in", "(paid,cancelled,void)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (invLookupErr) {
        console.error("[core-square-payment-link] order→invoice lookup error:", invLookupErr);
      }
      if (invRow?.id) invoice_id = invRow.id;
    }

    if (!invoice_id && !order) {
      return json({ ok: false, error: "Commande introuvable pour créer le lien Square" });
    }

    // Try to extract caller's user_id from JWT (for agent_id audit trail)
    let agentId = SYSTEM_AGENT_ID;
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user?.id) agentId = user.id;
      } catch { /* use system fallback */ }
    }

    // Load invoice to get amount + customer data when present.
    let inv: any = null;
    if (invoice_id) {
      const { data: invRow, error: invErr } = await supabase
        .from("billing_invoices")
        .select(
          "id, invoice_number, balance_due, total, customer_id, order_id, status, " +
          "customer:billing_customers(email, first_name, last_name)",
        )
        .eq("id", invoice_id)
        .single();

      if (invErr || !invRow) return json({ ok: false, error: "Facture introuvable" });
      inv = invRow;

      if (!order && inv.order_id) {
        const { data: orderRow } = await supabase
          .from("orders")
          .select(
            "id, order_number, total_amount, client_email, client_first_name, client_last_name, " +
            "client_phone, client_full_address, status, payment_status, service_type, equipment_details, " +
            "equipment_line_details, pricing_snapshot, selected_channels, created_at",
          )
          .eq("id", inv.order_id)
          .maybeSingle();
        if (orderRow) order = orderRow;
      }
    }

    const balance = Number(inv?.balance_due ?? inv?.total ?? order?.total_amount ?? 0);
    if (balance <= 0) return json({ ok: false, error: "Aucun solde à payer pour cette commande" });

    const orderAlreadyPaid = ["paid", "confirmed"].includes(String(order?.payment_status || "").toLowerCase());
    const orderCancelled = String(order?.status || "").toLowerCase() === "cancelled";
    const invoiceClosed = ["paid", "cancelled", "void"].includes(String(inv?.status || "").toLowerCase()) && Number(inv?.balance_due || 0) <= 0;
    if (invoiceClosed || orderCancelled || (!inv && orderAlreadyPaid)) {
      return json({ ok: false, error: "Cette commande est déjà payée ou fermée" });
    }

    const resolvedEmail = customer_email || order?.client_email || (inv?.customer as any)?.email || null;
    const resolvedName = customer_name ||
      [order?.client_first_name, order?.client_last_name].filter(Boolean).join(" ").trim() ||
      `${(inv?.customer as any)?.first_name || ""} ${(inv?.customer as any)?.last_name || ""}`.trim() ||
      null;
    const orderNumber = order?.order_number || inv?.invoice_number || "";
    const description = orderNumber ? `Commande #${orderNumber}` : inv?.invoice_number ? `Facture #${inv.invoice_number}` : "Paiement Nivra";
    const lineItems = [
      order?.service_type ? { name: order.service_type, type: "service", amount: balance } : null,
      ...(Array.isArray(order?.equipment_line_details) ? order.equipment_line_details : []),
    ].filter(Boolean);
    const clientEdits = order
      ? {
          first_name: order.client_first_name || "",
          last_name: order.client_last_name || "",
          phone: order.client_phone || "",
          email: resolvedEmail || "",
          address: order.client_full_address || "",
          billing_address: { address: order.client_full_address || "", province: "QC" },
        }
      : null;

    // Create field_payment_intent linked to this invoice
    const { data: intent, error: intentErr } = await supabase
      .from("field_payment_intents")
      .insert({
        agent_id: agentId,
        amount: balance,
        currency: "CAD",
        status: "pending",
        payment_method: "square",
        customer_email: resolvedEmail,
        customer_name: resolvedName,
        converted_invoice_id: invoice_id,
        converted_order_id: order?.id ?? inv?.order_id ?? null,
        description,
        line_items: lineItems.length ? lineItems : null,
        client_edits: clientEdits,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .select("id")
      .single();

    if (intentErr || !intent) {
      console.error("[core-square-payment-link] Insert error:", intentErr);
      return json({ ok: false, error: "Erreur création lien" }, 500);
    }

    const paymentUrl = `${SITE_URL}/payer/${intent.id}`;
    let emailSent = false;

    // Send email if mode = 'email' and we have an email address
    if (mode === "email" && resolvedEmail) {
      try {
        await supabase.from("email_queue").insert({
          event_key: `payment_link_${intent.id}`,
          to_email: resolvedEmail,
          template_key: "invoice_payment_link",
          template_vars: {
            client_name: resolvedName || "Client",
            first_name: order?.client_first_name || (inv?.customer as any)?.first_name || resolvedName || "Client",
            invoice_number: inv?.invoice_number || orderNumber,
            order_number: orderNumber,
            amount: balance.toFixed(2),
            payment_url: paymentUrl,
          },
          status: "queued",
          attempts: 0,
          max_attempts: 5,
        });
        emailSent = true;
      } catch (e) {
        console.warn("[core-square-payment-link] Email queue failed (non-fatal):", e);
      }
    }

    console.log("[core-square-payment-link] Created intent", intent.id, "for invoice", invoice_id);
    return json({ ok: true, payment_url: paymentUrl, intent_id: intent.id, email_sent: emailSent });

  } catch (err: any) {
    console.error("[core-square-payment-link] Fatal:", err);
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
});
