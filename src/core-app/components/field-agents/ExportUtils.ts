/**
 * CSV/Excel export utilities for HR/Payroll module.
 */

export function downloadCSV(data: Record<string, any>[], filename: string, columns: { key: string; label: string }[]) {
  if (!data.length) return;
  const header = columns.map(c => `"${c.label}"`).join(",");
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const COMMISSION_COLUMNS = [
  { key: "agent_name", label: "Agent" },
  { key: "commission_amount", label: "Commission ($)" },
  { key: "sale_amount", label: "Vente ($)" },
  { key: "commission_rate", label: "Taux" },
  { key: "status", label: "Statut" },
  { key: "created_at", label: "Date" },
];

export const PAYROLL_COLUMNS = [
  { key: "employee_name", label: "Employé" },
  { key: "period_name", label: "Période" },
  { key: "commission_total", label: "Commission ($)" },
  { key: "bonus_total", label: "Bonus ($)" },
  { key: "hours_worked", label: "Heures" },
  { key: "gross_pay", label: "Brut ($)" },
  { key: "deductions_total", label: "Retenues ($)" },
  { key: "net_pay", label: "Net ($)" },
  { key: "status", label: "Statut" },
];

export const TIME_COLUMNS = [
  { key: "employee_name", label: "Employé" },
  { key: "punch_in", label: "Punch In" },
  { key: "punch_out", label: "Punch Out" },
  { key: "total_hours", label: "Heures" },
  { key: "entry_type", label: "Type" },
  { key: "status", label: "Statut" },
];

export const WITHDRAWAL_COLUMNS = [
  { key: "agent_name", label: "Agent" },
  { key: "amount", label: "Montant ($)" },
  { key: "status", label: "Statut" },
  { key: "created_at", label: "Demandé le" },
  { key: "reviewed_at", label: "Revu le" },
  { key: "paid_at", label: "Payé le" },
  { key: "admin_notes", label: "Note admin" },
];
