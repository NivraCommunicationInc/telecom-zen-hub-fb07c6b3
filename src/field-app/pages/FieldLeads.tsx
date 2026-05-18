/**
 * FieldLeads — Uses fetchLeads from service layer. No direct DB queries.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchLeads } from "@/field-app/lib/fieldServices";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { UserPlus, Loader2, Phone, ChevronRight, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  new: { label: "Nouveau", classes: "bg-amber-500/20 text-amber-300" },
  contacted: { label: "Contacté", classes: "bg-[#E0E7FF] text-[#4338CA]" },
  qualified: { label: "Qualifié", classes: "bg-amber-500/20 text-amber-300" },
  submitted: { label: "Soumis", classes: "bg-blue-500/20 text-blue-300" },
  won: { label: "Gagné", classes: "bg-emerald-500/20 text-emerald-400" },
  lost: { label: "Perdu", classes: "bg-red-500/20 text-red-400" },
};

export default function FieldLeads() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["field-leads-list", filter, search],
    queryFn: () => fetchLeads({ status: filter !== "all" ? filter : undefined, search: search || undefined }),
  });

  const leads = data?.leads || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Mes leads</h1>
        <button onClick={() => navigate(fieldPath("/sale/new"))} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#22C55E] text-white text-sm font-medium hover:bg-[#16A34A] transition-colors"><Plus className="h-4 w-4" />Nouvelle vente</button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-700 bg-gray-800 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E]" />
      </div>
      <div className="flex gap-1 flex-wrap">
        {[{ key: "all", label: "Tous" }, { key: "new", label: "Nouveaux" }, { key: "contacted", label: "Contactés" }, { key: "qualified", label: "Qualifiés" }, { key: "submitted", label: "Soumis" }].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-colors border", filter === f.key ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "text-gray-400 border-transparent hover:bg-gray-700")}>{f.label}</button>
        ))}
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-emerald-400" /></div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12"><UserPlus className="h-8 w-8 mx-auto mb-2 text-[#D1D5DB]" /><p className="text-sm text-gray-500">Aucun lead trouvé</p></div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead: any) => {
            const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
            return (
              <button key={lead.id} onClick={() => navigate(fieldPath(`/leads/${lead.id}`))} className="w-full text-left p-4 rounded-xl border border-gray-700 bg-gray-800 hover:border-gray-600 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{lead.first_name} {lead.last_name}</span>
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", sc.classes)}>{sc.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
                      {lead.service_need && <span>{lead.service_need}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">{formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: fr })}</span>
                    <ChevronRight className="h-4 w-4 text-[#D1D5DB]" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
