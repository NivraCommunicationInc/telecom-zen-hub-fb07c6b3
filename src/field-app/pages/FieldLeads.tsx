/**
 * FieldLeads — Lead management for field sales agents.
 * List + New lead + Detail views.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import {
  UserPlus, ArrowLeft, Loader2, Phone, Mail, MapPin,
  ChevronRight, Plus, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: "Nouveau", color: "text-blue-400", bg: "bg-blue-500/10" },
  contacted: { label: "Contacté", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  qualified: { label: "Qualifié", color: "text-amber-400", bg: "bg-amber-500/10" },
  submitted: { label: "Soumis", color: "text-purple-400", bg: "bg-purple-500/10" },
  won: { label: "Gagné", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  lost: { label: "Perdu", color: "text-red-400", bg: "bg-red-500/10" },
};

function useFieldLeads() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["field-leads", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_leads")
        .select("*")
        .eq("agent_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}

// ── LIST VIEW ──────────────────────────────────────
export default function FieldLeads() {
  const navigate = useNavigate();
  const { data: leads = [], isLoading } = useFieldLeads();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = leads.filter((l: any) => {
    if (filter !== "all" && l.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.first_name?.toLowerCase().includes(q) ||
        l.last_name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.phone?.includes(q)
      );
    }
    return true;
  });

  const filters = [
    { key: "all", label: "Tous" },
    { key: "new", label: "Nouveaux" },
    { key: "contacted", label: "Contactés" },
    { key: "qualified", label: "Qualifiés" },
    { key: "submitted", label: "Soumis" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Mes leads</h1>
        <button
          onClick={() => navigate(fieldPath("/leads/new"))}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouveau lead
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,35%)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[hsl(225,15%,14%)] bg-[hsl(225,20%,8%)] text-sm text-white placeholder:text-[hsl(220,10%,35%)] focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-1 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
              filter === f.key
                ? "bg-amber-600/20 text-amber-400 border border-amber-500/30"
                : "text-[hsl(220,10%,42%)] hover:text-white border border-transparent"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <UserPlus className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,20%)]" />
          <p className="text-sm text-[hsl(220,10%,35%)]">Aucun lead trouvé</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((lead: any) => {
            const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
            return (
              <button
                key={lead.id}
                onClick={() => navigate(fieldPath(`/leads/${lead.id}`))}
                className="w-full text-left p-4 rounded-xl border border-[hsl(225,15%,12%)] bg-[hsl(225,20%,7%)] hover:bg-[hsl(225,20%,9%)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {lead.first_name} {lead.last_name}
                      </span>
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", sc.color, sc.bg)}>
                        {sc.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-[hsl(220,10%,40%)]">
                      {lead.phone && (
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>
                      )}
                      {lead.service_need && <span>{lead.service_need}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[hsl(220,10%,30%)]">
                      {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: fr })}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[hsl(220,10%,25%)]" />
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
