/**
 * CorePromotionsPage — Marketing & Billing Promotions Console
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tag, Search, Plus, Percent, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export default function CorePromotionsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "expired">("all");
  const [selected, setSelected] = useState<any>(null);

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ["core-promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const now = new Date();
  const getPromoStatus = (p: any) => {
    if (!p.is_active) return "inactive";
    if (p.expires_at && new Date(p.expires_at) < now) return "expired";
    return "active";
  };

  const filtered = promotions.filter((p: any) => {
    const s = getPromoStatus(p);
    if (statusFilter !== "all" && s !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.code?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
    }
    return true;
  });

  const activeCount = promotions.filter((p: any) => getPromoStatus(p) === "active").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F8FAFC]">Promotions & codes promo</h1>
          <p className="text-xs text-[#94A3B8]">{activeCount} actives • {promotions.length} total</p>
        </div>
        <Tag className="h-5 w-5 text-emerald-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Code, description…"
            className="w-full h-8 pl-8 pr-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "active", "inactive", "expired"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === s
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                  : "text-[#94A3B8] border border-[hsl(220,15%,18%)] hover:text-[#CBD5E1]"
              }`}
            >
              {s === "all" ? "Toutes" : s === "active" ? "Actives" : s === "inactive" ? "Inactives" : "Expirées"}
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
                {["Code", "Type", "Valeur", "Utilisations", "Limite", "Expiration", "Statut"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(220,15%,14%)]">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-3 py-3"><div className="h-4 bg-[hsl(220,15%,14%)] rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-[#64748B]">Aucune promotion trouvée</td></tr>
              ) : (
                filtered.map((p: any) => {
                  const status = getPromoStatus(p);
                  const statusStyles = status === "active" ? "bg-emerald-500/15 text-emerald-400"
                    : status === "expired" ? "bg-red-500/15 text-red-400"
                    : "bg-[#64748B]/20 text-[#64748B]";
                  return (
                    <tr key={p.id} onClick={() => setSelected(p)} className="hover:bg-[hsl(220,15%,13%)] cursor-pointer transition-colors">
                      <td className="px-3 py-2.5 font-mono text-[#38BDF8] font-medium">{p.code}</td>
                      <td className="px-3 py-2.5 text-[#CBD5E1]">
                        {p.discount_type === "percentage" ? <Percent className="h-3.5 w-3.5 inline mr-1" /> : <DollarSign className="h-3.5 w-3.5 inline mr-1" />}
                        {p.discount_type === "percentage" ? "Pourcentage" : "Montant fixe"}
                      </td>
                      <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">
                        {p.discount_type === "percentage" ? `${p.discount_value}%` : `${Number(p.discount_value).toFixed(2)} $`}
                      </td>
                      <td className="px-3 py-2.5 text-[#CBD5E1]">{p.current_uses ?? 0}</td>
                      <td className="px-3 py-2.5 text-[#94A3B8]">{p.max_uses ?? "∞"}</td>
                      <td className="px-3 py-2.5 text-[#94A3B8]">{p.expires_at ? format(new Date(p.expires_at), "dd MMM yyyy", { locale: fr }) : "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${statusStyles}`}>
                          {status === "active" ? "Active" : status === "expired" ? "Expirée" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md bg-[hsl(220,20%,9%)] border-l border-[hsl(220,15%,16%)] text-[#F8FAFC] overflow-y-auto">
          <SheetHeader><SheetTitle className="text-[#F8FAFC]">Détail promotion</SheetTitle></SheetHeader>
          {selected && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                {[
                  ["Code", selected.code],
                  ["Description", selected.description],
                  ["Type", selected.discount_type === "percentage" ? "Pourcentage" : "Montant fixe"],
                  ["Valeur", selected.discount_type === "percentage" ? `${selected.discount_value}%` : `${Number(selected.discount_value).toFixed(2)} $`],
                  ["Utilisations", `${selected.current_uses ?? 0} / ${selected.max_uses ?? "∞"}`],
                  ["Expiration", selected.expires_at ? format(new Date(selected.expires_at), "dd MMM yyyy HH:mm", { locale: fr }) : "Sans expiration"],
                  ["Scope", selected.scope || "global"],
                  ["Statut", getPromoStatus(selected) === "active" ? "Active" : getPromoStatus(selected) === "expired" ? "Expirée" : "Inactive"],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between text-[12px]">
                    <span className="text-[#94A3B8]">{l}</span>
                    <span className="text-[#F8FAFC] font-medium text-right max-w-[200px]">{v || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
