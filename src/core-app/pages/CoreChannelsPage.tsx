/**
 * CoreChannelsPage — TV Channel Management Console
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tv, Search, Plus, ToggleLeft, ToggleRight } from "lucide-react";

export default function CoreChannelsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["core-tv-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_channels")
        .select("*")
        .order("channel_number", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = channels.filter((c: any) => {
    if (statusFilter === "active" && !c.is_active) return false;
    if (statusFilter === "inactive" && c.is_active) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name?.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q) || String(c.channel_number).includes(q);
    }
    return true;
  });

  const activeCount = channels.filter((c: any) => c.is_active).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F8FAFC]">Chaînes TV</h1>
          <p className="text-xs text-[#94A3B8]">{activeCount} actives • {channels.length} total</p>
        </div>
        <Tv className="h-5 w-5 text-emerald-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, catégorie, numéro…"
            className="w-full h-8 pl-8 pr-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === s
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                  : "text-[#94A3B8] border border-[hsl(220,15%,18%)] hover:text-[#CBD5E1]"
              }`}
            >
              {s === "all" ? "Toutes" : s === "active" ? "Actives" : "Inactives"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["N°", "Nom", "Langue", "Catégorie", "Statut"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(220,15%,14%)]">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-3 py-3"><div className="h-4 bg-[hsl(220,15%,14%)] rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-[#64748B]">Aucune chaîne trouvée</td></tr>
              ) : (
                filtered.map((c: any) => (
                  <tr key={c.id} className="hover:bg-[hsl(220,15%,13%)] transition-colors">
                    <td className="px-3 py-2.5 font-mono text-[#38BDF8]">{c.channel_number ?? "—"}</td>
                    <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">{c.name}</td>
                    <td className="px-3 py-2.5 text-[#CBD5E1]">{c.language || "—"}</td>
                    <td className="px-3 py-2.5 text-[#CBD5E1]">{c.category || "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        c.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                      }`}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
