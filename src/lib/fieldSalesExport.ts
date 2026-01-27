/**
 * fieldSalesExport - Export utilities for field sales data
 * Generates Excel/CSV exports for orders, commissions, and performance
 */

interface FieldSalesOrder {
  id: string;
  order_number: string | null;
  salesperson_name?: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  service_city: string | null;
  service_type: string;
  plan_name: string;
  monthly_price: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  sync_status: string;
  created_at: string;
}

interface Commission {
  id: string;
  salesperson_name: string;
  order_number: string;
  commission_amount: number;
  bonus_amount: number;
  status: string;
  created_at: string;
  validated_at: string | null;
  paid_at: string | null;
}

interface LeaderboardEntry {
  full_name: string | null;
  email: string;
  total_sales: number;
  total_revenue: number;
  total_commissions: number;
  total_bonuses: number;
  sales_today: number;
  sales_this_week: number;
  sales_this_month: number;
}

/**
 * Convert data to CSV format
 */
function convertToCSV(data: Record<string, any>[], headers: { key: string; label: string }[]): string {
  const headerRow = headers.map(h => `"${h.label}"`).join(",");
  
  const dataRows = data.map(row => 
    headers.map(h => {
      const value = row[h.key];
      if (value === null || value === undefined) return '""';
      if (typeof value === "number") return value.toString();
      if (typeof value === "string") return `"${value.replace(/"/g, '""')}"`;
      return `"${String(value)}"`;
    }).join(",")
  );

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Download CSV file
 */
function downloadCSV(csv: string, filename: string): void {
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export field sales orders to CSV
 */
export function exportOrdersToCSV(orders: FieldSalesOrder[]): void {
  const headers = [
    { key: "order_number", label: "N° Commande" },
    { key: "created_at", label: "Date" },
    { key: "salesperson_name", label: "Vendeur" },
    { key: "customer_name", label: "Client" },
    { key: "customer_email", label: "Email" },
    { key: "customer_phone", label: "Téléphone" },
    { key: "customer_address", label: "Adresse" },
    { key: "service_city", label: "Ville" },
    { key: "service_type", label: "Type Service" },
    { key: "plan_name", label: "Plan" },
    { key: "monthly_price", label: "Prix Mensuel" },
    { key: "total_amount", label: "Total" },
    { key: "payment_method", label: "Méthode Paiement" },
    { key: "payment_status", label: "Statut Paiement" },
    { key: "sync_status", label: "Statut Sync" },
  ];

  const formattedData = orders.map(o => ({
    ...o,
    created_at: new Date(o.created_at).toLocaleDateString("fr-CA"),
  }));

  const csv = convertToCSV(formattedData, headers);
  const date = new Date().toISOString().split("T")[0];
  downloadCSV(csv, `ventes-terrain-${date}.csv`);
}

/**
 * Export commissions to CSV
 */
export function exportCommissionsToCSV(commissions: Commission[]): void {
  const headers = [
    { key: "order_number", label: "N° Commande" },
    { key: "salesperson_name", label: "Vendeur" },
    { key: "commission_amount", label: "Commission" },
    { key: "bonus_amount", label: "Bonus" },
    { key: "status", label: "Statut" },
    { key: "created_at", label: "Date Création" },
    { key: "validated_at", label: "Date Validation" },
    { key: "paid_at", label: "Date Paiement" },
  ];

  const formattedData = commissions.map(c => ({
    ...c,
    created_at: new Date(c.created_at).toLocaleDateString("fr-CA"),
    validated_at: c.validated_at ? new Date(c.validated_at).toLocaleDateString("fr-CA") : "",
    paid_at: c.paid_at ? new Date(c.paid_at).toLocaleDateString("fr-CA") : "",
  }));

  const csv = convertToCSV(formattedData, headers);
  const date = new Date().toISOString().split("T")[0];
  downloadCSV(csv, `commissions-${date}.csv`);
}

/**
 * Export leaderboard/performance to CSV
 */
export function exportLeaderboardToCSV(leaderboard: LeaderboardEntry[]): void {
  const headers = [
    { key: "full_name", label: "Nom" },
    { key: "email", label: "Email" },
    { key: "total_sales", label: "Ventes Totales" },
    { key: "sales_today", label: "Ventes Aujourd'hui" },
    { key: "sales_this_week", label: "Ventes Semaine" },
    { key: "sales_this_month", label: "Ventes Mois" },
    { key: "total_revenue", label: "Revenus Totaux" },
    { key: "total_commissions", label: "Commissions" },
    { key: "total_bonuses", label: "Bonus" },
  ];

  const csv = convertToCSV(leaderboard, headers);
  const date = new Date().toISOString().split("T")[0];
  downloadCSV(csv, `classement-vendeurs-${date}.csv`);
}

/**
 * Generate monthly report CSV
 */
export function exportMonthlyReportToCSV(
  orders: FieldSalesOrder[], 
  commissions: Commission[],
  month: string // Format: YYYY-MM
): void {
  // Summary data
  const totalSales = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const totalCommissions = commissions.reduce((sum, c) => sum + c.commission_amount, 0);
  const totalBonuses = commissions.reduce((sum, c) => sum + c.bonus_amount, 0);
  const paidCommissions = commissions.filter(c => c.status === "paid").reduce((sum, c) => sum + c.commission_amount, 0);
  const pendingCommissions = commissions.filter(c => c.status === "pending").reduce((sum, c) => sum + c.commission_amount, 0);

  // By service type
  const byService = orders.reduce((acc, o) => {
    if (!acc[o.service_type]) {
      acc[o.service_type] = { count: 0, revenue: 0 };
    }
    acc[o.service_type].count++;
    acc[o.service_type].revenue += o.total_amount;
    return acc;
  }, {} as Record<string, { count: number; revenue: number }>);

  // By payment method
  const byPayment = orders.reduce((acc, o) => {
    if (!acc[o.payment_method]) {
      acc[o.payment_method] = { count: 0, revenue: 0 };
    }
    acc[o.payment_method].count++;
    acc[o.payment_method].revenue += o.total_amount;
    return acc;
  }, {} as Record<string, { count: number; revenue: number }>);

  // Build report
  let csv = "RAPPORT MENSUEL VENTES TERRAIN\n";
  csv += `Période: ${month}\n`;
  csv += `Généré le: ${new Date().toLocaleDateString("fr-CA")}\n\n`;
  
  csv += "RÉSUMÉ\n";
  csv += `Ventes totales,${totalSales}\n`;
  csv += `Revenus totaux,${totalRevenue.toFixed(2)}$\n`;
  csv += `Commissions totales,${totalCommissions.toFixed(2)}$\n`;
  csv += `Bonus totaux,${totalBonuses.toFixed(2)}$\n`;
  csv += `Commissions payées,${paidCommissions.toFixed(2)}$\n`;
  csv += `Commissions en attente,${pendingCommissions.toFixed(2)}$\n\n`;

  csv += "PAR TYPE DE SERVICE\n";
  csv += "Service,Nombre,Revenus\n";
  Object.entries(byService).forEach(([service, data]) => {
    csv += `${service},${data.count},${data.revenue.toFixed(2)}$\n`;
  });
  csv += "\n";

  csv += "PAR MODE DE PAIEMENT\n";
  csv += "Méthode,Nombre,Revenus\n";
  Object.entries(byPayment).forEach(([method, data]) => {
    csv += `${method},${data.count},${data.revenue.toFixed(2)}$\n`;
  });

  downloadCSV(csv, `rapport-mensuel-${month}.csv`);
}
