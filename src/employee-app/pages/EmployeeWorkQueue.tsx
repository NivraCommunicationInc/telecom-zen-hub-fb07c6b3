/**
 * EmployeeWorkQueue — Phase 3: Unified work queue powered by employee_work_items.
 * Real SLA tracking, auto-assignment status, realtime updates.
 */
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShoppingCart, CreditCard, ShieldCheck, Zap, Headphones,
  ArrowUpRight, Loader2, Filter, Clock, User, UserCheck,
  AlertTriangle, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { fr } from "date-fns/locale";
import { useWorkItems, WorkItem } from "@/employee-app/hooks/useWorkItems";
import { supabase } from "@/integrations/supabase/client";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { toast } from "sonner";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";

type FilterKey = "all" | "mine" | "unassigned" | "urgent" | "breached" | "order" | "payment" | "kyc" | "activation" | "ticket";

const TYPE_CONFIG: Record<string, { label: string; icon: typeof ShoppingCart; color: string; bg: string }> = {
  order: { label: "Commande", icon: ShoppingCart, color: "text-blue-400", bg: "bg-blue-500/10" },
  payment: { label: "Paiement", icon: CreditCard, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  kyc: { label: "KYC", icon: ShieldCheck, color: "text-amber-400", bg: "bg-amber-500/10" },
  activation: { label: "Activation", icon: Zap, color: "text-purple-400", bg: "bg-purple-500/10" },
  ticket: { label: "Ticket", icon: Headphones, color: "text-cyan-400", bg: "bg-cyan-500/10" },
};

const SLA_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  on_time: { label: "OK", color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  at_risk: { label: "À risque", color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-500" },
  breached: { label: "Dépassé", color: "text-red-400", bg: "bg-red-500/10", dot: "bg-red-500" },
};

function SlaIndicator({ item }: { item: WorkItem }) {
  const sla = SLA_CONFIG[item.sla_status] || SLA_CONFIG.on_time;
  const deadline = item.sla_deadline_at ? new Date(item.sla_deadline_at) : null;
  const now = new Date();
  
  let timeLabel = "";
  if (deadline) {
    const diff = deadline.getTime() - now.getTime();
    if (diff > 0) {
      const hours = Math.floor(diff / 3600000);
      timeLabel = hours > 24 ? `${Math.floor(hours / 24)}j` : `${hours}h`;
    } else {
      const overHours = Math.abs(Math.floor(diff / 3600000));
      timeLabel = overHours > 24 ? `-${Math.floor(overHours / 24)}j` : `-${overHours}h`;
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full", sla.bg)}>
        <div className={cn("h-1.5 w-1.5 rounded-full", sla.dot, item.sla_status === "breached" && "animate-pulse")} />
        <span className={cn("text-[10px] font-semibold", sla.color)}>{sla.label}</span>
      </div>
      {timeLabel && (
        <span className={cn(
          "text-[10px] font-mono tabular-nums",
          item.sla_status === "breached" ? "text-red-400" :
          item.sla_status === "at_risk" ? "text-amber-400" :
          "text-[hsl(220,10%,40%)]"
        )}>
          {timeLabel}
        </span>
      )}
    </div>
  );
}

export default function EmployeeWorkQueue() {
  usePortalRealtime(["employee_work_items", "orders", "support_tickets"], [["employee-work-queue"]]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeFilter, setActiveFilter] = useState<FilterKey>(
    (searchParams.get("filter") as FilterKey) || "all"
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Use the filter for the query when it maps to a supported filter
  const queryFilter = ["mine", "unassigned", "urgent", "breached", "order", "payment", "kyc", "activation", "ticket"].includes(activeFilter) ? activeFilter : undefined;
  const { data: items = [], isLoading } = useWorkItems(queryFilter);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
  }, []);

  // Compute filter counts from full data (all filter)
  const { data: allItems = [] } = useWorkItems();
  const filterCounts = useMemo(() => {
    return {
      all: allItems.length,
      mine: allItems.filter(i => i.assigned_to_id === currentUserId).length,
      unassigned: allItems.filter(i => !i.assigned_to_id).length,
      urgent: allItems.filter(i => i.priority === "urgent" || i.priority === "high").length,
      breached: allItems.filter(i => i.sla_status === "breached").length,
      order: allItems.filter(i => i.item_type === "order").length,
      payment: allItems.filter(i => i.item_type === "payment").length,
      kyc: allItems.filter(i => i.item_type === "kyc").length,
      activation: allItems.filter(i => i.item_type === "activation").length,
      ticket: allItems.filter(i => i.item_type === "ticket").length,
    };
  }, [allItems, currentUserId]);

  const handleFilterChange = (key: FilterKey) => {
    setActiveFilter(key);
    setSearchParams(key === "all" ? {} : { filter: key });
  };

  const handleTakeOwnership = useCallback(async (item: WorkItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId) return;
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", currentUserId)
      .maybeSingle();

    const { error } = await supabase
      .from("employee_work_items")
      .update({
        assigned_to_id: currentUserId,
        assigned_to_name: profile?.full_name || "Agent",
        status: "assigned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (!error) {
      toast.success("Tâche assignée");
      await logInternalAudit({
        action: "take_ownership",
        category: "operations",
        portal: "employee",
        targetType: item.item_type,
        targetId: item.source_id,
      });
    }
  }, [currentUserId]);

  const getItemHref = (item: WorkItem) => {
    switch (item.item_type) {
      case "order": {
        const orderRouteParam = (item.source_reference || item.source_id || "").trim();
        return employeePath(`/orders/${encodeURIComponent(orderRouteParam)}`);
      }
      case "activation": return employeePath("/activations");
      case "payment": return employeePath(`/payments?id=${item.source_id}`);
      case "kyc": return employeePath("/kyc");
      case "ticket": return employeePath("/support");
      default: return employeePath("/work-queue");
    }
  };

  const FILTERS: { key: FilterKey; label: string; highlight?: boolean }[] = [
    { key: "all", label: "Tout" },
    { key: "mine", label: "Mes tâches", highlight: true },
    { key: "unassigned", label: "Non assignés" },
    { key: "urgent", label: "Urgent", highlight: true },
    { key: "breached", label: "SLA dépassé", highlight: true },
    { key: "order", label: "Commandes" },
    { key: "payment", label: "Paiements" },
    { key: "kyc", label: "KYC" },
    { key: "activation", label: "Activations" },
    { key: "ticket", label: "Tickets" },
  ];

  const priorityIndicator = (p: WorkItem["priority"]) => {
    const config = {
      urgent: { dot: "bg-red-500", text: "text-red-400", label: "URGENT" },
      high: { dot: "bg-amber-500", text: "text-amber-400", label: "HAUTE" },
      normal: { dot: "bg-blue-500", text: "text-blue-400", label: "NORMAL" },
      low: { dot: "bg-[hsl(220,10%,30%)]", text: "text-[hsl(220,10%,40%)]", label: "BASSE" },
    }[p];
    return (
      <div className="flex items-center gap-1.5">
        <div className={cn("h-2 w-2 rounded-full", config.dot, p === "urgent" && "animate-pulse")} />
        <span className={cn("text-[10px] font-semibold uppercase tracking-wide", config.text)}>{config.label}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">File de travail</h1>
          <p className="text-sm text-[hsl(220,10%,45%)]">
            {items.length} élément{items.length !== 1 ? "s" : ""}
            {activeFilter !== "all" && ` · ${FILTERS.find(f => f.key === activeFilter)?.label}`}
            {filterCounts.breached > 0 && (
              <span className="ml-2 text-red-400 font-semibold">
                · {filterCounts.breached} SLA dépassé{filterCounts.breached > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* SLA Summary bar */}
      {(filterCounts.breached > 0 || filterCounts.urgent > 0) && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-red-500/20 bg-red-500/[0.04]">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <div className="flex items-center gap-4 text-xs">
            {filterCounts.breached > 0 && (
              <button onClick={() => handleFilterChange("breached")} className="text-red-400 hover:text-red-300 font-medium">
                {filterCounts.breached} SLA dépassé{filterCounts.breached > 1 ? "s" : ""}
              </button>
            )}
            {filterCounts.urgent > 0 && (
              <span className="text-amber-400 font-medium">
                {filterCounts.urgent} urgent{filterCounts.urgent > 1 ? "s" : ""}
              </span>
            )}
            {filterCounts.unassigned > 0 && (
              <button onClick={() => handleFilterChange("unassigned")} className="text-[hsl(220,10%,50%)] hover:text-white">
                {filterCounts.unassigned} non assigné{filterCounts.unassigned > 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-1 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-[hsl(220,10%,30%)] mr-1" />
        {FILTERS.map((f) => {
          const count = filterCounts[f.key];
          const isActive = activeFilter === f.key;
          const isBreached = f.key === "breached" && count > 0;
          return (
            <button
              key={f.key}
              onClick={() => handleFilterChange(f.key)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                isActive
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : isBreached
                  ? "text-red-400 hover:bg-red-500/10 border border-red-500/20"
                  : f.highlight && count > 0
                  ? "text-amber-400 hover:bg-amber-500/10 border border-transparent"
                  : "text-[hsl(220,10%,42%)] hover:text-white hover:bg-[hsl(220,15%,12%)] border border-transparent"
              )}
            >
              {f.label}
              {count > 0 && (
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                  isActive ? "bg-blue-500/20 text-blue-300" :
                  isBreached ? "bg-red-500/15 text-red-400" :
                  f.key === "urgent" ? "bg-amber-500/15 text-amber-400" :
                  "bg-[hsl(220,15%,14%)] text-[hsl(220,10%,45%)]"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-[hsl(220,10%,30%)] text-sm">
          <Clock className="h-6 w-6 mx-auto mb-2 text-[hsl(220,10%,20%)]" />
          Aucun élément dans cette file.
        </div>
      ) : (
        <div className="rounded-xl border border-[hsl(220,15%,12%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7.5%)]">
                  {["Type", "Référence", "Client", "Statut", "Priorité", "SLA", "Assigné", ""].map(h => (
                    <th key={h} className={cn(
                      "px-4 py-2.5 text-[10px] font-semibold text-[hsl(220,10%,35%)] uppercase tracking-wider",
                      h === "" ? "text-right" : "text-left"
                    )}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const tc = TYPE_CONFIG[item.item_type] || TYPE_CONFIG.order;
                  const isBreach = item.sla_status === "breached";
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b border-[hsl(220,15%,9%)] hover:bg-[hsl(220,20%,9.5%)] transition-colors cursor-pointer",
                        isBreach && "bg-red-500/[0.03] border-l-2 border-l-red-500"
                      )}
                      onClick={() => navigate(getItemHref(item))}
                    >
                      <td className="px-4 py-2.5">
                        <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md", tc.bg)}>
                          <tc.icon className={cn("h-3 w-3", tc.color)} />
                          <span className={cn("text-[10px] font-semibold", tc.color)}>{tc.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-white font-medium">{item.source_reference || "—"}</td>
                      <td className="px-4 py-2.5">
                        {item.client_name ? (
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-[hsl(220,10%,30%)]" />
                            <span className="text-xs text-[hsl(220,10%,60%)]">{item.client_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-[hsl(220,10%,30%)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded bg-[hsl(220,15%,13%)] text-[10px] text-[hsl(220,10%,55%)] font-medium">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{priorityIndicator(item.priority)}</td>
                      <td className="px-4 py-2.5">
                        <SlaIndicator item={item} />
                      </td>
                      <td className="px-4 py-2.5">
                        {item.assigned_to_name ? (
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="h-3 w-3 text-blue-400" />
                            <span className="text-xs text-[hsl(220,10%,55%)]">{item.assigned_to_name}</span>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleTakeOwnership(item, e)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                          >
                            <ChevronUp className="h-3 w-3" />
                            Prendre
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button className="p-1 rounded hover:bg-blue-500/10 text-[hsl(220,10%,35%)] hover:text-blue-400 transition-colors">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
