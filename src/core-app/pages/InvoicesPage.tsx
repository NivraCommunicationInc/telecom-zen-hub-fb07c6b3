/**
 * Nivra Core — Invoice Operations Console
 * Telecom-grade billing operations workspace.
 */
import { useState, useMemo } from "react";
import { useAdminInvoices } from "@/core-app/hooks/useAdminInvoices";
import type { AdminInvoice } from "@/core-app/hooks/useAdminInvoices";
import type { EnvironmentFilter } from "@/core-app/hooks/useEnvironmentFilter";
import { CoreEnvironmentToggle } from "@/core-app/components/CoreEnvironmentToggle";
import { InvoiceKPIHeader } from "@/core-app/components/invoices/InvoiceKPIHeader";
import { InvoiceFilters } from "@/core-app/components/invoices/InvoiceFilters";
import { InvoiceTable } from "@/core-app/components/invoices/InvoiceTable";
import { InvoiceDetailDrawer } from "@/core-app/components/invoices/InvoiceDetailDrawer";
import { InvoiceFinancialSummary } from "@/core-app/components/invoices/InvoiceFinancialSummary";
import { RefreshCw, FileText } from "lucide-react";

const InvoicesPage = () => {
  const [envFilter, setEnvFilter] = useState<EnvironmentFilter>("all");
  const { data: invoices = [], isLoading, refetch } = useAdminInvoices(envFilter);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [disputedOnly, setDisputedOnly] = useState(false);

  // View
  const [selectedInvoice, setSelectedInvoice] = useState<AdminInvoice | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter(inv => {
      if (statusFilter && inv.status !== statusFilter) return false;
      if (typeFilter && inv.type !== typeFilter) return false;
      if (unpaidOnly) {
        const hasBalance = (inv.balance_due ?? 0) > 0;
        const notClosed = !["paid", "paid_by_promo", "void", "cancelled"].includes(inv.status ?? "");
        if (!hasBalance || !notClosed) return false;
      }
      if (disputedOnly && inv.status !== "disputed") return false;
      if (dateFrom && (inv.created_at ?? "").slice(0, 10) < dateFrom) return false;
      if (dateTo && (inv.created_at ?? "").slice(0, 10) > dateTo) return false;
      if (dueFrom && (inv.due_date ?? "").slice(0, 10) < dueFrom) return false;
      if (dueTo && (inv.due_date ?? "").slice(0, 10) > dueTo) return false;
      if (!q) return true;
      return (
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.customer_name?.toLowerCase().includes(q) ||
        inv.customer_email?.toLowerCase().includes(q) ||
        inv.account_number?.toLowerCase().includes(q) ||
        inv.order_number?.toLowerCase().includes(q)
      );
    });
  }, [invoices, search, statusFilter, typeFilter, dateFrom, dateTo, dueFrom, dueTo, unpaidOnly, disputedOnly]);

  return (
    <div className="space-y-4">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-400" />
            <h1 className="text-lg font-bold text-[#F8FAFC] tracking-tight">Opérations Facturation</h1>
          </div>
          <p className="text-[12px] text-[#94A3B8] mt-0.5">
            Console de facturation · {invoices.length} facture{invoices.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CoreEnvironmentToggle value={envFilter} onChange={setEnvFilter} />
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[11px] font-medium text-[#94A3B8] hover:text-[#F8FAFC] hover:border-emerald-500/30 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </button>
        </div>
      </div>

      {/* ═══ KPIs ═══ */}
      <InvoiceKPIHeader invoices={invoices} isLoading={isLoading} />

      {/* ═══ 2-column: Table + Summary ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-3">
          {/* Filters */}
          <InvoiceFilters
            search={search} onSearch={setSearch}
            status={statusFilter} onStatus={setStatusFilter}
            type={typeFilter} onType={setTypeFilter}
            dateFrom={dateFrom} onDateFrom={setDateFrom}
            dateTo={dateTo} onDateTo={setDateTo}
            dueFrom={dueFrom} onDueFrom={setDueFrom}
            dueTo={dueTo} onDueTo={setDueTo}
            unpaidOnly={unpaidOnly} onUnpaidOnly={setUnpaidOnly}
            disputedOnly={disputedOnly} onDisputedOnly={setDisputedOnly}
            resultCount={filtered.length}
            totalCount={invoices.length}
          />

          {/* Table */}
          <InvoiceTable invoices={filtered} isLoading={isLoading} onSelect={setSelectedInvoice} />

          {/* Footer */}
          {!isLoading && filtered.length > 0 && (
            <p className="text-[11px] text-[#64748B] text-center">
              {filtered.length} facture{filtered.length !== 1 ? "s" : ""} affichée{filtered.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Financial Summary sidebar */}
        <div className="hidden xl:block">
          <InvoiceFinancialSummary invoices={invoices} />
        </div>
      </div>

      {/* ═══ DETAIL DRAWER ═══ */}
      <InvoiceDetailDrawer invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
    </div>
  );
};

export default InvoicesPage;
