/**
 * EmployeeWorkQueue — Phase 2: Telecom-grade operational queue.
 * Enhanced SLA bars, filter counts, inline status, faster navigation.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import {
  ShoppingCart, CreditCard, ShieldCheck, Zap, Headphones,
  ArrowUpRight, Loader2, Filter, Clock, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { fr } from "date-fns/locale";

type QueueItemType = "order" | "payment" | "kyc" | "activation" | "ticket";
type FilterKey = "all" | "mine" | "unassigned" | "urgent" | "overdue" | QueueItemType;

interface QueueItem {
  id: string;
  type: QueueItemType;
  reference: string;
  clientName: string | null;
  clientEmail: string | null;
  status: string;
  priority: "low" | "normal" | "high" | "urgent";
  assignedTo: string | null;
  createdAt: string;
  ageHours: number;
  href: string;
}

const TYPE_CONFIG: Record<QueueItemType, { label: string; icon: typeof ShoppingCart; color: string; bg: string }> = {
  order: { label: "Commande", icon: ShoppingCart, color: "text-blue-400", bg: "bg-blue-500/10" },
  payment: { label: "Paiement", icon: CreditCard, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  kyc: { label: "KYC", icon: ShieldCheck, color: "text-amber-400", bg: "bg-amber-500/10" },
  activation: { label: "Activation", icon: Zap, color: "text-purple-400", bg: "bg-purple-500/10" },
  ticket: { label: "Ticket", icon: Headphones, color: "text-cyan-400", bg: "bg-cyan-500/10" },
};

function getPriority(status: string, createdAt: string): QueueItem["priority"] {
  const hours = differenceInHours(new Date(), new Date(createdAt));
  if (hours > 72) return "urgent";
  if (hours > 48) return "high";
  if (hours > 24) return "normal";
  return "low";
}

/** SLA progress bar — visual representation of time elapsed */
function SlaBar({ ageHours, priority }: { ageHours: number; priority: QueueItem["priority"] }) {
  // SLA target: 24h normal, fills up to 72h
  const pct = Math.min(100, (ageHours / 72) * 100);
  const barColor =
    priority === "urgent" ? "bg-red-500" :
    priority === "high" ? "bg-amber-500" :
    priority === "normal" ? "bg-blue-500" :
    "bg-[hsl(220,10%,25%)]";

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-[hsl(220,15%,12%)] overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn(
        "text-[10px] font-mono tabular-nums",
        priority === "urgent" ? "text-red-400" :
        priority === "high" ? "text-amber-400" :
        "text-[hsl(220,10%,40%)]"
      )}>
        {ageHours < 1 ? "<1h" : ageHours < 24 ? `${Math.round(ageHours)}h` : `${Math.round(ageHours / 24)}j`}
      </span>
    </div>
  );
}

