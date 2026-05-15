/**
 * Field portal utility helpers.
 * Universal price + discount formatters used across the Field app
 * to guarantee that no "—" placeholder ever surfaces in lieu of a price.
 */

const CAD = new Intl.NumberFormat("fr-CA", {
  style: "currency",
  currency: "CAD",
});

/** Resolve the canonical numeric price from any catalog/order/line shape. */
export const getPrice = (item: any): number => {
  const raw =
    item?.price ??
    item?.unit_price ??
    item?.monthly_price ??
    item?.monthlyPrice ??
    item?.one_time_price ??
    item?.oneTimePrice ??
    item?.amount ??
    item?.total_price ??
    item?.totalPrice ??
    0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

/** Always returns a valid CAD string. Never "—", null, NaN. */
export const formatPrice = (item: any): string => CAD.format(getPrice(item));

/** Format a raw amount in CAD. */
export const formatAmount = (amount: number | string | null | undefined): string => {
  const n = Number(amount ?? 0);
  return CAD.format(Number.isFinite(n) ? n : 0);
};

/** Activation/installation fee formatter — shows "Gratuit" when zero. */
export const formatActivationFee = (amount: number | string | null | undefined): string => {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "Gratuit";
  return CAD.format(n);
};

/** Service monthly price + "/mois" suffix. */
export const formatMonthlyPrice = (item: any): string =>
  `${formatPrice(item)}/mois`;

/**
 * Universal discount label.
 * Handles all discount shapes coming from agent_discounts, discounts,
 * or the in-flight FieldSaleDiscount draft.
 */
export const formatDiscountLabel = (discount: any): string => {
  if (!discount) return "";

  const name = discount.name || discount.label || "Rabais";
  const amount = Number(
    discount.amount ?? discount.value ?? discount.monthly_amount ?? 0,
  );
  const months = Number(
    discount.duration_months ??
      discount.duration ??
      discount.months_total ??
      0,
  );
  const type: string = String(
    discount.type || discount.discount_type || "",
  ).toLowerCase();
  const lcName = String(name).toLowerCase();

  // Installation gratuite
  if (type === "remove_fee" || lcName.includes("installation")) {
    return `${name} — Frais d'installation annulés`;
  }

  // Premier mois gratuit
  if (type === "first_month_free" || lcName.includes("premier mois")) {
    return `${name} — 1er mois offert`;
  }

  // Rabais mensuel récurrent
  if (months > 0) {
    return `${name} — ${amount.toFixed(2)}$/mois × ${months} mois`;
  }

  // Rabais unique
  if (type === "one_time" || months === 0) {
    return `${name} — ${amount.toFixed(2)}$ (unique)`;
  }

  return `${name} — ${amount.toFixed(2)}$`;
};
