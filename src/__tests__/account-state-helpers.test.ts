/**
 * ═══════════════════════════════════════════════════════════════════
 * REGRESSION SUITE: Account state helpers
 * ═══════════════════════════════════════════════════════════════════
 *
 * Locks the contract for the TypeScript-side helpers around the SQL
 * `get_account_state()` engine. The SQL itself is exercised at runtime
 * (no easy way to unit-test PL/pgSQL without a live DB), but these
 * helpers are pure and deterministic — perfect for fast unit guards.
 *
 * Why this matters:
 *   - blocksBillingActions() controls whether the checkout button is
 *     disabled. A regression here = closed accounts can place orders.
 *   - isRecoverable() drives the "Pay now" / "Resume service" CTAs.
 *   - explainState() copy is shown to customers verbatim.
 */
import { describe, it, expect } from "vitest";
import {
  blocksBillingActions,
  explainState,
  isRecoverable,
  isTerminal,
  STATE_BADGE_CLASSES,
  type AccountStateResult,
} from "@/lib/accountState";
import { stateLabel } from "@/components/AccountStateBadge";

const SAMPLE_SIGNALS = {
  account_status: "active" as const,
  active_subscriptions: 0,
  pending_subscriptions: 0,
  suspended_subscriptions: 0,
  cancelled_subscriptions: 0,
  total_subscriptions: 0,
  overdue_invoices: 0,
  pending_invoices: 0,
  kyc_status: null,
  has_completed_install: false,
};

function makeResult(overrides: Partial<AccountStateResult> = {}): AccountStateResult {
  return {
    account_id: "00000000-0000-0000-0000-000000000001",
    client_id: "00000000-0000-0000-0000-000000000002",
    state: "active",
    label_fr: "Service actif",
    label_en: "Service active",
    color: "green",
    reason: "test",
    blocking_issues: [],
    signals: SAMPLE_SIGNALS,
    last_updated_at: new Date().toISOString(),
    computed_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("isTerminal", () => {
  it("returns true ONLY for closed and not_found", () => {
    expect(isTerminal("closed")).toBe(true);
    expect(isTerminal("not_found")).toBe(true);
  });

  it("returns false for every recoverable state", () => {
    const recoverable = [
      "new",
      "pending_kyc",
      "pending_payment",
      "pending_activation",
      "active",
      "suspended_non_payment",
      "cancelled",
    ] as const;
    for (const s of recoverable) {
      expect(isTerminal(s), `state ${s} should not be terminal`).toBe(false);
    }
  });
});

describe("isRecoverable", () => {
  it("treats active as not needing recovery", () => {
    expect(isRecoverable("active")).toBe(false);
  });

  it("treats terminal states as not recoverable", () => {
    expect(isRecoverable("closed")).toBe(false);
    expect(isRecoverable("not_found")).toBe(false);
  });

  it("flags pending and suspended states as recoverable", () => {
    expect(isRecoverable("pending_kyc")).toBe(true);
    expect(isRecoverable("pending_payment")).toBe(true);
    expect(isRecoverable("pending_activation")).toBe(true);
    expect(isRecoverable("suspended_non_payment")).toBe(true);
    expect(isRecoverable("cancelled")).toBe(true);
    expect(isRecoverable("new")).toBe(true);
  });
});

describe("blocksBillingActions", () => {
  it("blocks closed and not_found from placing new orders / autopay", () => {
    expect(blocksBillingActions("closed")).toBe(true);
    expect(blocksBillingActions("not_found")).toBe(true);
  });

  it("does NOT block active customers from placing orders", () => {
    expect(blocksBillingActions("active")).toBe(false);
  });

  it("does NOT block recoverable states — customer can pay/fix", () => {
    expect(blocksBillingActions("pending_payment")).toBe(false);
    expect(blocksBillingActions("suspended_non_payment")).toBe(false);
    expect(blocksBillingActions("cancelled")).toBe(false);
  });
});

describe("explainState", () => {
  it("returns French copy by default", () => {
    const msg = explainState(makeResult({ state: "active" }));
    expect(msg).toMatch(/services?\s+fonctionnent/i);
  });

  it("returns English copy when locale is en", () => {
    const msg = explainState(makeResult({ state: "active" }), "en");
    expect(msg).toMatch(/services? (are|is) running/i);
  });

  it("mentions overdue count when there are overdue invoices", () => {
    const msg = explainState(
      makeResult({
        state: "pending_payment",
        signals: { ...SAMPLE_SIGNALS, overdue_invoices: 3 },
      }),
    );
    expect(msg).toContain("3");
  });

  it("does NOT mention overdue count when there are none", () => {
    const msg = explainState(
      makeResult({
        state: "pending_payment",
        signals: { ...SAMPLE_SIGNALS, overdue_invoices: 0 },
      }),
    );
    expect(msg).not.toMatch(/\d+ facture/i);
  });
});

describe("stateLabel", () => {
  it("returns a label for every defined state", () => {
    const states: Array<Parameters<typeof stateLabel>[0]> = [
      "new",
      "pending_kyc",
      "pending_payment",
      "pending_activation",
      "active",
      "suspended_non_payment",
      "cancelled",
      "closed",
      "not_found",
    ];
    for (const s of states) {
      expect(stateLabel(s).length, `FR label missing for ${s}`).toBeGreaterThan(0);
      expect(stateLabel(s, "en").length, `EN label missing for ${s}`).toBeGreaterThan(0);
    }
  });
});

describe("STATE_BADGE_CLASSES", () => {
  it("defines wrap + dot classes for every color", () => {
    for (const color of ["green", "amber", "red", "blue", "gray"] as const) {
      expect(STATE_BADGE_CLASSES[color].wrap, `wrap class missing for ${color}`).toBeTruthy();
      expect(STATE_BADGE_CLASSES[color].dot, `dot class missing for ${color}`).toBeTruthy();
    }
  });
});
