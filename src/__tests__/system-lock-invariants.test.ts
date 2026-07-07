/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NIVRA SYSTEM LOCK — PERMANENT REGRESSION GUARD
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This file is the BUILD-TIME enforcement layer for all 9 locked production
 * systems. If ANY test here fails, the build MUST NOT proceed.
 *
 * LOCKED SYSTEMS:
 *   1. Checkout pricing & promo application
 *   2. PayPal payment flow
 *   3. Invoice/payment canonical financial mapping
 *   4. Client portal financial displays
 *   5. Nivra Core financial displays
 *   6. Order confirmation page financial displays
 *   7. Financial email templates / senders
 *   8. Consent / legal checkout evidence
 *   9. Order lifecycle separation from payment lifecycle
 *
 * FORBIDDEN PATTERNS (any of these reintroduced = build failure):
 *   - Duplicated pricing logic
 *   - Alternate financial mapping
 *   - Fallback identifiers (id.slice)
 *   - Non-canonical reads (profiles.account_number)
 *   - UI-specific recalculation of taxes/totals
 *   - Email-specific recalculation
 *   - Order auto-completion from payment status
 *   - Payment without canonical amount alignment
 *
 * MODIFICATION POLICY:
 *   Tests may only be ADDED, never removed or weakened.
 *   Any deletion of a test from this file is a security incident.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// ── Helpers ──────────────────────────────────────────────────────────────────

