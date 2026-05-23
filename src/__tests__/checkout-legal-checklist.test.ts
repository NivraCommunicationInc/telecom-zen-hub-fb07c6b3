/**
 * ═══════════════════════════════════════════════════════════════════
 * REGRESSION SUITE: Legal checklist enforcement at checkout
 * ═══════════════════════════════════════════════════════════════════
 *
 * The checkout flow blocks payment until ALL required acknowledgements are
 * checked. A regression here means a customer could pay without consenting
 * to prepaid rules, 10-day rescission (Quebec LPC), etc. — that's a legal
 * exposure, not just UX.
 *
 * Tests guard:
 *   1. All baseline checks (prepaid + delays + notices) required.
 *   2. NEW (2026-05): `rescission` checkbox is also required — added to
 *      comply with the Quebec Consumer Protection Act 10-day cooling-off.
 *   3. Optional `etransfer` only required when payment method is e-Transfer.
 */
import { describe, it, expect } from "vitest";
import {
  isChecklistComplete,
  type ChecklistState,
} from "@/components/checkout/CheckoutEssentialTermsBase";

const ALL_CHECKED: ChecklistState = {
  prepaid: true,
  delays: true,
  notices: true,
  etransfer: true,
  rescission: true,
};

describe("Checkout legal checklist", () => {
  it("blocks completion when no boxes are checked", () => {
    const empty: ChecklistState = {
      prepaid: false,
      delays: false,
      notices: false,
      etransfer: false,
      rescission: false,
    };
    expect(isChecklistComplete(empty, false)).toBe(false);
    expect(isChecklistComplete(empty, true)).toBe(false);
  });

  it("requires prepaid acknowledgement", () => {
    expect(isChecklistComplete({ ...ALL_CHECKED, prepaid: false }, false)).toBe(false);
  });

  it("requires delays acknowledgement", () => {
    expect(isChecklistComplete({ ...ALL_CHECKED, delays: false }, false)).toBe(false);
  });

  it("requires notices acknowledgement", () => {
    expect(isChecklistComplete({ ...ALL_CHECKED, notices: false }, false)).toBe(false);
  });

  it("requires the rescission (10-day right) acknowledgement — Quebec LPC", () => {
    // Regression guard: this checkbox was added 2026-05 after the audit
    // identified missing consumer-protection consent. Removing it would
    // re-introduce a compliance gap.
    expect(isChecklistComplete({ ...ALL_CHECKED, rescission: false }, false)).toBe(false);
    expect(isChecklistComplete({ ...ALL_CHECKED, rescission: false }, true)).toBe(false);
  });

  it("allows completion when all baseline + rescission boxes are checked (PayPal flow)", () => {
    // PayPal does not need the etransfer ack
    const paypalFlow: ChecklistState = {
      prepaid: true,
      delays: true,
      notices: true,
      etransfer: false, // not relevant for PayPal
      rescission: true,
    };
    expect(isChecklistComplete(paypalFlow, false)).toBe(true);
  });

  it("requires etransfer ack ONLY when payment method is e-Transfer", () => {
    const withoutEtransfer: ChecklistState = {
      prepaid: true,
      delays: true,
      notices: true,
      etransfer: false,
      rescission: true,
    };
    // e-Transfer flow → must check etransfer too
    expect(isChecklistComplete(withoutEtransfer, true)).toBe(false);
    // PayPal flow → etransfer not required
    expect(isChecklistComplete(withoutEtransfer, false)).toBe(true);
  });

  it("allows completion with everything checked (e-Transfer flow)", () => {
    expect(isChecklistComplete(ALL_CHECKED, true)).toBe(true);
  });
});
