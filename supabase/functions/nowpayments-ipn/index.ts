import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-nowpayments-sig",
};

// HMAC SHA-512 signature verification
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    
    return computedSignature.toLowerCase() === signature.toLowerCase();
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

// Sort object keys for consistent signature
function sortObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(obj).sort().reduce((result: Record<string, unknown>, key: string) => {
    const value = obj[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sortObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
    return result;
  }, {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get IPN secret from environment
    const ipnSecret = Deno.env.get("NOWPAYMENTS_IPN_SECRET");
    if (!ipnSecret) {
      console.error("NOWPAYMENTS_IPN_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "IPN secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get signature from header
    const signature = req.headers.get("x-nowpayments-sig");
    const rawBody = await req.text();
    
    // Parse payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error("Invalid JSON payload");
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentId = String(payload.payment_id || "");
    
    // Log IPN attempt
    const { data: ipnLog } = await supabase
      .from("crypto_ipn_logs")
      .insert({
        payment_id: paymentId,
        event_type: payload.payment_status as string,
        raw_payload: payload,
        signature_valid: false,
        processed: false,
      })
      .select()
      .single();

    // Verify signature
    if (!signature) {
      console.error("Missing signature header");
      
      // Update log with error
      if (ipnLog) {
        await supabase
          .from("crypto_ipn_logs")
          .update({ error_message: "Missing signature header" })
          .eq("id", ipnLog.id);
      }

      // Log security event
      await supabase.from("admin_security_audit").insert({
        admin_user_id: "00000000-0000-0000-0000-000000000000",
        action: "ipn_signature_failed",
        target_type: "crypto_ipn",
        details: { reason: "Missing signature", payment_id: paymentId },
      });

      return new Response(
        JSON.stringify({ error: "Missing signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sort payload and verify
    const sortedPayload = sortObject(payload);
    const payloadString = JSON.stringify(sortedPayload);
    const isValid = await verifySignature(payloadString, signature, ipnSecret);

    if (!isValid) {
      console.error("Invalid signature");
      
      // Update log with error
      if (ipnLog) {
        await supabase
          .from("crypto_ipn_logs")
          .update({ error_message: "Invalid signature" })
          .eq("id", ipnLog.id);
      }

      // Log security event
      await supabase.from("admin_security_audit").insert({
        admin_user_id: "00000000-0000-0000-0000-000000000000",
        action: "ipn_signature_failed",
        target_type: "crypto_ipn",
        details: { reason: "Invalid signature", payment_id: paymentId },
      });

      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Signature valid - update log
    if (ipnLog) {
      await supabase
        .from("crypto_ipn_logs")
        .update({ signature_valid: true })
        .eq("id", ipnLog.id);
    }

    console.log("Valid IPN received:", JSON.stringify(payload));

    // Find the crypto_payment record
    const { data: cryptoPayment, error: findError } = await supabase
      .from("crypto_payments")
      .select("*")
      .eq("payment_id", paymentId)
      .single();

    if (findError || !cryptoPayment) {
      console.error("Crypto payment not found:", paymentId);
      
      if (ipnLog) {
        await supabase
          .from("crypto_ipn_logs")
          .update({ error_message: "Payment record not found", processed: true })
          .eq("id", ipnLog.id);
      }

      return new Response(
        JSON.stringify({ error: "Payment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update crypto_payment with IPN data
    const updateData: Record<string, unknown> = {
      payment_status: payload.payment_status,
      raw_ipn: payload,
      updated_at: new Date().toISOString(),
    };

    if (payload.actually_paid) {
      updateData.actually_paid = payload.actually_paid;
    }
    if (payload.outcome_amount) {
      updateData.outcome_amount = payload.outcome_amount;
    }
    if (payload.outcome_currency) {
      updateData.outcome_currency = payload.outcome_currency;
    }
    if (payload.pay_amount) {
      updateData.pay_amount = payload.pay_amount;
    }

    const { error: updateError } = await supabase
      .from("crypto_payments")
      .update(updateData)
      .eq("id", cryptoPayment.id);

    if (updateError) {
      console.error("Error updating crypto_payment:", updateError);
      
      if (ipnLog) {
        await supabase
          .from("crypto_ipn_logs")
          .update({ error_message: "Failed to update payment", processed: true })
          .eq("id", ipnLog.id);
      }

      return new Response(
        JSON.stringify({ error: "Failed to update payment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Link IPN log to crypto_payment
    if (ipnLog) {
      await supabase
        .from("crypto_ipn_logs")
        .update({ 
          crypto_payment_id: cryptoPayment.id,
          processed: true 
        })
        .eq("id", ipnLog.id);
    }

    // If payment is finished/confirmed, update the order/billing
    const finalStatuses = ["finished", "confirmed"];
    if (finalStatuses.includes(String(payload.payment_status))) {
      // Update order payment_status if linked
      if (cryptoPayment.order_id) {
        await supabase
          .from("orders")
          .update({ payment_status: "paid" })
          .eq("id", cryptoPayment.order_id);
      }

      // Update billing status if linked
      if (cryptoPayment.billing_id) {
        await supabase
          .from("billing")
          .update({ 
            status: "paid",
            paid_at: new Date().toISOString(),
            payment_method_type: "crypto",
            payment_reference: `${payload.pay_currency}:${paymentId}`,
          })
          .eq("id", cryptoPayment.billing_id);
      }
    }

    // Log successful IPN processing
    await supabase.from("admin_security_audit").insert({
      admin_user_id: "00000000-0000-0000-0000-000000000000",
      action: "ipn_processed",
      target_type: "crypto_payment",
      target_id: cryptoPayment.id,
      details: {
        payment_id: paymentId,
        status: payload.payment_status,
        pay_currency: payload.pay_currency,
        actually_paid: payload.actually_paid,
      },
    });

    // Also log status update
    await supabase.from("admin_security_audit").insert({
      admin_user_id: "00000000-0000-0000-0000-000000000000",
      action: "crypto_payment_status_updated",
      target_type: "crypto_payment",
      target_id: cryptoPayment.id,
      details: {
        old_status: cryptoPayment.payment_status,
        new_status: payload.payment_status,
        payment_id: paymentId,
      },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in nowpayments-ipn:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
