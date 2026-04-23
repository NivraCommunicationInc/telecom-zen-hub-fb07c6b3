/**
 * FieldClients — Real clients linked to the agent's orders (mine: true).
 * Dark theme: Navy bg + white text + purple accents.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Users, Loader2, Search, Phone, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { fetchOrderList } from "@/field-app/lib/fieldServices";

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  confirmed: { label: "Payé", classes: "bg-[hsl(var(--field-success)/0.15)] text-[hsl(var(--field-success))] border border-[hsl(var(--field-success)/0.3)]" },
  pending: { label: "En attente", classes: "bg-[hsl(var(--field-warning)/0.15)] text-[hsl(var(--field-warning))] border border-[hsl(var(--field-warning)/0.3)]" },
  cancelled: { label: "Annulé", classes: "bg-[hsl(var(--field-danger)/0.15)] text-[hsl(var(--field-danger))] border border-[hsl(var(--field-danger)/0.3)]" },
};

export default function FieldClients() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["field-clients-orders"],
    queryFn: () => fetchOrderList({ mine: true }),
  });

  const orders = data?.orders || [];

  // Deduplicate by customer name+phone
  const seen = new Map<string, any>();
  for (const order of orders) {
    const key = `${order.customer_name}|${order.customer_phone}`;
    if (!seen.has(key)) {
      const services = Array.isArray(order.services) ? order.services : [];
      const planNames = services.map((s: any) => s.name).filter(Boolean).join(", ");
      seen.set(key, { ...order, activePlan: planNames || "—", orderId: order.id });
    }
  }
  const clients = Array.from(seen.values());

  const filtered = search.trim()
    ? clients.filter((c: any) =>
        c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.customer_phone?.includes(search) ||
        c.customer_email?.toLowerCase().includes(search.toLowerCase()))
    : clients;

  return (
    <div className="space-y-5 field-page-enter">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Mes clients</h1>
        <p className="text-sm text-[hsl(var(--field-text-muted))] mt-0.5">
          {clients.length} client{clients.length !== 1 ? "s" : ""}
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
          { label: "Payés", value: clients.filter((c: any) => c.payment_status === "confirmed").length, color: "text-[hsl(var(--field-success))]" },
          { label: "En attente", value: clients.filter((c: any) => c.payment_status === "pending").length, color: "text-[hsl(var(--field-warning))]" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-[hsl(var(--field-card))] border border-[hsl(var(--field-border-subtle))] rounded-xl p-4 text-center"
          >
            <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
            <p className="text-[10px] text-[hsl(var(--field-text-dim))] font-medium uppercase tracking-wider">
              {s.label}
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
          {filtered.map((client: any) => {
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
                      {client.activePlan} • {Number(client.total_amount ?? 0).toFixed(2)} $
                    </p>
                    {client.customer_phone && (
                      <span className="text-[10px] text-[hsl(var(--field-text-dim))] flex items-center gap-1 mt-0.5">
                        <Phone className="h-2.5 w-2.5" />
                        {client.customer_phone}
                      </span>
                    )}
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
