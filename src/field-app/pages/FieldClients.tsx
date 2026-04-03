/**
 * FieldClients — Client list for field agents.
 * Shows clients from field_sales_orders with active plan, status, commission, quick actions.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { useNavigate } from "react-router-dom";
import {
  Users, Loader2, Search, Phone, Mail, MapPin,
  ChevronRight, CheckCircle2, Clock, XCircle, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  confirmed: { label: "Payé", classes: "bg-[#DCFCE7] text-[#16A34A]" },
  pending: { label: "En attente", classes: "bg-[#FEF3C7] text-[#D97706]" },
  cancelled: { label: "Annulé", classes: "bg-[#FEE2E2] text-[#DC2626]" },
  failed: { label: "Échoué", classes: "bg-[#FEE2E2] text-[#DC2626]" },
};

const SYNC_BADGE: Record<string, { label: string; classes: string }> = {
  synced: { label: "Sync ✓", classes: "bg-[#DCFCE7] text-[#16A34A]" },
  pending: { label: "Sync...", classes: "bg-[#FEF3C7] text-[#D97706]" },
  error: { label: "Erreur", classes: "bg-[#FEE2E2] text-[#DC2626]" },
};

export default function FieldClients() {
  const { user } = useStaffUser();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["field-clients", user?.id],
    queryFn: async () => {
      const [ordersRes, commissionsRes] = await Promise.all([
        supabase.from("field_sales_orders")
          .select("id, customer_name, customer_email, customer_phone, customer_address, services, payment_status, sync_status, total_amount, created_at")
          .eq("salesperson_id", user!.id)
          .order("created_at", { ascending: false }),
        supabase.from("sales_commissions")
          .select("field_order_id, commission_amount, status")
          .eq("salesperson_id", user!.id),
      ]);

      const commissionMap = new Map<string, { amount: number; status: string }>();
      for (const c of commissionsRes.data || []) {
        if (c.field_order_id) {
          commissionMap.set(c.field_order_id, { amount: Number(c.commission_amount || 0), status: c.status });
        }
      }

      // Deduplicate by customer name+phone
      const seen = new Map<string, any>();
      for (const order of ordersRes.data || []) {
        const key = `${order.customer_name}|${order.customer_phone}`;
        if (!seen.has(key)) {
          const services = Array.isArray(order.services) ? order.services : [];
          const planNames = services.map((s: any) => s.name).filter(Boolean).join(", ");
          const commission = commissionMap.get(order.id);
          seen.set(key, {
            ...order,
            activePlan: planNames || "—",
            commission: commission || null,
            orderId: order.id,
          });
        }
      }
      return Array.from(seen.values());
    },
    enabled: !!user?.id,
  });

  const filtered = search.trim()
    ? clients.filter((c: any) => 
        c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.customer_phone?.includes(search) ||
        c.customer_email?.toLowerCase().includes(search.toLowerCase())
      )
    : clients;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#000000] tracking-tight">Mes clients</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">{clients.length} client{clients.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, téléphone, courriel..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#000000] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E]"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total clients", value: clients.length, color: "text-[#000000]" },
          { label: "Payés", value: clients.filter((c: any) => c.payment_status === "confirmed").length, color: "text-[#16A34A]" },
          { label: "En attente", value: clients.filter((c: any) => c.payment_status === "pending").length, color: "text-[#D97706]" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-[#E5E7EB] rounded-xl p-4 text-center">
            <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
            <p className="text-[10px] text-[#9CA3AF] font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Client List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-8 w-8 mx-auto mb-2 text-[#D1D5DB]" />
          <p className="text-sm text-[#9CA3AF]">Aucun client trouvé</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-[#E5E7EB] bg-[#F9FAFB]">
            <span className="col-span-3 text-[10px] font-bold text-[#9CA3AF] uppercase">Client</span>
            <span className="col-span-3 text-[10px] font-bold text-[#9CA3AF] uppercase">Forfait actif</span>
            <span className="col-span-2 text-[10px] font-bold text-[#9CA3AF] uppercase">Statut</span>
            <span className="col-span-2 text-[10px] font-bold text-[#9CA3AF] uppercase">Commission</span>
            <span className="col-span-2 text-[10px] font-bold text-[#9CA3AF] uppercase text-right">Action</span>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {filtered.map((client: any) => {
              const payBadge = STATUS_BADGE[client.payment_status] || STATUS_BADGE.pending;
              const syncBadge = SYNC_BADGE[client.sync_status] || SYNC_BADGE.pending;
              return (
                <div key={client.orderId} className="grid grid-cols-1 sm:grid-cols-12 gap-2 px-4 py-3 hover:bg-[#F9FAFB] transition-colors items-center">
                  {/* Client Info */}
                  <div className="col-span-3 min-w-0">
                    <p className="text-sm font-semibold text-[#000000] truncate">{client.customer_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {client.customer_phone && <span className="text-[10px] text-[#6B7280] flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{client.customer_phone}</span>}
                    </div>
                  </div>
                  {/* Plan */}
                  <div className="col-span-3">
                    <p className="text-xs text-[#374151] truncate">{client.activePlan}</p>
                    <p className="text-[10px] text-[#9CA3AF]">{client.total_amount?.toFixed(2)} $</p>
                  </div>
                  {/* Status */}
                  <div className="col-span-2 flex flex-wrap gap-1">
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", payBadge.classes)}>{payBadge.label}</span>
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", syncBadge.classes)}>{syncBadge.label}</span>
                  </div>
                  {/* Commission */}
                  <div className="col-span-2">
                    {client.commission ? (
                      <div>
                        <p className="text-xs font-bold text-[#000000]">{client.commission.amount.toFixed(2)} $</p>
                        <p className="text-[10px] text-[#6B7280]">{client.commission.status === "paid" ? "Payée" : "En attente"}</p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-[#9CA3AF]">—</p>
                    )}
                  </div>
                  {/* Action */}
                  <div className="col-span-2 flex justify-end gap-1">
                    <button onClick={() => navigate(fieldPath(`/orders/${client.orderId}`))} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-[#F0FDF4] text-[#16A34A] hover:bg-[#DCFCE7] transition-colors flex items-center gap-1">
                      Voir <ChevronRight className="h-3 w-3" />
                    </button>
                    {client.customer_phone && (
                      <a href={`tel:${client.customer_phone}`} className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#22C55E] hover:bg-[#F0FDF4]">
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}