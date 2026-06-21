// Sends maintenance notification to all active clients. Single source of truth
// for maintenance notifications. Writes to:
//   - email_queue (transactional email, idempotent via event_key)
//   - notifications (in-portal banner inside customer portals)
// Triggered manually from Core ("Notifier tous les clients") or automatically
// 24h before a planned maintenance via notify_upcoming_maintenance() cron.
import { createClient } from "npm:@supabase/supabase-js@2";

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

    // Resolve active client user_ids
    const { data: activeSubs } = await supabase
      .from("billing_subscriptions")
      .select("customer_id")
      .eq("status", "active");
    const activeCustIds = Array.from(
      new Set((activeSubs || []).map((s: any) => s.customer_id).filter(Boolean)),
    );
    const { data: activeCusts } = activeCustIds.length
      ? await supabase
          .from("billing_customers")
          .select("user_id")
          .in("id", activeCustIds)
      : { data: [] as any[] };
    const activeUserIds = Array.from(
      new Set((activeCusts || []).map((c: any) => c.user_id).filter(Boolean)),
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, first_name, last_name, preferred_language")
      .in("user_id", activeUserIds)
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

    const serviceLabel =
      incident.service_display_name || incident.service_name || "Tous les services";
    const title = incident.incident_title || `Maintenance — ${serviceLabel}`;
    const messageBody =
      incident.incident_message ||
      `Maintenance planifiée le ${start} (durée estimée: ${duration}). Service affecté: ${serviceLabel}.`;

    let queued = 0;
    let portalNotified = 0;
    const skippedEmails: string[] = [];
    const skippedPortal: string[] = [];

    for (const p of (profiles || []) as any[]) {
      const lang = p.preferred_language === "en" ? "en" : "fr";

      // 1) Email — idempotent via event_key unique constraint
      const eventKey = `maintenance_${incident.id}_${p.user_id}`;
      const { error: qErr } = await supabase.from("email_queue").insert({
        event_key: eventKey,
        to_email: p.email,
        template_key: "maintenance_notification",
        language: lang,
        entity_type: "service_incident",
        entity_id: incident.id,
        template_vars: {
          client_name: p.first_name || "",
          scheduled_start_at: start,
          estimated_duration: duration,
          affected_services: serviceLabel,
          maintenance_type: incident.maintenance_type || "planned",
          incident_title: title,
          incident_message: messageBody,
          language: lang,
        },
        status: "queued",
      });
      if (!qErr) queued++;
      else if (!String(qErr.message || "").includes("duplicate")) {
        skippedEmails.push(p.email);
      }

      // 2) Portal notification — dedup by checking existing entry for this incident+user
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", p.user_id)
        .eq("type", "maintenance")
        .eq("link_id", incident.id)
        .maybeSingle();

      if (!existing) {
        const { error: nErr } = await supabase.from("notifications").insert({
          user_id: p.user_id,
          user_role: "client",
          type: "maintenance",
          title,
          message: messageBody,
          link_target: "/status",
          link_id: incident.id,
        });
        if (!nErr) portalNotified++;
        else skippedPortal.push(p.user_id);
      }
    }

    await supabase
      .from("service_incidents")
      .update({ notification_sent_at: new Date().toISOString() })
      .eq("id", incident_id);

    return new Response(
      JSON.stringify({
        ok: true,
        queued,
        portal_notified: portalNotified,
        total_clients: profiles?.length || 0,
        skipped_emails: skippedEmails.length,
        skipped_portal: skippedPortal.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
