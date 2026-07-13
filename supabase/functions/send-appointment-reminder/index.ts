/**
 * send-appointment-reminder
 *
 * Two modes:
 *  - Manual: POST { appointmentId } → sends reminder immediately for that appointment.
 *  - Scan (cron): POST {} (or no body) → finds appointments with scheduled_at in the
 *    next 25-35 minutes window that haven't been reminded, and queues a reminder for each.
 *
 * Marks `appointments.reminder_sent_at` to guarantee idempotency.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { queueRenderedEmail } from "../_shared/templateRenderer.ts";

interface Body {
  appointmentId?: string;
  force?: boolean;
}

const REMINDER_STATUSES = [
  "scheduled",
  "confirmed",
  "technician_assigned",
  "modified",
  "in_progress",
];

async function resolveEmail(supabase: any, apt: any): Promise<{ email: string | null; name: string | null }> {
  // Try direct fields on appointment
  const direct = apt.client_email || apt.customer_email || apt.email;
  const directName = apt.client_name || apt.customer_name || null;
  if (direct) return { email: direct, name: directName };

  // Fall back to linked order
  if (apt.order_id) {
    const { data: ord } = await supabase
      .from("orders")
      .select("email, client_email, customer_email, first_name, last_name, client_full_name")
      .eq("id", apt.order_id)
      .maybeSingle();
    if (ord) {
      const email = ord.email || ord.client_email || ord.customer_email;
      const name = ord.client_full_name || [ord.first_name, ord.last_name].filter(Boolean).join(" ") || null;
      if (email) return { email, name };
    }
  }

  // Fall back to profile via user_id
  if (apt.user_id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("email, first_name, last_name, full_name")
      .eq("id", apt.user_id)
      .maybeSingle();
    if (prof?.email) {
      const name = prof.full_name || [prof.first_name, prof.last_name].filter(Boolean).join(" ") || null;
      return { email: prof.email, name };
    }
  }

  return { email: null, name: null };
}

async function sendForAppointment(supabase: any, apt: any, requestId: string): Promise<{ ok: boolean; reason?: string; email?: string }> {
  const { email, name } = await resolveEmail(supabase, apt);
  if (!email) {
    return { ok: false, reason: "no_email" };
  }

  // Optional: resolve technician
  let technicianName: string | undefined;
  let technicianPhone: string | undefined;
  if (apt.technician_id) {
    const { data: tech } = await supabase
      .from("technicians")
      .select("full_name, first_name, last_name, phone")
      .eq("id", apt.technician_id)
      .maybeSingle();
    if (tech) {
      technicianName = tech.full_name || [tech.first_name, tech.last_name].filter(Boolean).join(" ") || undefined;
      technicianPhone = tech.phone || undefined;
    }
  }

  const eventKey = `appointment_reminder_${apt.id}`;
  const result = await queueRenderedEmail({
    eventKey,
    templateKey: "appointment_reminder",
    toEmail: email,
    templateVars: {
      client_name: name?.split(" ")[0] || "Client",
      scheduled_at: apt.scheduled_at,
      service_address: apt.service_address || apt.address || undefined,
      order_number: apt.order_number || undefined,
      technician_name: technicianName,
      technician_phone: technicianPhone,
      portal_path: "/portal/appointments",
    },
  });

  await supabase
    .from("appointments")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", apt.id);

  console.log(`[${requestId}] Reminder queued for appointment ${apt.id} → ${email.substring(0, 3)}*** (already=${result.alreadyQueued})`);
  return { ok: true, email };
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase not configured");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: Body = {};
    try { body = await req.json(); } catch { /* empty body → scan mode */ }

    // MODE 1: Manual send for a specific appointment (Core agent button)
    if (body.appointmentId) {
      const { data: apt, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", body.appointmentId)
        .maybeSingle();

      if (error || !apt) {
        return new Response(JSON.stringify({ success: false, error: "appointment_not_found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (!apt.scheduled_at) {
        return new Response(JSON.stringify({ success: false, error: "no_scheduled_at" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (apt.reminder_sent_at && !body.force) {
        return new Response(JSON.stringify({ success: true, alreadySent: true, sentAt: apt.reminder_sent_at }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const result = await sendForAppointment(supabase, apt, requestId);
      return new Response(JSON.stringify({ success: result.ok, ...result }), {
        status: result.ok ? 200 : 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // MODE 2: Scan window (cron) - appointments starting in 25-35 minutes
    const nowIso = new Date().toISOString();
    const lowerIso = new Date(Date.now() + 25 * 60 * 1000).toISOString();
    const upperIso = new Date(Date.now() + 35 * 60 * 1000).toISOString();

    const { data: due, error: scanError } = await supabase
      .from("appointments")
      .select("*")
      .in("status", REMINDER_STATUSES)
      .is("reminder_sent_at", null)
      .gte("scheduled_at", lowerIso)
      .lte("scheduled_at", upperIso);

    if (scanError) throw scanError;

    console.log(`[${requestId}] Scan mode: found ${due?.length || 0} appointment(s) due for reminder [${lowerIso} .. ${upperIso}] (now=${nowIso})`);

    const results: any[] = [];
    for (const apt of due || []) {
      try {
        const r = await sendForAppointment(supabase, apt, requestId);
        results.push({ id: apt.id, ...r });
      } catch (e) {
        console.error(`[${requestId}] Failed for appointment ${apt.id}:`, e);
        results.push({ id: apt.id, ok: false, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get("origin")) },
    });
  }
};

serve(handler);
