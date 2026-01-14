import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

/**
 * Resend Webhook Handler
 * Tracks email opens, clicks, bounces, and complaints
 * 
 * Configure in Resend Dashboard:
 * Webhook URL: https://<project-ref>.supabase.co/functions/v1/resend-webhook
 * Events: email.delivered, email.opened, email.clicked, email.bounced, email.complained
 */

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    click?: {
      link: string;
      timestamp: string;
    };
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const event: ResendWebhookEvent = await req.json();
    console.log(`[Resend Webhook] Event: ${event.type}, Email ID: ${event.data.email_id}`);

    const resendId = event.data.email_id;
    const toEmail = event.data.to[0];

    // Find the email send record
    const { data: emailSend, error: findError } = await supabase
      .from("email_sends")
      .select("id, campaign_id, automation_rule_id, open_count, click_count, click_urls")
      .eq("resend_id", resendId)
      .maybeSingle();

    if (findError) {
      console.error("Error finding email send:", findError);
    }

    // If not found by resend_id, try by email (for older sends)
    let sendId = emailSend?.id;
    if (!sendId) {
      const { data: byEmail } = await supabase
        .from("email_sends")
        .select("id, campaign_id, automation_rule_id, open_count, click_count, click_urls")
        .eq("to_email", toEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (byEmail) {
        sendId = byEmail.id;
      }
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {};
    let campaignUpdate: Record<string, unknown> | null = null;

    switch (event.type) {
      case "email.delivered":
        updates.status = "delivered";
        updates.delivered_at = now;
        campaignUpdate = { field: "total_delivered", increment: 1 };
        break;

      case "email.opened":
        updates.status = "opened";
        updates.opened_at = now;
        updates.open_count = (emailSend?.open_count || 0) + 1;
        campaignUpdate = { field: "total_opened", increment: 1 };
        break;

      case "email.clicked":
        updates.status = "clicked";
        updates.clicked_at = now;
        updates.click_count = (emailSend?.click_count || 0) + 1;
        
        // Track clicked URLs
        const clickUrls = (emailSend?.click_urls as string[]) || [];
        if (event.data.click?.link && !clickUrls.includes(event.data.click.link)) {
          clickUrls.push(event.data.click.link);
        }
        updates.click_urls = clickUrls;
        
        campaignUpdate = { field: "total_clicked", increment: 1 };
        break;

      case "email.bounced":
        updates.status = "bounced";
        updates.bounced_at = now;
        campaignUpdate = { field: "total_bounced", increment: 1 };
        
        // Add to unsubscribe list
        await supabase.from("email_unsubscribes").upsert({
          email: toEmail,
          reason: "bounced",
          source: "resend_webhook",
          is_active: true
        }, { onConflict: "email" });
        break;

      case "email.complained":
        updates.status = "complained";
        
        // Add to unsubscribe list
        await supabase.from("email_unsubscribes").upsert({
          email: toEmail,
          reason: "complained",
          source: "resend_webhook",
          is_active: true
        }, { onConflict: "email" });
        break;

      case "email.unsubscribed":
        await supabase.from("email_unsubscribes").upsert({
          email: toEmail,
          reason: "unsubscribed",
          source: "resend_webhook",
          is_active: true
        }, { onConflict: "email" });
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Update email send record
    if (sendId && Object.keys(updates).length > 0) {
      await supabase
        .from("email_sends")
        .update(updates)
        .eq("id", sendId);
    }

    // Update campaign stats
    if (emailSend?.campaign_id && campaignUpdate) {
      // Use raw SQL increment to avoid race conditions
      const { error: campaignError } = await supabase.rpc("increment_campaign_stat", {
        p_campaign_id: emailSend.campaign_id,
        p_field: campaignUpdate.field,
        p_increment: campaignUpdate.increment
      });

      if (campaignError) {
        console.error("Error updating campaign stats:", campaignError);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
