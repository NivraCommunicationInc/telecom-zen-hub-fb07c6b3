/**
 * checkoutBackfill — Writes canonical records to local Supabase
 * after Nivra Core checkout succeeds.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NivraFullCheckoutResponse, NivraFullCheckoutPayload } from "@/lib/api/nivraApi";

export interface BackfillResult {
  billing_customer_id: string | null;
  order: boolean;
  invoice: boolean;
  payment: boolean;
  subscription: boolean;
  errors: string[];
}

type BillingMethod = "interac" | "card" | "manual";

const toBillingMethod = (method?: string, reference?: string | null): BillingMethod => {
  const normalizedMethod = String(method || "").toLowerCase();
  const normalizedReference = String(reference || "").toLowerCase();

  if (normalizedMethod === "paypal") throw new Error("PayPal décommissionné — utiliser Square/carte");
  if (normalizedMethod === "etransfer" || normalizedMethod === "e_transfer" || normalizedMethod === "interac") return "interac";
  if (normalizedMethod === "credit_card" || normalizedMethod === "card") return "card";
  if (normalizedReference.startsWith("pi_")) return "card";
  return "manual";
};

const isPaidCheckout = (payload: NivraFullCheckoutPayload) => {
  const method = String(payload.payment.method || "").toLowerCase();
  const reference = String(payload.payment.reference || "");
  const cardCaptured =
    (method === "credit_card" || method === "card" || reference.startsWith("pi_")) &&
    (payload.payment.status === "captured" || reference.startsWith("pi_"));

  return method === "promo_free" || cardCaptured;
};

export async function backfillCheckoutToSupabase(
  supabase: SupabaseClient,
  payload: NivraFullCheckoutPayload,
  response: NivraFullCheckoutResponse,
): Promise<BackfillResult> {
  const result: BackfillResult = {
    billing_customer_id: null,
    order: false,
    invoice: false,
    payment: false,
    subscription: false,
    errors: [],
  };

  const userId = payload.customer.user_id;
  const now = new Date().toISOString();
  const pricing = response.pricing;
  const billingMethod = toBillingMethod(payload.payment.method, payload.payment.reference);
  const paid = isPaidCheckout(payload);
  const isStreamingOnly = (payload.services?.length || 0) === 0 && (payload.streaming_addons?.length || 0) > 0;
  const derivedServiceType = payload.services.length > 0
    ? payload.services.map((s) => s.name).join(", ")
    : (isStreamingOnly
      ? payload.streaming_addons?.map((s) => s.name).join(", ") || "Streaming+"
      : "Service Nivra");
  const normalizedDeliveryMethod = isStreamingOnly
    ? "Livraison numérique par courriel"
    : (payload.installation.type || null);

  // 1) billing customer
  try {
    const { data: existing } = await supabase
      .from("billing_customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing?.id) {
      result.billing_customer_id = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("billing_customers")
        .insert({
          user_id: userId,
          first_name: payload.customer.first_name,
          last_name: payload.customer.last_name,
          email: payload.customer.email.trim().toLowerCase(),
          phone: payload.customer.phone,
          status: "active",
        })
        .select("id")
        .single();

      if (error) {
        result.errors.push(`billing_customer: ${error.message}`);
      } else {
        result.billing_customer_id = created.id;
      }
    }
  } catch (e: any) {
    result.errors.push(`billing_customer: ${e.message}`);
  }

  if (!result.billing_customer_id) return result;

  // 2) resolve account
  let resolvedAccountId: string | null = payload.account_id || null;
  try {
    const { data: existingAcct } = await supabase
      .from("accounts")
      .select("id")
      .eq("client_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingAcct?.id) {
      resolvedAccountId = existingAcct.id;
    } else if (response.account_number) {
      const { data: newAcct, error: acctErr } = await supabase
        .from("accounts")
        .insert({
          client_id: userId,
          account_number: response.account_number,
          status: "active",
          primary_service_address: payload.service_address?.street || null,
          primary_service_city: payload.service_address?.city || null,
          primary_service_province: payload.service_address?.province || "QC",
          primary_service_postal_code: payload.service_address?.postal_code || null,
        })
        .select("id")
        .single();

      if (acctErr) {
        result.errors.push(`account: ${acctErr.message}`);
      } else {
        resolvedAccountId = newAcct.id;
      }
    }
  } catch (e: any) {
    result.errors.push(`account: ${e.message}`);
  }

  if (!resolvedAccountId) {
    result.errors.push("account: No active account found");
    return result;
  }

  // 3) order
  try {
    const { error } = await supabase.from("orders").upsert(
      {
        id: response.order_id,
        order_number: response.order_number,
        client_request_id: payload.client_request_id,
        user_id: userId,
        account_id: resolvedAccountId,
        status: paid ? "confirmed" : "submitted",
        payment_status: paid ? "paid" : (payload.payment.method === "etransfer" ? "pending" : "pre_authorized"),
        service_type: derivedServiceType,
        fulfillment_type: isStreamingOnly ? "digital" : null,
        delivery_method: normalizedDeliveryMethod,
        order_type: "new",
        total_amount: pricing?.grand_total ?? Number(payload.pricing_snapshot?.grand_total ?? 0),
        environment: "live",
        created_at: response.created_at || now,
        pricing_snapshot: payload.pricing_snapshot,
        notes: payload.notes || null,
        shipping_address: isStreamingOnly ? null : (payload.service_address.street || null),
        shipping_city: isStreamingOnly ? null : (payload.service_address.city || null),
        shipping_province: isStreamingOnly ? null : (payload.service_address.province || "QC"),
        shipping_postal_code: isStreamingOnly ? null : (payload.service_address.postal_code || null),
        installation_type: isStreamingOnly ? "digital_email" : (payload.installation.type || null),
        delivery_fee: isStreamingOnly ? 0 : (payload.installation.delivery_fee || 0),
        installation_fee: isStreamingOnly ? 0 : (payload.installation.installation_fee || 0),
        provider_payment_id: billingMethod === "card" ? (payload.payment.capture_id || payload.payment.reference || null) : null,
        payment_method: billingMethod === "card" ? "card" : payload.payment.method,
        payment_reference: payload.payment.reference || response.payment_number || null,
      },
      { onConflict: "order_number" },
    );

    if (error) result.errors.push(`order: ${error.message}`);
    else result.order = true;
  } catch (e: any) {
    result.errors.push(`order: ${e.message}`);
  }

  // 4) invoice
  try {
    const total = pricing?.grand_total ?? Number(payload.pricing_snapshot?.grand_total ?? 0);
    const { error } = await supabase.from("billing_invoices").upsert(
      {
        id: response.invoice_id,
        invoice_number: response.invoice_number,
        customer_id: result.billing_customer_id,
        order_id: response.order_id,
        status: paid ? "paid" : "pending",
        subtotal: pricing?.subtotal || pricing?.taxable_base || Number(payload.pricing_snapshot?.subtotal ?? payload.pricing_snapshot?.taxable_base ?? 0),
        tps_amount: pricing?.tps_amount ?? Number(payload.pricing_snapshot?.tps_amount ?? 0),
        tvq_amount: pricing?.tvq_amount ?? Number(payload.pricing_snapshot?.tvq_amount ?? 0),
        total,
        amount_paid: paid ? total : 0,
        balance_due: paid ? 0 : total,
        due_date: response.created_at || now,
        cycle_start_date: response.created_at || now,
        cycle_end_date: response.created_at || now,
        type: "initial",
        currency: "CAD",
        payment_method: billingMethod,
        environment: "live",
        paid_at: paid ? (response.created_at || now) : null,
        billing_snapshot_account_number: response.account_number,
        billing_snapshot_client: {
          first_name: payload.customer.first_name,
          last_name: payload.customer.last_name,
          email: payload.customer.email,
          phone: payload.customer.phone,
        },
        billing_snapshot_payment: {
          method: billingMethod,
          reference: payload.payment.reference || response.payment_number || null,
          status: payload.payment.status,
        },
      },
      { onConflict: "invoice_number" },
    );

    if (error) result.errors.push(`invoice: ${error.message}`);
    else result.invoice = true;
  } catch (e: any) {
    result.errors.push(`invoice: ${e.message}`);
  }

  // 4b) CANONICAL INVOICE LINES — write atomically at order creation
  if (result.invoice && response.invoice_id) {
    try {
      // Check if lines already exist (idempotency)
      const { data: existingLines } = await supabase
        .from("billing_invoice_lines")
        .select("id")
        .eq("invoice_id", response.invoice_id)
        .limit(1);

      if (!existingLines || existingLines.length === 0) {
        const invoiceLines: Array<{
          invoice_id: string;
          description: string;
          unit_price: number;
          quantity: number;
          line_total: number;
          line_type: string;
        }> = [];

        // Recurring services (each on its own line)
        for (const svc of payload.services) {
          const qty = svc.quantity || 1;
          const price = Number(svc.plan_price) || 0;
          invoiceLines.push({
            invoice_id: response.invoice_id,
            description: svc.name,
            unit_price: price,
            quantity: qty,
            line_total: Math.round(price * qty * 100) / 100,
            line_type: "service",
          });
        }

        // Streaming add-ons (each individually — NEVER grouped)
        if ((payload as any).streaming_addons?.length) {
          for (const addon of (payload as any).streaming_addons) {
            const price = Number(addon.monthly_price || addon.plan_price) || 0;
            invoiceLines.push({
              invoice_id: response.invoice_id,
              description: addon.name,
              unit_price: price,
              quantity: 1,
              line_total: price,
              line_type: "service",
            });
          }
        }

        // Paid TV channels (each individually)
        if ((payload as any).channels?.paid_channels?.length) {
          for (const ch of (payload as any).channels.paid_channels) {
            const price = Number(ch.price) || 0;
            invoiceLines.push({
              invoice_id: response.invoice_id,
              description: ch.name,
              unit_price: price,
              quantity: 1,
              line_total: price,
              line_type: "service",
            });
          }
        }

        // Equipment items (each individually)
        const equipmentItems = payload.equipment || [];
        for (const eq of equipmentItems) {
          const qty = Number(eq.quantity) || 1;
          const price = Number(eq.unit_price) || 0;
          invoiceLines.push({
            invoice_id: response.invoice_id,
            description: eq.name || "Équipement",
            unit_price: price,
            quantity: qty,
            line_total: Math.round(price * qty * 100) / 100,
            line_type: "equipment",
          });
        }

        // One-time fees
        if ((payload as any).fees?.length) {
          for (const fee of (payload as any).fees) {
            const amount = Number(fee.amount) || 0;
            if (amount > 0) {
              invoiceLines.push({
                invoice_id: response.invoice_id,
                description: fee.name,
                unit_price: amount,
                quantity: 1,
                line_total: amount,
                line_type: "fee",
              });
            }
          }
        }

        // Discount / promo lines (negative amounts)
        const promoDiscount = Number(payload.pricing_snapshot?.promo_discount) || 0;
        const welcomeDiscount = Number(payload.pricing_snapshot?.welcome_discount) || 0;
        if (promoDiscount > 0 && (payload as any).promo) {
          invoiceLines.push({
            invoice_id: response.invoice_id,
            description: `Rabais ${(payload as any).promo.code} (${(payload as any).promo.discount_value}% services)`,
            unit_price: -promoDiscount,
            quantity: 1,
            line_total: -promoDiscount,
            line_type: "discount",
          });
        }
        if (welcomeDiscount > 0) {
          invoiceLines.push({
            invoice_id: response.invoice_id,
            description: "Rabais bienvenue (50% premier mois)",
            unit_price: -welcomeDiscount,
            quantity: 1,
            line_total: -welcomeDiscount,
            line_type: "discount",
          });
        }

        if (invoiceLines.length > 0) {
          const { error: linesErr } = await supabase
            .from("billing_invoice_lines")
            .insert(invoiceLines);
          if (linesErr) {
            // BLOCKING: Invoice without lines is an incomplete operational record
            console.error("[Backfill] ❌ CRITICAL: Invoice lines creation FAILED — blocking checkout:", linesErr);
            result.errors.push(`invoice_lines_critical: ${linesErr.message}`);
            // Force invoice flag to false — downstream must retry or halt
            result.invoice = false;
          } else {
            console.log(`[Backfill] ✓ ${invoiceLines.length} canonical invoice lines created`);
          }
        } else {
          // BLOCKING: Zero lines generated from payload — data integrity violation
          console.error("[Backfill] ❌ CRITICAL: Zero invoice lines generated from checkout payload");
          result.errors.push("invoice_lines_critical: zero lines generated from payload");
          result.invoice = false;
        }
      }
    } catch (e: any) {
      console.error("[Backfill] ❌ CRITICAL: Invoice lines exception:", e);
      result.errors.push(`invoice_lines_critical: ${e.message}`);
      result.invoice = false;
    }
  }

  // 5) payment
  try {
    const total = pricing?.grand_total ?? Number(payload.pricing_snapshot?.grand_total ?? 0);
    const provider =
      billingMethod === "interac"
          ? "interac"
          : billingMethod === "card"
            ? "square"
            : "manual";
    const reference = payload.payment.reference || response.payment_number || null;
    const providerPaymentId = provider === "square" ? (payload.payment.capture_id || payload.payment.reference || null) : null;

    const { error } = await supabase.from("billing_payments").upsert(
      {
        id: response.payment_id,
        payment_number: response.payment_number,
        customer_id: result.billing_customer_id,
        invoice_id: response.invoice_id,
        method: billingMethod,
        amount: total,
        status: paid ? "confirmed" : "pending",
        reference,
        provider,
        provider_payment_id: providerPaymentId,
        received_at: paid ? (response.created_at || now) : null,
        source: "live",
        environment: "live",
        created_by_name: `${payload.customer.first_name} ${payload.customer.last_name}`.trim(),
      },
      { onConflict: "payment_number" },
    );

    if (error) result.errors.push(`payment: ${error.message}`);
    else result.payment = true;
  } catch (e: any) {
    result.errors.push(`payment: ${e.message}`);
  }

  // 6) subscription projection — canonical-only.
  // Module 54.2 Phase 5.1: no frontend write is allowed against billing_subscriptions.
  // The checkout projection function is idempotent and routes subscription creation
  // through the backend canonical flow.
  if (payload.services.length > 0) {
    try {
      const { data, error } = await supabase.functions.invoke("checkout-canonical-sync", {
        body: { payload, response },
      });

      if (error) {
        result.errors.push(`subscription: ${error.message}`);
      } else if (data?.ok === false) {
        const syncErrors = Array.isArray(data.errors) ? data.errors.join("; ") : "canonical sync failed";
        result.errors.push(`subscription: ${syncErrors}`);
      } else {
        result.subscription = Boolean(data?.results?.subscription || data?.results?.subscriptions);
      }
    } catch (e: any) {
      result.errors.push(`subscription: ${e.message}`);
    }
  }

  return result;
}