function useWorkQueueData() {
  return useQuery<QueueItem[]>({
    queryKey: ["employee-work-queue-v2"],
    queryFn: async () => {
      const items: QueueItem[] = [];
      const now = new Date();

      // Orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, user_id, status, created_at, assigned_to")
        .in("status", ["pending", "submitted", "received", "processing", "on_hold"])
        .eq("environment", "live")
        .order("created_at", { ascending: true })
        .limit(50);

      if (orders) {
        const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];
        const { data: profiles } = userIds.length
          ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
          : { data: [] };
        const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

        for (const o of orders) {
          const p = profileMap.get(o.user_id);
          const ageHours = differenceInHours(now, new Date(o.created_at));
          items.push({
            id: o.id, type: "order",
            reference: o.order_number ?? o.id.slice(0, 8),
            clientName: p?.full_name ?? null, clientEmail: p?.email ?? null,
            status: o.status,
            priority: getPriority(o.status, o.created_at),
            assignedTo: o.assigned_to,
            createdAt: o.created_at, ageHours,
            href: employeePath(`/orders/${o.id}`),
          });
        }
      }

      // Manual payments
      const { data: payments } = await supabase
        .from("billing_payments")
        .select("id, payment_number, status, created_at, method, customer_id")
        .eq("status", "pending").eq("environment", "live")
        .order("created_at", { ascending: true }).limit(30);

      if (payments) {
        for (const pay of payments) {
          const ageHours = differenceInHours(now, new Date(pay.created_at ?? ""));
          items.push({
            id: pay.id, type: "payment",
            reference: pay.payment_number,
            clientName: null, clientEmail: null,
            status: pay.status ?? "pending",
            priority: getPriority(pay.status ?? "pending", pay.created_at ?? ""),
            assignedTo: null, createdAt: pay.created_at ?? "", ageHours,
            href: employeePath(`/payments?id=${pay.id}`),
          });
        }
      }

      // KYC
      const { data: kycs } = await supabase
        .from("order_identity_data")
        .select("id, order_id, verification_status, created_at")
        .eq("verification_status", "pending")
        .order("created_at", { ascending: true }).limit(30);

      if (kycs) {
        for (const k of kycs) {
          const ageHours = differenceInHours(now, new Date(k.created_at));
          items.push({
            id: k.id, type: "kyc",
            reference: k.order_id?.slice(0, 8) ?? k.id.slice(0, 8),
            clientName: null, clientEmail: null,
            status: k.verification_status ?? "pending",
            priority: getPriority("pending", k.created_at),
            assignedTo: null, createdAt: k.created_at, ageHours,
            href: employeePath("/kyc"),
          });
        }
      }

      // Activations
      const { data: activations } = await supabase
        .from("orders")
        .select("id, order_number, user_id, status, created_at")
        .in("status", ["delivered", "installed"])
        .eq("environment", "live")
        .order("created_at", { ascending: true }).limit(30);

      if (activations) {
        for (const a of activations) {
          const ageHours = differenceInHours(now, new Date(a.created_at));
          items.push({
            id: a.id, type: "activation",
            reference: a.order_number ?? a.id.slice(0, 8),
            clientName: null, clientEmail: null,
            status: a.status,
            priority: getPriority(a.status, a.created_at),
            assignedTo: null, createdAt: a.created_at, ageHours,
            href: employeePath("/activations"),
          });
        }
      }

      // Tickets
      const { data: tickets } = await supabase
        .from("support_tickets")
        .select("id, ticket_number, subject, status, priority, created_at, assigned_to")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: true }).limit(30);

      if (tickets) {
        for (const t of tickets) {
          const ageHours = differenceInHours(now, new Date(t.created_at));
          items.push({
            id: t.id, type: "ticket",
            reference: t.ticket_number ?? t.id.slice(0, 8),
            clientName: null, clientEmail: null,
            status: t.status ?? "open",
            priority: t.priority === "urgent" || t.priority === "high" ? "urgent" : "normal",
            assignedTo: t.assigned_to, createdAt: t.created_at, ageHours,
            href: employeePath("/support"),
          });
        }
      }

      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      items.sort((a, b) => {
        const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pd !== 0) return pd;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      return items;
    },
    staleTime: 1000 * 60 * 2,
  });
}

