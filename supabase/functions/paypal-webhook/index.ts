import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID");
    
    // Parse the webhook event
    const event: PayPalWebhookEvent = await req.json();
    
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
      },
    });

    // Handle different event types
    switch (event.event_type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        // Subscription was approved and activated by customer
        const paypalSubscriptionId = event.resource.id;
        const customId = event.resource.custom_id;
        
        console.log(`[PayPal Webhook] Subscription activated: ${paypalSubscriptionId}`);
        
        // Update billing_subscription if custom_id matches our subscription id
        if (customId) {
          const { error } = await supabase
            .from("billing_subscriptions")
            .update({
              paypal_subscription_id: paypalSubscriptionId,
              status: "active",
              auto_billing_enabled: true,
            })
            .eq("id", customId);
          
          if (error) {
            console.error("[PayPal Webhook] Failed to update subscription:", error);
          } else {
            console.log(`[PayPal Webhook] Subscription ${customId} activated with PayPal ID ${paypalSubscriptionId}`);
          }
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
          entity_id: paypalSubscriptionId,
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
          entity_id: paypalSubscriptionId,
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
            // Find pending invoice for this subscription
            const { data: invoice } = await supabase
              .from("billing_invoices")
              .select("*")
              .eq("subscription_id", sub.id)
              .eq("status", "pending")
              .order("created_at", { ascending: false })
              .limit(1)
              .single();
            
            if (invoice) {
              // Record the payment
              await supabase.from("billing_payments").insert({
                invoice_id: invoice.id,
                customer_id: sub.customer_id,
                amount: amount,
                method: "paypal",
                provider: "paypal",
                provider_payment_id: paymentId,
                status: "confirmed",
                received_at: new Date().toISOString(),
                source: "live",
              });
              
              // Update invoice
              const newAmountPaid = (invoice.amount_paid || 0) + amount;
              const newBalanceDue = invoice.total - newAmountPaid;
              
              await supabase
                .from("billing_invoices")
                .update({
                  amount_paid: newAmountPaid,
                  balance_due: newBalanceDue,
                  status: newBalanceDue <= 0 ? "paid" : "pending",
                  paid_at: newBalanceDue <= 0 ? new Date().toISOString() : null,
                })
                .eq("id", invoice.id);
              
              // If fully paid, update subscription cycle
              if (newBalanceDue <= 0) {
                const newCycleStart = new Date(invoice.cycle_end_date);
                const newCycleEnd = new Date(invoice.cycle_end_date);
                newCycleEnd.setDate(newCycleEnd.getDate() + 30);
                
                await supabase
                  .from("billing_subscriptions")
                  .update({
                    status: "active",
                    cycle_start_date: newCycleStart.toISOString().split('T')[0],
                    cycle_end_date: newCycleEnd.toISOString().split('T')[0],
                    last_invoice_id: invoice.id,
                  })
                  .eq("id", sub.id);
              }
              
              console.log(`[PayPal Webhook] Payment recorded for invoice ${invoice.invoice_number}`);
              
              // Queue confirmation email
              if (sub.customer) {
                await supabase.from("email_queue").insert({
                  event_key: `paypal_payment_${paymentId}`,
                  to_email: sub.customer.email,
                  template_key: "payment_confirmed",
                  template_vars: {
                    client_name: `${sub.customer.first_name} ${sub.customer.last_name}`,
                    amount: amount.toFixed(2),
                    invoice_number: invoice.invoice_number,
                    payment_method: "PayPal",
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
