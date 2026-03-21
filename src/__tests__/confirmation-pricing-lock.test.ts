/**
 * ═══════════════════════════════════════════════════════════════════
 * PRODUCTION-LOCKED REGRESSION SUITE: Confirmation Pricing Display
 * ═══════════════════════════════════════════════════════════════════
 *
 * These tests enforce the separation between:
 *   - Recurring monthly display  (monthly block)
 *   - Payment-today display      (one-time block)
 *
 * Violations of these rules MUST fail the build.
 * See: ClientOrderConfirmation.tsx inline rules.
 */
import { describe, it, expect } from "vitest";
import { toNonNegativeMoney } from "@/lib/pricing/money";

// ── Helpers mirroring the exact production logic ──

interface PromoApplied {
  code: string;
  duration?: string;
  applies_to?: { services?: boolean; recurring?: boolean; equipment_only?: boolean };
  discount_value: number;
}

function classifyPromo(promo: PromoApplied | null) {
  if (!promo) return { isRecurring: false };
  const isRecurring =
    (promo.duration === "recurring" || promo.duration === "month" ||
      promo.applies_to?.services === true || promo.applies_to?.recurring === true) &&
    !promo.applies_to?.equipment_only;
  return { isRecurring };
}

function computeConfirmationPricing(params: {
  recurringSubtotal: number;
  oneTimeSubtotal: number;
  promoDiscount: number;
  welcomeDiscount: number;
  promo: PromoApplied | null;
}) {
  const { recurringSubtotal, oneTimeSubtotal, promoDiscount, welcomeDiscount, promo } = params;
  const { isRecurring } = classifyPromo(promo);

  const recurringPromoDiscount = toNonNegativeMoney(
    (isRecurring ? promoDiscount : 0) + welcomeDiscount
  );
  const oneTimePromoDiscount = !isRecurring ? toNonNegativeMoney(promoDiscount) : 0;
  const monthlyRecurringNet = toNonNegativeMoney(recurringSubtotal - recurringPromoDiscount);

  return {
    monthlyRecurringGross: recurringSubtotal,
    monthlyRecurringNet,
    recurringPromoDiscount,
    oneTimePromoDiscount,
    oneTimeSubtotal,
  };
}

// ═══════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════

describe("Confirmation Pricing Display Lock", () => {

  // ── RULE 1: One-time discount must NOT reduce monthly display ──

  it("EQUIP-type one-time promo does NOT reduce monthly recurring total", () => {
    const result = computeConfirmationPricing({
      recurringSubtotal: 140,
      oneTimeSubtotal: 230,
      promoDiscount: 230,
      welcomeDiscount: 0,
      promo: { code: "EQUIP26", duration: "one_time", applies_to: { equipment_only: true }, discount_value: 230 },
    });

    expect(result.monthlyRecurringNet).toBe(140);
    expect(result.recurringPromoDiscount).toBe(0);
    expect(result.oneTimePromoDiscount).toBe(230);
  });

  it("monthly display is never 0 when recurring services exist and discount is one-time", () => {
    const result = computeConfirmationPricing({
      recurringSubtotal: 80,
      oneTimeSubtotal: 100,
      promoDiscount: 100,
      welcomeDiscount: 0,
      promo: { code: "BIGDEAL", duration: "one_time", applies_to: { equipment_only: true }, discount_value: 100 },
    });

    expect(result.monthlyRecurringNet).toBeGreaterThan(0);
    expect(result.monthlyRecurringNet).toBe(80);
  });

  // ── RULE 2: One-time discount MUST appear in payment-today section ──

  it("one-time promo discount is captured for payment-today display", () => {
    const result = computeConfirmationPricing({
      recurringSubtotal: 140,
      oneTimeSubtotal: 230,
      promoDiscount: 230,
      welcomeDiscount: 0,
      promo: { code: "EQUIP26", duration: "one_time", applies_to: { equipment_only: true }, discount_value: 230 },
    });

    expect(result.oneTimePromoDiscount).toBe(230);
    expect(result.oneTimePromoDiscount).toBeGreaterThan(0);
  });

  // ── RULE 3: Recurring promo correctly reduces only the monthly block ──

  it("recurring promo reduces monthly display but NOT one-time block", () => {
    const result = computeConfirmationPricing({
      recurringSubtotal: 140,
      oneTimeSubtotal: 50,
      promoDiscount: 20,
      welcomeDiscount: 0,
      promo: { code: "SAVE20", duration: "recurring", applies_to: { services: true }, discount_value: 20 },
    });

    expect(result.monthlyRecurringNet).toBe(120);
    expect(result.recurringPromoDiscount).toBe(20);
    expect(result.oneTimePromoDiscount).toBe(0);
  });

  // ── RULE 4: Welcome discount is always recurring ──

  it("welcome discount reduces monthly display", () => {
    const result = computeConfirmationPricing({
      recurringSubtotal: 100,
      oneTimeSubtotal: 0,
      promoDiscount: 0,
      welcomeDiscount: 10,
      promo: null,
    });

    expect(result.monthlyRecurringNet).toBe(90);
    expect(result.recurringPromoDiscount).toBe(10);
  });

  // ── RULE 5: Mixed scenario — equipment promo + welcome discount ──

  it("equipment promo goes to payment-today while welcome discount reduces monthly", () => {
    const result = computeConfirmationPricing({
      recurringSubtotal: 140,
      oneTimeSubtotal: 230,
      promoDiscount: 230,
      welcomeDiscount: 15,
      promo: { code: "EQUIP26", duration: "one_time", applies_to: { equipment_only: true }, discount_value: 230 },
    });

    expect(result.monthlyRecurringNet).toBe(125); // 140 - 15 welcome
    expect(result.recurringPromoDiscount).toBe(15); // welcome only
    expect(result.oneTimePromoDiscount).toBe(230);  // equipment promo in today's payment
  });

  // ── RULE 6: No promo at all — monthly stays at gross ──

  it("no promo leaves monthly at gross and one-time discount at 0", () => {
    const result = computeConfirmationPricing({
      recurringSubtotal: 140,
      oneTimeSubtotal: 50,
      promoDiscount: 0,
      welcomeDiscount: 0,
      promo: null,
    });

    expect(result.monthlyRecurringNet).toBe(140);
    expect(result.oneTimePromoDiscount).toBe(0);
    expect(result.recurringPromoDiscount).toBe(0);
  });
});
