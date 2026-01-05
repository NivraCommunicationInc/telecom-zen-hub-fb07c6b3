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
  INVOICE_GENERATION_DAYS_BEFORE: 5, // J-5: Invoice generated 5 days before Bill Cycle
  ETRANSFER_GRACE_HOURS: 24, // Grace period for e-Transfer in verification at J0
  TPS_RATE: 0.05,
  TVQ_RATE: 0.09975,
  DISPUTE_INTEREST_RATE: 0.05, // 5% per month for disputes/chargebacks only
  NUMBER_LOSS_DAYS: 90, // After 90 days, number may be unrecoverable
} as const;

/**
 * Billing status types
 */
export type BillingStatus = 
  | 'active'           // Service is active, payment confirmed
  | 'renewal_due'      // J-5 to J0: Invoice issued, payment expected before J0
  | 'in_verification'  // E-Transfer in verification at J0 (grace period)
  | 'overdue'          // Payment not confirmed by J0
  | 'suspended'        // Service suspended due to non-payment
  | 'expired';         // After extended non-payment (number at risk)

export type PaymentStatus =
  | 'pending'          // Payment expected
  | 'in_verification'  // E-Transfer being verified
  | 'confirmed'        // Payment confirmed
  | 'overdue';         // Payment past due (J0)

/**
 * Calculate the invoice issue date (J-5: 5 days before Bill Cycle)
 */
export function calculateInvoiceIssueDate(billCycleDay: number, fromDate: Date): Date {
  const billCycleDate = calculateNextInvoiceDate(billCycleDay, fromDate);
  const issueDate = new Date(billCycleDate);
  issueDate.setDate(issueDate.getDate() - BILLING_CONSTANTS.INVOICE_GENERATION_DAYS_BEFORE);
  return issueDate;
}

/**
 * Calculate the payment/service status based on Bill Cycle, payment status, and current date
 */
export function calculateBillingStatus(
  billCycleDay: number,
  paymentStatus: PaymentStatus,
  currentDate: Date = new Date()
): { billingStatus: BillingStatus; paymentStatusLabel: string; serviceStatusLabel: string } {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const billCycleDate = new Date(year, month - 1, clampBillingDay(year, month, billCycleDay));
  
  // Calculate J-5 date
  const invoiceIssueDate = new Date(billCycleDate);
  invoiceIssueDate.setDate(invoiceIssueDate.getDate() - BILLING_CONSTANTS.INVOICE_GENERATION_DAYS_BEFORE);
  
  // Calculate e-Transfer grace deadline (J0 + 24h)
  const graceDeadline = new Date(billCycleDate);
  graceDeadline.setHours(graceDeadline.getHours() + BILLING_CONSTANTS.ETRANSFER_GRACE_HOURS);
  
  currentDate.setHours(0, 0, 0, 0);
  billCycleDate.setHours(0, 0, 0, 0);
  invoiceIssueDate.setHours(0, 0, 0, 0);

  // If payment is confirmed, service is active
  if (paymentStatus === 'confirmed') {
    return {
      billingStatus: 'active',
      paymentStatusLabel: 'Payé',
      serviceStatusLabel: 'Actif',
    };
  }

  // Before J-5: Payment expected but not yet urgent
  if (currentDate < invoiceIssueDate) {
    return {
      billingStatus: 'active',
      paymentStatusLabel: 'En attente',
      serviceStatusLabel: 'Actif',
    };
  }

  // J-5 to J0: Renewal due period
  if (currentDate >= invoiceIssueDate && currentDate < billCycleDate) {
    return {
      billingStatus: 'renewal_due',
      paymentStatusLabel: 'Renouvellement dû',
      serviceStatusLabel: 'Actif (renouvellement dû)',
    };
  }

  // At or after J0
  if (currentDate >= billCycleDate) {
    // E-Transfer in verification at J0: grace period
    if (paymentStatus === 'in_verification' && new Date() < graceDeadline) {
      return {
        billingStatus: 'in_verification',
        paymentStatusLabel: 'En vérification (grâce 24h)',
        serviceStatusLabel: 'En vérification',
      };
    }

    // Not paid at J0 = overdue + suspended
    return {
      billingStatus: 'suspended',
      paymentStatusLabel: 'Paiement en retard (Overdue)',
      serviceStatusLabel: 'Service en suspension (Suspended)',
    };
  }

  // Default fallback
  return {
    billingStatus: 'active',
    paymentStatusLabel: 'En attente',
    serviceStatusLabel: 'Actif',
  };
}

/**
 * Calculate days since a date became overdue/suspended
 */
export function calculateDaysSinceSuspension(billCycleDate: Date, currentDate: Date = new Date()): number {
  const billCycle = new Date(billCycleDate);
  billCycle.setHours(0, 0, 0, 0);
  currentDate.setHours(0, 0, 0, 0);
  
  if (currentDate <= billCycle) return 0;
  
  const diffTime = currentDate.getTime() - billCycle.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determine days-since-suspension bucket for filtering
 */
export function getSuspensionBucket(daysSinceSuspension: number): string {
  if (daysSinceSuspension <= 30) return '0-30';
  if (daysSinceSuspension <= 60) return '31-60';
  if (daysSinceSuspension <= 90) return '61-90';
  return '90+';
}

/**
 * Check if a number is at risk of being lost (90+ days without renewal)
 */
export function isNumberAtRisk(daysSinceSuspension: number): boolean {
  return daysSinceSuspension >= BILLING_CONSTANTS.NUMBER_LOSS_DAYS;
}

/**
 * Get Bill Cycle Day from account creation date (fallback logic)
 */
export function getBillCycleDayFromDate(date: Date | string | null): number {
  if (!date) return 1; // Default to 1st of month if no date
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getDate();
}
