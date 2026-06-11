/**
 * Returns the date in the next calendar month corresponding to anchorDay.
 * End-of-month fallback: anchorDay=31 in February → Feb 28/29.
 *
 * anchorDay : day of month (1–31) locked at service activation
 * fromDate  : reference date — typically the current cycle_end_date
 */
export function nextAnchoredDate(anchorDay: number, fromDate: Date): Date {
  const month = fromDate.getMonth(); // 0-indexed
  const year = fromDate.getFullYear();
  const nextMonth = (month + 1) % 12;
  const nextYear = month === 11 ? year + 1 : year;
  const lastDayOfNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
  return new Date(nextYear, nextMonth, Math.min(anchorDay, lastDayOfNextMonth));
}
