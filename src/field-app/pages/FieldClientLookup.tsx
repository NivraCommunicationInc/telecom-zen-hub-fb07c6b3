/**
 * FieldClientLookup — Uses searchCustomers from service layer. No direct DB queries.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchCustomers } from "@/field-app/lib/fieldServices";
import { Search, MapPin, Loader2, CheckCircle2, XCircle, AlertTriangle, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FieldClientLookup() {
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["field-address-lookup", submittedSearch],
    queryFn: () => searchCustomers(submittedSearch),
    enabled: !!submittedSearch.trim(),
  });

  const handleSearch = () => setSubmittedSearch(search);

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold text-white">Recherche adresse</h1><p className="text-sm text-gray-400">Vérifiez la disponibilité du service avant de visiter une adresse</p></div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Adresse ou code postal…" className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-700 bg-gray-800 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E]" />
        </div>
        <button onClick={handleSearch} disabled={!search.trim()} className="px-5 py-3 rounded-xl bg-[#22C55E] text-white text-sm font-bold hover:bg-[#16A34A] disabled:opacity-40 transition-colors">Vérifier</button>
      </div>
      {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-emerald-400" /></div>}
      {data && (
        <div className="space-y-4">
          <div className={cn("p-5 rounded-2xl border-2", data.isAvailable ? "bg-emerald-500/15 border-emerald-500/30" : data.hasExistingService ? "bg-[#FEF2F2] border-[#FECACA]" : "bg-[#FFFBEB] border-[#FDE68A]")}>
            <div className="flex items-center gap-3">
              {data.isAvailable ? <CheckCircle2 className="h-8 w-8 text-emerald-400" /> : data.hasExistingService ? <XCircle className="h-8 w-8 text-red-400" /> : <AlertTriangle className="h-8 w-8 text-amber-300" />}
              <div>
                <p className="text-lg font-bold text-white">{data.isAvailable ? "Adresse disponible ✅" : data.hasExistingService ? "Client existant ❌" : "Commande en cours ⚠️"}</p>
                <p className="text-sm text-gray-400">{data.isAvailable ? "Aucun service actif — vous pouvez proposer nos offres" : data.hasExistingService ? "Un compte actif existe déjà" : "Une commande est en cours de traitement"}</p>
              </div>
            </div>
          </div>
          {data.accounts?.length > 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Comptes existants ({data.accounts.length})</h3></div>
              <div className="divide-y divide-[#F3F4F6]">
                {data.accounts.map((acc: any) => (
                  <div key={acc.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2"><User className="h-4 w-4 text-gray-400" /><div><p className="text-sm font-medium text-white">{acc.account_number}</p><p className="text-[10px] text-gray-400">{acc.primary_service_address}</p></div></div>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", acc.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-700 text-gray-400")}>{acc.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.fieldOrders?.length > 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ventes terrain ({data.fieldOrders.length})</h3></div>
              <div className="divide-y divide-[#F3F4F6]">
                {data.fieldOrders.map((fo: any) => (
                  <div key={fo.id} className="px-4 py-3 flex items-center justify-between">
                    <div><p className="text-sm font-medium text-white">{fo.customer_name}</p><p className="text-[10px] text-gray-400">{fo.customer_address}</p></div>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", fo.sync_status === "synced" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-300")}>{fo.sync_status === "synced" ? "Sync" : fo.payment_status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {!data && !isLoading && (
        <div className="text-center py-16"><MapPin className="h-12 w-12 mx-auto mb-3 text-[#D1D5DB]" /><p className="text-sm text-gray-500">Entrez une adresse pour vérifier la couverture</p></div>
      )}
    </div>
  );
}
