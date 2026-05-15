import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createNivraPayPalSubscription } from "../_shared/nivraPayPalSubscriptionFactory.ts";
import { enforceBillingRateLimit } from "../_shared/billingRateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CapturePayPalOrderRequest {
  paypal_order_id: string;
  invoice_id?: string;
  order_id?: string;
  customer_id?: string;
}

function normalizeEmail(email: string | undefined | null): string {
  return (email || "").trim().toLowerCase();
}

async function ensureBillingCustomer(
  supabase: any,
  email: string,
  firstName: string,
  lastName: string,
  phone?: string
): Promise<string | null> {
  const normEmail = normalizeEmail(email);
  if (!normEmail) return null;

  const { data: existing } = await supabase
    .from("billing_customers")
    .select("id")
    .eq("email", normEmail)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: newCustomer, error } = await supabase
    .from("billing_customers")
    .insert({
      email: normEmail,
      first_name: firstName || "Client",
      last_name: lastName || "PayPal",
      phone: phone || "",
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[PayPal Capture] Failed to create billing_customer:", error);
    return null;
  }
  return newCustomer.id;
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_SECRET");
  if (!clientId || !clientSecret) throw new Error("PayPal credentials not configured");

  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) throw new Error("Failed to get PayPal access token");
  const data = await response.json();
  return data.access_token;
}

// ============================================================================
// RECURRING ELIGIBILITY CHECK
// ============================================================================

const RECURRING_CATEGORIES = new Set([
  "internet", "mobile", "tv_combo", "tv_pack", "streaming", "security",
]);

