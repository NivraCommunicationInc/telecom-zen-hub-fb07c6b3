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
  new: { label: "Nouveau", classes: "bg-[#FEF3C7] text-[#D97706]" },
  contacted: { label: "Contacté", classes: "bg-[#E0E7FF] text-[#4338CA]" },
  qualified: { label: "Qualifié", classes: "bg-[#FEF3C7] text-[#D97706]" },
  submitted: { label: "Soumis", classes: "bg-[#DBEAFE] text-[#1D4ED8]" },
  won: { label: "Gagné", classes: "bg-[#DCFCE7] text-[#16A34A]" },
  lost: { label: "Perdu", classes: "bg-[#FEE2E2] text-[#DC2626]" },
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
        <h1 className="text-xl font-bold text-[#000000]">Mes leads</h1>
        <button onClick={() => navigate(fieldPath("/sale/new"))} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#22C55E] text-white text-sm font-medium hover:bg-[#16A34A] transition-colors"><Plus className="h-4 w-4" />Nouvelle vente</button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#000000] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E]" />
      </div>
      <div className="flex gap-1 flex-wrap">
        {[{ key: "all", label: "Tous" }, { key: "new", label: "Nouveaux" }, { key: "contacted", label: "Contactés" }, { key: "qualified", label: "Qualifiés" }, { key: "submitted", label: "Soumis" }].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-colors border", filter === f.key ? "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]" : "text-[#6B7280] border-transparent hover:bg-[#F3F4F6]")}>{f.label}</button>
        ))}
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12"><UserPlus className="h-8 w-8 mx-auto mb-2 text-[#D1D5DB]" /><p className="text-sm text-[#9CA3AF]">Aucun lead trouvé</p></div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead: any) => {
            const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
            return (
              <button key={lead.id} onClick={() => navigate(fieldPath(`/leads/${lead.id}`))} className="w-full text-left p-4 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#D1D5DB] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#000000]">{lead.first_name} {lead.last_name}</span>
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", sc.classes)}>{sc.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[#6B7280]">
                      {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
                      {lead.service_need && <span>{lead.service_need}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#9CA3AF]">{formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: fr })}</span>
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
