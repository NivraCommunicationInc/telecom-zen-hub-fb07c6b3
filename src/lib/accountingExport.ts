/**
 * Accounting Export Utilities
 * Export billing data to CSV/Excel for accounting purposes
 */

import { format } from "date-fns";
import { fr } from "date-fns/locale";

export interface ExportableInvoice {
  id: string;
  invoice_number: string | null;
  client_email: string | null;
  amount: number;
  subtotal: number | null;
  tps_amount: number | null;
  tvq_amount: number | null;
  status: string;
  created_at: string;
  paid_at: string | null;
  payment_method_type: string | null;
  payment_reference: string | null;
  due_date: string | null;
  notes: string | null;
}

export interface ExportOptions {
  format: "csv" | "excel";
  dateRange?: {
    start: Date;
    end: Date;
  };
  includeColumns: (keyof ExportableInvoice)[];
  filename?: string;
}

const COLUMN_HEADERS: Record<keyof ExportableInvoice, string> = {
  id: "ID",
  invoice_number: "Numéro de facture",
  client_email: "Email client",
  amount: "Montant total",
  subtotal: "Sous-total",
  tps_amount: "TPS (5%)",
  tvq_amount: "TVQ (9.975%)",
  status: "Statut",
  created_at: "Date de création",
  paid_at: "Date de paiement",
  payment_method_type: "Méthode de paiement",
  payment_reference: "Référence paiement",
  due_date: "Date d'échéance",
  notes: "Notes",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Payé",
  overdue: "En retard",
  cancelled: "Annulé",
  disputed: "Contesté",
  refunded: "Remboursé",
  partial: "Partiel",
};

function formatValue(key: keyof ExportableInvoice, value: unknown): string {
  if (value === null || value === undefined) return "";
  
  if (key === "amount" || key === "subtotal" || key === "tps_amount" || key === "tvq_amount") {
    return (value as number).toFixed(2);
  }
  
  if (key === "created_at" || key === "paid_at" || key === "due_date") {
    try {
      return format(new Date(value as string), "yyyy-MM-dd HH:mm", { locale: fr });
    } catch {
      return String(value);
    }
  }
  
  if (key === "status") {
    return STATUS_LABELS[value as string] || String(value);
  }
  
  return String(value);
}

function escapeCSV(value: string): string {
  // Escape quotes and wrap in quotes if contains comma, newline, or quote
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateCSV(
  invoices: ExportableInvoice[],
  columns: (keyof ExportableInvoice)[]
): string {
  const headers = columns.map((col) => escapeCSV(COLUMN_HEADERS[col]));
  const headerRow = headers.join(",");
  
  const dataRows = invoices.map((invoice) => {
    return columns
      .map((col) => escapeCSV(formatValue(col, invoice[col])))
      .join(",");
  });
  
  return [headerRow, ...dataRows].join("\n");
}

export function downloadCSV(content: string, filename: string): void {
  // Add BOM for Excel UTF-8 compatibility
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportInvoicesToCSV(
  invoices: ExportableInvoice[],
  options: Partial<ExportOptions> = {}
): void {
  const defaultColumns: (keyof ExportableInvoice)[] = [
    "invoice_number",
    "client_email",
    "created_at",
    "subtotal",
    "tps_amount",
    "tvq_amount",
    "amount",
    "status",
    "paid_at",
    "payment_method_type",
    "payment_reference",
  ];
  
  const columns = options.includeColumns || defaultColumns;
  const csvContent = generateCSV(invoices, columns);
  
  const filename = options.filename || 
    `export-comptable-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
  
  downloadCSV(csvContent, filename);
}

export function generateAccountingSummary(invoices: ExportableInvoice[]): {
  totalRevenue: number;
  totalTPS: number;
  totalTVQ: number;
  totalSubtotal: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
} {
  const paidInvoices = invoices.filter((i) => i.status === "paid");
  
  return {
    totalRevenue: paidInvoices.reduce((sum, i) => sum + (i.amount || 0), 0),
    totalTPS: paidInvoices.reduce((sum, i) => sum + (i.tps_amount || 0), 0),
    totalTVQ: paidInvoices.reduce((sum, i) => sum + (i.tvq_amount || 0), 0),
    totalSubtotal: paidInvoices.reduce((sum, i) => sum + (i.subtotal || 0), 0),
    paidCount: paidInvoices.length,
    pendingCount: invoices.filter((i) => i.status === "pending").length,
    overdueCount: invoices.filter((i) => i.status === "overdue").length,
  };
}
