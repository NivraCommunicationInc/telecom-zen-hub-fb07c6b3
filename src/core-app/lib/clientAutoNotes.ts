/**
 * clientAutoNotes — Centralized helper to write automatic system notes
 * to client_internal_notes whenever a significant action occurs.
 *
 * • All calls are FIRE-AND-FORGET (never throw, never block the caller).
 * • Notes are tagged with note_type='system'.
 * • A short in-memory de-dup window prevents identical notes within 5 s
 *   (round-trip avoidance; DB-level idempotency is also enforced by
 *   `event_key` in `rpc_account_journal_write`).
 */
import { writeAccountJournal } from "@/lib/writeAccountJournal";

const DEDUP_WINDOW_MS = 5000;
const recent = new Map<string, number>();

function minuteBucket(): string {
  return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
}

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
  | "equipment_status_changed"
  | "credit_added"
  | "plan_changed"
  | "fee_added"
  | "call_logged"
  | "ticket_created"
  | "ticket_updated"
  | "personal_info_updated"
  | "invoice_created"
  | "subscription_renewed"
  | "promotion_added"
  | "equipment_changed"
  | "account_suspended"
  | "account_reactivated"
  | "followup_added";

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
  credit_added: "Crédit ajouté",
  plan_changed: "Changement de forfait",
  fee_added: "Frais ajouté",
  call_logged: "Appel enregistré",
  ticket_created: "Ticket créé",
  ticket_updated: "Ticket mis à jour",
  personal_info_updated: "Informations personnelles mises à jour",
  invoice_created: "Facture créée",
  subscription_renewed: "Abonnement renouvelé",
  promotion_added: "Promotion appliquée",
  equipment_changed: "Équipement modifié",
  account_suspended: "Compte suspendu",
  account_reactivated: "Compte réactivé",
  followup_added: "Suivi ajouté",
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
  /** Optional order id — when provided, also mirrored to activity_logs entity_type='order' */
  orderId?: string | null;
}

/**
 * Write an automatic system note. Never throws.
 */
export function addClientAutoNote(params: AutoNoteParams): void {
  const { clientId, event, detail, metadata, orderId } = params;
  if (!clientId) return;

  const dedupKey = `${clientId}:${event}:${detail || ""}`;
  const now = Date.now();
  const last = recent.get(dedupKey);
  if (last && now - last < DEDUP_WINDOW_MS) return;
  recent.set(dedupKey, now);

  if (recent.size > 200) {
    for (const [k, ts] of recent) {
      if (now - ts > DEDUP_WINDOW_MS * 4) recent.delete(k);
    }
  }

  const label = EVENT_LABELS[event] ?? event;
  const body = detail ? `${label} — ${detail}` : label;
  const bucket = minuteBucket();

  // Fire-and-forget.
  void (async () => {
    // 1. Client-profile note
    try {
      await writeAccountJournal({
        targetTable: "client_internal_notes",
        eventKey: `autonote:${clientId}:${event}:${orderId || "none"}:${bucket}`,
        payload: {
          client_id: clientId,
          note_type: "system",
          body,
        },
      });
    } catch (err: any) {
      console.warn("[autoNote] client_internal_notes insert failed:", err?.message, { event, clientId });
    }

    // 2. Activity log mirror
    try {
      await writeAccountJournal({
        targetTable: "activity_logs",
        eventKey: `autolog:${clientId}:${event}:${orderId || "none"}:${bucket}`,
        payload: {
          action: event,
          entity_type: orderId ? "order" : "client",
          entity_id: orderId || clientId,
          details: { note: body, target_client_id: clientId, ...(metadata || {}) },
        },
      });
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
