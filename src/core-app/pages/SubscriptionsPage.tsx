/**
 * Nivra Core — Subscription Lifecycle Console
 * Telecom-grade service management workspace.
 */
import { useState, useMemo } from "react";
import { useAdminSubscriptions } from "@/core-app/hooks/useAdminSubscriptions";
import type { AdminSubscription } from "@/core-app/hooks/useAdminSubscriptions";
import type { EnvironmentFilter } from "@/core-app/hooks/useEnvironmentFilter";
import { CoreEnvironmentToggle } from "@/core-app/components/CoreEnvironmentToggle";
import { SubscriptionKPIHeader } from "@/core-app/components/subscriptions/SubscriptionKPIHeader";
import { SubscriptionFilters } from "@/core-app/components/subscriptions/SubscriptionFilters";
import { SubscriptionTable } from "@/core-app/components/subscriptions/SubscriptionTable";
import { SubscriptionDetailDrawer } from "@/core-app/components/subscriptions/SubscriptionDetailDrawer";
import { SubscriptionSummary } from "@/core-app/components/subscriptions/SubscriptionSummary";
import { RefreshCw, Repeat } from "lucide-react";

const SubscriptionsPage = () => {
  const [envFilter, setEnvFilter] = useState<EnvironmentFilter>("all");
  const { data: subs = [], isLoading, refetch } = useAdminSubscriptions(envFilter);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [renewalFrom, setRenewalFrom] = useState("");
  const [renewalTo, setRenewalTo] = useState("");

  // View
  const [selectedSub, setSelectedSub] = useState<AdminSubscription | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return subs.filter(s => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (categoryFilter && s.service_category !== categoryFilter) return false;
      if (dateFrom && (s.cycle_start_date ?? "") < dateFrom) return false;
      if (dateTo && (s.cycle_start_date ?? "") > dateTo) return false;
      if (renewalFrom && (s.cycle_end_date ?? "") < renewalFrom) return false;
      if (renewalTo && (s.cycle_end_date ?? "") > renewalTo) return false;
      if (!q) return true;
      return (
        s.plan_name?.toLowerCase().includes(q) ||
        s.plan_code?.toLowerCase().includes(q) ||
        s.client_name?.toLowerCase().includes(q) ||
        s.client_email?.toLowerCase().includes(q) ||
        s.account_number?.toLowerCase().includes(q) ||
        s.service_category?.toLowerCase().includes(q)
      );
    });
  }, [subs, search, statusFilter, categoryFilter, dateFrom, dateTo, renewalFrom, renewalTo]);

  return (
    <div className="space-y-4">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-emerald-400" />
            <h1 className="text-lg font-bold text-[#F8FAFC] tracking-tight">Gestion des Services</h1>
          </div>
          <p className="text-[12px] text-[#94A3B8] mt-0.5">
            Console de cycle de vie · {subs.length} abonnement{subs.length !== 1 ? "s" : ""}
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
      <SubscriptionKPIHeader subs={subs} isLoading={isLoading} />

      {/* ═══ 2-column: Table + Summary ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-3">
          {/* Filters */}
          <SubscriptionFilters
            search={search} onSearch={setSearch}
            status={statusFilter} onStatus={setStatusFilter}
            category={categoryFilter} onCategory={setCategoryFilter}
            dateFrom={dateFrom} onDateFrom={setDateFrom}
            dateTo={dateTo} onDateTo={setDateTo}
            renewalFrom={renewalFrom} onRenewalFrom={setRenewalFrom}
            renewalTo={renewalTo} onRenewalTo={setRenewalTo}
            resultCount={filtered.length}
            totalCount={subs.length}
          />

          {/* Table */}
          <SubscriptionTable subs={filtered} isLoading={isLoading} onSelect={setSelectedSub} />

          {/* Footer */}
          {!isLoading && filtered.length > 0 && (
            <p className="text-[11px] text-[#64748B] text-center">
              {filtered.length} abonnement{filtered.length !== 1 ? "s" : ""} affiché{filtered.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Summary sidebar */}
        <div className="hidden xl:block">
          <SubscriptionSummary subs={subs} />
        </div>
      </div>

      {/* ═══ DETAIL DRAWER ═══ */}
      <SubscriptionDetailDrawer subscription={selectedSub} onClose={() => setSelectedSub(null)} />
    </div>
  );
};

export default SubscriptionsPage;
