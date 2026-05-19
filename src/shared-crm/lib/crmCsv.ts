/**
 * crmCsv — Export CRM contacts to CSV (client-side download).
 */
import type { CrmContact } from "./crmTypes";

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

export function exportContactsCsv(contacts: CrmContact[], filename = "crm-contacts.csv") {
  const headers = [
    "id", "first_name", "last_name", "full_name", "phone", "email",
    "address", "city", "postal_code", "date_of_birth",
    "call_status", "call_attempts", "last_called_at", "next_callback_at",
    "assigned_to", "priority", "territory", "is_dnc", "dnc_reason",
    "interest_tags", "source", "created_at",
  ];
  const rows = contacts.map((c) => headers.map((h) => {
    const v = (c as any)[h];
    if (Array.isArray(v)) return esc(v.join("|"));
    return esc(v);
  }).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
