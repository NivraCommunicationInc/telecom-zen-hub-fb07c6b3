/**
 * FieldClients — Uses searchCustomers from service layer for address lookup. No direct DB queries.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchCustomers } from "@/field-app/lib/fieldServices";
import { useNavigate } from "react-router-dom";
import { Users, Loader2, Search, Phone, ChevronRight, CheckCircle2, XCircle, AlertTriangle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { fetchOrderList } from "@/field-app/lib/fieldServices";

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  confirmed: { label: "Payé", classes: "bg-[#DCFCE7] text-[#16A34A]" },
  pending: { label: "En attente", classes: "bg-[#FEF3C7] text-[#D97706]" },
  cancelled: { label: "Annulé", classes: "bg-[#FEE2E2] text-[#DC2626]" },
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
    ? clients.filter((c: any) => c.customer_name?.toLowerCase().includes(search.toLowerCase()) || c.customer_phone?.includes(search) || c.customer_email?.toLowerCase().includes(search.toLowerCase()))
    : clients;

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-[#000000] tracking-tight">Mes clients</h1><p className="text-sm text-[#6B7280] mt-0.5">{clients.length} client{clients.length !== 1 ? "s" : ""}</p></div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom, téléphone, courriel..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#000000] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E]" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[{ label: "Total clients", value: clients.length, color: "text-[#000000]" }, { label: "Payés", value: clients.filter((c: any) => c.payment_status === "confirmed").length, color: "text-[#16A34A]" }, { label: "En attente", value: clients.filter((c: any) => c.payment_status === "pending").length, color: "text-[#D97706]" }].map((s) => (
          <div key={s.label} className="bg-white border border-[#E5E7EB] rounded-xl p-4 text-center"><p className={cn("text-2xl font-bold", s.color)}>{s.value}</p><p className="text-[10px] text-[#9CA3AF] font-medium">{s.label}</p></div>
        ))}
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12"><Users className="h-8 w-8 mx-auto mb-2 text-[#D1D5DB]" /><p className="text-sm text-[#9CA3AF]">Aucun client trouvé</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((client: any) => {
            const payBadge = STATUS_BADGE[client.payment_status] || STATUS_BADGE.pending;
            return (
              <button key={client.orderId} onClick={() => navigate(fieldPath(`/orders/${client.orderId}`))} className="w-full text-left p-4 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#D1D5DB] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#000000]">{client.customer_name}</span>
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", payBadge.classes)}>{payBadge.label}</span>
                    </div>
                    <p className="text-xs text-[#6B7280] mt-0.5">{client.activePlan} • {client.total_amount?.toFixed(2)} $</p>
                    {client.customer_phone && <span className="text-[10px] text-[#6B7280] flex items-center gap-0.5 mt-0.5"><Phone className="h-2.5 w-2.5" />{client.customer_phone}</span>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#D1D5DB]" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
