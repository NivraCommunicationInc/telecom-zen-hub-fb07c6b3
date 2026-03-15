import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ============================================================================
 * PAYPAL WEBHOOK HANDLER - SECURE
 * ============================================================================
 * 
 * This function handles incoming PayPal webhook events for subscription billing.
 * 
 * SECURITY:
 * - Validates PayPal webhook signature to prevent spoofing
 * - Uses service role key for database operations
 * - All events are logged for audit trail
 * 
 * EVENTS HANDLED:
 * - BILLING.SUBSCRIPTION.ACTIVATED: Customer approved subscription
 * - BILLING.SUBSCRIPTION.CANCELLED: Subscription was cancelled
 * - BILLING.SUBSCRIPTION.SUSPENDED: Payment failed, subscription suspended
 * - BILLING.SUBSCRIPTION.PAYMENT.FAILED: Individual payment failed
 * - PAYMENT.SALE.COMPLETED: Successful monthly charge
 * 
 * @author Nivra Telecom
 * @version 2.1.0 - Added signature verification
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
 * This is CRITICAL for security - prevents spoofed webhook attacks
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

  // Get verification headers from PayPal
  const transmissionId = req.headers.get("paypal-transmission-id");
  const transmissionTime = req.headers.get("paypal-transmission-time");
  const certUrl = req.headers.get("paypal-cert-url");
  const authAlgo = req.headers.get("paypal-auth-algo");
  const transmissionSig = req.headers.get("paypal-transmission-sig");

  // If any header is missing, verification fails
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    console.warn("[PayPal Webhook] Missing verification headers - possible spoofed request");
    return false;
  }

  try {
    // Get access token
    const auth = btoa(`${clientId}:${clientSecret}`);
    const tokenResponse = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      console.error("[PayPal Webhook] Failed to get access token for verification");
      return false;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Verify webhook signature with PayPal
    const verifyResponse = await fetch("https://api-m.paypal.com/v1/notifications/verify-webhook-signature", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
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
    } else {
      console.log("[PayPal Webhook] Signature verified successfully");
    }
    
    return isValid;
  } catch (error) {
    console.error("[PayPal Webhook] Verification error:", error);
    return false;
  }
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
    
    // Read the raw body for signature verification
    const rawBody = await req.text();
    
    // SECURITY: Verify webhook signature
    if (webhookId) {
      const isValid = await verifyPayPalWebhook(req, rawBody, webhookId);
      if (!isValid) {
        console.error("[PayPal Webhook] SECURITY: Invalid signature - rejecting request");
        
        // Log the security event
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
      console.warn("[PayPal Webhook] WARNING: PAYPAL_WEBHOOK_ID not configured - signature verification disabled");
    }
    
    // Parse the webhook event
    const event: PayPalWebhookEvent = JSON.parse(rawBody);
    
    console.log(`[PayPal Webhook] Received event: ${event.event_type}`, {
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
        verified: !!webhookId,
      },
    });

    // Handle different event types
    switch (event.event_type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        // Subscription was approved and activated by customer
        const paypalSubscriptionId = event.resource.id;
        const customId = event.resource.custom_id;
        
        console.log(`[PayPal Webhook] Subscription activated: ${paypalSubscriptionId}`);
        
        // Update billing_subscription by PayPal subscription ID first (primary method)
        const { data: existingSub } = await supabase
          .from("billing_subscriptions")
          .select("id")
          .eq("paypal_subscription_id", paypalSubscriptionId)
          .single();
        
        if (existingSub) {
          await supabase
            .from("billing_subscriptions")
            .update({
              status: "active",
              auto_billing_enabled: true,
            })
            .eq("id", existingSub.id);
          
          console.log(`[PayPal Webhook] Subscription ${existingSub.id} activated`);
          
            // Also mark the initial invoice as paid via RPC if there's a pending one
            const { data: pendingInvoice } = await supabase
              .from("billing_invoices")
              .select("id, total")
              .eq("subscription_id", existingSub.id)
              .in("status", ["pending", "partially_paid"])
              .order("created_at", { ascending: true })
              .limit(1)
              .single();
            
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
                }
              );
              if (rpcError) {
                console.error("[PayPal Webhook] RPC error on subscription activation:", rpcError);
              } else {
                console.log(`[PayPal Webhook] Initial invoice paid via RPC:`, rpcResult);
              }
            }
        } else if (customId && customId.startsWith("order_")) {
          // Fallback: try to find by custom_id pattern
          console.log(`[PayPal Webhook] Looking for subscription with order pattern: ${customId}`);
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.CANCELLED": {
        // Customer or merchant cancelled the subscription
        const paypalSubscriptionId = event.resource.id;
        
        console.log(`[PayPal Webhook] Subscription cancelled: ${paypalSubscriptionId}`);
        
        // Find and update the subscription
        const { error } = await supabase
          .from("billing_subscriptions")
          .update({
            status: "cancelled",
            auto_billing_enabled: false,
          })
          .eq("paypal_subscription_id", paypalSubscriptionId);
        
        if (error) {
          console.error("[PayPal Webhook] Failed to cancel subscription:", error);
        }
        
        // Queue notification email
        const { data: sub } = await supabase
          .from("billing_subscriptions")
          .select("*, customer:billing_customers(*)")
          .eq("paypal_subscription_id", paypalSubscriptionId)
          .single();
        
        if (sub?.customer) {
          await supabase.from("email_queue").insert({
            event_key: `paypal_cancelled_${paypalSubscriptionId}`,
            to_email: sub.customer.email,
            template_key: "subscription_cancelled",
            template_vars: {
              client_name: `${sub.customer.first_name} ${sub.customer.last_name}`,
              plan_name: sub.plan_name,
            },
            status: "queued",
            attempts: 0,
            max_attempts: 5,
          });
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.SUSPENDED": {
        // Subscription suspended due to payment failure
        const paypalSubscriptionId = event.resource.id;
        
        console.log(`[PayPal Webhook] Subscription suspended: ${paypalSubscriptionId}`);
        
        const { error } = await supabase
          .from("billing_subscriptions")
          .update({
            status: "suspended",
          })
          .eq("paypal_subscription_id", paypalSubscriptionId);
        
        if (error) {
          console.error("[PayPal Webhook] Failed to suspend subscription:", error);
        }
        
        // Create alert for admin
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

      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
        // A subscription payment failed
        const paypalSubscriptionId = event.resource.billing_agreement_id || event.resource.id;
        
        console.log(`[PayPal Webhook] Payment failed for subscription: ${paypalSubscriptionId}`);
        
        // Create alert
        await supabase.from("billing_system_alerts").insert({
          alert_type: "payment_failed",
          entity_type: "billing_subscriptions",
          entity_reference: paypalSubscriptionId,
          details: {
            event_id: event.id,
            amount: event.resource.amount,
          },
        });
        
        // Find subscription and notify customer
        const { data: sub } = await supabase
          .from("billing_subscriptions")
          .select("*, customer:billing_customers(*)")
          .eq("paypal_subscription_id", paypalSubscriptionId)
          .single();
        
        if (sub?.customer) {
          await supabase.from("email_queue").insert({
            event_key: `paypal_failed_${event.id}`,
            to_email: sub.customer.email,
            template_key: "payment_failed",
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
        break;
      }

      case "PAYMENT.SALE.COMPLETED": {
        // A payment was successfully completed (monthly charge)
        const paymentId = event.resource.id;
        const billingAgreementId = event.resource.billing_agreement_id;
        const amount = parseFloat(event.resource.amount?.total || event.resource.amount?.value || "0");
        
        console.log(`[PayPal Webhook] Payment completed: ${paymentId}, Amount: ${amount}`);
        
        if (billingAgreementId) {
          // Find the subscription
          const { data: sub } = await supabase
            .from("billing_subscriptions")
            .select("*, customer:billing_customers(*)")
            .eq("paypal_subscription_id", billingAgreementId)
            .single();
          
          if (sub) {
            // Find pending/unpaid invoice for this subscription
            const { data: invoice } = await supabase
              .from("billing_invoices")
              .select("id")
              .eq("subscription_id", sub.id)
              .in("status", ["pending", "partially_paid"])
              .order("created_at", { ascending: false })
              .limit(1)
              .single();
            
            if (invoice) {
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
                console.log(`[PayPal Webhook] Subscription payment applied via RPC:`, rpcResult);

                // If fully paid, update subscription cycle
                if (rpcResult?.is_fully_paid) {
                  const newCycleStart = new Date(sub.cycle_end_date);
                  const newCycleEnd = new Date(sub.cycle_end_date);
                  newCycleEnd.setDate(newCycleEnd.getDate() + 30);
                  
                  await supabase
                    .from("billing_subscriptions")
                    .update({
                      cycle_start_date: newCycleStart.toISOString().split('T')[0],
                      cycle_end_date: newCycleEnd.toISOString().split('T')[0],
                      last_invoice_id: invoice.id,
                    })
                    .eq("id", sub.id);
                }

                // Queue confirmation email
                if (sub.customer && !rpcResult?.already_processed) {
                  await supabase.from("email_queue").insert({
                    event_key: `paypal_payment_${paymentId}`,
                    to_email: sub.customer.email,
                    template_key: "payment_confirmed",
                    template_vars: {
                      client_name: `${sub.customer.first_name} ${sub.customer.last_name}`,
                      amount: amount.toFixed(2),
                      invoice_number: rpcResult?.invoice_number || "N/A",
                      payment_method: "PayPal (Paiement automatique)",
                      reference: paymentId,
                    },
                    status: "queued",
                    attempts: 0,
                    max_attempts: 5,
                  });
                }
              }
            }
          }
        }
        break;
      }

      // =========================================================================
      // ONE-TIME PAYMENT CAPTURE — safety net for invoice payments
      // =========================================================================
      case "PAYMENT.CAPTURE.COMPLETED": {
        const captureId = event.resource.id;
        const captureAmount = parseFloat(
          (event.resource as any).amount?.value || "0"
        );
        const customId = (event.resource as any).custom_id;

        console.log(
          `[PayPal Webhook] PAYMENT.CAPTURE.COMPLETED: capture=${captureId}, amount=${captureAmount}, custom_id=${customId}`
        );

        if (!customId) {
          console.log("[PayPal Webhook] No custom_id on capture — skipping");
          break;
        }

        // Try V2 invoice first — use the transactional DB function
        const { data: v2Check } = await supabase
          .from("billing_invoices")
          .select("id, status")
          .eq("id", customId)
          .maybeSingle();

        if (v2Check && v2Check.status !== "paid") {
          // ★ USE THE TRANSACTIONAL DB FUNCTION ★
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
            console.log(`[PayPal Webhook] V2 invoice updated via DB function:`, rpcResult);
          }
        } else if (v2Check?.status === "paid") {
          console.log(`[PayPal Webhook] Invoice ${customId} already paid — skipping`);
        } else {
          // Legacy billing table access has been permanently removed.
          // All invoices must exist in billing_invoices (canonical Core table).
          console.warn(`[PayPal Webhook] Invoice not found in billing_invoices for custom_id=${customId} — no legacy fallback`);
        }

        break;
      }

      // =========================================================================
      // DISPUTE & CHARGEBACK HANDLERS (V2.5 - Billing Rules)
      // =========================================================================
      case "CUSTOMER.DISPUTE.CREATED":
      case "RISK.DISPUTE.CREATED":
      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.REVERSED": {
        // A dispute/chargeback was initiated
        const disputeId = event.resource.id;
        const paymentId = (event.resource as any).disputed_transactions?.[0]?.seller_transaction_id || 
                          (event.resource as any).seller_transaction_id ||
                          disputeId;
        
        console.log(`[PayPal Webhook] Dispute/Chargeback detected: ${event.event_type}`, { disputeId, paymentId });
        
        // Determine dispute type
        const disputeType = event.event_type.includes("DISPUTE") ? "disputed" : 
                           event.event_type.includes("REVERSED") ? "chargeback" : "fraud";
        
        // Try to find the payment by provider_payment_id
        const { data: payment } = await supabase
          .from("billing_payments")
          .select("*, invoice:billing_invoices(*, subscription:billing_subscriptions(*, customer:billing_customers(*)))")
          .or(`provider_payment_id.eq.${paymentId},provider_payment_id.eq.${disputeId}`)
          .maybeSingle();
        
        if (payment) {
          // 1. Update payment status
          await supabase
            .from("billing_payments")
            .update({
              status: disputeType,
              notes: `[${new Date().toISOString()}] PayPal ${event.event_type}: ${disputeId}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment.id);
          
          // 2. Update invoice status if exists
          if (payment.invoice_id) {
            await supabase
              .from("billing_invoices")
              .update({
                status: disputeType,
                notes: `[LITIGE] ${event.event_type} - ID: ${disputeId}`,
                updated_at: new Date().toISOString(),
              })
              .eq("id", payment.invoice_id);
          }
          
          // 3. Suspend the subscription immediately
          if (payment.invoice?.subscription_id) {
            await supabase
              .from("billing_subscriptions")
              .update({
                status: "suspended",
                updated_at: new Date().toISOString(),
              })
              .eq("id", payment.invoice.subscription_id);
          }
          
          // 4. Update order payment_status if linked
          if (payment.invoice?.order_id) {
            await supabase
              .from("orders")
              .update({
                payment_status: disputeType,
                updated_at: new Date().toISOString(),
              })
              .eq("id", payment.invoice.order_id);
          }
          
          // 5. Create dispute record for J+2/J+5 processing
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
              created_at: new Date().toISOString(),
              // Schedule J+2 (admin fee) and J+5 (expiration)
              scheduled_fee_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
              scheduled_expiry_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            },
            resolved: false,
          });
          
          // 6. Notify customer
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
          }
          
          console.log(`[PayPal Webhook] Dispute processed: payment ${payment.id} marked as ${disputeType}`);
        } else {
          // Log orphan dispute for manual review
          await supabase.from("billing_system_alerts").insert({
            alert_type: "orphan_dispute",
            entity_type: "paypal_webhook",
            entity_reference: disputeId,
            severity: "high",
            details: {
              event_type: event.event_type,
              payment_id: paymentId,
              dispute_id: disputeId,
              resource: event.resource,
            },
            resolved: false,
          });
          console.warn(`[PayPal Webhook] Orphan dispute - no matching payment found: ${paymentId}`);
        }
        break;
      }

      case "CUSTOMER.DISPUTE.RESOLVED": {
        // Dispute was resolved (won or lost)
        const disputeId = event.resource.id;
        const outcome = (event.resource as any).dispute_outcome?.outcome_code;
        
        console.log(`[PayPal Webhook] Dispute resolved: ${disputeId}, outcome: ${outcome}`);
        
        // Mark alert as resolved (match by paypal_dispute_id in details)
        await supabase
          .from("billing_system_alerts")
          .update({ resolved: true, resolved_at: new Date().toISOString() })
          .eq("alert_type", "dispute_created")
          .contains("details", { paypal_dispute_id: disputeId });
        
        // If we won the dispute, we could reactivate - but typically requires manual review
        await supabase.from("activity_logs").insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          entity_type: "dispute_resolution",
          entity_id: disputeId,
          action: "dispute_resolved",
          details: {
            outcome,
            event: event.event_type,
          },
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
    // Return 200 to prevent PayPal from retrying on parse errors
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
