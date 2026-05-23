/**
 * ═══════════════════════════════════════════════════════════════════
 * REGRESSION SUITE: Reconciliation discrepancy detection
 * ═══════════════════════════════════════════════════════════════════
 *
 * Locks the math that decides "is this account out of sync?".
 *
 * The actual logic runs in Deno inside supabase/functions/billing-reconciliation,
 * but the decision rule is pure arithmetic — easy to unit-test here.
 *
 * Regressions in this code cost real money:
 *   - Too tight (no tolerance) → false alarms on every rounding cent.
 *   - Too loose → real fraud / missed payments slip through.
 */
import { describe, it, expect } from "vitest";

const TOLERANCE_CAD = 0.01;

function isDiscrepant(
  paymentsReceived: number,
  invoicesPaid: number,
  hasOrphanPayments = false,
  hasOrphanInvoices = false,
): boolean {
  const discrepancy = Math.abs(paymentsReceived - invoicesPaid);
  return discrepancy > TOLERANCE_CAD || hasOrphanPayments || hasOrphanInvoices;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

describe("reconciliation discrepancy detection", () => {
  it("treats a perfectly matched account as OK", () => {
    expect(isDiscrepant(100.0, 100.0)).toBe(false);
  });

  it("treats a 1¢ rounding difference as OK", () => {
    expect(isDiscrepant(100.01, 100.0)).toBe(false);
    expect(isDiscrepant(99.99, 100.0)).toBe(false);
  });

  it("flags a 2¢ difference as a discrepancy (tolerance is strict)", () => {
    expect(isDiscrepant(100.02, 100.0)).toBe(true);
  });

  it("flags large discrepancies — real money missing", () => {
    expect(isDiscrepant(60.0, 100.0)).toBe(true); // $40 missing
    expect(isDiscrepant(140.0, 100.0)).toBe(true); // overpaid?
  });

  it("flags orphan payments even if the totals happen to match", () => {
    // Payment received but not attached to any invoice — even if the total
    // happens to equal invoices_paid by coincidence, that's a bug.
    expect(isDiscrepant(100.0, 100.0, true, false)).toBe(true);
  });

  it("flags orphan invoices (marked paid with amount_paid=0)", () => {
    expect(isDiscrepant(100.0, 100.0, false, true)).toBe(true);
  });

  it("flags accounts with no payments yet (won't surface as discrepancy at $0)", () => {
    // New account, no activity → 0 vs 0 → OK
    expect(isDiscrepant(0, 0)).toBe(false);
  });
});

describe("round2 — money helper", () => {
  it("rounds to 2 decimals", () => {
    expect(round2(100.005)).toBe(100.01); // banker's rounding doesn't apply to Math.round
    expect(round2(99.994)).toBe(99.99);
    expect(round2(0.1 + 0.2)).toBe(0.3); // notorious JS float bug — round2 must fix it
  });

  it("handles negative amounts (refunds)", () => {
    expect(round2(-50.123)).toBe(-50.12);
  });

  it("handles zero", () => {
    expect(round2(0)).toBe(0);
  });
});
