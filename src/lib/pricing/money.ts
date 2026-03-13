export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined) return fallback;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(/\s/g, "").replace(/,/g, ".").replace(/[^0-9.-]/g, "");
    if (!normalized) return fallback;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toMoney = (value: unknown, fallback = 0): number =>
  roundMoney(toFiniteNumber(value, fallback));

export const toNonNegativeMoney = (value: unknown, fallback = 0): number =>
  Math.max(0, toMoney(value, fallback));

export const toMoneyCents = (value: unknown): number =>
  Math.round(toNonNegativeMoney(value) * 100);

export const sanitizeTaxes = (taxableBase: unknown, tps: unknown, tvq: unknown) => {
  const safeTaxableBase = toNonNegativeMoney(taxableBase);
  if (safeTaxableBase <= 0) {
    return { taxableBase: 0, tps: 0, tvq: 0 };
  }

  return {
    taxableBase: safeTaxableBase,
    tps: toNonNegativeMoney(tps),
    tvq: toNonNegativeMoney(tvq),
  };
};

export const formatCurrencyCAD = (value: unknown): string =>
  toNonNegativeMoney(value).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

export const normalizeServerPricingResult = (raw: any) => {
  const recurringSubtotal = toNonNegativeMoney(raw?.recurring_subtotal);
  const oneTimeSubtotal = toNonNegativeMoney(raw?.one_time_subtotal);
  const promoDiscount = toNonNegativeMoney(raw?.promo_discount);
  const welcomeDiscount = toNonNegativeMoney(raw?.welcome_discount);
  const discountTotalCombined = toNonNegativeMoney(
    raw?.discount_total_combined,
    promoDiscount + welcomeDiscount,
  );

  const { taxableBase, tps, tvq } = sanitizeTaxes(raw?.taxable_base, raw?.tps_amount, raw?.tvq_amount);

  const grandTotal = toNonNegativeMoney(raw?.grand_total);

  return {
    recurring_subtotal: recurringSubtotal,
    one_time_subtotal: oneTimeSubtotal,
    discount_total_combined: discountTotalCombined,
    promo_discount: promoDiscount,
    welcome_discount: welcomeDiscount,
    welcome_applied: Boolean(raw?.welcome_applied),
    is_new_customer: Boolean(raw?.is_new_customer),
    preauth_discount: toNonNegativeMoney(raw?.preauth_discount),
    taxable_base: taxableBase,
    tps_amount: tps,
    tvq_amount: tvq,
    grand_total: grandTotal,
    promo_applied: raw?.promo_applied
      ? {
          ...raw.promo_applied,
          discount_value: toNonNegativeMoney(raw.promo_applied.discount_value),
          discount_cents: Math.max(0, Math.round(toFiniteNumber(raw.promo_applied.discount_cents, 0))),
          discount_amount: toNonNegativeMoney(raw.promo_applied.discount_amount),
          min_payable_cents: Math.max(0, Math.round(toFiniteNumber(raw.promo_applied.min_payable_cents, 0))),
        }
      : null,
    computed_at: raw?.computed_at || new Date().toISOString(),
    cents: {
      recurring_subtotal: Math.max(0, Math.round(toFiniteNumber(raw?.cents?.recurring_subtotal, toMoneyCents(recurringSubtotal)))),
      one_time_subtotal: Math.max(0, Math.round(toFiniteNumber(raw?.cents?.one_time_subtotal, toMoneyCents(oneTimeSubtotal)))),
      discount_total_combined: Math.max(0, Math.round(toFiniteNumber(raw?.cents?.discount_total_combined, toMoneyCents(discountTotalCombined)))),
      promo_discount: Math.max(0, Math.round(toFiniteNumber(raw?.cents?.promo_discount, toMoneyCents(promoDiscount)))),
      welcome_discount: Math.max(0, Math.round(toFiniteNumber(raw?.cents?.welcome_discount, toMoneyCents(welcomeDiscount)))),
      taxable_base: Math.max(0, Math.round(toFiniteNumber(raw?.cents?.taxable_base, toMoneyCents(taxableBase)))),
      tps: Math.max(0, Math.round(toFiniteNumber(raw?.cents?.tps, toMoneyCents(tps)))),
      tvq: Math.max(0, Math.round(toFiniteNumber(raw?.cents?.tvq, toMoneyCents(tvq)))),
      grand_total: Math.max(0, Math.round(toFiniteNumber(raw?.cents?.grand_total, toMoneyCents(grandTotal)))),
    },
  };
};
