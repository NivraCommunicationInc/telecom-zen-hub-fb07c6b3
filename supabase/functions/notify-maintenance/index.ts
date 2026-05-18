// Sends maintenance notification to all active clients. Triggered manually
// from Core ("Notifier tous les clients") or automatically 24h before a
// planned maintenance via notify_upcoming_maintenance() cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { incident_id } = await req.json();
    if (!incident_id) {
      return new Response(JSON.stringify({ error: "incident_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: incident, error: incErr } = await supabase
      .from("service_incidents")
      .select("*")
      .eq("id", incident_id)
      .maybeSingle();
    if (incErr || !incident) {
      return new Response(JSON.stringify({ error: "incident not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Active clients: profiles with an active billing subscription
    const { data: customers } = await supabase
      .from("billing_customers")
      .select("user_id");
    const userIds = Array.from(new Set((customers || []).map((c: any) => c.user_id).filter(Boolean)));

    const { data: activeSubs } = await supabase
      .from("billing_subscriptions")
      .select("customer_id")
      .eq("status", "active");
    const activeCustIds = new Set((activeSubs || []).map((s: any) => s.customer_id));
    const { data: activeCusts } = await supabase
      .from("billing_customers")
      .select("user_id,id")
      .in("id", Array.from(activeCustIds));
    const activeUserIds = Array.from(
      new Set((activeCusts || []).map((c: any) => c.user_id).filter(Boolean)),
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, first_name, last_name, preferred_language")
      .in("user_id", activeUserIds.length ? activeUserIds : userIds)
      .not("email", "is", null);

    const start = incident.scheduled_start_at
      ? new Date(incident.scheduled_start_at).toLocaleString("fr-CA", {
          dateStyle: "long",
          timeStyle: "short",
        })
      : incident.started_at
      ? new Date(incident.started_at).toLocaleString("fr-CA", {
          dateStyle: "long",
          timeStyle: "short",
        })
      : "Bientôt";

    let duration = "À confirmer";
    if (incident.scheduled_start_at && incident.scheduled_end_at) {
      const mins = Math.round(
        (new Date(incident.scheduled_end_at).getTime() -
          new Date(incident.scheduled_start_at).getTime()) /
          60000,
      );
      duration = mins >= 60 ? `${Math.round(mins / 60)} h` : `${mins} min`;
    }

    let queued = 0;
    for (const p of (profiles || []) as any[]) {
      const eventKey = `maintenance_${incident.id}_${p.user_id}`;
      const lang = p.preferred_language === "en" ? "en" : "fr";
      const { error: qErr } = await supabase.from("email_queue").insert({
        event_key: eventKey,
        to_email: p.email,
        template_key: "maintenance_notification",
        language: lang,
        template_vars: {
          client_name: p.first_name || "",
          scheduled_start_at: start,
          estimated_duration: duration,
          affected_services: incident.service_display_name || incident.service_name || "—",
          maintenance_type: incident.maintenance_type || "planned",
          language: lang,
        },
        status: "queued",
      });
      if (!qErr) queued++;
    }

    await supabase
      .from("service_incidents")
      .update({ notification_sent_at: new Date().toISOString() })
      .eq("id", incident_id);

    return new Response(JSON.stringify({ ok: true, queued, total_clients: profiles?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
