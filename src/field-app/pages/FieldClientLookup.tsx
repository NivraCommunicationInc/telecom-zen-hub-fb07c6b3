/**
 * FieldClientLookup — Quick address/client coverage check.
 * Agents can search by address to check service availability before door-knocking.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, MapPin, Loader2, CheckCircle2, XCircle, AlertTriangle, User, Wifi, Tv } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FieldClientLookup() {
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["field-address-lookup", submittedSearch],
    queryFn: async () => {
      if (!submittedSearch.trim()) return null;
      const q = submittedSearch.trim().toLowerCase();

      // Check existing accounts at this address
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, account_number, status, primary_service_address, primary_service_city, primary_service_postal_code")
        .or(`primary_service_address.ilike.%${q}%,primary_service_postal_code.ilike.%${q}%`)
        .limit(10);

      // Check existing orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, status, service_type, service_address")
        .or(`service_address.ilike.%${q}%`)
        .in("status", ["pending", "processing", "shipped", "delivered", "installed", "activated"])
        .limit(10);

      // Check active subscriptions at address
      const { data: subs } = await supabase
        .from("billing_subscriptions")
        .select("id, plan_name, status, customer_id, billing_subscriptions_address_id_fkey:service_addresses(address, city)")
        .in("status", ["active", "trial"])
        .limit(5);

      // Check field_sales_orders at this address
      const { data: fieldOrders } = await supabase
        .from("field_sales_orders")
        .select("id, customer_name, customer_address, payment_status, sync_status, created_at")
        .ilike("customer_address", `%${q}%`)
        .limit(10);

      const hasExistingService = (accounts || []).some((a: any) => a.status === "active");
      const hasPendingOrder = (orders || []).length > 0 || (fieldOrders || []).length > 0;

      return {
        accounts: accounts || [],
        orders: orders || [],
        fieldOrders: fieldOrders || [],
        hasExistingService,
        hasPendingOrder,
        isAvailable: !hasExistingService && !hasPendingOrder,
      };
    },
    enabled: !!submittedSearch.trim(),
  });

  const handleSearch = () => setSubmittedSearch(search);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#000000]">Recherche adresse</h1>
        <p className="text-sm text-[#6B7280]">Vérifiez la disponibilité du service avant de visiter une adresse</p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Adresse ou code postal…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#000000] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E]"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={!search.trim()}
          className="px-5 py-3 rounded-xl bg-[#22C55E] text-white text-sm font-bold hover:bg-[#16A34A] disabled:opacity-40 transition-colors"
        >
          Vérifier
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Availability status */}
          <div className={cn(
            "p-5 rounded-2xl border-2",
            data.isAvailable
              ? "bg-[#F0FDF4] border-[#BBF7D0]"
              : data.hasExistingService
                ? "bg-[#FEF2F2] border-[#FECACA]"
                : "bg-[#FFFBEB] border-[#FDE68A]"
          )}>
            <div className="flex items-center gap-3">
              {data.isAvailable ? (
                <CheckCircle2 className="h-8 w-8 text-[#16A34A]" />
              ) : data.hasExistingService ? (
                <XCircle className="h-8 w-8 text-[#DC2626]" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-[#D97706]" />
              )}
              <div>
                <p className="text-lg font-bold text-[#000000]">
                  {data.isAvailable ? "Adresse disponible ✅" : data.hasExistingService ? "Client existant ❌" : "Commande en cours ⚠️"}
                </p>
                <p className="text-sm text-[#6B7280]">
                  {data.isAvailable
                    ? "Aucun service actif — vous pouvez proposer nos offres"
                    : data.hasExistingService
                      ? "Un compte actif existe déjà à cette adresse"
                      : "Une commande est en cours de traitement pour cette adresse"
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Existing accounts */}
          {data.accounts.length > 0 && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E5E7EB]">
                <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Comptes existants ({data.accounts.length})</h3>
              </div>
              <div className="divide-y divide-[#F3F4F6]">
                {data.accounts.map((acc: any) => (
                  <div key={acc.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-[#6B7280]" />
                      <div>
                        <p className="text-sm font-medium text-[#000000]">{acc.account_number}</p>
                        <p className="text-[10px] text-[#6B7280]">{acc.primary_service_address}, {acc.primary_service_city}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded",
                      acc.status === "active" ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#F3F4F6] text-[#6B7280]"
                    )}>
                      {acc.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Field orders at address */}
          {data.fieldOrders.length > 0 && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E5E7EB]">
                <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Ventes terrain à cette adresse ({data.fieldOrders.length})</h3>
              </div>
              <div className="divide-y divide-[#F3F4F6]">
                {data.fieldOrders.map((fo: any) => (
                  <div key={fo.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#000000]">{fo.customer_name}</p>
                      <p className="text-[10px] text-[#6B7280]">{fo.customer_address}</p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded",
                      fo.sync_status === "synced" ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#FEF3C7] text-[#D97706]"
                    )}>
                      {fo.sync_status === "synced" ? "Sync" : fo.payment_status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!data && !isLoading && (
        <div className="text-center py-16">
          <MapPin className="h-12 w-12 mx-auto mb-3 text-[#D1D5DB]" />
          <p className="text-sm text-[#9CA3AF]">Entrez une adresse pour vérifier la couverture</p>
          <p className="text-xs text-[#D1D5DB] mt-1">Recherche par adresse civique ou code postal</p>
        </div>
      )}
    </div>
  );
}
