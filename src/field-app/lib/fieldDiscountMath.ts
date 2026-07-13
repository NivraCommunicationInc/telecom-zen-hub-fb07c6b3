/**
 * Field Sales — Discount math helpers.
 *
 * Centralizes the rules for the 6 standard agent discounts so that
 * StepRecap, the live order summary, and the quote/order payloads all
 * compute the exact same numbers.
 */
import type {
  FieldSaleDiscount,
  FieldSaleService,
} from "@/field-app/lib/fieldSaleTypes";

export interface DiscountBreakdown {
  /** Amount removed from monthly recurring (services). */
  monthlyDiscountAmount: number;
  /** Amount removed from installation fee (one-time). */
  installationDiscountAmount: number;
  /** First-month-only credit on plans (one-time). */
  firstMonthCredit: number;
  /** True if the selected discount is allowed given current services / plan price. */
  eligible: boolean;
  /** Optional human-readable reason for ineligibility. */
  ineligibilityReason?: string;
}

const sumServices = (services: FieldSaleService[]) =>
  services.reduce((sum, s) => sum + (Number(s.monthlyPrice) || 0), 0);

const maxServicePrice = (services: FieldSaleService[]) =>
  services.reduce((max, s) => Math.max(max, Number(s.monthlyPrice) || 0), 0);

export function isDiscountEligible(
  discount: FieldSaleDiscount | null,
  services: FieldSaleService[],
  installationFee: number,
): { eligible: boolean; reason?: string } {
  if (!discount) return { eligible: true };

  const minPrice = Number(discount.min_plan_price ?? 0);
  if (minPrice > 0 && maxServicePrice(services) < minPrice) {
    return {
      eligible: false,
      reason: `Aucun forfait ≥ ${minPrice.toFixed(0)} $ sélectionné`,
    };
  }

  if (discount.applies_to === "installation" && installationFee <= 0) {
    return {
      eligible: false,
      reason: "Aucun frais d'installation à supprimer",
    };
  }

  if (
    (discount.applies_to === "plan_only" || discount.type === "first_month_free") &&
    services.length === 0
  ) {
    return { eligible: false, reason: "Aucun forfait sélectionné" };
  }

  return { eligible: true };
}

export function computeDiscountBreakdown(
  discount: FieldSaleDiscount | null,
  services: FieldSaleService[],
  installationFee: number,
): DiscountBreakdown {
  const monthlyBase = sumServices(services);
  const eligibility = isDiscountEligible(discount, services, installationFee);

  // Core custom discounts are monthly recurring account promotions. They are
  // saved with the quote/order and applied to renewal invoices after
  // activation, but they must NEVER reduce the initial order transaction.
  if (discount?.source === "custom_core") {
    return {
      monthlyDiscountAmount: 0,
      installationDiscountAmount: 0,
      firstMonthCredit: 0,
      eligible: eligibility.eligible,
      ineligibilityReason: eligibility.reason,
    };
  }

  if (!discount || !eligibility.eligible) {
    return {
      monthlyDiscountAmount: 0,
      installationDiscountAmount: 0,
      firstMonthCredit: 0,
      eligible: eligibility.eligible,
      ineligibilityReason: eligibility.reason,
    };
  }

  let monthlyDiscountAmount = 0;
  let installationDiscountAmount = 0;
  let firstMonthCredit = 0;

  switch (discount.type) {
    case "remove_fee":
      installationDiscountAmount = installationFee;
      break;
    case "first_month_free":
      // Credit equal to the plan price, applied once on the first invoice.
      firstMonthCredit = monthlyBase;
      break;
    case "percentage":
      monthlyDiscountAmount = (monthlyBase * Number(discount.value || 0)) / 100;
      break;
    case "fixed":
    case "fixed_monthly":
    default:
      monthlyDiscountAmount = Math.min(Number(discount.value || 0), monthlyBase);
      break;
  }

  return {
    monthlyDiscountAmount: Math.max(0, monthlyDiscountAmount),
    installationDiscountAmount: Math.max(0, installationDiscountAmount),
    firstMonthCredit: Math.max(0, firstMonthCredit),
    eligible: true,
  };
}
