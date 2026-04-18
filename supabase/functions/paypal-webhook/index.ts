import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
  } catch {
    return { raw: customId };
  }
}

/**
 * Find subscription by PayPal subscription ID
 */
async function findSubscription(supabase: any, paypalSubscriptionId: string) {
  const { data } = await supabase
    .from("billing_subscriptions")
    .select("id, customer_id, plan_name, plan_code, plan_price, cycle_start_date, cycle_end_date, status, recurring_setup_status, order_id, customer:billing_customers(email, first_name, last_name, phone)")
    .eq("paypal_subscription_id", paypalSubscriptionId)
    .maybeSingle();
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID");
    
    const rawBody = await req.text();
    
    // SECURITY: Verify webhook signature
    if (webhookId) {
      const isValid = await verifyPayPalWebhook(req, rawBody, webhookId);
      if (!isValid) {
        console.error("[PayPal Webhook] SECURITY: Invalid signature - rejecting request");
        await supabase.from("activity_logs").insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          entity_type: "security_event",
          entity_id: "paypal_webhook",
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
    } else {
      console.error("[PayPal Webhook] PAYPAL_WEBHOOK_ID not configured — rejecting");
      return new Response(
        JSON.stringify({ error: "Webhook signature verification not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const event: PayPalWebhookEvent = JSON.parse(rawBody);
    
    console.log(`[PayPal Webhook] Received: ${event.event_type}`, {
      id: event.id,
      resource_id: event.resource?.id,
      custom_id: event.resource?.custom_id,
    });

    // Log the webhook event
    await supabase.from("activity_logs").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      entity_type: "paypal_webhook",
      entity_id: event.id,
      action: event.event_type,
      details: {
        resource_id: event.resource?.id,
        resource_type: event.resource_type,
        custom_id: event.resource?.custom_id,
        status: event.resource?.status,
        verified: true,
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
            const { data: rpcResult, error: rpcError } = await supabase.rpc(
              "apply_payment_to_invoice",
              {
                p_invoice_id: pendingInvoice.id,
                p_amount: pendingInvoice.total,
                p_method: "paypal",
                p_provider: "paypal",
                p_provider_payment_id: `sub_activation_${paypalSubscriptionId}`,
                p_source: "webhook_subscription",
                p_created_by_name: "PayPal Webhook",
                p_created_by_role: "system",
                p_customer_id: sub.customer_id,
              }
            );
            if (rpcError) {
              console.error("[PayPal Webhook] RPC error on activation:", rpcError);
            } else {
              console.log(`[PayPal Webhook] ✓ Initial invoice paid:`, rpcResult);
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
                reason: event.resource.status_change_note || "Annulé via PayPal",
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

        // ★ USE THE TRANSACTIONAL DB FUNCTION ★
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          "apply_payment_to_invoice",
          {
            p_invoice_id: invoice.id,
            p_amount: amount,
            p_method: "paypal",
            p_provider: "paypal",
            p_provider_payment_id: paymentId,
            p_source: "webhook_subscription",
            p_created_by_name: "PayPal Webhook",
            p_created_by_role: "system",
            p_customer_id: sub.customer_id,
          }
        );

        if (rpcError) {
          console.error("[PayPal Webhook] apply_payment_to_invoice error:", rpcError);
        } else {
          console.log(`[PayPal Webhook] ✓ Payment applied:`, rpcResult);

          // Advance billing cycle if fully paid
          if (rpcResult?.is_fully_paid) {
            const newCycleStart = new Date(sub.cycle_end_date);
            const newCycleEnd = new Date(sub.cycle_end_date);
            newCycleEnd.setDate(newCycleEnd.getDate() + 30);
            
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
          }

          // Trace audit
          await supabase.from("billing_subscription_trace_audit").insert({
            subscription_id: sub.id,
            customer_id: sub.customer_id,
            action: "paypal_recurring_payment_received",
            source_type: "webhook",
            source_id: event.id,
            details: {
              payment_id: paymentId,
              amount,
              invoice_id: invoice.id,
              is_fully_paid: rpcResult?.is_fully_paid,
              already_processed: rpcResult?.already_processed,
            },
            reason: `PayPal recurring payment $${amount} applied to invoice ${invoice.invoice_number || invoice.id}`,
          });

          // Notify customer
          if (sub.customer && !rpcResult?.already_processed) {
            await supabase.from("email_queue").insert({
              event_key: `paypal_payment_${paymentId}`,
              to_email: sub.customer.email,
              template_key: "payment_confirmed",
              template_vars: {
                client_name: `${sub.customer.first_name} ${sub.customer.last_name}`,
                amount: amount.toFixed(2),
                amount_paid_today: amount.toFixed(2),
                total_payable: Number(invoice.total || amount).toFixed(2),
                invoice_id: invoice.id,
                order_id: invoice.order_id || undefined,
                invoice_number: rpcResult?.invoice_number || invoice.invoice_number || "N/A",
                payment_method: "PayPal (Paiement automatique)",
                reference: paymentId,
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

        const { data: v2Check } = await supabase
          .from("billing_invoices")
          .select("id, status")
          .eq("id", customId)
          .maybeSingle();

        if (v2Check && v2Check.status !== "paid") {
          const { data: rpcResult, error: rpcError } = await supabase.rpc(
            "apply_payment_to_invoice",
            {
              p_invoice_id: v2Check.id,
              p_amount: captureAmount,
              p_method: "paypal",
              p_provider: "paypal",
              p_provider_payment_id: captureId,
              p_source: "webhook",
              p_created_by_name: "PayPal Webhook",
              p_created_by_role: "system",
            }
          );

          if (rpcError) {
            console.error("[PayPal Webhook] apply_payment_to_invoice error:", rpcError);
          } else {
            console.log(`[PayPal Webhook] ✓ Invoice updated via RPC:`, rpcResult);
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
              status: "queued",
              priority: "urgent",
              attempts: 0,
              max_attempts: 5,
            });

            // P2 — CHARGEBACK ADMIN ALERT
            // Send immediate alert to support@nivra-telecom.ca AND nivratelecom@gmail.com
            const adminRecipients = ["support@nivra-telecom.ca", "nivratelecom@gmail.com"];
            const clientFullName = `${customer.first_name} ${customer.last_name}`.trim();
            for (const adminEmail of adminRecipients) {
              await supabase.from("email_queue").insert({
                event_key: `dispute_admin_alert_${disputeId}_${adminEmail}`,
                idempotency_key: `dispute_admin_alert_${disputeId}_${adminEmail}`,
                to_email: adminEmail,
                from_email: "Nivra Telecom <support@nivra-telecom.ca>",
                subject: `🚨 Chargeback détecté — ${clientFullName} — ${Number(payment.amount || 0).toFixed(2)}$`,
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
                priority: "urgent",
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
          entity_id: disputeId,
          action: "dispute_resolved",
          details: { outcome, event: event.event_type },
        });
        break;
      }

      default:
        console.log(`[PayPal Webhook] Unhandled event type: ${event.event_type}`);
    }

    return new Response(
      JSON.stringify({ received: true, event_type: event.event_type }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[PayPal Webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
