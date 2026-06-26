/**
 * Canonical proration math — shared between client-plan-change, cancel-account,
 * billing-generate-renewals and future suspension/pause/move flows.
 *
 * Single source of truth so unit tests cover every prepaid scenario.
 */

export interface ProrationInput {
  /** Inclusive cycle start (ISO date or Date). */
  cycleStart: string | Date;
  /** Exclusive cycle end (ISO date or Date). */
  cycleEnd: string | Date;
  /** "Now" reference — defaults to current time. */
  referenceDate?: string | Date;
  /** Daily-priceable amount for one full cycle (e.g. plan_price or price diff). */
  amount: number;
}

export interface ProrationResult {
  daysRemaining: number;
  cycleTotalDays: number;
  proratedAmount: number;
}

/**
 * Compute prorata for unused (remaining) days of a cycle.
 * Used by:
 *  - Cancellation credit  (amount = plan_price, sign: credit)
 *  - Upgrade charge       (amount = newPrice - oldPrice, sign: charge)
 *  - Add-service charge   (amount = newServicePrice, sign: charge)
 *  - Suspension credit    (amount = plan_price for the suspended days)
 */
export function prorateRemaining({
  cycleStart,
  cycleEnd,
  referenceDate,
  amount,
}: ProrationInput): ProrationResult {
  const start = new Date(cycleStart);
  const end = new Date(cycleEnd);
  const now = new Date(referenceDate ?? new Date());

  const cycleTotalDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86_400_000),
  );
  const daysRemaining = Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / 86_400_000),
  );
  const ratio = Math.min(1, daysRemaining / cycleTotalDays);
  const proratedAmount = Math.round(Number(amount) * ratio * 100) / 100;

  return { daysRemaining, cycleTotalDays, proratedAmount };
}

/**
 * Compute prorata for a specific window WITHIN the cycle (suspension/pause).
 * Returns credit owed for `[pauseStart, pauseEnd)` days at full daily rate.
 */
export function prorateWindow({
  cycleStart,
  cycleEnd,
  windowStart,
  windowEnd,
  amount,
}: {
  cycleStart: string | Date;
  cycleEnd: string | Date;
  windowStart: string | Date;
  windowEnd: string | Date;
  amount: number;
}): ProrationResult {
  const cStart = new Date(cycleStart).getTime();
  const cEnd = new Date(cycleEnd).getTime();
  const wStart = Math.max(cStart, new Date(windowStart).getTime());
  const wEnd = Math.min(cEnd, new Date(windowEnd).getTime());

  const cycleTotalDays = Math.max(1, Math.round((cEnd - cStart) / 86_400_000));
  const daysRemaining = Math.max(0, Math.round((wEnd - wStart) / 86_400_000));
  const ratio = Math.min(1, daysRemaining / cycleTotalDays);
  const proratedAmount = Math.round(Number(amount) * ratio * 100) / 100;

  return { daysRemaining, cycleTotalDays, proratedAmount };
}
