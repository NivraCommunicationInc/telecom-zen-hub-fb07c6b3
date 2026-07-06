/**
 * marketing-resend-webhook — Reçoit les événements Resend (delivered, opened, clicked, bounced, complained).
 * Configure l'URL de ce endpoint dans le dashboard Resend → Webhooks.
 * verify_jwt = false (endpoint public appelé par Resend).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const evt = await req.json();
    const type: string = evt.type ?? "unknown";
    const data = evt.data ?? {};
    const messageId: string | undefined = data.email_id ?? data.id;

    await admin.from("mkt_webhook_events").insert({
      provider: "resend", event_type: type, payload: evt,
    });

    if (!messageId) return ok();

    const now = new Date().toISOString();
    const statusMap: Record<string, string> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.opened": "opened",
      "email.clicked": "clicked",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.failed": "failed",
    };
    const newStatus = statusMap[type];
    if (!newStatus) return ok();

    const { data: row } = await admin.from("mkt_send_log")
      .select("id, campaign_id, status, open_count, click_count")
      .eq("provider_message_id", messageId).maybeSingle();
    if (!row) return ok();

    const updates: any = { status: newStatus, updated_at: now };
    if (type === "email.delivered") updates.delivered_at = now;
    if (type === "email.opened") {
      updates.open_count = (row.open_count ?? 0) + 1;
      if (!row.status || !["opened", "clicked"].includes(row.status)) updates.first_opened_at = now;
    }
    if (type === "email.clicked") {
      updates.click_count = (row.click_count ?? 0) + 1;
      if (row.status !== "clicked") updates.first_clicked_at = now;
    }

    await admin.from("mkt_send_log").update(updates).eq("id", row.id);

    // Rebuild campaign counters (light)
    if (row.campaign_id) {
      const col = ({
        delivered: "delivered_count", opened: "opened_count", clicked: "clicked_count",
        bounced: "bounced_count", complained: "complained_count",
      } as Record<string, string>)[newStatus];
      if (col) {
        const { count } = await admin.from("mkt_send_log")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", row.campaign_id).eq("status", newStatus);
        await admin.from("mkt_campaigns").update({ [col]: count ?? 0 }).eq("id", row.campaign_id);
      }
    }

    // Auto-suppress on bounce/complaint
    if (["bounced", "complained"].includes(newStatus)) {
      const email = (evt.data?.to ?? [])[0] ?? evt.data?.email;
      if (email) {
        await admin.from("email_unsubscribes").upsert({
          email: String(email).toLowerCase(),
          reason: newStatus, is_active: true, unsubscribed_at: now,
        }, { onConflict: "email" });
      }
    }

    return ok();
  } catch (e) {
    console.error("[marketing-resend-webhook]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