function isRecurringEligible(order: any): boolean {
  if (!order) return false;
  const snapshot = order.pricing_snapshot;
  if (snapshot) {
    const category = snapshot.category || snapshot.service_category;
    if (category && RECURRING_CATEGORIES.has(category)) return true;
    if (snapshot.plan_code) return true;
  }
  const st = (order.service_type || "").toLowerCase();
  if (st.includes("internet") || st.includes("mobile") || st.includes("tv") ||
      st.includes("streaming") || st.includes("sécurité") || st.includes("security")) {
    return true;
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const rl = await enforceBillingRateLimit(req, "paypal-capture-order", corsHeaders);
  if (rl) return rl;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase: any = createClient<any>(supabaseUrl, supabaseServiceKey);

    const body: CapturePayPalOrderRequest = await req.json();
    console.log("[PayPal Capture] ▶ Capturing order:", body.paypal_order_id, "invoice_id:", body.invoice_id);

    if (!body.paypal_order_id) throw new Error("Missing paypal_order_id");

    const accessToken = await getPayPalAccessToken();

    // ── Step 1: Capture the PayPal order ────────────────────────────
    const captureResponse = await fetch(
      `https://api-m.paypal.com/v2/checkout/orders/${body.paypal_order_id}/capture`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!captureResponse.ok) {
      const error = await captureResponse.text();
      console.error("[PayPal Capture] ✗ Capture API error:", error);
      throw new Error(`PayPal capture failed: ${error}`);
    }

    const captureData = await captureResponse.json();

    // ── Step 2: Extract & validate capture data ──────────────────
    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = capture?.id;
    const amountValue = capture?.amount?.value;
    const currencyCode = capture?.amount?.currency_code;
    const customId = captureData.purchase_units?.[0]?.custom_id;
    const amount = parseFloat(amountValue || "0");
    const paypalOrderStatus = captureData.status;

    const captureProof = {
      paypal_order_id: body.paypal_order_id,
      paypal_order_status: paypalOrderStatus,
      capture_id: captureId,
      capture_status: capture?.status,
      amount_value: amountValue,
      currency_code: currencyCode,
      custom_id: customId,
      payer_email: normalizeEmail(captureData.payer?.email_address),
      payer_name: `${captureData.payer?.name?.given_name || ""} ${captureData.payer?.name?.surname || ""}`.trim(),
    };
    console.log("[PayPal Capture] ★ CAPTURE PROOF:", JSON.stringify(captureProof));

    if (paypalOrderStatus !== "COMPLETED") {
      throw new Error(`Payment not completed: ${paypalOrderStatus}`);
    }
    if (!captureId) {
      throw new Error("No capture ID in PayPal response");
    }

    // Extract payer info
    const payerEmail = normalizeEmail(captureData.payer?.email_address);
    const payerFirstName = captureData.payer?.name?.given_name || "";
    const payerLastName = captureData.payer?.name?.surname || "";
    const payerPhone = captureData.payer?.phone?.phone_number?.national_number || "";
    const payerAddress = captureData.payer?.address
      ? {
          address_line_1: captureData.payer.address.address_line_1 || "",
          address_line_2: captureData.payer.address.address_line_2 || "",
          admin_area_2: captureData.payer.address.admin_area_2 || "",
          admin_area_1: captureData.payer.address.admin_area_1 || "",
          postal_code: captureData.payer.address.postal_code || "",
          country_code: captureData.payer.address.country_code || "",
        }
      : null;

    // Ensure billing_customer exists
    let linkedCustomerId: string | null = body.customer_id || null;
    if (payerEmail && !linkedCustomerId) {
      linkedCustomerId = await ensureBillingCustomer(supabase, payerEmail, payerFirstName, payerLastName, payerPhone);
    }

    // ════════════════════════════════════════════════════════════════
    // FIELD-SALES BRIDGE — if this capture corresponds to a Field
    // payment intent, materialize the field_sales_orders row, call
    // field-sales-sync to create the canonical orders/invoice rows,
    // mark the intent paid, and queue a commission. Then return early.
    // ════════════════════════════════════════════════════════════════
    {
      const { data: fieldIntent } = await supabase
        .from("field_payment_intents")
        .select("id, quote_id, agent_id, amount, status, converted_field_order_id, customer_email, customer_name")
        .eq("paypal_order_id", body.paypal_order_id)
        .maybeSingle();

      if (fieldIntent) {
        console.log("[PayPal Capture] ▶ Field-sale bridge: intent=", fieldIntent.id);

        // Idempotency — already processed
        if (fieldIntent.status === "completed" && fieldIntent.converted_field_order_id) {
          console.log("[PayPal Capture] ✓ Field intent already completed, skipping");
          return new Response(JSON.stringify({
            success: true, capture_id: captureId, amount, currency: currencyCode,
            status: "COMPLETED", already_processed: true, field_intent_id: fieldIntent.id,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        try {
          // Load quote
          const { data: quote } = await supabase
            .from("field_quotes")
            .select("id, agent_id, agent_name, client_info, services, equipment, total")
            .eq("id", fieldIntent.quote_id)
            .single();

          if (!quote) throw new Error("Field quote not found for intent " + fieldIntent.id);

          const ci: any = quote.client_info || {};
          const customerName = `${ci.first_name || ""} ${ci.last_name || ""}`.trim()
            || fieldIntent.customer_name || "Client";

          // Insert field_sales_orders row (mirror of completed sale)
          const { data: fso, error: fsoErr } = await supabase
            .from("field_sales_orders")
            .insert({
              salesperson_id: fieldIntent.agent_id,
              customer_name: customerName,
              customer_email: ci.email || fieldIntent.customer_email || null,
              customer_phone: ci.phone || null,
              customer_address: ci.address || null,
              customer_city: ci.city || null,
              customer_postal_code: ci.postal_code || null,
              services: { services: quote.services, equipment: quote.equipment },
              total_amount: Number(quote.total),
              payment_method: "paypal",
              payment_reference: captureId,
              payment_status: "confirmed",
              sync_status: "pending",
              internal_notes: `Agent: ${quote.agent_name || "—"} · Field PayPal capture · intent=${fieldIntent.id}`,
            })
            .select("id")
            .single();

          if (fsoErr || !fso) throw fsoErr ?? new Error("field_sales_orders insert failed");

          // Call field-sales-sync internally (service-role bypass)
          const syncResp = await fetch(`${supabaseUrl}/functions/v1/field-sales-sync`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "sync_single", sale_id: fso.id, internal: true }),
          });

          const syncResult = await syncResp.json().catch(() => ({}));
          console.log("[PayPal Capture] field-sales-sync result:", syncResp.status, syncResult);

          const newOrderId = syncResult?.orderId || syncResult?.order_id || null;
          const newInvoiceId = syncResult?.invoice_id || null;

          // Mark intent completed
          await supabase
            .from("field_payment_intents")
            .update({
              status: "completed",
              paid_at: new Date().toISOString(),
              converted_field_order_id: fso.id,
              converted_order_id: newOrderId,
              converted_invoice_id: newInvoiceId,
            })
            .eq("id", fieldIntent.id);

          // Queue commission (best-effort — uses existing commission rules if defined)
          try {
            await supabase.from("field_commissions").insert({
              agent_id: fieldIntent.agent_id,
              order_id: newOrderId,
              amount: 0, // calculated by trigger / commission engine
              status: "pending",
              commission_type: "field_sale",
              description: `Vente terrain — ${customerName}`,
              earned_at: new Date().toISOString(),
              notes: `intent=${fieldIntent.id} · sale=${fso.id}`,
            });
          } catch (commErr) {
            console.warn("[PayPal Capture] commission insert failed (non-fatal):", commErr);
          }

          // Activity log
          await supabase.from("activity_logs").insert({
            user_id: fieldIntent.agent_id,
            entity_type: "field_payment_intent",
            entity_id: fieldIntent.id,
            action: "paypal_captured",
            details: {
              ...captureProof,
              field_sales_order_id: fso.id,
              new_order_id: newOrderId,
              new_invoice_id: newInvoiceId,
              sync_result: syncResult,
            },
          });

          console.log("[PayPal Capture] ★ Field bridge complete — sale:", fso.id, "order:", newOrderId);

          return new Response(JSON.stringify({
            success: true,
            capture_id: captureId, amount, currency: currencyCode,
            status: "COMPLETED",
            field_intent_id: fieldIntent.id,
            field_sales_order_id: fso.id,
            order_id: newOrderId,
            invoice_id: newInvoiceId,
            payer_email: payerEmail,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (bridgeErr: any) {
          console.error("[PayPal Capture] ✗ Field bridge error:", bridgeErr);
          await supabase.from("billing_system_alerts").insert({
            alert_type: "field_paypal_bridge_error",
            entity_type: "field_payment_intent",
            entity_id: fieldIntent.id,
            entity_reference: captureId,
            details: {
              error: bridgeErr?.message || String(bridgeErr),
              capture_id: captureId,
              intent_id: fieldIntent.id,
            },
          });
          // fall through to return error
          return new Response(JSON.stringify({
            success: false, capture_id: captureId,
            error: "Field bridge failed: " + (bridgeErr?.message || String(bridgeErr)),
          }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // Resolve invoice_id: request body > PayPal custom_id
    const invoiceId = body.invoice_id || customId;

    // ── Step 3: Apply payment via transactional DB function ──────
    let paymentResult: any = null;
    let invoiceUpdated = false;
    let updatedInvoice: any = null;

    if (invoiceId) {
      // Try V2 billing_invoices
      const { data: v2Invoice } = await supabase
        .from("billing_invoices")
        .select("id, order_id, invoice_number, total, customer_id, subscription_id, customer:billing_customers(email, first_name, last_name, phone)")
        .eq("id", invoiceId)
        .maybeSingle();

      if (v2Invoice) {
        // ★ USE THE TRANSACTIONAL DB FUNCTION ★
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          "apply_payment_to_invoice",
          {
            p_invoice_id: v2Invoice.id,
            p_amount: amount,
            p_method: "paypal",
            p_provider: "paypal",
            p_provider_payment_id: captureId,
            p_provider_order_id: body.paypal_order_id,
            p_source: "portal",
            p_created_by_name: "PayPal Capture",
            p_created_by_role: "system",
            p_customer_id: linkedCustomerId || v2Invoice.customer_id,
          }
        );

        if (rpcError) {
          console.error("[PayPal Capture] ✗ apply_payment_to_invoice error:", rpcError);
          throw new Error(`Failed to apply payment: ${rpcError.message}`);
        }

        paymentResult = rpcResult;
        invoiceUpdated = paymentResult?.success === true;

        if (invoiceUpdated) {
          console.log("[PayPal Capture] ✓ Payment applied via DB function:", paymentResult);

          updatedInvoice = {
            id: v2Invoice.id,
            invoice_number: paymentResult.invoice_number || v2Invoice.invoice_number,
            total: v2Invoice.total,
            amount_paid: paymentResult.new_amount_paid,
            balance_due: paymentResult.new_balance_due,
            status: paymentResult.invoice_status,
            paid_at: paymentResult.is_fully_paid ? new Date().toISOString() : null,
          };

          if (paymentResult.is_fully_paid && v2Invoice.order_id) {
            const { data: fieldSale } = await supabase
              .from("field_sales_orders")
              .select("id, payment_status")
              .eq("converted_order_id", v2Invoice.order_id)
              .maybeSingle();

            if (fieldSale?.id && fieldSale.payment_status !== "confirmed") {
              await supabase
                .from("field_sales_orders")
                .update({
                  payment_status: "confirmed",
                  payment_reference: captureId,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", fieldSale.id);

              await supabase.from("field_order_status_history").insert({
                field_order_id: fieldSale.id,
                status_domain: "payment",
                old_status: fieldSale.payment_status || "pending",
                new_status: "confirmed",
                changed_by_user_id: null,
                change_reason: `PayPal capture ${captureId}`,
                metadata: {
                  invoice_id: v2Invoice.id,
                  order_id: v2Invoice.order_id,
                  provider: "paypal",
                },
              });
            }
          }

          // Queue confirmation email
          const customerEmail = v2Invoice.customer?.email;
          const customerName = `${v2Invoice.customer?.first_name || ""} ${v2Invoice.customer?.last_name || ""}`.trim();

          if (customerEmail && !paymentResult.already_processed) {
            // Generate receipt PDF (non-blocking)
            const { buildReceiptPdfAttachment } = await import("../_shared/pdfFromDb.ts");
            const pdfAttachment = await buildReceiptPdfAttachment(v2Invoice.id, "recu-paiement");

            await supabase.from("email_queue").insert({
              event_key: `paypal_payment_${captureId}`,
              to_email: normalizeEmail(customerEmail),
              template_key: "payment_receipt",
              template_vars: {
                client_name: customerName || "Client",
                amount: amount.toFixed(2),
                amount_paid_today: amount.toFixed(2),
                total_payable: Number(v2Invoice.total).toFixed(2),
                invoice_id: v2Invoice.id,
                order_id: v2Invoice.order_id || body.order_id || undefined,
                invoice_number: v2Invoice.invoice_number,
                payment_method: "PayPal",
                reference: captureId,
              },
              attachments: pdfAttachment ? [pdfAttachment] : null,
              status: "queued",
              attempts: 0,
              max_attempts: 5,
            });
            console.log("[PayPal Capture] ✓ Confirmation email queued to:", customerEmail, pdfAttachment ? "(with PDF)" : "(no PDF)");
          }

          // ══════════════════════════════════════════════════════════════
          // PHASE 2b: RECURRING SUBSCRIPTION SETUP AFTER CAPTURE
          // ══════════════════════════════════════════════════════════════
          // Only trigger after:
          //   1. Successful PayPal capture (COMPLETED)
          //   2. Payment applied to invoice (invoiceUpdated = true)
          //   3. Order is recurring-eligible
          //   4. No existing PayPal subscription for this order
          // ══════════════════════════════════════════════════════════════
          if (v2Invoice.order_id && paymentResult.is_fully_paid) {
            await attemptRecurringSetup(
              supabase,
              v2Invoice.order_id,
              v2Invoice.id,
              linkedCustomerId || v2Invoice.customer_id,
              v2Invoice.subscription_id,
              v2Invoice.customer,
              payerPhone,
            );
          }
        }
      } else {
        console.error("[PayPal Capture] ✗ ORPHAN CAPTURE — invoice_id not found in billing_invoices:", invoiceId);
        // HARDENING: alert immediately so support can manually recover
        await supabase.from("billing_system_alerts").insert({
          alert_type: "paypal_capture_orphan_no_invoice",
          entity_type: "paypal_capture",
          entity_id: null,
          entity_reference: captureId,
          details: {
            ...captureProof,
            attempted_invoice_id: invoiceId,
            payer_email: payerEmail,
            payer_name: `${payerFirstName} ${payerLastName}`.trim(),
            payer_phone: payerPhone,
            linked_customer_id: linkedCustomerId,
            ts: new Date().toISOString(),
            recovery_hint: "Money was captured by PayPal but no DB invoice exists. Manually create order/invoice/payment using payer info above.",
          },
        });
        // Notify business immediately (use custom_html template — exists in registry)
        const alertSubject = `🚨 PayPal capture orpheline — ${captureId}`;
        const alertBody = `
          <h2>Capture PayPal sans facture</h2>
          <p><strong>Capture ID:</strong> ${captureId}</p>
          <p><strong>Montant:</strong> ${amount} ${currencyCode}</p>
          <p><strong>Payeur:</strong> ${payerFirstName} ${payerLastName} &lt;${payerEmail}&gt;</p>
          <p><strong>Téléphone:</strong> ${payerPhone || "n/a"}</p>
          <p><strong>Tentative invoice_id:</strong> ${invoiceId}</p>
          <p>L'argent a été capturé par PayPal mais aucune facture n'a été trouvée. Récupération manuelle requise immédiatement.</p>
        `;
        await supabase.from("email_queue").insert([
          {
            event_key: `orphan_capture_${captureId}`,
            to_email: "support@nivra-telecom.ca",
            template_key: "custom_html",
            subject: alertSubject,
            template_vars: { subject: alertSubject, html: alertBody },
            status: "queued",
            attempts: 0,
            max_attempts: 5,
          },
          {
            event_key: `orphan_capture_${captureId}_alt`,
            to_email: "nivratelecom@gmail.com",
            template_key: "custom_html",
            subject: alertSubject,
            template_vars: { subject: alertSubject, html: alertBody },
            status: "queued",
            attempts: 0,
            max_attempts: 5,
          },
        ]);
      }
    }

    // ── Update orders table if order_id provided ─────────────────
    if (body.order_id) {
      await supabase
        .from("orders")
        .update({
          payment_status: "captured",
          payment_method: "paypal",
          payment_reference: captureId,
        })
        .eq("id", body.order_id);
    }

    // ── Activity log ─────────────────────────────────────────────
    await supabase.from("activity_logs").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      entity_type: "paypal_capture",
      entity_id: body.order_id || invoiceId || null,
      action: "completed",
      details: {
        ...captureProof,
        invoice_updated: invoiceUpdated,
        linked_customer_id: linkedCustomerId,
        db_function_result: paymentResult,
      },
    });

    console.log("[PayPal Capture] ★ COMPLETE — capture_id:", captureId, "invoice_updated:", invoiceUpdated);

    return new Response(
      JSON.stringify({
        success: true,
        capture_id: captureId,
        amount,
        currency: currencyCode,
        status: "COMPLETED",
        payer_email: payerEmail,
        payer_address: payerAddress,
        linked_customer_id: linkedCustomerId,
        invoice_updated: invoiceUpdated,
        already_processed: paymentResult?.already_processed || false,
        updated_invoice: updatedInvoice,
        capture_proof: captureProof,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[PayPal Capture] ✗ Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================================
// RECURRING SUBSCRIPTION SETUP — called only after successful capture
// ============================================================================

async function attemptRecurringSetup(
  supabase: any,
  orderId: string,
  invoiceId: string,
  customerId: string,
  subscriptionId: string | null,
  customer: any,
  payerPhone: string,
): Promise<void> {
  const log = (msg: string) => console.log(`[PayPal Capture][RecurringSetup] ${msg}`);

  try {
    // ═══ STEP 1: Load order ═══
    const { data: order } = await supabase
      .from("orders")
      .select("id, order_number, account_id, service_type, pricing_snapshot")
      .eq("id", orderId)
      .single();

    if (!order) {
      log(`Order ${orderId} not found — skipping recurring setup`);
      await setRecurringStatus(supabase, subscriptionId, "skipped");
      return;
    }

    // ═══ STEP 2: Check recurring eligibility ═══
    if (!isRecurringEligible(order)) {
      log(`Order ${order.order_number} is not recurring-eligible — marking skipped`);
      await setRecurringStatus(supabase, subscriptionId, "skipped");
      return;
    }

    // ═══ STEP 3: Anti-duplication — check existing PayPal subscription ═══
    const { data: existingSub } = await supabase
      .from("billing_subscriptions")
      .select("id, paypal_subscription_id, recurring_setup_status")
      .eq("order_id", orderId)
      .not("paypal_subscription_id", "is", null)
      .maybeSingle();

    if (existingSub?.paypal_subscription_id) {
      log(`PayPal subscription already exists for order ${orderId}: ${existingSub.paypal_subscription_id} — anti-duplication`);
      return;
    }

    // ═══ STEP 4: Resolve recurring monthly total from billing_subscription_services ═══
    // Find the subscription for this order
    let nivraSubId = subscriptionId;
    if (!nivraSubId) {
      const { data: sub } = await supabase
        .from("billing_subscriptions")
        .select("id")
        .eq("order_id", orderId)
        .maybeSingle();
      nivraSubId = sub?.id || null;
    }

    let recurringTotal = 0;
    let planLabel = "";
    let planCode = "";

    if (nivraSubId) {
      // Get item-level detail from billing_subscription_services
      const { data: services } = await supabase
        .from("billing_subscription_services")
        .select("service_code, service_name, unit_price")
        .eq("subscription_id", nivraSubId)
        .eq("is_active", true);

      if (services && services.length > 0) {
        recurringTotal = services.reduce((sum: number, s: any) => sum + Number(s.unit_price), 0);
        planLabel = services.map((s: any) => s.service_name).join(" + ");
        planCode = services[0].service_code;
      }
    }

    // Fallback: use pricing_snapshot if no services found
    if (recurringTotal <= 0) {
      const snapshot = order.pricing_snapshot;
      if (snapshot) {
        recurringTotal = Number(snapshot.monthly_total || snapshot.plan_price || 0);
        planLabel = snapshot.plan_name || order.service_type || "Abonnement Nivra";
        planCode = snapshot.plan_code || "";
      }
    }

    if (recurringTotal <= 0 || !planCode) {
      log(`Cannot resolve recurring amount or plan_code for order ${order.order_number} — marking failed`);
      await setRecurringStatus(supabase, nivraSubId, "failed");
      await supabase.from("billing_system_alerts").insert({
        alert_type: "recurring_setup_failed",
        entity_type: "order",
        entity_id: orderId,
        details: {
          reason: "recurring_total_or_plan_code_unresolvable",
          recurring_total: recurringTotal,
          plan_code: planCode,
          order_number: order.order_number,
        },
      });
      return;
    }

    // ═══ STEP 5: Resolve customer info ═══
    const customerEmail = customer?.email || "";
    const customerFirstName = customer?.first_name || "";
    const customerLastName = customer?.last_name || "";
    const customerPhone = customer?.phone || payerPhone || "";

    if (!customerEmail) {
      log(`No customer email for order ${order.order_number} — marking failed`);
      await setRecurringStatus(supabase, nivraSubId, "failed");
      return;
    }

    // ═══ STEP 6: Call the canonical PayPal subscription factory ═══
    log(`✓ Creating PayPal subscription: order=${order.order_number}, plan=${planCode}, amount=${recurringTotal}/mo`);

    const result = await createNivraPayPalSubscription({
      supabase,
      customer_id: customerId,
      customer_email: customerEmail,
      customer_first_name: customerFirstName,
      customer_last_name: customerLastName,
      customer_phone: customerPhone,
      order_id: orderId,
      order_number: String(order.order_number),
      account_id: order.account_id || "",
      invoice_id: invoiceId,
      recurring_monthly_total: recurringTotal,
      plan_label: planLabel,
      plan_code: planCode,
      nivra_subscription_id: nivraSubId || undefined,
    });

    log(`✓ PayPal subscription created: ${result.paypal_subscription_id} | plan reused: ${result.plan_reused} | status: ${result.recurring_setup_status}`);
    log(`  Approval URL: ${result.approval_url}`);

    // Queue email with approval link for customer
    await supabase.from("email_queue").insert({
      event_key: `paypal_recurring_setup_${orderId}`,
      to_email: normalizeEmail(customerEmail),
      template_key: "paypal_recurring_approval",
      template_vars: {
        client_name: `${customerFirstName} ${customerLastName}`.trim(),
        plan_name: planLabel,
        monthly_amount: recurringTotal.toFixed(2),
        approval_url: result.approval_url,
        order_number: order.order_number,
      },
      status: "queued",
      attempts: 0,
      max_attempts: 5,
    });

  } catch (err: any) {
    log(`✗ Recurring setup FAILED: ${err.message}`);
    // Factory already creates system alert on failure, just log here
    console.error("[PayPal Capture][RecurringSetup] Error:", err);
  }
}

async function setRecurringStatus(
  supabase: any,
  subId: string | null,
  status: string,
): Promise<void> {
  if (!subId) return;
  await supabase.from("billing_subscriptions")
    .update({
      recurring_setup_status: status,
      recurring_provider: status === "skipped" ? null : "paypal",
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", subId);
}
