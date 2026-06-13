// Send Web Push notifications to subscribed users via VAPID.
// Body: { user_ids?: string[], roles?: string[], title, body, url?, tag?, data? }
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VAPID_PUBLIC = "BD7N_yYMcS6fbzZrNs98sX6y35nrAMjEIjDmTPPZBChEsBxc3r4Yd2SSpW4CmrWpTqAO-RXbu6AKyEbaHVj0jvY";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@nivra-telecom.ca";
    if (!privateKey) throw new Error("VAPID_PRIVATE_KEY missing");

    webpush.setVapidDetails(subject, VAPID_PUBLIC, privateKey);

    const { user_ids, roles, title, body, url, tag, data, requireInteraction } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: "title required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve target user ids
    let targetIds: string[] = Array.isArray(user_ids) ? [...user_ids] : [];
    if (Array.isArray(roles) && roles.length > 0) {
      const { data: roleRows } = await supabase
        .from("user_roles").select("user_id").in("role", roles);
      (roleRows || []).forEach((r: any) => targetIds.push(r.user_id));
    }
    targetIds = [...new Set(targetIds)];
    if (targetIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "no targets" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", targetIds)
      .eq("is_active", true);

    const payload = JSON.stringify({ title, body, url, tag, data, requireInteraction });
    let sent = 0, failed = 0;
    const removeIds: string[] = [];

    await Promise.all((subs || []).map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (err) {
        failed++;
        if (err?.statusCode === 404 || err?.statusCode === 410) removeIds.push(s.id);
      }
    }));

    if (removeIds.length) {
      await supabase.from("push_subscriptions").update({ is_active: false }).in("id", removeIds);
    }

    return new Response(JSON.stringify({ sent, failed, deactivated: removeIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
