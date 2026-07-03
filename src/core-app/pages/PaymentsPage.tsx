/**
 * Nivra Core — Payment Operations Console
 * Telecom-grade financial operations workspace.
 */
import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminPayments } from "@/core-app/hooks/useAdminPayments";
import type { AdminPayment } from "@/core-app/hooks/useAdminPayments";
import type { EnvironmentFilter } from "@/core-app/hooks/useEnvironmentFilter";
import { CoreEnvironmentToggle } from "@/core-app/components/CoreEnvironmentToggle";
import { PaymentKPIHeader } from "@/core-app/components/payments/PaymentKPIHeader";
import { PaymentFilters } from "@/core-app/components/payments/PaymentFilters";
import { PaymentTable } from "@/core-app/components/payments/PaymentTable";
import { PaymentDetailDrawer } from "@/core-app/components/payments/PaymentDetailDrawer";
import { PaymentFinancialSummary } from "@/core-app/components/payments/PaymentFinancialSummary";
import { InteracVerificationPanel } from "@/core-app/components/payments/InteracVerificationPanel";
import { PAYMENT_METHODS, PAYMENT_SOURCES, PAYMENT_STATUSES } from "@/core-app/components/payments/PaymentConstants";
import { exportToCSV } from "@/core-app/lib/exportUtils";
import { RefreshCw, CreditCard, Download } from "lucide-react";

const PaymentsPage = () => {
  const queryClient = useQueryClient();
  const [envFilter, setEnvFilter] = useState<EnvironmentFilter>("all");
  const { data: payments = [], isLoading, refetch } = useAdminPayments(envFilter);

  // Realtime: refetch on any billing_payments change
  useEffect(() => {
    const channel = supabase
      .channel("core-payments-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "billing_payments" },
        () => { queryClient.invalidateQueries({ queryKey: ["admin-payments-v2"] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fraudOnly, setFraudOnly] = useState(false);

  // View
  const [selectedPayment, setSelectedPayment] = useState<AdminPayment | null>(null);
  const [showVerification, setShowVerification] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return payments.filter(p => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (methodFilter && p.method !== methodFilter) return false;
      if (sourceFilter && p.source !== sourceFilter) return false;
      if (fraudOnly && p.status !== "fraud") return false;
      if (dateFrom) {
        const pDate = (p.received_at || p.created_at || "").slice(0, 10);
        if (pDate < dateFrom) return false;
      }
      if (dateTo) {
        const pDate = (p.received_at || p.created_at || "").slice(0, 10);
        if (pDate > dateTo) return false;
      }
      if (!q) return true;
      return (
        p.payment_number?.toLowerCase().includes(q) ||
        p.nivra_reference?.toLowerCase().includes(q) ||
        p.customer_name?.toLowerCase().includes(q) ||
        p.customer_email?.toLowerCase().includes(q) ||
        p.account_number?.toLowerCase().includes(q) ||
        p.invoice_number?.toLowerCase().includes(q) ||
        p.reference?.toLowerCase().includes(q) ||
        p.provider_payment_id?.toLowerCase().includes(q) ||
        p.square_payment_id?.toLowerCase().includes(q)
      );
    });
  }, [payments, search, statusFilter, methodFilter, sourceFilter, dateFrom, dateTo, fraudOnly]);

  const handleExport = () => {
    const rows = filtered.map(p => {
      const methodKey = p.method === "paypal" ? "card" : p.method;
      return {
        date: p.received_at || p.created_at || "",
        client: p.customer_name || "",
        email: p.customer_email || "",
        compte: p.account_number || "",
        facture: p.invoice_number || "",
        montant: (p.amount ?? 0).toFixed(2),
        methode: PAYMENT_METHODS[methodKey as keyof typeof PAYMENT_METHODS] || methodKey,
        source: p.source ? (PAYMENT_SOURCES[p.source] || p.source) : "",
        ref_nvr: p.nivra_reference || p.payment_number || "",
        ref_processeur: p.square_payment_id || (p.provider === "paypal" ? "" : (p.provider_payment_id || "")) || p.reference || "",
        statut: PAYMENT_STATUSES[p.status as keyof typeof PAYMENT_STATUSES] || p.status || "",
        agent: p.confirmed_by || p.created_by_name || "",
      };
    });
    exportToCSV(rows, "paiements", [
      { key: "date", label: "Date" },
      { key: "client", label: "Client" },
      { key: "email", label: "Email" },
      { key: "compte", label: "Compte" },
      { key: "facture", label: "Facture" },
      { key: "montant", label: "Montant" },
      { key: "methode", label: "Méthode" },
      { key: "source", label: "Source" },
      { key: "ref_nvr", label: "Réf NVR" },
      { key: "ref_processeur", label: "Réf processeur" },
      { key: "statut", label: "Statut" },
      { key: "agent", label: "Agent" },
    ]);
  };

  const pendingVerification = payments.filter(
    p => (p.method === "interac" || p.method === "manual") && (p.status === "pending" || p.status === "in_verification")
  );

  return (
    <div className="space-y-4">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-400" />
            <h1 className="text-lg font-bold text-[#F8FAFC] tracking-tight">Opérations Paiements</h1>
          </div>
          <p className="text-[12px] text-[#94A3B8] mt-0.5">
            Console financière · {payments.length} paiement{payments.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Verification toggle */}
          {pendingVerification.length > 0 && (
            <button
              onClick={() => setShowVerification(!showVerification)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                showVerification
                  ? "border-violet-500/40 bg-violet-500/10 text-violet-400"
                  : "border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              🔍 Vérification ({pendingVerification.length})
            </button>
          )}
          <CoreEnvironmentToggle value={envFilter} onChange={setEnvFilter} />
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[11px] font-medium text-[#94A3B8] hover:text-[#F8FAFC] hover:border-emerald-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" /> Exporter CSV
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[11px] font-medium text-[#94A3B8] hover:text-[#F8FAFC] hover:border-emerald-500/30 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </button>
        </div>
      </div>

      {/* ═══ KPIs ═══ */}
      <PaymentKPIHeader payments={payments} isLoading={isLoading} />

      {/* ═══ INTERAC VERIFICATION (toggled) ═══ */}
      {showVerification && (
        <InteracVerificationPanel payments={payments} onSelect={setSelectedPayment} />
      )}

      {/* ═══ 2-column: Table + Summary ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-3">
          {/* Filters */}
          <PaymentFilters
            search={search} onSearch={setSearch}
            status={statusFilter} onStatus={setStatusFilter}
            method={methodFilter} onMethod={setMethodFilter}
            source={sourceFilter} onSource={setSourceFilter}
            dateFrom={dateFrom} onDateFrom={setDateFrom}
            dateTo={dateTo} onDateTo={setDateTo}
            fraudOnly={fraudOnly} onFraudOnly={setFraudOnly}
            resultCount={filtered.length}
            totalCount={payments.length}
          />

          {/* Table */}
          <PaymentTable payments={filtered} isLoading={isLoading} onSelect={setSelectedPayment} />

          {/* Footer count */}
          {!isLoading && filtered.length > 0 && (
            <p className="text-[11px] text-[#64748B] text-center">
              {filtered.length} paiement{filtered.length !== 1 ? "s" : ""} affiché{filtered.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Financial Summary sidebar */}
        <div className="hidden xl:block">
          <PaymentFinancialSummary payments={payments} />
        </div>
      </div>

      {/* ═══ DETAIL DRAWER ═══ */}
      <PaymentDetailDrawer payment={selectedPayment} onClose={() => setSelectedPayment(null)} />
    </div>
  );
};

export default PaymentsPage;
