/**
 * clientAutoNotes — Centralized helper to write automatic system notes
 * to client_internal_notes whenever a significant action occurs.
 *
 * • All calls are FIRE-AND-FORGET (never throw, never block the caller).
 * • Notes are tagged with note_type='system', created_by_role='system_auto'.
 * • A short de-dup window prevents identical notes within 5 seconds.
 *
 * This is the canonical replacement for inline note writing scattered
 * across mutations. Used by useOrderProcessing.ts and other surfaces.
 */
import { supabase } from "@/integrations/supabase/client";

const DEDUP_WINDOW_MS = 5000;
const recent = new Map<string, number>();

export type AutoNoteEvent =
  | "payment_confirmed"
  | "payment_partial"
  | "payment_invalid"
  | "payment_recorded"
  | "service_activated"
  | "order_completed"
  | "order_modified"
  | "order_created"
  | "status_changed"
  | "kyc_approved"
  | "kyc_rejected"
  | "kyc_requested"
  | "kyc_resubmission"
  | "equipment_assigned"
  | "equipment_replaced"
  | "shipping_updated"
  | "technician_assigned"
  | "contract_generated"
  | "contract_signed"
  | "contract_signed_admin"
  | "fulfillment_set"
  | "sim_activated"
  | "sim_deactivated"
  | "esim_activated"
  | "portin_submitted"
  | "portin_status_changed"
  | "portin_cancelled"
  | "appointment_created"
  | "appointment_modified"
  | "appointment_cancelled"
  | "client_login"
  | "email_sent"
  | "kyc_session_created"
  | "kyc_session_expired"
  | "equipment_status_changed";

const EVENT_LABELS: Record<AutoNoteEvent, string> = {
  payment_confirmed: "Paiement confirmé",
  payment_partial: "Paiement partiel",
  payment_invalid: "Paiement invalidé",
  payment_recorded: "Paiement enregistré",
  service_activated: "Service activé",
  order_completed: "Commande complétée",
  order_modified: "Commande modifiée",
  order_created: "Commande créée",
  status_changed: "Statut modifié",
  kyc_approved: "Identité approuvée",
  kyc_rejected: "Identité rejetée",
  kyc_requested: "Vérification d'identité demandée",
  kyc_resubmission: "Resoumission KYC demandée",
  equipment_assigned: "Équipement assigné",
  equipment_replaced: "Équipement remplacé",
  shipping_updated: "Expédition mise à jour",
  technician_assigned: "Technicien assigné",
  contract_generated: "Contrat généré",
  contract_signed: "Contrat signé par le client",
  contract_signed_admin: "Contrat signé (admin)",
  fulfillment_set: "Mode de livraison défini",
  sim_activated: "SIM activée",
  sim_deactivated: "SIM désactivée",
  esim_activated: "eSIM activée",
  portin_submitted: "Port-in initié",
  portin_status_changed: "Statut port-in modifié",
  portin_cancelled: "Port-in annulé",
  appointment_created: "Rendez-vous créé",
  appointment_modified: "Rendez-vous modifié",
  appointment_cancelled: "Rendez-vous annulé",
  client_login: "Connexion client",
  email_sent: "Courriel envoyé",
  kyc_session_created: "Session KYC créée",
  kyc_session_expired: "Session KYC expirée",
  equipment_status_changed: "Statut équipement modifié",
};

export interface AutoNoteParams {
  /** UUID of the client (auth user id) — required */
  clientId: string | null | undefined;
  /** Type of event */
  event: AutoNoteEvent;
  /** Human-readable detail line ("Facture #INV-123 — 75,40 $", etc.) */
  detail?: string;
  /** Optional structured metadata (logged to activity_logs only) */
  metadata?: Record<string, any>;
  /** Actor user id (the agent or system who triggered) */
  actorId?: string | null;
  /** Display name of actor (defaults to "Système") */
  actorName?: string | null;
  /** Optional order id — when provided, also mirrored to activity_logs entity_type='order' so it shows in the order timeline */
  orderId?: string | null;
}

/**
 * Write an automatic system note. Never throws.
 * Returns void to discourage await-chaining errors.
 *
 * Writes to TWO surfaces:
 *  1. client_internal_notes — visible on the client profile (note_type='system')
 *  2. activity_logs (entity_type='order' if orderId provided, else entity_type='client')
 *     — visible on the order detail timeline
 */
export function addClientAutoNote(params: AutoNoteParams): void {
  const { clientId, event, detail, metadata, actorId, actorName, orderId } = params;
  if (!clientId) return;

  const dedupKey = `${clientId}:${event}:${detail || ""}`;
  const now = Date.now();
  const last = recent.get(dedupKey);
  if (last && now - last < DEDUP_WINDOW_MS) return;
  recent.set(dedupKey, now);

  // Periodic cleanup
  if (recent.size > 200) {
    for (const [k, ts] of recent) {
      if (now - ts > DEDUP_WINDOW_MS * 4) recent.delete(k);
    }
  }

  const label = EVENT_LABELS[event] ?? event;
  const body = detail ? `${label} — ${detail}` : label;

  // Fire-and-forget. We deliberately do NOT await.
  void (async () => {
    // 1. Client-profile note
    try {
      await supabase.from("client_internal_notes").insert({
        client_id: clientId,
        note_type: "system",
        body,
        created_by_user_id: actorId || "00000000-0000-0000-0000-000000000000",
        created_by_role: "system_auto",
        created_by_name: actorName || "Système",
      } as any);
    } catch (err: any) {
      console.warn("[autoNote] client_internal_notes insert failed:", err?.message, { event, clientId });
    }

    // 2. Activity log mirror — so it appears on the order's timeline + audit trail
    try {
      await supabase.from("activity_logs").insert({
        user_id: clientId,
        action: event,
        entity_type: orderId ? "order" : "client",
        entity_id: orderId || clientId,
        actor_role: "system_auto",
        actor_name: actorName || "Système",
        details: { note: body, ...(metadata || {}) } as any,
      } as any);
    } catch (err: any) {
      console.warn("[autoNote] activity_logs insert failed:", err?.message, { event, clientId });
    }
  })();
}

/**
 * Format a money amount in CAD for note bodies.
 */
export function fmtMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toFixed(2)} $`;
}
