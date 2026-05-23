/**
 * Account state — canonical, cross-portal source of truth.
 *
 * Backed by the SQL function `public.get_account_state(account_id)` and the
 * convenience view `public.v_account_state`. See the migration
 * `20260522235622_billing_state_engine.sql` for the full decision tree.
 *
 * Why this exists:
 *   The "status" of a Nivra account used to be reconstructed independently in
 *   every portal (Core, Field, Employee, Tech, Client) by combining values
 *   from accounts.status + billing_subscriptions.status + billing_invoices +
 *   kyc + installations. That led to cross-portal desync bugs (a client could
 *   read "active" in one portal and "suspended" in another).
 *
 *   Now every portal reads from the same RPC. Update the SQL once and the
 *   whole platform agrees.
 */

export type AccountState =
  | "new"
  | "pending_kyc"
  | "pending_payment"
  | "pending_activation"
  | "active"
  | "suspended_non_payment"
  | "cancelled"
  | "closed"
  | "not_found";

export type AccountStateColor = "green" | "amber" | "red" | "blue" | "gray";

/** Signals that fed the decision — useful for tooltips and debugging. */
export interface AccountStateSignals {
  account_status: "active" | "suspended" | "closed" | null;
  active_subscriptions: number;
  pending_subscriptions: number;
  suspended_subscriptions: number;
  cancelled_subscriptions: number;
  total_subscriptions: number;
  overdue_invoices: number;
  pending_invoices: number;
  kyc_status: string | null;
  has_completed_install: boolean;
}

/** Full state object — direct shape of the RPC return value. */
export interface AccountStateResult {
  account_id: string;
  client_id: string | null;
  state: AccountState;
  label_fr: string;
  label_en: string;
  color: AccountStateColor;
  reason: string;
  blocking_issues: string[];
  signals: AccountStateSignals;
  last_updated_at: string;
  computed_at: string;
}

/**
 * Human-readable explanation of WHY a state is what it is. Use in support
 * tools so an agent can tell a customer "your service is suspended because…".
 */
export function explainState(result: AccountStateResult, locale: "fr" | "en" = "fr"): string {
  const isFr = locale === "fr";
  switch (result.state) {
    case "active":
      return isFr
        ? "Tous vos services fonctionnent normalement."
        : "All your services are running normally.";
    case "pending_kyc":
      return isFr
        ? "Nous devons vérifier votre identité avant d'activer votre service."
        : "We need to verify your identity before activating your service.";
    case "pending_payment":
      if (result.signals.overdue_invoices > 0) {
        return isFr
          ? `Vous avez ${result.signals.overdue_invoices} facture(s) en retard. Payez avant la suspension pour conserver votre service.`
          : `You have ${result.signals.overdue_invoices} overdue invoice(s). Pay before suspension to keep your service.`;
      }
      return isFr
        ? "Un paiement initial est requis pour activer votre service."
        : "An initial payment is required to activate your service.";
    case "pending_activation":
      return isFr
        ? "Votre paiement est reçu. Nous installons votre service — un technicien vous contactera sous peu."
        : "Your payment was received. We're setting up your service — a technician will be in touch shortly.";
    case "suspended_non_payment":
      return isFr
        ? "Votre service est suspendu pour non-paiement. Réglez votre solde pour le réactiver."
        : "Your service is suspended due to non-payment. Pay the balance to reactivate.";
    case "cancelled":
      return isFr
        ? "Tous vos abonnements ont été annulés. Vous pouvez recommander un nouveau service à tout moment."
        : "All your subscriptions have been cancelled. You can order a new service anytime.";
    case "closed":
      return isFr
        ? "Ce compte est fermé définitivement."
        : "This account is permanently closed.";
    case "new":
      return isFr
        ? "Compte créé. Choisissez un forfait pour démarrer."
        : "Account created. Choose a plan to get started.";
    case "not_found":
      return isFr ? "Compte introuvable." : "Account not found.";
  }
}

/** Tailwind-friendly classes per state color. Centralized so all portals match. */
export const STATE_BADGE_CLASSES: Record<AccountStateColor, { wrap: string; dot: string }> = {
  green: {
    wrap: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  amber: {
    wrap: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  red: {
    wrap: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
  blue: {
    wrap: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  gray: {
    wrap: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
};

/** True when the customer can still self-serve (pay, fix KYC) to recover. */
export function isRecoverable(state: AccountState): boolean {
  return (
    state === "pending_kyc" ||
    state === "pending_payment" ||
    state === "pending_activation" ||
    state === "suspended_non_payment" ||
    state === "cancelled" ||
    state === "new"
  );
}

/** True when no further customer action will fix the account (terminal). */
export function isTerminal(state: AccountState): boolean {
  return state === "closed" || state === "not_found";
}

/** Should the portal block billing actions (new orders, autopay setup)? */
export function blocksBillingActions(state: AccountState): boolean {
  return state === "closed" || state === "not_found";
}
