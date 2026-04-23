/**
 * CANONICAL BILLING CYCLE DISPLAY HELPER
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for displaying billing cycle / renewal /
 * next-invoice dates across the entire client portal.
 *
 * RULE (system-wide, no per-account exception):
 *   1. A subscription is "active" ONLY when its order has reached
 *      `delivered`, `activated`, or `completed` in Nivra Core.
 *   2. While not active → cycle_start_date / cycle_end_date /
 *      next_renewal_at MUST be NULL.
 *   3. UI must NEVER fabricate a fake cycle date for pending,
 *      incomplete, suspended or past_due subscriptions.
 *   4. Once the order is activated, the official trigger
 *      `fn_activate_sub_on_order_activation` anchors all dates
 *      on the activation moment (NOW()).
 */

export type SubscriptionStatusLike =
  | "active"
  | "pending"
  | "incomplete"
  | "suspended"
  | "past_due"
  | "cancelled"
  | "expired"
  | string
  | null
  | undefined;

export interface CycleDisplayInput {
  status?: SubscriptionStatusLike;
  cycle_start_date?: string | null;
  cycle_end_date?: string | null;
  next_renewal_at?: string | null;
  billing_cycle_anchor?: string | null;
}

export interface CycleDisplay {
  /** True only when subscription is active AND has real cycle dates. */
  isActive: boolean;
  /** Human label for the cycle day (e.g. "Le 24 de chaque mois") or null. */
  cycleDayLabel: string | null;
  /** Cycle start ISO string or null. */
  cycleStart: string | null;
  /** Cycle end / next invoice ISO string or null. */
  cycleEnd: string | null;
  /** Next renewal ISO string or null. */
  nextRenewal: string | null;
  /** Localised placeholder for inactive/pending subscriptions. */
  pendingMessage: string;
}

/**
 * Returns canonical display values for a subscription's billing cycle.
 * Returns nulls + a "pending" message when the subscription is not yet
 * activated — so the UI never displays fabricated dates.
 */
export function getCycleDisplay(sub: CycleDisplayInput | null | undefined): CycleDisplay {
  const status = (sub?.status ?? "").toString().toLowerCase();
  const isActive =
    status === "active" &&
    !!sub?.cycle_start_date &&
    !!sub?.cycle_end_date;

  if (!isActive) {
    return {
      isActive: false,
      cycleDayLabel: null,
      cycleStart: null,
      cycleEnd: null,
      nextRenewal: null,
      pendingMessage:
        "Le cycle de facturation débutera à la date d'activation réelle de votre service.",
    };
  }

  const anchor = sub?.billing_cycle_anchor || sub?.cycle_start_date || null;
  let cycleDayLabel: string | null = null;
  if (anchor) {
    const day = new Date(anchor).getUTCDate();
    if (Number.isFinite(day) && day > 0) {
      cycleDayLabel = `Le ${day} de chaque mois`;
    }
  }

  return {
    isActive: true,
    cycleDayLabel,
    cycleStart: sub!.cycle_start_date ?? null,
    cycleEnd: sub!.cycle_end_date ?? null,
    nextRenewal: sub?.next_renewal_at ?? sub?.cycle_end_date ?? null,
    pendingMessage: "",
  };
}
