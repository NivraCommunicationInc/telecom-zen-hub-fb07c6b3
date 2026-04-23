import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Users, Loader2, Search, Phone, ChevronRight, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { fetchOrderList } from "@/field-app/lib/fieldServices";

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  confirmed: {
    label: "Payé",
    classes: "bg-[hsl(var(--field-success)/0.15)] text-[hsl(var(--field-success))] border border-[hsl(var(--field-success)/0.3)]",
  },
  pending: {
    label: "En attente",
    classes: "bg-[hsl(var(--field-warning)/0.15)] text-[hsl(var(--field-warning))] border border-[hsl(var(--field-warning)/0.3)]",
  },
  cancelled: {
    label: "Annulé",
    classes: "bg-[hsl(var(--field-danger)/0.15)] text-[hsl(var(--field-danger))] border border-[hsl(var(--field-danger)/0.3)]",
  },
};

export default function FieldClients() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useStaffUser();
  const [search, setSearch] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["field-clients-orders", user?.id],
    enabled: !!user?.id,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const result = await fetchOrderList({ mine: true });
      return result?.orders ?? [];
    },
  });

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`field-clients-live-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
           table: "field_sales_orders",
           filter: `salesperson_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["field-clients-orders", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  const clients = useMemo(() => {
    const seen = new Map<string, any>();

    for (const order of orders) {
      const key = [order.customer_email || "", order.customer_phone || "", order.customer_name || ""]
        .join("|")
        .toLowerCase();

      if (!key.replace(/\|/g, "").trim()) continue;
      if (seen.has(key)) continue;

      const services = Array.isArray(order.services) ? order.services : [];
      const activePlan = services
        .map((service: any) => service?.name)
        .filter(Boolean)
        .join(", ");

      seen.set(key, {
        orderId: order.id,
        customer_name: order.customer_name || "Client sans nom",
        customer_email: order.customer_email || null,
        customer_phone: order.customer_phone || null,
        payment_status: order.payment_status || "pending",
        total_amount: Number(order.total_amount ?? 0),
        activePlan: activePlan || "—",
        updated_at: order.updated_at || order.created_at,
      });
    }

    return Array.from(seen.values());
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;

    return clients.filter((client) =>
      client.customer_name?.toLowerCase().includes(q) ||
      client.customer_phone?.includes(search.trim()) ||
      client.customer_email?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  return (
    <div className="space-y-5 field-page-enter">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Mes clients</h1>
        <p className="text-sm text-[hsl(var(--field-text-muted))] mt-0.5">
          Synchronisé en direct avec vos commandes terrain
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--field-text-dim))]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, téléphone, courriel..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] text-sm text-white placeholder:text-[hsl(var(--field-text-dim))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--field-accent)/0.4)] focus:border-[hsl(var(--field-accent))]"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: clients.length, color: "text-white" },
          {
            label: "Payés",
            value: clients.filter((client) => client.payment_status === "confirmed").length,
            color: "text-[hsl(var(--field-success))]",
          },
          {
            label: "En attente",
            value: clients.filter((client) => client.payment_status === "pending").length,
            color: "text-[hsl(var(--field-warning))]",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-[hsl(var(--field-card))] border border-[hsl(var(--field-border-subtle))] rounded-xl p-4 text-center"
          >
            <p className={cn("text-2xl font-bold", item.color)}>{item.value}</p>
            <p className="text-[10px] text-[hsl(var(--field-text-dim))] font-medium uppercase tracking-wider">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--field-accent))]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))]">
          <Users className="h-10 w-10 mx-auto mb-2 text-[hsl(var(--field-text-dim))]" />
          <p className="text-sm text-[hsl(var(--field-text-muted))]">Aucun client trouvé</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((client) => {
            const payBadge = STATUS_BADGE[client.payment_status] || STATUS_BADGE.pending;

            return (
              <button
                key={client.orderId}
                onClick={() => navigate(fieldPath(`/orders/${client.orderId}`))}
                className="w-full text-left p-4 rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] hover:border-[hsl(var(--field-accent)/0.4)] hover:bg-[hsl(var(--field-card-hover))] transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{client.customer_name}</span>
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", payBadge.classes)}>
                        {payBadge.label}
                      </span>
                    </div>
                    <p className="text-xs text-[hsl(var(--field-text-muted))] mt-0.5">
                      {client.activePlan} • {client.total_amount.toFixed(2)} $
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      {client.customer_phone && (
                        <span className="text-[10px] text-[hsl(var(--field-text-dim))] flex items-center gap-1">
                          <Phone className="h-2.5 w-2.5" />
                          {client.customer_phone}
                        </span>
                      )}
                      {client.customer_email && (
                        <span className="text-[10px] text-[hsl(var(--field-text-dim))] flex items-center gap-1">
                          <Mail className="h-2.5 w-2.5" />
                          {client.customer_email}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[hsl(var(--field-text-dim))]" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
