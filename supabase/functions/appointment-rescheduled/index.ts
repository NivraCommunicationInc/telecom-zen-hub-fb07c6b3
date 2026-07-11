/**
 * appointment-rescheduled â€” Notify the client when an appointment was
 * modified (date/time/technician/address) by an internal user.
 * The frontend has already updated the appointment row; this function
 * only sends the email and writes an activity log entry.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { enqueueEmail } from "../_shared/ResendProxy.ts";
import { violetShell, violetEsc } from "../_shared/violetEmailShell.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

interface Body {
  appointment_id: string;
  changes?: { field: string; from?: string; to?: string }[];
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-CA", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch (_e) { return iso; }
}

function buildEmail(args: {
  firstName: string;
  apptNumber: string;
  scheduledAt: string;
  address: string;
  technicianName: string | null;
  noteForClient?: string;
}) {
  const rows: [string, string][] = [
    ["Rendez-vous", `#${violetEsc(args.apptNumber)}`],
    ["Nouvelle date", violetEsc(fmtDateTime(args.scheduledAt))],
  ];
  if (args.address) rows.push(["Adresse", violetEsc(args.address)]);
  if (args.technicianName) rows.push(["Technicien", violetEsc(args.technicianName)]);

  return violetShell({
    preheader: "Votre rendez-vous a été modifié.",
    badge: "RENDEZ-VOUS MODIFIÉ",
    heroTitle: "Votre rendez-vous a été reprogrammé",
    heroSub: "Voici les nouveaux détails.",
    greeting: `Bonjour ${violetEsc(args.firstName) || "client"},`,
    bodyHtml:
      `Votre rendez-vous d'installation a été <strong>mis Ã  jour</strong>. ` +
      `Veuillez vérifier les nouveaux détails ci-dessous.` +
      (args.noteForClient ? `<br/><br/><em>${violetEsc(args.noteForClient)}</em>` : ""),
    cardTitle: "Nouveaux détails",
    cardRows: rows,
    ctaPrimaryUrl: "https://nivra-telecom.ca/portal/appointments",
    ctaPrimaryLabel: "Voir mon rendez-vous",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreflightRequest(req);
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const staffId = userData.user.id;

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", staffId);
    const allowed = ["admin", "supervisor", "employee", "billing_admin"];
    if (!roles?.some((r: any) => allowed.includes(r.role))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Body = await req.json();
    if (!body.appointment_id) {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: apt } = await supabase
      .from("appointments")
      .select(`
        id, appointment_number, scheduled_at, service_address, service_city,
        service_postal_code, client_email, client_id, technician_id, internal_notes
      `)
      .eq("id", body.appointment_id)
      .maybeSingle();

    if (!apt) {
      return new Response(JSON.stringify({ error: "Appointment not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let clientEmail = apt.client_email ?? null;
    let firstName = "";
    if (apt.client_id) {
      const { data: prof } = await supabase
        .from("profiles").select("email, full_name").eq("user_id", apt.client_id).maybeSingle();
      if (!clientEmail) clientEmail = prof?.email ?? null;
      firstName = prof?.full_name?.split(" ")?.[0] ?? "";
    }

    let technicianName: string | null = null;
    if (apt.technician_id) {
      const { data: tech } = await supabase
        .from("technicians").select("full_name").eq("id", apt.technician_id).maybeSingle();
      technicianName = tech?.full_name ?? null;
    }

    const fullAddress = [apt.service_address, apt.service_city, apt.service_postal_code]
      .filter(Boolean).join(", ");

    if (clientEmail) {
      try {
        await enqueueEmail({
          to: clientEmail,
          subject: "Votre rendez-vous a été modifié â€” Nivra Telecom",
          html: buildEmail({
            firstName,
            apptNumber: apt.appointment_number ?? apt.id.slice(0, 8),
            scheduledAt: apt.scheduled_at,
            address: fullAddress,
            technicianName,
          }),
          messageType: "appointment_rescheduled",
          entityType: "appointment",
          entityId: apt.id,
          eventKey: `appointment_rescheduled_${apt.id}_${Date.now()}`,
        });
      } catch (e) {
        console.warn("[appointment-rescheduled] enqueueEmail failed:", e);
      }
    }

    await supabase.from("activity_logs").insert({
      user_id: staffId,
      entity_type: "appointment",
      entity_id: apt.id,
      action: "appointment_rescheduled",
      reason: body.changes ? JSON.stringify(body.changes) : "Rendez-vous modifié",
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[appointment-rescheduled] Error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