export default function EmployeeWorkQueue() {
  const { data: items = [], isLoading } = useWorkQueueData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeFilter, setActiveFilter] = useState<FilterKey>(
    (searchParams.get("filter") as FilterKey) || "all"
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
  }, []);

  // Compute filter counts for badges
  const filterCounts = useMemo(() => {
    const cutoff48h = Date.now() - 48 * 60 * 60 * 1000;
    const counts: Record<FilterKey, number> = {
      all: items.length,
      mine: items.filter(i => i.assignedTo === currentUserId).length,
      unassigned: items.filter(i => !i.assignedTo).length,
      urgent: items.filter(i => i.priority === "urgent" || i.priority === "high").length,
      overdue: items.filter(i => new Date(i.createdAt).getTime() < cutoff48h).length,
      order: items.filter(i => i.type === "order").length,
      payment: items.filter(i => i.type === "payment").length,
      kyc: items.filter(i => i.type === "kyc").length,
      activation: items.filter(i => i.type === "activation").length,
      ticket: items.filter(i => i.type === "ticket").length,
    };
    return counts;
  }, [items, currentUserId]);

  const filteredItems = useMemo(() => {
    const cutoff48h = Date.now() - 48 * 60 * 60 * 1000;
    return items.filter((item) => {
      switch (activeFilter) {
        case "mine": return item.assignedTo === currentUserId;
        case "unassigned": return !item.assignedTo;
        case "urgent": return item.priority === "urgent" || item.priority === "high";
        case "overdue": return new Date(item.createdAt).getTime() < cutoff48h;
        case "order": case "payment": case "kyc": case "activation": case "ticket":
          return item.type === activeFilter;
        default: return true;
      }
    });
  }, [items, activeFilter, currentUserId]);

  const navigate = useNavigate();

  const handleFilterChange = (key: FilterKey) => {
    setActiveFilter(key);
    setSearchParams(key === "all" ? {} : { filter: key });
  };

  const FILTERS: { key: FilterKey; label: string; highlight?: boolean }[] = [
    { key: "all", label: "Tout" },
    { key: "mine", label: "Mes tâches", highlight: true },
    { key: "unassigned", label: "Non assignés" },
    { key: "urgent", label: "Urgent", highlight: true },
    { key: "overdue", label: "En retard", highlight: true },
    { key: "order", label: "Commandes" },
    { key: "payment", label: "Paiements" },
    { key: "kyc", label: "KYC" },
    { key: "activation", label: "Activations" },
    { key: "ticket", label: "Tickets" },
  ];

  const priorityIndicator = (p: QueueItem["priority"]) => {
    const config = {
      urgent: { dot: "bg-red-500", text: "text-red-400", label: "URGENT" },
      high: { dot: "bg-amber-500", text: "text-amber-400", label: "HAUTE" },
      normal: { dot: "bg-blue-500", text: "text-blue-400", label: "NORMAL" },
      low: { dot: "bg-[hsl(220,10%,30%)]", text: "text-[hsl(220,10%,40%)]", label: "BASSE" },
    }[p];
    return (
      <div className="flex items-center gap-1.5">
        <div className={cn("h-2 w-2 rounded-full", config.dot, p === "urgent" && "animate-pulse")} />
        <span className={cn("text-[10px] font-semibold uppercase tracking-wide", config.text)}>
          {config.label}
        </span>
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
            {filteredItems.length} élément{filteredItems.length !== 1 ? "s" : ""}
            {activeFilter !== "all" && ` · filtre: ${FILTERS.find(f => f.key === activeFilter)?.label}`}
          </p>
        </div>
      </div>

      {/* Filters with counts */}
      <div className="flex items-center gap-1 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-[hsl(220,10%,30%)] mr-1" />
        {FILTERS.map((f) => {
          const count = filterCounts[f.key];
          const isActive = activeFilter === f.key;
          const isHighlightAlert = f.highlight && count > 0 && !isActive;
          return (
            <button
              key={f.key}
              onClick={() => handleFilterChange(f.key)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                isActive
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : isHighlightAlert
                  ? "text-amber-400 hover:bg-amber-500/10 border border-transparent"
                  : "text-[hsl(220,10%,42%)] hover:text-white hover:bg-[hsl(220,15%,12%)] border border-transparent"
              )}
            >
              {f.label}
              {count > 0 && (
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                  isActive ? "bg-blue-500/20 text-blue-300" :
                  f.key === "urgent" || f.key === "overdue" ? "bg-red-500/15 text-red-400" :
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
      ) : filteredItems.length === 0 ? (
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
                  {["Type", "Référence", "Client", "Statut", "Priorité", "SLA", ""].map(h => (
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
                {filteredItems.map((item) => {
                  const tc = TYPE_CONFIG[item.type];
                  const isUrgent = item.priority === "urgent";
                  return (
                    <tr
                      key={`${item.type}-${item.id}`}
                      className={cn(
                        "border-b border-[hsl(220,15%,9%)] hover:bg-[hsl(220,20%,9.5%)] transition-colors cursor-pointer",
                        isUrgent && "bg-red-500/[0.02]"
                      )}
                      onClick={() => navigate(item.href)}
                    >
                      <td className="px-4 py-2.5">
                        <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md", tc.bg)}>
                          <tc.icon className={cn("h-3 w-3", tc.color)} />
                          <span className={cn("text-[10px] font-semibold", tc.color)}>{tc.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-white font-medium">{item.reference}</td>
                      <td className="px-4 py-2.5">
                        {item.clientName ? (
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-[hsl(220,10%,30%)]" />
                            <span className="text-xs text-[hsl(220,10%,60%)]">{item.clientName}</span>
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
                        <SlaBar ageHours={item.ageHours} priority={item.priority} />
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
