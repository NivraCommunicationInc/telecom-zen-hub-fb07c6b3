/**
 * CANONICAL NIVRA BILLING CYCLE RULE — Regression lock
 *
 * IMMUTABLE RULE:
 *   1. Billing cycle anchored to customer's service start / order date
 *   2. Renewal invoices generated 2–3 days BEFORE cycle day (J-3)
 *   3. Invoice due_date = cycle day itself
 *   4. Unpaid past due_date → overdue (balance due)
 *   5. 5-day grace period after due_date
 *   6. Unpaid past due_date + 5 days → service SUSPENDED, invoice VOIDED
 *
 * These tests ensure this rule is enforced across all automation surfaces.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const readFile = (relPath: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", "..", relPath), "utf-8");

describe("Canonical Billing Cycle Rule Lock", () => {

  describe("billing-check-overdue uses due_date NOT cycle_end_date", () => {
    it("must query invoices by due_date, not cycle_end_date", () => {
      const code = readFile("supabase/functions/billing-check-overdue/index.ts");
      // Must use due_date for overdue threshold
      expect(code).toContain('.lte("due_date", todayStr)');
      // Must NOT use cycle_end_date as primary overdue trigger
      expect(code).not.toMatch(/\.eq\("status", "pending"\)\s*\n\s*\.lte\("cycle_end_date"/);
    });

    it("must implement 5-day grace period before suspension", () => {
      const code = readFile("supabase/functions/billing-check-overdue/index.ts");
      expect(code).toContain("daysPastDue >= 5");
      expect(code).toContain("suspended");
      expect(code).toContain("grace");
    });

    it("must mark invoices overdue at J0 before suspension, not expire immediately", () => {
      const code = readFile("supabase/functions/billing-check-overdue/index.ts");
      // Must transition to overdue first
      expect(code).toContain('status: "overdue"');
      // The normal overdue flow (PART 2) must NOT use "expired" — it must use "suspended"
      // Dispute flow (PART 1) is allowed to use "expired" separately
      const part2 = code.split("PART 2")[1] || "";
      expect(part2).toContain('"suspended"');
      expect(part2).not.toContain('"expired"');
    });

    it("must void invoice only at J+10 (not at J+5 suspension)", () => {
      const code = readFile("supabase/functions/billing-check-overdue/index.ts");
      // Must have J+10 void logic
      expect(code).toContain("daysPastDue >= 10");
      // At J+5, invoice must stay overdue for reactivation
      expect(code).toContain("stays overdue for reactivation");
      expect(code).toContain("reactivation window");
    });
  });

  describe("billing-lifecycle uses due_date-based expiration", () => {
    it("processExpirations must NOT use bare cycle_end_date <= today for immediate expiry", () => {
      const code = readFile("supabase/functions/billing-lifecycle/index.ts");
      // Must not have the old pattern of immediate expiry at cycle_end_date
      expect(code).not.toMatch(/\.in\("status".*active.*pending.*\)\s*\n\s*\.lte\("cycle_end_date", today\)/);
    });

    it("must reference grace period in expiration logic", () => {
      const code = readFile("supabase/functions/billing-lifecycle/index.ts");
      expect(code).toContain("grace");
      expect(code).toContain("suspended");
    });
  });

  describe("billing-generate-renewals generates at J-3", () => {
    it("must look 3 days ahead for renewal generation", () => {
      const code = readFile("supabase/functions/billing-generate-renewals/index.ts");
      expect(code).toContain("targetDate.setDate(today.getDate() + 3)");
    });
  });

  describe("Confirmation page shows cycle anchored to order date", () => {
    it("must use pricing_snapshot.billing_cycle_day or order creation day", () => {
      const code = readFile("src/pages/client/ClientOrderConfirmation.tsx");
      expect(code).toContain("ps?.billing_cycle_day || activationDay");
    });

    it("must mention grace period in billing info text", () => {
      const code = readFile("src/pages/client/ClientOrderConfirmation.tsx");
      expect(code).toContain("période de grâce de 5 jours");
    });

    it("must document the canonical billing rule inline", () => {
      const code = readFile("src/pages/client/ClientOrderConfirmation.tsx");
      expect(code).toContain("CANONICAL NIVRA BILLING RULE");
    });
  });

  describe("No immediate expiration without grace period", () => {
    const AUTOMATION_FILES = [
      "supabase/functions/billing-check-overdue/index.ts",
      "supabase/functions/billing-lifecycle/index.ts",
    ];

    for (const file of AUTOMATION_FILES) {
      it(`${file} must NOT expire service at J0 (due_date)`, () => {
        const code = readFile(file);
        // The pattern "daysPastDue >= 0" followed immediately by "expired" without grace check is forbidden
        const lines = code.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes("daysPastDue >= 0") && line.includes("expired")) {
            // This is forbidden — immediate expiry at J0
            expect(false).toBe(true);
          }
        }
      });
    }
  });
});
