/**
 * appointmentActions — Shared helpers for Nivra Core /appointments actions.
 * - Every action writes an automatic system note to `client_internal_notes`.
 * - Status changes on `appointments` fire existing DB email triggers
 *   (`trg_enqueue_appointment_email_upd`), so client emails for
 *   reschedule / cancel are delivered by the queue — no ad-hoc send here.
 */
import { supabase } from "@/integrations/supabase/client";

async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

async function currentRole(userId: string): Promise<string> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return (data?.role as string) || "admin";
}

/** Write a system note attached to the client of an appointment. */
export async function logAppointmentNote(
  apt: { id: string; client_id?: string | null; client_email?: string | null; appointment_number?: string | null },
  body: string,
) {
  try {
    const user = await currentUser();
    if (!user) return;
    const role = await currentRole(user.id);

    let clientId: string | null = apt.client_id ?? null;
    if (!clientId && apt.client_email) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", apt.client_email)
        .maybeSingle();
      clientId = prof?.user_id ?? null;
    }
    if (!clientId) return; // guest appointment — nothing to attach to

    await supabase.from("client_internal_notes").insert({
      client_id: clientId,
      note_type: "system",
      body: `[RDV ${apt.appointment_number || apt.id.slice(0, 8)}] ${body}`,
      created_by_user_id: user.id,
      created_by_role: role,
      created_by_name: user.email || "Core",
    });
  } catch (e) {
    // best-effort; do not block the primary action
    console.error("logAppointmentNote failed", e);
  }
}

export async function rescheduleAppointment(apt: any, newIso: string, reason: string) {
  const oldIso = apt.scheduled_at;
  const { error } = await supabase
    .from("appointments")
    .update({
      scheduled_at: newIso,
      status: "rescheduled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", apt.id);
  if (error) throw error;
  await logAppointmentNote(
    apt,
    `Déplacé de ${new Date(oldIso).toLocaleString("fr-CA")} vers ${new Date(newIso).toLocaleString("fr-CA")}. Motif: ${reason || "—"}`,
  );
}

export async function cancelAppointment(apt: any, reason: string) {
  if (!reason.trim()) throw new Error("Raison d'annulation obligatoire");
  const { error } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      cancellation_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", apt.id);
  if (error) throw error;
  await logAppointmentNote(apt, `Annulé. Raison: ${reason}`);
}

export async function completeAppointment(apt: any) {
  const { error } = await supabase
    .from("appointments")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", apt.id);
  if (error) throw error;
  await logAppointmentNote(apt, "Marqué comme complété.");
}

export async function markNoShow(apt: any) {
  const { error } = await supabase
    .from("appointments")
    .update({ status: "no_show", updated_at: new Date().toISOString() })
    .eq("id", apt.id);
  if (error) throw error;
  await logAppointmentNote(apt, "Client absent (no-show).");
}

export async function assignTechnician(apt: any, technicianId: string | null, technicianName: string) {
  const { error } = await supabase
    .from("appointments")
    .update({ technician_id: technicianId, updated_at: new Date().toISOString() })
    .eq("id", apt.id);
  if (error) throw error;
  await logAppointmentNote(
    apt,
    technicianId ? `Technicien assigné: ${technicianName}` : "Technicien retiré de l'assignation.",
  );
}
