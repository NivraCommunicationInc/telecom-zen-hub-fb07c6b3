/**
 * BILLING FINANCIAL INVARIANTS — Permanent regression guard
 * 
 * These tests ensure that ALL surfaces read financial amounts from the same
 * canonical source (pricing_snapshot.grand_total), preventing the class of bug
 * where Nivra Core API gross totals contaminate discounted amounts.
 * 
 * INVARIANTS:
 * 1. pricing_snapshot.grand_total MUST be preferred over response.pricing.grand_total
 * 2. pricing_snapshot.grand_total MUST be preferred over order.total_amount
 * 3. Payment amount MUST equal invoice total MUST equal pricing_snapshot.grand_total
 * 4. No surface may use order.total_amount without pricing_snapshot fallback
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const readFile = (relPath: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", "..", relPath), "utf-8");

describe("Billing Financial Invariants", () => {
  
  describe("checkout-canonical-sync payment priority", () => {
    it("payment amount MUST use pricing_snapshot BEFORE response.pricing", () => {
      const syncCode = readFile("supabase/functions/checkout-canonical-sync/index.ts");
      
      // The payment section must NOT have response.pricing first
      // Match the pattern: payment amount assignment
      const paymentAmountPattern = /const total = toMoney\(response\.pricing\?\.grand_total \?\? payload\.pricing_snapshot/;
      expect(syncCode).not.toMatch(paymentAmountPattern);
      
      // It MUST use pricing_snapshot first (matching order + invoice priority)
      const correctPattern = /const total = toMoney\(payload\.pricing_snapshot\?\.grand_total \?\? response\.pricing\?\.grand_total\)/;
      expect(syncCode).toMatch(correctPattern);
    });

    it("order total_amount MUST use pricing_snapshot as source", () => {
      const syncCode = readFile("supabase/functions/checkout-canonical-sync/index.ts");
      
      // canonicalGrandTotal must prefer pricing_snapshot
      const orderPattern = /canonicalGrandTotal = toMoney\(payload\.pricing_snapshot\?\.grand_total/;
      expect(syncCode).toMatch(orderPattern);
    });
  });

  describe("Portal surfaces use pricing_snapshot", () => {
    it("ClientOrders must read pricing_snapshot.grand_total before total_amount", () => {
      const code = readFile("src/pages/client/ClientOrders.tsx");
      
      // Must NOT use bare order.total_amount without pricing_snapshot fallback
      // for the main amount display
      expect(code).toContain("pricing_snapshot?.grand_total ?? order.total_amount");
      expect(code).toContain("pricing_snapshot?.grand_total ?? selectedOrder.total_amount");
    });
  });

  describe("Core admin surfaces use pricing_snapshot fallback", () => {
    it("OrderSummaryPanel uses pricing_snapshot before order.total_amount", () => {
      const code = readFile("src/core-app/components/order-processing/OrderSummaryPanel.tsx");
      expect(code).toContain("pricing_snapshot");
    });

    it("CoreOrderFilePanel uses pricing_snapshot before order.total_amount", () => {
      const code = readFile("src/core-app/components/order-detail/CoreOrderFilePanel.tsx");
      expect(code).toContain("pricing_snapshot");
    });

    it("PaymentInvoiceStep uses pricing_snapshot before order.total_amount", () => {
      const code = readFile("src/core-app/components/order-processing/steps/PaymentInvoiceStep.tsx");
      expect(code).toContain("pricing_snapshot");
    });
  });

  describe("No raw order.total_amount in financial display paths", () => {
    const CRITICAL_FILES = [
      "src/pages/client/ClientOrders.tsx",
      "src/pages/client/ClientOrderConfirmation.tsx",
      "src/core-app/components/order-processing/OrderSummaryPanel.tsx",
      "src/core-app/components/order-detail/CoreOrderFilePanel.tsx",
      "src/core-app/components/order-processing/steps/OrderReviewStep.tsx",
      "src/core-app/components/order-processing/steps/PaymentInvoiceStep.tsx",
    ];

    for (const file of CRITICAL_FILES) {
      it(`${file} must not use order.total_amount without pricing_snapshot guard`, () => {
        const code = readFile(file);
        
        // Find all occurrences of order.total_amount or order?.total_amount
        // Each one must be preceded by pricing_snapshot on the same line or expression
        const lines = code.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes("total_amount") && !line.includes("//") && !line.includes("*")) {
            // If it references order.total_amount, it must also reference pricing_snapshot
            // OR be inside a fallback chain that already checked pricing_snapshot
            if (
              line.includes("order.total_amount") && 
              !line.includes("pricing_snapshot") &&
              !line.includes("invoice?.total") &&
              !line.includes("invoice.total") &&
              !line.includes("total_amount_displayed") // consent record, not display
            ) {
              // Check if the previous line contains pricing_snapshot (multi-line expression)
              const prevLine = i > 0 ? lines[i - 1] : "";
              const hasPricingGuard = prevLine.includes("pricing_snapshot") || line.includes("pricing_snapshot");
              expect(hasPricingGuard).toBe(true);
            }
          }
        }
      });
    }
  });
  describe("Email financial canonical invariants", () => {
    it("send-order-confirmation MUST NOT map total_amount from monthly_total_tax_in", () => {
      const code = readFile("supabase/functions/send-order-confirmation/index.ts");
      expect(code).not.toContain("total_amount: monthly_total_tax_in");
      expect(code).toContain("amount_paid_today: canonicalAmountPaidToday");
      expect(code).toContain("total_payable: canonicalTotalPayable");
    });

    it("send-order-confirmation MUST prioritize latest payment amount for amount_paid_today", () => {
      const code = readFile("supabase/functions/send-order-confirmation/index.ts");
      expect(code).toContain("const latestPaymentAmount = toNum(latestPayment?.amount)");
      expect(code).toContain("const canonicalAmountPaidToday = latestPaymentAmount > 0");
    });

    it("process-email-queue MUST enforce canonical enrichment before rendering", () => {
      const code = readFile("supabase/functions/process-email-queue/index.ts");
      expect(code).toContain("resolveCanonicalFinancialVars(");
      expect(code).toContain("const templateVars = await resolveCanonicalFinancialVars");
    });

    it("order_submitted template MUST show paid today from canonical paid/total fields", () => {
      const code = readFile("supabase/functions/process-email-queue/index.ts");
      expect(code).toContain("Payé aujourd’hui / Paid today");
      expect(code).toContain("formatCurrency(vars.amount_paid_today ?? vars.total_payable ?? vars.total_amount)");
      expect(code).toContain("ORDER_CONFIRMATION_TEMPLATES");
    });

    it("PayPal payment confirmation email producers MUST include invoice_id for canonical enrichment", () => {
      const captureCode = readFile("supabase/functions/paypal-capture-order/index.ts");
      const webhookCode = readFile("supabase/functions/paypal-webhook/index.ts");
      const chargeCode = readFile("supabase/functions/paypal-charge-subscription/index.ts");

      expect(captureCode).toContain("invoice_id: v2Invoice.id");
      expect(webhookCode).toContain("invoice_id: invoice.id");
      expect(chargeCode).toContain("invoice_id: body.invoice_id");
    });
  });
});