const readFile = (relPath: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", "..", relPath), "utf-8");

const fileExists = (relPath: string) =>
  fs.existsSync(path.resolve(__dirname, "..", "..", relPath));

function grepSrc(pattern: string, excludeFiles: string[] = []): string[] {
  try {
    const excludeArgs = [
      "--exclude-dir=node_modules",
      "--exclude-dir=.git",
      "--exclude-dir=dist",
      "--exclude=*.test.ts",
      "--exclude=types.ts",
      ...excludeFiles.map((f) => `--exclude=${f}`),
    ].join(" ");
    const root = path.resolve(__dirname, "..", "..");
    const result = execSync(
      `grep -rn "${pattern}" ${root}/src ${excludeArgs} 2>/dev/null || true`,
      { encoding: "utf-8" },
    );
    return result
      .split("\n")
      .filter(Boolean)
      .filter((l) => !l.includes("system-lock-invariants.test.ts"));
  } catch {
    return [];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// LOCK 1: CHECKOUT PRICING & PROMO APPLICATION
// ═════════════════════════════════════════════════════════════════════════════

describe("LOCK 1 — Checkout Pricing & Promo", () => {
  it("ClientNewOrder must use compute_checkout_pricing RPC as sole authority", () => {
    const code = readFile("src/pages/client/ClientNewOrder.tsx");
    expect(code).toContain("compute_checkout_pricing");
    // Must NOT contain local tax calculation for transactional write paths
    expect(code).not.toMatch(/const\s+tps\s*=\s*subtotal\s*\*/);
    expect(code).not.toMatch(/const\s+tvq\s*=\s*subtotal\s*\*/);
  });

  it("serverTaxEngine must be marked as preview-only, not for writes", () => {
    const code = readFile("src/lib/pricing/serverTaxEngine.ts");
    expect(code).toMatch(/FORBIDDEN usage/i);
    expect(code).toMatch(/ESTIMATION ONLY|preview|NOT.*SERVER.*SOURCE.*TRUTH/i);
  });

  it("checkout MUST send pricing_snapshot from RPC to backend", () => {
    const code = readFile("src/pages/client/ClientNewOrder.tsx");
    expect(code).toContain("pricing_snapshot");
  });

  it("NO frontend file calculates TPS/TVQ for transactional amounts", () => {
    // Allowed: serverTaxEngine.ts (preview), test files, types
    const violations = grepSrc("TPS_RATE\\|TVQ_RATE\\|0\\.05.*tps\\|0\\.09975.*tvq", [
      "serverTaxEngine.ts",
      "taxPreview.ts",
    ]);
    const real = violations.filter(
      (v) =>
        !v.includes("serverTaxEngine") &&
        !v.includes("taxPreview") &&
        !v.includes("// preview") &&
        !v.includes("// UI only") &&
        !v.includes("// display") &&
        !v.includes("config") &&
        !v.includes(".test."),
    );
    // If any transactional path computes taxes locally, fail
    const transactionalViolations = real.filter(
      (v) =>
        v.includes("Checkout") ||
        v.includes("checkout") ||
        v.includes("invoice") ||
        v.includes("payment") ||
        v.includes("order"),
    );
    expect(
      transactionalViolations,
      `Local tax calculation in transactional paths:\n${transactionalViolations.join("\n")}`,
    ).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LOCK 2: PAYPAL PAYMENT FLOW
// ═════════════════════════════════════════════════════════════════════════════

describe("LOCK 2 — PayPal Payment Flow", () => {
  it("paypal-create-order must validate amount > 0", () => {
    const code = readFile("supabase/functions/paypal-create-order/index.ts");
    expect(code).toMatch(/amount\s*<=\s*0|amount\s*<\s*0|!Number\.isFinite/);
  });

  it("paypal-capture-order must record payment with invoice_id", () => {
    const code = readFile("supabase/functions/paypal-capture-order/index.ts");
    expect(code).toContain("invoice_id");
  });

  it("paypal-webhook must verify signature in production", () => {
    const code = readFile("supabase/functions/paypal-webhook/index.ts");
    expect(code).toMatch(/verify|signature|PAYPAL_WEBHOOK_ID/);
  });

  it("paypal-webhook must include invoice_id for canonical enrichment", () => {
    const code = readFile("supabase/functions/paypal-webhook/index.ts");
    expect(code).toContain("invoice_id");
  });

  it("paypal-charge-subscription must include invoice_id", () => {
    const code = readFile("supabase/functions/paypal-charge-subscription/index.ts");
    expect(code).toContain("invoice_id");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LOCK 3: INVOICE/PAYMENT CANONICAL FINANCIAL MAPPING
// ═════════════════════════════════════════════════════════════════════════════

describe("LOCK 3 — Invoice/Payment Canonical Mapping", () => {
  it("checkout-canonical-sync must prioritize pricing_snapshot for order total", () => {
    const code = readFile("supabase/functions/checkout-canonical-sync/index.ts");
    expect(code).toMatch(
      /canonicalGrandTotal\s*=\s*toMoney\(payload\.pricing_snapshot\?\.grand_total/,
    );
  });

  it("checkout-canonical-sync must prioritize pricing_snapshot for payment amount", () => {
    const code = readFile("supabase/functions/checkout-canonical-sync/index.ts");
    expect(code).toMatch(
      /const total = toMoney\(payload\.pricing_snapshot\?\.grand_total \?\? response\.pricing\?\.grand_total\)/,
    );
  });

  it("apply_payment_to_invoice RPC must exist as canonical payment path", () => {
    const violations = grepSrc("apply_payment_to_invoice");
    expect(violations.length).toBeGreaterThan(0);
  });

  it("public Square checkout must charge a canonical invoice, never a FIELD intent", () => {
    const code = readFile("src/pages/GuestCheckout.tsx");
    expect(code).toContain("precreateOnly");
    expect(code).toContain("return { invoice_id: invoiceId }");
    expect(code).not.toContain('"pos-square-intent"');
    expect(code).not.toContain("intent_id: data.intent_id");
  });

  it("POS card flows must use a Core invoice before charging Square", () => {
    const adminForm = readFile("src/components/pos/POSPaymentFormAdmin.tsx");
    const unifiedPOS = readFile("src/components/pos/UnifiedPOSPage.tsx");
    expect(adminForm).toContain("onBeforeCardCharge");
    expect(adminForm).not.toContain('"pos-square-intent"');
    expect(unifiedPOS).toContain("createPOSDraftInvoice");
    expect(unifiedPOS).toContain("precreated_order_id");
  });

  it("document builder MUST block generation without compute_invoice_breakdown", () => {
    const code = readFile("src/lib/pdf/documentBuilder.ts");
    expect(code).toContain("compute_invoice_breakdown RPC requis");
    // fallbackStructure must only appear in deletion comments, not as active code
    const lines = code.split("\n");
    const activeFallbacks = lines.filter(
      (l) => l.includes("fallbackStructure") && !l.includes("SUPPRIMÉ") && !l.includes("//"),
    );
    expect(activeFallbacks, "Active fallbackStructure code found").toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LOCK 4: CLIENT PORTAL FINANCIAL DISPLAYS
// ═════════════════════════════════════════════════════════════════════════════

describe("LOCK 4 — Client Portal Financial Displays", () => {
  it("ClientOrders must read pricing_snapshot.grand_total before total_amount", () => {
    const code = readFile("src/pages/client/ClientOrders.tsx");
    expect(code).toContain("pricing_snapshot");
  });

  it("ClientOrders must use pricing_snapshot ?? total_amount fallback chain", () => {
    const code = readFile("src/pages/client/ClientOrders.tsx");
    // Must contain the canonical fallback pattern
    expect(code).toMatch(/pricing_snapshot.*grand_total.*total_amount/s);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LOCK 5: NIVRA CORE FINANCIAL DISPLAYS
// ═════════════════════════════════════════════════════════════════════════════

describe("LOCK 5 — Nivra Core Financial Displays", () => {
  const CORE_FILES = [
    "src/core-app/components/order-processing/OrderSummaryPanel.tsx",
    "src/core-app/components/order-detail/CoreOrderFilePanel.tsx",
    "src/core-app/components/order-processing/steps/PaymentInvoiceStep.tsx",
    "src/core-app/components/order-processing/steps/OrderReviewStep.tsx",
  ];

  for (const file of CORE_FILES) {
    it(`${path.basename(file)} must reference pricing_snapshot`, () => {
      if (fileExists(file)) {
        const code = readFile(file);
        expect(code).toContain("pricing_snapshot");
      }
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// LOCK 6: ORDER CONFIRMATION PAGE
// ═════════════════════════════════════════════════════════════════════════════

describe("LOCK 6 — Order Confirmation Page", () => {
  it("ClientOrderConfirmation must use pricing_snapshot.grand_total as SOLE authority", () => {
    const code = readFile("src/pages/client/ClientOrderConfirmation.tsx");
    expect(code).toContain("pricing_snapshot");
    expect(code).toContain("BILLING INVARIANT");
  });

  it("must NOT compute taxes locally", () => {
    const code = readFile("src/pages/client/ClientOrderConfirmation.tsx");
    // Must not have inline tax math
    expect(code).not.toMatch(/subtotal\s*\*\s*0\.05/);
    expect(code).not.toMatch(/subtotal\s*\*\s*0\.09975/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LOCK 7: FINANCIAL EMAIL TEMPLATES / SENDERS
// ═════════════════════════════════════════════════════════════════════════════

describe("LOCK 7 — Financial Email Templates & Senders", () => {
  it("send-order-confirmation must use canonicalAmountPaidToday", () => {
    const code = readFile("supabase/functions/send-order-confirmation/index.ts");
    expect(code).toContain("canonicalAmountPaidToday");
    expect(code).toContain("canonicalTotalPayable");
  });

  it("send-order-confirmation must NOT map total_amount from monthly_total_tax_in", () => {
    const code = readFile("supabase/functions/send-order-confirmation/index.ts");
    expect(code).not.toContain("total_amount: monthly_total_tax_in");
  });

  it("process-email-queue must enforce canonical enrichment", () => {
    const code = readFile("supabase/functions/process-email-queue/index.ts");
    expect(code).toContain("resolveCanonicalFinancialVars");
  });

  it("email templates must use canonical paid/total fields", () => {
    const code = readFile("supabase/functions/process-email-queue/index.ts");
    expect(code).toContain("amount_paid_today");
    expect(code).toContain("total_payable");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LOCK 8: CONSENT / LEGAL CHECKOUT EVIDENCE
// ═════════════════════════════════════════════════════════════════════════════

describe("LOCK 8 — Consent & Legal Checkout Evidence", () => {
  it("checkout must persist consent to checkout_consent_records", () => {
    const code = readFile("src/pages/client/ClientNewOrder.tsx");
    expect(code).toContain("checkout_consent_records");
  });

  it("consent persistence must be a blocking operation", () => {
    const code = readFile("src/pages/client/ClientNewOrder.tsx");
    // Must throw on error, not silently continue
    expect(code).toMatch(/persistConsent|consent.*throw|consent.*error/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LOCK 9: ORDER LIFECYCLE SEPARATION FROM PAYMENT LIFECYCLE
// ═════════════════════════════════════════════════════════════════════════════

describe("LOCK 9 — Order/Payment Lifecycle Separation", () => {
  it("checkout-canonical-sync must NOT set order status to completed/activated/fulfilled", () => {
    const code = readFile("supabase/functions/checkout-canonical-sync/index.ts");
    // Order status after checkout must be intake state only
    expect(code).not.toMatch(/order.*status.*['"]completed['"]/);
    expect(code).not.toMatch(/order.*status.*['"]activated['"]/);
    expect(code).not.toMatch(/order.*status.*['"]fulfilled['"]/);
  });

  it("NO edge function auto-completes orders from payment confirmation", () => {
    const paypalWebhook = readFile("supabase/functions/paypal-webhook/index.ts");
    const paypalCapture = readFile("supabase/functions/paypal-capture-order/index.ts");
    // These must NOT transition order status to completion states
    for (const code of [paypalWebhook, paypalCapture]) {
      expect(code).not.toMatch(/orders.*update.*status.*['"]completed['"]/);
      expect(code).not.toMatch(/orders.*update.*status.*['"]activated['"]/);
      expect(code).not.toMatch(/orders.*update.*status.*['"]fulfilled['"]/);
    }
  });

  it("trg_guard_order_lifecycle_no_skip migration must exist", () => {
    const migrations = execSync(
      `grep -rl "trg_guard_order_lifecycle_no_skip" ${path.resolve(__dirname, "..", "..", "supabase/migrations")} 2>/dev/null || true`,
      { encoding: "utf-8" },
    );
    expect(migrations.trim().length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CROSS-CUTTING: FORBIDDEN PATTERNS (applies to all 9 locks)
// ═════════════════════════════════════════════════════════════════════════════

describe("CROSS-CUTTING — Forbidden Patterns", () => {
  it("NO frontend file uses id.slice() for financial identifiers", () => {
    const invoiceViolations = grepSrc("invoice.*id\\.slice\\|id\\.slice.*invoice");
    const paymentViolations = grepSrc("payment.*id\\.slice\\|id\\.slice.*payment");
    const all = [...invoiceViolations, ...paymentViolations].filter(
      (v) => !v.includes(".test.ts"),
    );
    expect(
      all,
      `id.slice() used as fallback for financial IDs:\n${all.join("\n")}`,
    ).toHaveLength(0);
  });

  it("NO component reads profile.account_number (non-canonical)", () => {
    const violations = grepSrc(
      "profile\\.account_number\\|profile\\?\\.account_number",
    );
    const real = violations.filter(
      (v) =>
        !v.includes("canonicalAccountResolver") &&
        !v.includes("// canonical") &&
        !v.includes("// NOTE:"),
    );
    expect(
      real,
      `Non-canonical profile.account_number reads:\n${real.join("\n")}`,
    ).toHaveLength(0);
  });

  it("canonicalAccountResolver.ts must exist", () => {
    expect(
      fileExists("src/lib/canonicalAccountResolver.ts"),
    ).toBe(true);
  });

  it("document generation is blocked without billing_invoice_lines", () => {
    const code = readFile("src/lib/pdf/documentBuilder.ts");
    expect(code).toContain("Génération bloquée");
  });

  it("canonical document service also blocks without RPC", () => {
    if (fileExists("src/lib/pdf/canonicalDocumentService.ts")) {
      const code = readFile("src/lib/pdf/canonicalDocumentService.ts");
      expect(code).toContain("compute_invoice_breakdown RPC requis");
    }
  });
});
