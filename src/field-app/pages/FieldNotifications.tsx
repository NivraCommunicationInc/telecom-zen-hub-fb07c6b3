/**
 * FieldNotifications — Activity feed & notifications for field agents.
 * Shows recent system events: sync status changes, commission updates, lead conversions.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { Bell, Loader2, CheckCircle2, AlertCircle, DollarSign, RefreshCw, UserPlus, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

type NotifItem = {
  id: string;
  type: "sale" | "commission" | "sync" | "lead" | "system";
  title: string;
  description: string;
  time: string;
  status?: "success" | "warning" | "error" | "info";
};

const ICON_MAP: Record<string, typeof Bell> = {
  sale: ShoppingCart,
  commission: DollarSign,
  sync: RefreshCw,
  lead: UserPlus,
  system: Bell,
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  success: { bg: "bg-[#DCFCE7]", color: "text-[#16A34A]" },
  warning: { bg: "bg-[#FEF3C7]", color: "text-[#D97706]" },
  error: { bg: "bg-[#FEE2E2]", color: "text-[#DC2626]" },
  info: { bg: "bg-[#DBEAFE]", color: "text-[#3B82F6]" },
};

export default function FieldNotifications() {
  const { user } = useStaffUser();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["field-notifications", user?.id],
    queryFn: async () => {
      const items: NotifItem[] = [];

      // Recent orders with status changes
      const { data: orders } = await supabase
        .from("field_sales_orders")
        .select("id, customer_name, sync_status, payment_status, created_at, updated_at")
        .eq("salesperson_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(10);

      for (const o of orders || []) {
        if (o.sync_status === "synced") {
          items.push({
            id: `sync-${o.id}`, type: "sync",
            title: "Commande synchronisée",
            description: `${o.customer_name} — visible dans Core`,
            time: o.updated_at || o.created_at, status: "success",
          });
        } else if (o.sync_status === "error") {
          items.push({
            id: `sync-err-${o.id}`, type: "sync",
            title: "Erreur synchronisation",
            description: `${o.customer_name} — action requise`,
            time: o.updated_at || o.created_at, status: "error",
          });
        }
        if (o.payment_status === "confirmed") {
          items.push({
            id: `pay-${o.id}`, type: "sale",
            title: "Paiement confirmé",
            description: `${o.customer_name}`,
            time: o.updated_at || o.created_at, status: "success",
          });
        }
      }

      // Recent commissions
      const { data: comms } = await supabase
        .from("field_commissions")
        .select("id, amount, status, created_at")
        .eq("agent_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);

      for (const c of comms || []) {
        items.push({
          id: `comm-${c.id}`, type: "commission",
          title: c.status === "paid" ? "Commission payée" : c.status === "approved" ? "Commission approuvée" : "Commission en attente",
          description: `${Number(c.amount).toFixed(2)} $`,
          time: c.created_at,
          status: c.status === "paid" ? "success" : c.status === "approved" ? "info" : "warning",
        });
      }

      // Sort by time desc
      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return items.slice(0, 20);
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 3,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#000000]">Notifications</h1>
        <p className="text-sm text-[#6B7280]">Activité récente et mises à jour</p>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-10 w-10 mx-auto mb-3 text-[#D1D5DB]" />
          <p className="text-sm text-[#9CA3AF]">Aucune notification</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = ICON_MAP[n.type] || Bell;
            const style = STATUS_STYLE[n.status || "info"];
            return (
              <div key={n.id} className="flex items-start gap-3 p-4 bg-white border border-[#E5E7EB] rounded-xl hover:border-[#D1D5DB] transition-colors">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", style.bg)}>
                  <Icon className={cn("h-4 w-4", style.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#000000]">{n.title}</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">{n.description}</p>
                </div>
                <span className="text-[10px] text-[#9CA3AF] shrink-0">
                  {formatDistanceToNow(new Date(n.time), { addSuffix: true, locale: fr })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
