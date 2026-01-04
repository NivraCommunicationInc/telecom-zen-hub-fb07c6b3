/**
 * Billing Cycle Utilities
 * 
 * Handles the special rule for billing days 29/30/31:
 * If the billing day doesn't exist in a month (e.g., 31 in February),
 * the invoice is issued on the last day of that month.
 * The next month returns to the normal billing day if it exists.
 * 
 * Examples:
 * - Billing day 31, February 2026 → February 28, 2026
 * - Billing day 31, March 2026 → March 31, 2026
 * - Billing day 30, February 2026 → February 28, 2026
 * - Billing day 29, February 2028 (leap year) → February 29, 2028
 */

/**
 * Get the last day of a given month
 */
export function getLastDayOfMonth(year: number, month: number): number {
  // month is 1-12 (January = 1)
  // Setting day 0 of next month gives last day of current month
  return new Date(year, month, 0).getDate();
}

/**
 * Clamp billing day to valid day for the given month
 * 
 * @param year - Full year (e.g., 2026)
 * @param month - Month 1-12 (January = 1)
 * @param billingDay - Original billing day (1-31)
 * @returns Clamped day that exists in the month
 */
export function clampBillingDay(year: number, month: number, billingDay: number): number {
  const lastDay = getLastDayOfMonth(year, month);
  return Math.min(billingDay, lastDay);
}

/**
 * Calculate the next invoice date from a given date
 * 
 * @param billingDay - The day of the month for billing (1-31)
 * @param fromDate - The reference date
 * @returns The next invoice date
 */
export function calculateNextInvoiceDate(billingDay: number, fromDate: Date): Date {
  let year = fromDate.getFullYear();
  let month = fromDate.getMonth() + 1; // Convert to 1-12
  
  // If we've already passed the billing day this month, go to next month
  const currentDay = fromDate.getDate();
  if (currentDay >= billingDay) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  
  // Apply the 29/30/31 clamping rule
  const actualDay = clampBillingDay(year, month, billingDay);
  
  return new Date(year, month - 1, actualDay);
}

/**
 * Get the effective billing day for a specific month
 * 
 * @param billingDay - Original billing day (1-31)
 * @param year - Year
 * @param month - Month 1-12
 * @returns The actual day the invoice will be issued
 */
export function getEffectiveBillingDay(billingDay: number, year: number, month: number): number {
  return clampBillingDay(year, month, billingDay);
}

/**
 * Calculate the period end date (day before next billing cycle)
 */
export function calculatePeriodEnd(billingDay: number, periodStart: Date): Date {
  const nextCycle = calculateNextInvoiceDate(billingDay, periodStart);
  const periodEnd = new Date(nextCycle);
  periodEnd.setDate(periodEnd.getDate() - 1);
  return periodEnd;
}

/**
 * Calculate the due date (15 days after issue date)
 */
export function calculateDueDate(issueDate: Date, graceDays: number = 15): Date {
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + graceDays);
  return dueDate;
}

/**
 * Check if a date is overdue (past the grace period)
 */
export function isOverdue(dueDate: Date, graceDays: number = 15): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const threshold = new Date(dueDate);
  threshold.setDate(threshold.getDate() + graceDays);
  
  return today > threshold;
}

/**
 * Format billing cycle description for display
 * 
 * @param billingDay - The billing day (1-31)
 * @returns Human-readable description in French
 */
export function formatBillingCycleDescription(billingDay: number): string {
  if (billingDay >= 29) {
    return `Chaque ${billingDay} du mois (ou dernier jour si le mois est plus court)`;
  }
  return `Chaque ${billingDay} du mois`;
}

/**
 * Get next 12 months of billing dates for preview
 * 
 * @param billingDay - The billing day (1-31)
 * @param startDate - Optional start date (defaults to today)
 * @returns Array of next 12 billing dates
 */
export function getNext12BillingDates(billingDay: number, startDate?: Date): Date[] {
  const dates: Date[] = [];
  let currentDate = startDate ? new Date(startDate) : new Date();
  
  for (let i = 0; i < 12; i++) {
    const nextDate = calculateNextInvoiceDate(billingDay, currentDate);
    dates.push(nextDate);
    currentDate = nextDate;
  }
  
  return dates;
}

/**
 * Constants for billing
 */
export const BILLING_CONSTANTS = {
  PAYMENT_GRACE_DAYS: 15,
  TPS_RATE: 0.05,
  TVQ_RATE: 0.09975,
  LATE_FEE_RATE: 0.05,
} as const;
