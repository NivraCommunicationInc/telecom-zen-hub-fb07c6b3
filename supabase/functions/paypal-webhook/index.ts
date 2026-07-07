import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceBillingRateLimit } from "../_shared/billingRateLimit.ts";
import { reportEdgeError } from "../_shared/sentry.ts";
import { nextAnchoredDate } from "../_shared/billing-utils.ts";
import { writePaymentAutoNote } from "../_shared/paymentAutoNote.ts";


/**
 * ============================================================================
 * PAYPAL WEBHOOK HANDLER - HARDENED (Phase 2b)
 * ============================================================================
 * 
 * SECURITY:
 * - Validates PayPal webhook signature to prevent spoofing
 * - Uses service role key for database operations
 * - All events are logged for audit trail
 * 
 * EVENTS HANDLED:
 * - BILLING.SUBSCRIPTION.ACTIVATED: Customer approved → recurring_setup_status = active
 * - BILLING.SUBSCRIPTION.CANCELLED: Subscription cancelled → status = cancelled
 * - BILLING.SUBSCRIPTION.SUSPENDED: Payment failed → status = suspended
 * - BILLING.SUBSCRIPTION.PAYMENT.FAILED: Payment failed alert
 * - PAYMENT.SALE.COMPLETED: Monthly charge → apply_payment_to_invoice RPC
 * - PAYMENT.CAPTURE.COMPLETED: One-time capture safety net
 * - CUSTOMER.DISPUTE.* / PAYMENT.CAPTURE.DENIED/REVERSED: Chargeback handling
 * 
 * RECURRING STATE TRANSITIONS:
 *   pending → active (on BILLING.SUBSCRIPTION.ACTIVATED)
 *   pending → failed (on repeated PAYMENT.FAILED without activation)
 *   active → suspended (on BILLING.SUBSCRIPTION.SUSPENDED)
 *   active → cancelled (on BILLING.SUBSCRIPTION.CANCELLED)
 *   suspended → active (on BILLING.SUBSCRIPTION.ACTIVATED re-activation)
 * 
 * @version 3.0.0 - Phase 2b: Provider-neutral recurring_setup_status
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: {
    id: string;
    status?: string;
    billing_agreement_id?: string;
    custom_id?: string;
    subscriber?: {
      email_address?: string;
      name?: {
        given_name?: string;
        surname?: string;
      };
    };
    amount?: {
      total?: string;
      value?: string;
      currency_code?: string;
    };
  };
  create_time: string;
  resource_type: string;
}

/**
 * Verify PayPal webhook signature
 */
