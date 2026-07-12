import { createClient } from "npm:@supabase/supabase-js@2";
// ============================================================================
// nivra-core-sync — DOWNSTREAM READ-MODEL / MIRROR (Phase 3 V2)
// ============================================================================
// SENS UNIQUE : Nivra Core (source de vérité externe) → nivra-core-sync →
// tables billing_* de ce projet Supabase (projection idempotente pour le
// portail client et l'admin).
//
// Cette fonction ne peut JAMAIS devenir une source alternative de vérité :
//   • Elle n'accepte que des payloads signés émis par Nivra Core.
//   • Les upserts sur billing_invoices / billing_payments / billing_subscriptions
//     sont des projections de l'état canonique déjà validé en amont.
//   • Les triggers DB (trg_forbid_paypal_*, trg_assert_sub_provider_square,
//     trg_forbid_live_catalog_read_on_renewal) restent la barrière ultime
//     et bloqueront toute écriture non conforme.
//
// Toute création INDÉPENDANTE de facture / paiement / souscription initiée
// depuis ce projet Supabase doit passer par les RPC canoniques
// (`build_invoice_from_order`, `create_subscriptions_from_order`,
// `apply_payment_to_invoice`, `refund_payment`, etc.), pas par cette fonction.
// ============================================================================

/**
 * nivra-core-sync - Webhook endpoint called by Nivra Core Worker
 * after creating order/invoice/payment/subscription.
 * 
 * Writes canonical records to local Supabase tables for portal visibility.
 * Secured via NIVRA_WEBHOOK_SECRET header.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface SyncPayload {
  event: "checkout_completed" | "payment_updated" | "order_status_changed";
  // Customer
  customer: {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  // Order
  order: {
    id: string;
    order_number: string;
    status: string;
    payment_status: string;
    service_type: string;
    order_type: string;
    total_amount: number;
    environment: string;
    created_at: string;
    pricing_snapshot: Record<string, any>;
    line_items: any[];
    notes?: string;
    risk_flags?: string[];
    // Address
    service_address?: string;
    service_city?: string;
    service_province?: string;
    service_postal_code?: string;
    installation_type?: string;
    delivery_fee?: number;
    installation_fee?: number;
  };
  // Invoice
  invoice: {
    id: string;
    invoice_number: string;
    status: string;
    subtotal: number;
    tps_amount: number;
    tvq_amount: number;
    total: number;
    amount_paid: number;
    balance_due: number;
    due_date: string;
    cycle_start_date: string;
    cycle_end_date: string;
    type: string;
    fees?: number;
    activation_fee?: number;
    currency?: string;
    payment_method?: string;
  };
  // Payment
  payment: {
    id: string;
    payment_number: string;
    method: string;
    amount: number;
    status: string;
    reference?: string;
    provider?: string;
    provider_payment_id?: string;
    received_at?: string;
    source?: string;
  };
  // Subscription (optional)
  subscription?: {
    id: string;
    plan_code: string;
    plan_name: string;
    plan_price: number;
    status: string;
    cycle_start_date: string;
    cycle_end_date: string;
    service_category?: string;
    auto_billing_enabled?: boolean;
  } | null;
  // Account
  account: {
    id: string;
    account_number: string;
  };
  // Billing snapshot
  billing_snapshot?: {
    account_number: string;
    client: Record<string, any>;
    payment: Record<string, any>;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // â"€â"€ Auth: verify webhook secret â"€â"€
    const webhookSecret = Deno.env.get("NIVRA_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-webhook-secret");

    if (!webhookSecret || !providedSecret || providedSecret !== webhookSecret) {
      console.error("[nivra-core-sync] Invalid webhook secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const payload: SyncPayload = await req.json();
    console.log(`[nivra-core-sync] Event: ${payload.event}, Order: ${payload.order.order_number}`);

    const results: Record<string, any> = {};
    const errors: string[] = [];

    // â"€â"€ 1. Upsert billing_customer â"€â"€
    try {
      const { data: existingCustomer } = await admin
        .from("billing_customers")
        .select("id")
        .eq("user_id", payload.customer.user_id)
        .maybeSingle();

      let customerId: string;
      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error } = await admin
          .from("billing_customers")
          .insert({
            user_id: payload.customer.user_id,
            first_name: payload.customer.first_name,
            last_name: payload.customer.last_name,
            email: payload.customer.email.trim().toLowerCase(),
            phone: payload.customer.phone,
            status: "active",
          })
          .select("id")
          .single();
        if (error) throw error;
        customerId = newCustomer.id;
      }
      results.customer_id = customerId;

      // â"€â"€ 2. Resolve or create account - BLOCKING â"€â"€
      let accountId: string | null = null;
      {
        const { data: acct } = await admin
          .from("accounts")
          .select("id")
          .eq("client_id", payload.customer.user_id)
          .eq("status", "active")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (acct) {
          accountId = acct.id;
        } else if (payload.account?.account_number) {
          const { data: newAcct, error: acctErr } = await admin
            .from("accounts")
            .insert({
              client_id: payload.customer.user_id,
              account_number: payload.account.account_number,
              status: "active",
              primary_service_address: payload.order.service_address || null,
              primary_service_city: payload.order.service_city || null,
              primary_service_province: payload.order.service_province || "QC",
              primary_service_postal_code: payload.order.service_postal_code || null,
            })
            .select("id")
            .single();
          if (acctErr) {
            // Handle race condition: unique index violation â†' re-fetch
            if (acctErr.code === '23505') {
              console.warn("[nivra-core-sync] Account exists (race), re-fetching");
              const { data: reFetched } = await admin
                .from("accounts")
                .select("id")
                .eq("client_id", payload.customer.user_id)
                .eq("status", "active")
                .maybeSingle();
              accountId = reFetched?.id || null;
            } else {
              console.error("[nivra-core-sync] Account create error:", acctErr);
              errors.push(`account: ${acctErr.message}`);
            }
          } else {
            accountId = newAcct.id;
            console.log("[nivra-core-sync] OK: Account created:", payload.account.account_number);
          }
        }
        
        if (!accountId) {
          const errMsg = `FATAL: No account_id resolved for user ${payload.customer.user_id}. Order sync blocked.`;
          console.error("[nivra-core-sync]", errMsg);
          errors.push(errMsg);
          // Return early - order trigger will reject NULL account_id anyway
          return new Response(
            JSON.stringify({ ok: false, results, errors }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // â"€â"€ 3. Upsert order â"€â"€
      const { error: orderErr } = await admin.from("orders").upsert(
        {
          id: payload.order.id,
          order_number: payload.order.order_number,
          user_id: payload.customer.user_id,
          account_id: accountId,
          status: payload.order.status,
          payment_status: payload.order.payment_status,
          service_type: payload.order.service_type,
          order_type: payload.order.order_type || "new",
          total_amount: payload.order.total_amount,
          environment: payload.order.environment || "live",
          created_at: payload.order.created_at,
          pricing_snapshot: payload.order.pricing_snapshot,
          line_items: payload.order.line_items,
          notes: payload.order.notes || null,
          risk_flags: payload.order.risk_flags || [],
          service_address: payload.order.service_address || null,
          service_city: payload.order.service_city || null,
          service_province: payload.order.service_province || null,
          service_postal_code: payload.order.service_postal_code || null,
          installation_type: payload.order.installation_type || null,
          delivery_fee: payload.order.delivery_fee || 0,
          installation_fee: payload.order.installation_fee || 0,
        },
        { onConflict: "id" }
      );
      if (orderErr) {
        console.error("[nivra-core-sync] Order upsert error:", orderErr);
        errors.push(`order: ${orderErr.message}`);
      } else {
        results.order = "synced";
      }

      // â"€â"€ 3. Upsert billing_invoice â"€â"€
      const { error: invoiceErr } = await admin.from("billing_invoices").upsert(
        {
          id: payload.invoice.id,
          invoice_number: payload.invoice.invoice_number,
          customer_id: customerId,
          order_id: payload.order.id,
          status: payload.invoice.status,
          subtotal: payload.invoice.subtotal,
          tps_amount: payload.invoice.tps_amount,
          tvq_amount: payload.invoice.tvq_amount,
          total: payload.invoice.total,
          amount_paid: payload.invoice.amount_paid,
          balance_due: payload.invoice.balance_due,
          due_date: payload.invoice.due_date,
          cycle_start_date: payload.invoice.cycle_start_date,
          cycle_end_date: payload.invoice.cycle_end_date,
          type: payload.invoice.type || "initial",
          fees: payload.invoice.fees || 0,
          activation_fee: payload.invoice.activation_fee || 0,
          currency: payload.invoice.currency || "CAD",
          payment_method: payload.invoice.payment_method || null,
          paid_at: payload.invoice.status === "paid" ? (payload.order.created_at || new Date().toISOString()) : null,
          environment: payload.order.environment || "live",
          billing_snapshot_account_number: payload.billing_snapshot?.account_number || payload.account.account_number,
          billing_snapshot_client: payload.billing_snapshot?.client || {
            first_name: payload.customer.first_name,
            last_name: payload.customer.last_name,
            email: payload.customer.email,
            phone: payload.customer.phone,
          },
          billing_snapshot_payment: payload.billing_snapshot?.payment || null,
        },
        { onConflict: "id" }
      );
      if (invoiceErr) {
        console.error("[nivra-core-sync] Invoice upsert error:", invoiceErr);
        errors.push(`invoice: ${invoiceErr.message}`);
      } else {
        results.invoice = "synced";
      }

      // â"€â"€ 4. Upsert billing_payment â"€â"€
      const { error: paymentErr } = await admin.from("billing_payments").upsert(
        {
          id: payload.payment.id,
          payment_number: payload.payment.payment_number,
          customer_id: customerId,
          invoice_id: payload.invoice.id,
          method: payload.payment.method,
          amount: payload.payment.amount,
          status: payload.payment.status,
          reference: payload.payment.reference || null,
          provider: payload.payment.provider || null,
          provider_payment_id: payload.payment.provider_payment_id || null,
          received_at: payload.payment.received_at || null,
          source: payload.payment.source || "nivra_core",
          environment: payload.order.environment || "live",
        },
        { onConflict: "id" }
      );
      if (paymentErr) {
        console.error("[nivra-core-sync] Payment upsert error:", paymentErr);
        errors.push(`payment: ${paymentErr.message}`);
      } else {
        results.payment = "synced";
      }

      // ── 5. billing_subscriptions — WRITER LOCKED (Module 54.2 Phase 5) ──
      // This function is NO LONGER capable of creating a subscription directly.
      // Subscription creation is the exclusive responsibility of the canonical
      // SECURITY DEFINER flow (create_subscriptions_from_order() ← order_items).
      // We only read to report status; any write attempt has been removed.
      {
        const { data: existingSub } = await admin
          .from("billing_subscriptions")
          .select("id")
          .eq("order_id", payload.order.id)
          .maybeSingle();

        if (existingSub) {
          results.subscription = "already_exists";
        } else {
          results.subscription = "skipped_writer_locked";
          console.log(
            "[nivra-core-sync] billing_subscriptions insert skipped — writer locked (Module 54.2 Phase 5). Canonical path: create_subscriptions_from_order()",
          );
        }
      }

      // ── 5.5. Populate order_items for PDF snapshot system ──
      // order_items.is_recurring drives the price snapshot in dispatcher.ts.
      // Without this, PDFs fall back to live plan_price and show wrong amounts after upgrades.
      {
        try {
          const orderId = payload.order.id;
          const { count: existingCount } = await admin
            .from("order_items")
            .select("id", { count: "exact", head: true })
            .eq("order_id", orderId)
            .eq("is_recurring", true);

          if (!existingCount || existingCount === 0) {
            const inferServiceType = (name: string, code?: string): string => {
              const d = String(name || code || "").toLowerCase();
              if (d.includes("internet") || d.includes("giga") || d.includes("fibre") || d.includes("fiber")) return "internet";
              if (d.includes("tv") || d.includes("télé") || d.includes("chaîne") || d.includes("channel")) return "tv";
              if (d.includes("mobile") || d.includes("cellulaire")) return "mobile";
              return "internet";
            };
            const toMoney2 = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };

            const lineItems: any[] = Array.isArray(payload.order.line_items) ? payload.order.line_items : [];
            let itemsToInsert: any[] = [];

            if (lineItems.length > 0) {
              itemsToInsert = lineItems
                .filter((li: any) => li.type !== "discount")
                .map((li: any, idx: number) => ({
                  order_id: orderId,
                  item_number: idx + 1,
                  service_type: inferServiceType(li.name || li.description || "", li.plan_code),
                  plan_name: li.name || li.description || "Service",
                  description: li.description || li.name || "Service",
                  unit_price: toMoney2(li.unit_price ?? li.price ?? 0),
                  quantity: Number(li.quantity || 1),
                  line_total: toMoney2(li.line_total ?? (li.unit_price ?? li.price ?? 0) * (li.quantity || 1)),
                  is_recurring: li.type === "service" || li.is_recurring === true,
                  status: "active",
                }));
            } else if (payload.subscription) {
              // Fallback: one recurring item from subscription plan data
              itemsToInsert = [{
                order_id: orderId,
                item_number: 1,
                service_type: inferServiceType(payload.subscription.plan_name, payload.subscription.plan_code),
                plan_name: payload.subscription.plan_name,
                description: payload.subscription.plan_name,
                unit_price: toMoney2(payload.subscription.plan_price),
                quantity: 1,
                line_total: toMoney2(payload.subscription.plan_price),
                is_recurring: true,
                status: "active",
              }];
            }

            if (itemsToInsert.length > 0) {
              const { error: itemsErr } = await admin.from("order_items").insert(itemsToInsert);
              if (itemsErr) {
                console.warn("[nivra-core-sync] order_items insert failed:", itemsErr);
                errors.push(`order_items: ${itemsErr.message}`);
              } else {
                results.order_items = itemsToInsert.length;
              }
            }
          } else {
            results.order_items = "already_exists";
          }
        } catch (err: any) {
          errors.push(`order_items: ${err?.message || String(err)}`);
        }
      }

      // â"€â"€ 6. Log to transaction_events for audit trail â"€â"€
      await admin.from("transaction_events").insert({
        user_id: payload.customer.user_id,
        event_type: payload.event === "checkout_completed" ? "order_created" : payload.event,
        event_category: "order",
        status: "success",
        order_number: payload.order.order_number,
        order_id: payload.order.id,
        invoice_number: payload.invoice.invoice_number,
        payment_number: payload.payment.payment_number,
        amount: payload.order.total_amount,
        currency: "CAD",
        metadata: {
          source: "nivra_core_webhook",
          synced_tables: Object.keys(results),
          errors: errors.length > 0 ? errors : undefined,
        },
        source: "webhook",
      }).catch((err: any) => {
        console.warn("[nivra-core-sync] Transaction event log failed (non-blocking):", err);
      });

    } catch (innerErr) {
      console.error("[nivra-core-sync] Processing error:", innerErr);
      errors.push(`processing: ${innerErr.message}`);
    }

    const status = errors.length === 0 ? 200 : 207; // 207 = partial success
    return new Response(
      JSON.stringify({
        ok: errors.length === 0,
        results,
        errors: errors.length > 0 ? errors : undefined,
        order_number: payload.order.order_number,
      }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[nivra-core-sync] Fatal error:", err);
    return new Response(JSON.stringify({ error: "Internal error", details: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
