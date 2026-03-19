/**
 * EmployeeWorkQueue — Central operational table.
 * Columns: Type, Reference, Client, Status, Priority, Assigned, Created, SLA, Action.
 * Filters: All, Assigned to me, Unassigned, Urgent, Overdue, By type.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import {
  ShoppingCart, CreditCard, ShieldCheck, Zap, Headphones,
  UserPlus, ArrowUpRight, MessageSquare, Loader2, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { formatDistanceToNow } from "date-fns";
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
  href: string;
}

const TYPE_CONFIG: Record<QueueItemType, { label: string; icon: typeof ShoppingCart; color: string }> = {
  order: { label: "Commande", icon: ShoppingCart, color: "text-blue-400" },
  payment: { label: "Paiement", icon: CreditCard, color: "text-emerald-400" },
  kyc: { label: "KYC", icon: ShieldCheck, color: "text-amber-400" },
  activation: { label: "Activation", icon: Zap, color: "text-purple-400" },
  ticket: { label: "Ticket", icon: Headphones, color: "text-cyan-400" },
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "mine", label: "Assignés à moi" },
  { key: "unassigned", label: "Non assignés" },
  { key: "urgent", label: "Urgent" },
  { key: "overdue", label: "En retard" },
  { key: "order", label: "Commandes" },
  { key: "payment", label: "Paiements" },
  { key: "kyc", label: "KYC" },
  { key: "activation", label: "Activations" },
  { key: "ticket", label: "Tickets" },
];

function getPriority(status: string, createdAt: string): QueueItem["priority"] {
  const age = Date.now() - new Date(createdAt).getTime();
  const hours = age / (1000 * 60 * 60);
  if (hours > 72) return "urgent";
  if (hours > 48) return "high";
  if (hours > 24) return "normal";
  return "low";
}

function useWorkQueueData() {
  return useQuery<QueueItem[]>({
    queryKey: ["employee-work-queue"],
    queryFn: async () => {
      const items: QueueItem[] = [];

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
          items.push({
            id: o.id,
            type: "order",
            reference: o.order_number ?? o.id.slice(0, 8),
            clientName: p?.full_name ?? null,
            clientEmail: p?.email ?? null,
            status: o.status,
            priority: getPriority(o.status, o.created_at),
            assignedTo: o.assigned_to,
            createdAt: o.created_at,
            href: employeePath(`/orders/${o.id}`),
          });
        }
      }

      // Manual payments
      const { data: payments } = await supabase
        .from("billing_payments")
        .select("id, payment_number, status, created_at, method, customer_id")
        .eq("status", "pending")
        .eq("environment", "live")
        .order("created_at", { ascending: true })
        .limit(30);

      if (payments) {
        for (const pay of payments) {
          items.push({
            id: pay.id,
            type: "payment",
            reference: pay.payment_number,
            clientName: null,
            clientEmail: null,
            status: pay.status ?? "pending",
            priority: getPriority(pay.status ?? "pending", pay.created_at ?? ""),
            assignedTo: null,
            createdAt: pay.created_at ?? "",
            href: employeePath(`/payments?id=${pay.id}`),
          });
        }
      }

      // KYC
      const { data: kycs } = await supabase
        .from("order_identity_data")
        .select("id, order_id, verification_status, created_at")
        .eq("verification_status", "pending")
        .order("created_at", { ascending: true })
        .limit(30);

      if (kycs) {
        for (const k of kycs) {
          items.push({
            id: k.id,
            type: "kyc",
            reference: k.order_id?.slice(0, 8) ?? k.id.slice(0, 8),
            clientName: null,
            clientEmail: null,
            status: k.verification_status ?? "pending",
            priority: getPriority("pending", k.created_at),
            assignedTo: null,
            createdAt: k.created_at,
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
        .order("created_at", { ascending: true })
        .limit(30);

      if (activations) {
        for (const a of activations) {
          items.push({
            id: a.id,
            type: "activation",
            reference: a.order_number ?? a.id.slice(0, 8),
            clientName: null,
            clientEmail: null,
            status: a.status,
            priority: getPriority(a.status, a.created_at),
            assignedTo: null,
            createdAt: a.created_at,
            href: employeePath(`/activations`),
          });
        }
      }

      // Tickets
      const { data: tickets } = await supabase
        .from("support_tickets")
        .select("id, ticket_number, subject, status, priority, created_at, assigned_to, user_id")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: true })
        .limit(30);

      if (tickets) {
        for (const t of tickets) {
          items.push({
            id: t.id,
            type: "ticket",
            reference: t.ticket_number ?? t.id.slice(0, 8),
            clientName: null,
            clientEmail: null,
            status: t.status ?? "open",
            priority: t.priority === "urgent" || t.priority === "high" ? "urgent" : "normal",
            assignedTo: t.assigned_to,
            createdAt: t.created_at,
            href: employeePath(`/support`),
          });
        }
      }

      // Sort by priority then age
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

  const priorityBadge = (p: QueueItem["priority"]) => {
    const colors = {
      urgent: "bg-red-500/15 text-red-400",
      high: "bg-amber-500/15 text-amber-400",
      normal: "bg-blue-500/10 text-blue-400",
      low: "bg-[hsl(220,15%,15%)] text-[hsl(220,10%,45%)]",
    };
    return (
      <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold uppercase", colors[p])}>
        {p === "urgent" ? "Urgent" : p === "high" ? "Haute" : p === "normal" ? "Normale" : "Basse"}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">File de travail</h1>
        <p className="text-sm text-[hsl(220,10%,45%)]">{filteredItems.length} élément{filteredItems.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-[hsl(220,10%,35%)] mr-1" />
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => handleFilterChange(f.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              activeFilter === f.key
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "text-[hsl(220,10%,45%)] hover:text-white hover:bg-[hsl(220,15%,12%)] border border-transparent"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 text-[hsl(220,10%,35%)] text-sm">Aucun élément dans cette file.</div>
      ) : (
        <div className="rounded-xl border border-[hsl(220,15%,13%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)]">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Référence</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Statut</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Priorité</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Créé</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const tc = TYPE_CONFIG[item.type];
                  return (
                    <tr
                      key={`${item.type}-${item.id}`}
                      className="border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(220,20%,9%)] transition-colors cursor-pointer"
                      onClick={() => navigate(item.href)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <tc.icon className={cn("h-3.5 w-3.5", tc.color)} />
                          <span className="text-xs text-[hsl(220,10%,55%)]">{tc.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-white">{item.reference}</td>
                      <td className="px-4 py-3 text-xs text-[hsl(220,10%,55%)]">{item.clientName ?? item.clientEmail ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-[hsl(220,15%,15%)] text-[10px] text-[hsl(220,10%,55%)] font-medium">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{priorityBadge(item.priority)}</td>
                      <td className="px-4 py-3 text-xs text-[hsl(220,10%,45%)]">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: fr })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="p-1.5 rounded hover:bg-blue-500/10 text-[hsl(220,10%,40%)] hover:text-blue-400 transition-colors">
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