async function verifyPayPalWebhook(
  req: Request,
  body: string,
  webhookId: string
): Promise<boolean> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_SECRET");
  
  if (!clientId || !clientSecret) {
    console.error("[PayPal Webhook] Missing PayPal credentials");
    return false;
  }

  const transmissionId = req.headers.get("paypal-transmission-id");
  const transmissionTime = req.headers.get("paypal-transmission-time");
  const certUrl = req.headers.get("paypal-cert-url");
  const authAlgo = req.headers.get("paypal-auth-algo");
  const transmissionSig = req.headers.get("paypal-transmission-sig");

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    console.warn("[PayPal Webhook] Missing verification headers - possible spoofed request");
    return false;
  }

  try {
    const auth = btoa(`${clientId}:${clientSecret}`);
    const tokenResponse = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) return false;

    const tokenData = await tokenResponse.json();

    const verifyResponse = await fetch("https://api-m.paypal.com/v1/notifications/verify-webhook-signature", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      }),
    });

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error("[PayPal Webhook] Verification API error:", errorText);
      return false;
    }

    const verifyResult = await verifyResponse.json();
    const isValid = verifyResult.verification_status === "SUCCESS";
    if (!isValid) {
      console.error("[PayPal Webhook] Signature verification FAILED:", verifyResult);
    }
    return isValid;
  } catch (error) {
    console.error("[PayPal Webhook] Verification error:", error);
    return false;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse custom_id — may be JSON (from factory) or legacy string
 */
function parseCustomId(customId: string | undefined): Record<string, string> {
  if (!customId) return {};
  try {
    return JSON.parse(customId);
  } catch (_e) {
    return { raw: customId };
  }
}

/**
 * Find subscription by PayPal subscription ID
 */
async function findSubscription(supabase: any, paypalSubscriptionId: string) {
  const { data } = await supabase
    .from("billing_subscriptions")
    .select("id, customer_id, plan_name, plan_code, plan_price, cycle_start_date, cycle_end_date, billing_anchor_date, status, recurring_setup_status, order_id, customer:billing_customers(email, first_name, last_name, phone)")
    .eq("paypal_subscription_id", paypalSubscriptionId)
    .maybeSingle();
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const rl = await enforceBillingRateLimit(req, "paypal-webhook", corsHeaders);
  if (rl) return rl;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase: any = createClient<any>(supabaseUrl, supabaseServiceKey);

    const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID");

    const rawBody = await req.text();
    let signatureVerified = false;

    // SECURITY: Verify webhook signature when configured
    if (webhookId) {
      const isValid = await verifyPayPalWebhook(req, rawBody, webhookId);
      if (!isValid) {
        console.error("[PayPal Webhook] SECURITY: Invalid signature - rejecting request");
        await supabase.from("activity_logs").insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          entity_type: "security_event",
          entity_id: null,
          action: "invalid_signature",
          details: {
            transmission_id: req.headers.get("paypal-transmission-id"),
            ip: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
          },
        });
        return new Response(
          JSON.stringify({ error: "Invalid webhook signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      signatureVerified = true;
    } else {
      // SECURITY: Fail closed — do not process unverified webhooks.
      // If PAYPAL_WEBHOOK_ID is missing, reject with 503 so PayPal retries later.
      // Operators must configure PAYPAL_WEBHOOK_ID to restore webhook processing.
      console.error("[PayPal Webhook] CRITICAL: PAYPAL_WEBHOOK_ID not configured — rejecting webhook");
      await supabase.from("billing_system_alerts").insert({
        alert_type: "paypal_webhook_config_missing",
        entity_type: "paypal_webhook",
        entity_reference: req.headers.get("paypal-transmission-id"),
        details: {
          reason: "PAYPAL_WEBHOOK_ID secret missing — webhook rejected for security",
          ip: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
          ts: new Date().toISOString(),
        },
      }).catch(() => {});
      return new Response(
        JSON.stringify({ error: "Webhook signature verification not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event: PayPalWebhookEvent = JSON.parse(rawBody);

    console.log(`[PayPal Webhook] Received: ${event.event_type}`, {
      id: event.id,
      resource_id: event.resource?.id,
      custom_id: event.resource?.custom_id,
      signature_verified: signatureVerified,
    });

    // ─── IDEMPOTENCE 3.B.1 ─────────────────────────────────────────────
    // L'idempotence est portée atomiquement par les RPC canoniques via
    // record_webhook_event() (PK provider+event_id, ON CONFLICT DO NOTHING) :
    //   - événements de capture → apply_payment_from_webhook()
    //   - événements de refund  → refund_payment()
    //   - événements de cycle de vie → dedup par ressource (provider_subscription_id)
    // Ce trace audit est purement informatif — plus jamais le verrou.
    await supabase.from("activity_logs").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      entity_type: "paypal_webhook",
      entity_id: null,
      action: event.event_type,
      details: {
        paypal_event_id: event.id,
        resource_id: event.resource?.id,
        resource_type: event.resource_type,
        custom_id: event.resource?.custom_id,
        status: event.resource?.status,
        verified: signatureVerified,
      },
    });

    switch (event.event_type) {

      // ═══════════════════════════════════════════════════════════════
      // BILLING.SUBSCRIPTION.ACTIVATED
      // Customer approved the subscription via PayPal
      // → recurring_setup_status = active, subscription status = active
      // ═══════════════════════════════════════════════════════════════
      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        const paypalSubscriptionId = event.resource.id;
        const customData = parseCustomId(event.resource.custom_id);
        
        console.log(`[PayPal Webhook] Subscription ACTIVATED: ${paypalSubscriptionId}`);
        
        const sub = await findSubscription(supabase, paypalSubscriptionId);
        
        if (sub) {
          // Update to active + set recurring_setup_status
          await supabase
            .from("billing_subscriptions")
            .update({
              status: "active",
              recurring_setup_status: "active",
              recurring_provider: "paypal",
              auto_billing_enabled: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);
          
          console.log(`[PayPal Webhook] ✓ Subscription ${sub.id} → active (recurring_setup_status = active)`);
          
          // Apply initial payment to pending invoice via RPC
          const { data: pendingInvoice } = await supabase
            .from("billing_invoices")
            .select("id, total")
            .eq("subscription_id", sub.id)
            .in("status", ["pending", "partially_paid"])
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          
          if (pendingInvoice) {
            // Phase 3.B.1 — passage strict par apply_payment_from_webhook
            //   (idempotence event_id + délégation apply_payment_to_invoice + trace provider)
            const { data: paymentId, error: rpcError } = await supabase.rpc(
              "apply_payment_from_webhook",
              {
                p_provider: "paypal",
                p_event_id: `${event.id}:activation`,
                p_event_type: event.event_type,
                p_provider_created_at: event.create_time || null,
                p_invoice_id: pendingInvoice.id,
                p_amount: pendingInvoice.total,
                p_method: "paypal",
                p_external_reference: `sub_activation_${paypalSubscriptionId}`,
                p_source: "webhook_subscription",
                p_context: { paypal_subscription_id: paypalSubscriptionId, phase: "activation" },
              }
            );
            if (rpcError) {
              console.error("[PayPal Webhook] apply_payment_from_webhook error (activation):", rpcError);
            } else {
              console.log(`[PayPal Webhook] ✓ Initial invoice paid: payment_id=${paymentId}`);
            }
          }

          // Trace audit
          await supabase.from("billing_subscription_trace_audit").insert({
            subscription_id: sub.id,
            customer_id: sub.customer_id,
            action: "paypal_subscription_activated",
            source_type: "webhook",
            source_id: event.id,
            details: {
              paypal_subscription_id: paypalSubscriptionId,
              custom_data: customData,
              previous_status: sub.status,
              previous_setup_status: sub.recurring_setup_status,
            },
            reason: `PayPal subscription activated via webhook`,
          });

          // Notify customer of activation
          if (sub.customer) {
            await supabase.from("email_queue").insert({
              event_key: `paypal_activated_${paypalSubscriptionId}`,
              to_email: sub.customer.email,
              template_key: "paypal_subscription_activated",
              template_vars: {
                client_name: `${sub.customer.first_name} ${sub.customer.last_name}`,
                plan_name: sub.plan_name,
                monthly_amount: sub.plan_price,
                next_billing_date: sub.cycle_end_date,
              },
              status: "queued",
              attempts: 0,
              max_attempts: 5,
            });
          }

        } else {
          console.warn(`[PayPal Webhook] No subscription found for PayPal ID: ${paypalSubscriptionId}`);
          await supabase.from("billing_system_alerts").insert({
            alert_type: "orphan_subscription_activation",
            entity_type: "paypal_webhook",
            entity_reference: paypalSubscriptionId,
            details: { event_id: event.id, custom_data: customData },
          });
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════
      // BILLING.SUBSCRIPTION.CANCELLED
      // → status = cancelled, auto_billing_enabled = false
      // ═══════════════════════════════════════════════════════════════
      case "BILLING.SUBSCRIPTION.CANCELLED": {
        const paypalSubscriptionId = event.resource.id;
        console.log(`[PayPal Webhook] Subscription CANCELLED: ${paypalSubscriptionId}`);
        
        const sub = await findSubscription(supabase, paypalSubscriptionId);

        if (sub) {
          await supabase
            .from("billing_subscriptions")
            .update({
              status: "cancelled",
              auto_billing_enabled: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);

          // Trace audit
          await supabase.from("billing_subscription_trace_audit").insert({
            subscription_id: sub.id,
            customer_id: sub.customer_id,
            action: "paypal_subscription_cancelled",
            source_type: "webhook",
            source_id: event.id,
            details: { paypal_subscription_id: paypalSubscriptionId, previous_status: sub.status },
            reason: "PayPal subscription cancelled via webhook",
          });

          // Notify customer
          if (sub.customer) {
            await supabase.from("email_queue").insert({
              event_key: `paypal_cancelled_${paypalSubscriptionId}`,
              to_email: sub.customer.email,
              template_key: "paypal_subscription_cancelled",
              template_vars: {
                client_name: `${sub.customer.first_name} ${sub.customer.last_name}`,
                plan_name: sub.plan_name,
                reason: (event.resource as any).status_change_note || "Annulé via PayPal",
              },
              status: "queued",
              attempts: 0,
              max_attempts: 5,
            });
          }
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════
      // BILLING.SUBSCRIPTION.SUSPENDED
      // → status = suspended + system alert
      // ═══════════════════════════════════════════════════════════════
      case "BILLING.SUBSCRIPTION.SUSPENDED": {
        const paypalSubscriptionId = event.resource.id;
        console.log(`[PayPal Webhook] Subscription SUSPENDED: ${paypalSubscriptionId}`);
        
        const sub = await findSubscription(supabase, paypalSubscriptionId);

        if (sub) {
          await supabase
            .from("billing_subscriptions")
            .update({
              status: "suspended",
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);

          await supabase.from("billing_subscription_trace_audit").insert({
            subscription_id: sub.id,
            customer_id: sub.customer_id,
            action: "paypal_subscription_suspended",
            source_type: "webhook",
            source_id: event.id,
            details: { paypal_subscription_id: paypalSubscriptionId, previous_status: sub.status },
            reason: "PayPal payment failed — subscription suspended",
          });
        }

        await supabase.from("billing_system_alerts").insert({
          alert_type: "subscription_suspended",
          entity_type: "billing_subscriptions",
          entity_reference: paypalSubscriptionId,
          details: {
            reason: "PayPal payment failed",
            event_id: event.id,
          },
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════
      // BILLING.SUBSCRIPTION.PAYMENT.FAILED
      // → system alert + customer notification (no status change yet)
      // ═══════════════════════════════════════════════════════════════
      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
        const paypalSubscriptionId = event.resource.billing_agreement_id || event.resource.id;
        console.log(`[PayPal Webhook] Payment FAILED for: ${paypalSubscriptionId}`);
        
        await supabase.from("billing_system_alerts").insert({
          alert_type: "payment_failed",
          entity_type: "billing_subscriptions",
          entity_reference: paypalSubscriptionId,
          details: { event_id: event.id, amount: event.resource.amount },
        });
        
        const sub = await findSubscription(supabase, paypalSubscriptionId);

        if (sub) {
          await supabase.from("billing_subscription_trace_audit").insert({
            subscription_id: sub.id,
            customer_id: sub.customer_id,
            action: "paypal_payment_failed",
            source_type: "webhook",
            source_id: event.id,
            details: { paypal_subscription_id: paypalSubscriptionId, amount: event.resource.amount },
            reason: "PayPal recurring payment failed",
          });

          if (sub.customer) {
            await supabase.from("email_queue").insert({
              event_key: `paypal_failed_${event.id}`,
              to_email: sub.customer.email,
              template_key: "paypal_recurring_payment_failed",
              template_vars: {
                client_name: `${sub.customer.first_name} ${sub.customer.last_name}`,
                plan_name: sub.plan_name,
                amount: event.resource.amount?.value || event.resource.amount?.total,
              },
              status: "queued",
              attempts: 0,
              max_attempts: 5,
            });
          }
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════
      // PAYMENT.SALE.COMPLETED — Monthly recurring charge
      // → apply_payment_to_invoice RPC + cycle advancement
      // ═══════════════════════════════════════════════════════════════
      case "PAYMENT.SALE.COMPLETED": {
        const paymentId = event.resource.id;
        const billingAgreementId = event.resource.billing_agreement_id;
        const amount = parseFloat(event.resource.amount?.total || event.resource.amount?.value || "0");
        
        console.log(`[PayPal Webhook] PAYMENT.SALE.COMPLETED: ${paymentId}, amount: ${amount}`);
        
        if (!billingAgreementId) {
          console.log("[PayPal Webhook] No billing_agreement_id — skipping");
          break;
        }

        const sub = await findSubscription(supabase, billingAgreementId);
        
        if (!sub) {
          console.warn(`[PayPal Webhook] No subscription for billing_agreement: ${billingAgreementId}`);
          break;
        }

        // Find pending invoice for this subscription
        const { data: invoice } = await supabase
          .from("billing_invoices")
          .select("id, order_id, invoice_number, total")
          .eq("subscription_id", sub.id)
          .in("status", ["pending", "partially_paid"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!invoice) {
          console.warn(`[PayPal Webhook] No pending invoice for subscription ${sub.id} — logging orphan payment`);
          await supabase.from("billing_system_alerts").insert({
            alert_type: "orphan_recurring_payment",
            entity_type: "billing_subscriptions",
            entity_id: sub.id,
            entity_reference: billingAgreementId,
            details: {
              payment_id: paymentId,
              amount,
              reason: "no_pending_invoice",
            },
          });
          break;
        }

        // ★ Phase 3.B.1 — RPC canonique idempotente (verrou event_id + trace) ★
        const { data: appliedPaymentId, error: rpcError } = await supabase.rpc(
          "apply_payment_from_webhook",
          {
            p_provider: "paypal",
            p_event_id: event.id,
            p_event_type: event.event_type,
            p_provider_created_at: event.create_time || null,
            p_invoice_id: invoice.id,
            p_amount: amount,
            p_method: "paypal",
            p_external_reference: paymentId,
            p_source: "webhook_subscription",
            p_context: { paypal_subscription_id: sub.provider_subscription_id, phase: "recurring" },
          }
        );

        if (rpcError) {
          console.error("[PayPal Webhook] apply_payment_from_webhook error:", rpcError);
        } else if (!appliedPaymentId) {
          console.log(`[PayPal Webhook] Event ${event.id} déjà traité (short-circuit RPC) — skip side-effects`);
        } else {
          console.log(`[PayPal Webhook] ✓ Payment applied via RPC: payment_id=${appliedPaymentId}`);

          // Vérifier via lecture (jamais une écriture directe) si la facture est totalement payée
          const { data: freshInvoice } = await supabase
            .from("billing_invoices")
            .select("status, invoice_number")
            .eq("id", invoice.id)
            .maybeSingle();
          const isFullyPaid = freshInvoice?.status === "paid";

          if (isFullyPaid) {
            const newCycleStart = new Date(sub.cycle_end_date);
            const anchorDay = sub.billing_anchor_date
              ? new Date(sub.billing_anchor_date).getDate()
              : new Date(sub.cycle_start_date).getDate();
            const newCycleEnd = nextAnchoredDate(anchorDay, newCycleStart);

            await supabase
              .from("billing_subscriptions")
              .update({
                cycle_start_date: newCycleStart.toISOString().split('T')[0],
                cycle_end_date: newCycleEnd.toISOString().split('T')[0],
                next_renewal_at: newCycleEnd.toISOString(),
                last_invoice_id: invoice.id,
                updated_at: new Date().toISOString(),
              })
              .eq("id", sub.id);

            console.log(`[PayPal Webhook] ✓ Cycle advanced: ${newCycleStart.toISOString().split('T')[0]} → ${newCycleEnd.toISOString().split('T')[0]}`);

            const { reactivateIfSuspended } = await import("../_shared/reactivationEngine.ts");
            const reactivation = await reactivateIfSuspended(supabase, sub.id, invoice.id, "paypal_webhook");
            if (reactivation.reactivated) {
              console.log(`[PayPal Webhook] ✓ Auto-reactivated subscription ${sub.id} (was: suspended)`);
            }
          }

          // Trace audit
          await supabase.from("billing_subscription_trace_audit").insert({
            subscription_id: sub.id,
            customer_id: sub.customer_id,
            action: "paypal_recurring_payment_received",
            source_type: "webhook",
            source_id: event.id,
            details: {
              payment_id: appliedPaymentId,
              amount,
              invoice_id: invoice.id,
              is_fully_paid: isFullyPaid,
            },
            reason: `PayPal recurring payment $${amount} applied to invoice ${freshInvoice?.invoice_number || invoice.invoice_number || invoice.id}`,
          });

          // Notify customer (with receipt PDF, non-blocking)
          if (sub.customer) {
            const { buildReceiptPdfAttachment } = await import("../_shared/pdfFromDb.ts");
            const pdfAttachment = await buildReceiptPdfAttachment(invoice.id, "recu-paiement");

            await supabase.from("email_queue").insert({
              event_key: `paypal_payment_${appliedPaymentId}`,
              to_email: sub.customer.email,
              template_key: "payment_confirmed",
              template_vars: {
                client_name: `${sub.customer.first_name} ${sub.customer.last_name}`,
                amount: amount.toFixed(2),
                amount_paid_today: amount.toFixed(2),
                total_payable: Number(invoice.total || amount).toFixed(2),
                invoice_id: invoice.id,
                order_id: invoice.order_id || undefined,
                invoice_number: freshInvoice?.invoice_number || invoice.invoice_number || "N/A",
                payment_method: "PayPal (Paiement automatique)",
                reference: paymentId,
              },
              attachments: pdfAttachment ? [pdfAttachment] : null,
              status: "queued",
              attempts: 0,
              max_attempts: 5,
            });
          }

          await writePaymentAutoNote({
            supabase,
            billingCustomerId: sub.customer_id,
            amount,
            method: "paypal",
            provider: "paypal",
            invoiceNumber: freshInvoice?.invoice_number || invoice.invoice_number,
            invoiceId: invoice.id,
            nivraReference: null,
            paymentNumber: null,
            channel: "Autopay PayPal (webhook)",
          });
        }
        break;
      }


      // ═══════════════════════════════════════════════════════════════
      // PAYMENT.CAPTURE.COMPLETED — One-time invoice payment safety net
      // ═══════════════════════════════════════════════════════════════
      case "PAYMENT.CAPTURE.COMPLETED": {
        const captureId = event.resource.id;
        const captureAmount = parseFloat((event.resource as any).amount?.value || "0");
        const customId = (event.resource as any).custom_id;

        console.log(`[PayPal Webhook] PAYMENT.CAPTURE.COMPLETED: capture=${captureId}, amount=${captureAmount}, custom_id=${customId}`);

        if (!customId) {
          console.log("[PayPal Webhook] No custom_id on capture — skipping");
          break;
        }

        // ───────────────────────────────────────────────────────────
        // FIX 1 — Field payment intent: payment confirms BEFORE order
        // exists. Materialize the order/invoice/commission from the
        // stored field_quote, then mark intent as paid.
        // ───────────────────────────────────────────────────────────
        if (typeof customId === "string" && customId.startsWith("fpi:")) {
          const intentId = customId.slice(4);
          console.log(`[PayPal Webhook] Field payment intent capture: ${intentId}`);

          const { data: intent, error: intentErr } = await supabase
            .from("field_payment_intents")
            .select("id, status, quote_id, agent_id, amount")
            .eq("id", intentId)
            .maybeSingle();

          if (intentErr || !intent) {
            console.warn(`[PayPal Webhook] field_payment_intent not found: ${intentId}`);
            break;
          }
          if (intent.status === "paid") {
            console.log(`[PayPal Webhook] intent ${intentId} already paid — skipping`);
            break;
          }

          const { data: quote } = await supabase
            .from("field_quotes")
            .select("*")
            .eq("id", intent.quote_id)
            .maybeSingle();

          if (!quote) {
            console.error(`[PayPal Webhook] quote ${intent.quote_id} missing — cannot materialize`);
            break;
          }

          // Build a normalized payload and call field-sales-sync to
          // create order + invoice + commission.
          try {
            const syncResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/field-sales-sync`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
              },
              body: JSON.stringify({
                action: "materialize_from_quote",
                quote_id: quote.id,
                agent_id: intent.agent_id,
                paypal_capture_id: captureId,
                paypal_amount: captureAmount,
              }),
            });
            const syncData = await syncResp.json().catch(() => null);
            console.log(`[PayPal Webhook] materialize_from_quote → ${syncResp.status}`, syncData);

            await supabase
              .from("field_payment_intents")
              .update({
                status: "paid",
                paid_at: new Date().toISOString(),
                converted_field_order_id: syncData?.field_order_id ?? null,
                converted_order_id: syncData?.order_id ?? null,
                converted_invoice_id: syncData?.invoice_id ?? null,
              })
              .eq("id", intentId);

            await supabase
              .from("field_quotes")
              .update({
                status: "converted",
                converted_order_id: syncData?.order_id ?? null,
              })
              .eq("id", quote.id);
          } catch (e) {
            console.error("[PayPal Webhook] materialize_from_quote failed", e);
          }
          break;
        }

        // ───────────────────────────────────────────────────────────
        // Core order payment link (co:<order_id>) — admin generated a
        // PayPal link from CoreOrderDetail and the client just paid.
        // ───────────────────────────────────────────────────────────
        if (typeof customId === "string" && customId.startsWith("co:")) {
          const coreOrderId = customId.slice(3);
          console.log(`[PayPal Webhook] Core order payment capture: ${coreOrderId}`);

          const { data: coreOrder } = await supabase
            .from("orders")
            .select("id, order_number, status, payment_status, client_email, client_first_name, client_last_name, total_amount")
            .eq("id", coreOrderId)
            .maybeSingle();

          if (!coreOrder) {
            console.warn(`[PayPal Webhook] Core order not found: ${coreOrderId}`);
            break;
          }
          if (coreOrder.payment_status === "paid") {
            console.log(`[PayPal Webhook] Core order ${coreOrderId} already paid — skipping`);
            break;
          }

          await supabase
            .from("orders")
            .update({
              status: "confirmed",
              payment_status: "paid",
              payment_method: "paypal",
              payment_reference: captureId,
              provider_payment_id: captureId,
              payment_confirmed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", coreOrderId);

          await supabase.from("order_status_history").insert({
            order_id: coreOrderId,
            status_domain: "payment",
            old_status: coreOrder.payment_status,
            new_status: "paid",
            actor_user_id: null,
            actor_role: "system",
            actor_name: "PayPal Webhook",
            change_reason: "Paiement PayPal reçu (lien admin)",
            metadata: { capture_id: captureId, amount: captureAmount, custom_id: customId },
          });

          if (coreOrder.client_email) {
            const fullName = [coreOrder.client_first_name, coreOrder.client_last_name].filter(Boolean).join(" ") || "client";
            await supabase.from("email_queue").insert({
              event_key: `core_paid_${coreOrderId}_${captureId}`,
              to_email: coreOrder.client_email,
              template_key: "order_payment_confirmed",
              template_vars: {
                client_name: fullName,
                order_number: coreOrder.order_number || coreOrderId.slice(0, 8),
                amount: captureAmount.toFixed(2),
              },
              status: "queued",
              attempts: 0,
              max_attempts: 5,
            });
          }
          break;
        }



        const { data: v2Check } = await supabase
          .from("billing_invoices")
          .select("id, status")
          .eq("id", customId)
          .maybeSingle();

        if (v2Check && v2Check.status !== "paid") {
          // Phase 3.B.1 — RPC canonique idempotente
          const { data: appliedPaymentId, error: rpcError } = await supabase.rpc(
            "apply_payment_from_webhook",
            {
              p_provider: "paypal",
              p_event_id: event.id,
              p_event_type: event.event_type,
              p_provider_created_at: event.create_time || null,
              p_invoice_id: v2Check.id,
              p_amount: captureAmount,
              p_method: "paypal",
              p_external_reference: captureId,
              p_source: "webhook",
              p_context: { paypal_capture_id: captureId, phase: "one_time_capture" },
            }
          );

          if (rpcError) {
            console.error("[PayPal Webhook] apply_payment_from_webhook error (capture):", rpcError);
          } else if (!appliedPaymentId) {
            console.log(`[PayPal Webhook] Capture ${captureId} déjà traitée (short-circuit)`);
          } else {
            console.log(`[PayPal Webhook] ✓ Capture appliquée: payment_id=${appliedPaymentId}`);

            // Lire l'état à jour (jamais d'écriture directe)
            const { data: freshInv } = await supabase
              .from("billing_invoices")
              .select("status, invoice_number, customer_id")
              .eq("id", v2Check.id)
              .maybeSingle();
            const isFullyPaid = freshInv?.status === "paid";

            if (isFullyPaid) {
              // Retrouver l'abonnement lié (via facture) pour éventuelle réactivation
              const { data: subRow } = await supabase
                .from("billing_subscriptions")
                .select("id, status")
                .eq("customer_id", freshInv?.customer_id || null)
                .in("status", ["suspended", "suspended_nonpayment"])
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              if (subRow?.id) {
                const { reactivateIfSuspended } = await import("../_shared/reactivationEngine.ts");
                const reactivation = await reactivateIfSuspended(
                  supabase, subRow.id, v2Check.id, "paypal_capture"
                );
                if (reactivation.reactivated) {
                  console.log(`[PayPal Webhook] ✓ Auto-reactivated subscription ${subRow.id}`);
                }
              }
            }

            await writePaymentAutoNote({
              supabase,
              billingCustomerId: freshInv?.customer_id || null,
              amount: captureAmount,
              method: "paypal",
              provider: "paypal",
              invoiceNumber: freshInv?.invoice_number || null,
              invoiceId: v2Check.id,
              nivraReference: null,
              paymentNumber: null,
              channel: "PayPal (capture)",
            });
          }


        } else if (v2Check?.status === "paid") {
          console.log(`[PayPal Webhook] Invoice ${customId} already paid — skipping`);
        } else {
          console.warn(`[PayPal Webhook] Invoice not found for custom_id=${customId}`);
        }
        break;
      }

      // ═══════════════════════════════════════════════════════════════
      // DISPUTE & CHARGEBACK HANDLERS
      // ═══════════════════════════════════════════════════════════════
      case "CUSTOMER.DISPUTE.CREATED":
      case "RISK.DISPUTE.CREATED":
      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.REVERSED": {
        const disputeId = event.resource.id;
        const paymentId = (event.resource as any).disputed_transactions?.[0]?.seller_transaction_id || 
                          (event.resource as any).seller_transaction_id ||
                          disputeId;
        
        console.log(`[PayPal Webhook] Dispute/Chargeback: ${event.event_type}`, { disputeId, paymentId });
        
        const disputeType = event.event_type.includes("DISPUTE") ? "disputed" : 
                           event.event_type.includes("REVERSED") ? "chargeback" : "fraud";
        
        const { data: payment } = await supabase
          .from("billing_payments")
          .select("*, invoice:billing_invoices(*, subscription:billing_subscriptions(*, customer:billing_customers(*)))")
          .or(`provider_payment_id.eq.${paymentId},provider_payment_id.eq.${disputeId}`)
          .maybeSingle();
        
        if (payment) {
          await supabase.from("billing_payments")
            .update({ status: disputeType, notes: `[${new Date().toISOString()}] PayPal ${event.event_type}: ${disputeId}` })
            .eq("id", payment.id);
          
          if (payment.invoice_id) {
            await supabase.from("billing_invoices")
              .update({ status: disputeType, notes: `[LITIGE] ${event.event_type} - ID: ${disputeId}` })
              .eq("id", payment.invoice_id);
          }
          
          if (payment.invoice?.subscription_id) {
            await supabase.from("billing_subscriptions")
              .update({ status: "suspended", updated_at: new Date().toISOString() })
              .eq("id", payment.invoice.subscription_id);
          }
          
          if (payment.invoice?.order_id) {
            await supabase.from("orders")
              .update({ payment_status: disputeType, updated_at: new Date().toISOString() })
              .eq("id", payment.invoice.order_id);
          }
          
          await supabase.from("billing_system_alerts").insert({
            alert_type: "dispute_created",
            entity_type: "billing_payments",
            entity_id: payment.id,
            severity: "critical",
            details: {
              dispute_type: disputeType,
              paypal_dispute_id: disputeId,
              paypal_event: event.event_type,
              payment_id: paymentId,
              amount: payment.amount,
              invoice_id: payment.invoice_id,
              subscription_id: payment.invoice?.subscription_id,
              scheduled_fee_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
              scheduled_expiry_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            },
            resolved: false,
          });
          
          if (payment.invoice?.subscription?.customer) {
            const customer = payment.invoice.subscription.customer;
            const { buildAutoDocPdfAttachment } = await import("../_shared/pdfFromDb.ts");
            const chargebackPdf = await buildAutoDocPdfAttachment("chargeback_notice", {
              client_email: customer.email,
              first_name: customer.first_name,
              last_name: customer.last_name,
              chargeback_amount: payment.amount,
              chargeback_date: new Date().toISOString(),
              bank_reference: payment.provider_payment_id,
            }).catch(() => null);
            await supabase.from("email_queue").insert({
              event_key: `dispute_${disputeId}`,
              to_email: customer.email,
              template_key: "payment_disputed",
              template_vars: {
                client_name: `${customer.first_name} ${customer.last_name}`,
                amount: payment.amount?.toFixed(2),
                dispute_type: disputeType === "disputed" ? "contestation" :
                             disputeType === "chargeback" ? "rétrofacturation" : "fraude",
                payment_reference: payment.provider_payment_id,
              },
              attachments: chargebackPdf ? [chargebackPdf] : null,
              status: "queued",
              priority: 20,
              attempts: 0,
              max_attempts: 5,
            });

            // P2 — CHARGEBACK ADMIN ALERT
            // Send immediate alert to support@nivra-telecom.ca AND support@nivra-telecom.ca
            const adminRecipients = ["support@nivra-telecom.ca"];
            const clientFullName = `${customer.first_name} ${customer.last_name}`.trim();
            for (const adminEmail of adminRecipients) {
              await supabase.from("email_queue").insert({
                event_key: `dispute_admin_alert_${disputeId}_${adminEmail}`,
                idempotency_key: `dispute_admin_alert_${disputeId}_${adminEmail}`,
                to_email: adminEmail,
                from_email: "Nivra Telecom <support@nivra-telecom.ca>",
                subject: `Alerte: litige PayPal — ${clientFullName}`,
                template_key: "admin_alert_chargeback",
                template_vars: {
                  client_full_name: clientFullName,
                  client_email: customer.email,
                  amount: Number(payment.amount || 0).toFixed(2),
                  paypal_transaction_id: payment.provider_payment_id || disputeId,
                  paypal_dispute_id: disputeId,
                  event_type: event.event_type,
                  dispute_timestamp: event.create_time || new Date().toISOString(),
                  order_id: payment.invoice?.order_id || null,
                  invoice_id: payment.invoice_id,
                },
                status: "queued",
                priority: 20,
                attempts: 0,
                max_attempts: 5,
              });
            }
          }
        } else {
          await supabase.from("billing_system_alerts").insert({
            alert_type: "orphan_dispute",
            entity_type: "paypal_webhook",
            entity_reference: disputeId,
            severity: "high",
            details: { event_type: event.event_type, payment_id: paymentId, dispute_id: disputeId },
            resolved: false,
          });
        }
        break;
      }

      case "CUSTOMER.DISPUTE.RESOLVED": {
        const disputeId = event.resource.id;
        const outcome = (event.resource as any).dispute_outcome?.outcome_code;
        
        console.log(`[PayPal Webhook] Dispute resolved: ${disputeId}, outcome: ${outcome}`);
        
        await supabase.from("billing_system_alerts")
          .update({ resolved: true, resolved_at: new Date().toISOString() })
          .eq("alert_type", "dispute_created")
          .contains("details", { paypal_dispute_id: disputeId });
        
        await supabase.from("activity_logs").insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          entity_type: "dispute_resolution",
          entity_id: null,
          action: "dispute_resolved",
          details: { dispute_id: disputeId, outcome, event: event.event_type },
        });
        break;
      }

      // ═══════════════════════════════════════════════════════════════
      // PAYMENT.SALE.REFUNDED
      // PayPal executed a refund externally (via their dashboard or
      // a 3rd-party process). DB was not updated — fix it here.
      // → billing_payments.status = refunded / partially_refunded
      // → billing_invoices updated
      // → internal team alert only (NOT sent to client — PayPal
      //   already notified the client on their end)
      // ═══════════════════════════════════════════════════════════════
      case "PAYMENT.SALE.REFUNDED": {
        // PayPal v1 resource = refund object:
        //   resource.id           = refund transaction ID
        //   resource.sale_id      = original sale ID (stored in billing_payments.provider_payment_id)
        //   resource.parent_payment = original PayPal payment ID
        //   resource.amount.total = refunded amount
        const refundId = event.resource.id;
        const originalSaleId = (event.resource as any).sale_id as string | undefined;
        const refundAmount = parseFloat(
          (event.resource as any).amount?.total ||
          (event.resource as any).amount?.value ||
          "0"
        );

        console.log(`[PayPal Webhook] PAYMENT.SALE.REFUNDED: refundId=${refundId}, saleId=${originalSaleId}, amount=${refundAmount}`);

        // Find the original payment — try sale_id first, then refund_id as fallback
        const lookupIds = ([originalSaleId, refundId]).filter(Boolean) as string[];
        const { data: payment } = await supabase
          .from("billing_payments")
          .select("id, amount, status, invoice_id, customer_id, payment_number")
          .in("provider_payment_id", lookupIds)
          .maybeSingle();

        if (!payment) {
          console.warn(`[PayPal Webhook] PAYMENT.SALE.REFUNDED: no payment found for saleId=${originalSaleId}, refundId=${refundId}`);
          await supabase.from("billing_system_alerts").insert({
            alert_type: "paypal_refund_unmatched",
            entity_type: "paypal_webhook",
            entity_reference: refundId,
            severity: "high",
            details: {
              paypal_refund_id: refundId,
              original_sale_id: originalSaleId,
              refund_amount: refundAmount,
              event_id: event.id,
              reason: "No billing_payment found with matching provider_payment_id",
            },
            resolved: false,
          });
          break;
        }

        const isPartial = refundAmount > 0 && refundAmount < Number(payment.amount);

        // ─── Phase 3.B.1 — refund canonique via refund_payment() RPC ─────
        // JAMAIS un account_adjustment / invoice_line négative / promotion.
        // La RPC :
        //   - pose son verrou d'idempotence (record_webhook_event)
        //   - insère billing_payment(payment_kind='refund', amount<0)
        //   - réajuste billing_invoices.amount_paid + status atomiquement
        //   - trace provider_event_id / provider_created_at / rpc_used
        const { data: refundPaymentId, error: refundRpcErr } = await supabase.rpc(
          "refund_payment",
          {
            p_provider: "paypal",
            p_event_id: `refund:${refundId}`,
            p_original_payment_id: payment.id,
            p_amount: refundAmount,
            p_external_reference: refundId,
            p_reason: `PayPal external refund${isPartial ? " (partial)" : ""}`,
            p_provider_created_at: event.create_time || null,
            p_context: {
              paypal_refund_id: refundId,
              original_sale_id: originalSaleId,
              is_partial: isPartial,
              webhook_event_id: event.id,
            },
          }
        );

        if (refundRpcErr) {
          console.error("[PayPal Webhook] refund_payment error:", refundRpcErr);
          await supabase.from("billing_system_alerts").insert({
            alert_type: "paypal_refund_rpc_failed",
            entity_type: "billing_payment",
            entity_id: payment.id,
            severity: "high",
            details: {
              paypal_refund_id: refundId,
              rpc_error: refundRpcErr.message,
              event_id: event.id,
            },
          });
          break;
        }

        if (!refundPaymentId) {
          console.log(`[PayPal Webhook] Refund ${refundId} déjà traité — short-circuit`);
          break;
        }

        // Audit alert (aucune écriture directe billing)
        await supabase.from("billing_system_alerts").insert({
          alert_type: "paypal_external_refund",
          entity_type: "billing_payments",
          entity_id: payment.id,
          severity: "medium",
          details: {
            paypal_refund_id: refundId,
            original_sale_id: originalSaleId,
            refund_amount: refundAmount,
            is_partial: isPartial,
            payment_number: payment.payment_number,
            invoice_id: payment.invoice_id,
            customer_id: payment.customer_id,
            event_id: event.id,
            refund_payment_id: refundPaymentId,
            rpc_used: "refund_payment",
          },
          resolved: false,
        });



        // Internal team email — look up customer for context
        const { data: customer } = await supabase
          .from("billing_customers")
          .select("email, first_name, last_name")
          .eq("id", payment.customer_id)
          .maybeSingle();

        await supabase.from("email_queue").insert({
          event_key: `paypal_external_refund_${refundId}`,
          idempotency_key: `paypal_external_refund_${refundId}`,
          to_email: "support@nivra-telecom.ca",
          from_email: "Nivra Telecom <support@nivra-telecom.ca>",
          subject: `Remboursement PayPal externe — ${refundAmount.toFixed(2)} $ CAD — ${customer ? `${customer.first_name} ${customer.last_name}` : payment.payment_number}`,
          template_key: "admin_alert_chargeback",
          template_vars: {
            client_full_name: customer ? `${customer.first_name} ${customer.last_name}` : "Client inconnu",
            client_email: customer?.email || "N/A",
            amount: refundAmount.toFixed(2),
            paypal_transaction_id: originalSaleId || refundId,
            paypal_dispute_id: refundId,
            event_type: "PAYMENT.SALE.REFUNDED (remboursement externe PayPal)",
            dispute_timestamp: event.create_time || new Date().toISOString(),
            order_id: null,
            invoice_id: payment.invoice_id,
          },
          status: "queued",
          priority: 15,
          attempts: 0,
          max_attempts: 3,
        });

        console.log(`[PayPal Webhook] ✓ PAYMENT.SALE.REFUNDED: payment ${payment.id} → ${newPaymentStatus} (${refundAmount.toFixed(2)} CAD)`);
        break;
      }

      default:
        console.log(`[PayPal Webhook] Unhandled event type: ${event.event_type}`);
    }

    return new Response(
      JSON.stringify({ received: true, event_type: event.event_type }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[PayPal Webhook] Error:", error);
    // Fire-and-forget — never block the webhook response.
    reportEdgeError(error, {
      function: "paypal-webhook",
      transmission_id: req.headers.get("paypal-transmission-id"),
    }).catch(() => {});
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
