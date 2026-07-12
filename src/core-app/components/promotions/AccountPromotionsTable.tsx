/**
 * AccountPromotionsTable — Onglet "Assignations actives" de la page Promotions Core.
 * Lit `account_promotions` (source de vérité pour les rabais récurrents appliqués
 * automatiquement par `renew_subscription` → `apply_active_account_promotions_to_invoice`).
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, ToggleRight, ToggleLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AccountPromoRow {
  id: string;
  account_id: string;
  promo_code: string | null;
  label: string;
  promotion_type: string;
  amount: number;
  duration_months: number;
  months_remaining: number;
  is_active: boolean;
  started_at: string;
  expires_at: string | null;
  created_at: string;
  account_number: string | null;
  account_email: string | null;
}

export default function AccountPromotionsTable() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "expired">("active");

  const { data = [], isLoading } = useQuery({
    queryKey: ["core-account-promotions", statusFilter],
    queryFn: async (): Promise<AccountPromoRow[]> => {
      let q = supabase
        .from("account_promotions")
        .select("id, account_id, promo_code, label, promotion_type, amount, duration_months, months_remaining, is_active, started_at, expires_at, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (statusFilter === "active") q = q.eq("is_active", true).gt("months_remaining", 0);
      if (statusFilter === "expired") q = q.or("is_active.eq.false,months_remaining.eq.0");
      const { data: rows, error } = await q;
      if (error) throw error;
      const accountIds = Array.from(new Set((rows || []).map((r: any) => r.account_id).filter(Boolean)));
      let accountMap: Record<string, { account_number: string | null; email: string | null }> = {};
      if (accountIds.length > 0) {
        const { data: accs } = await supabase
          .from("accounts")
          .select("id, account_number, contact_email")
          .in("id", accountIds);
        (accs || []).forEach((a: any) => {
          accountMap[a.id] = { account_number: a.account_number || null, email: a.contact_email || null };
        });
      }
      return (rows || []).map((r: any) => ({
        ...r,
        account_number: accountMap[r.account_id]?.account_number || null,
        account_email: accountMap[r.account_id]?.email || null,
      }));
    },
  });

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((r) =>
      (r.promo_code || "").toLowerCase().includes(q) ||
      (r.label || "").toLowerCase().includes(q) ||
      (r.account_number || "").toLowerCase().includes(q) ||
      (r.account_email || "").toLowerCase().includes(q),
    );
  }, [data, search]);

  const deactivate = async (id: string) => {
    const { error } = await supabase.from("account_promotions").update({ is_active: false }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Promotion désactivée");
    qc.invalidateQueries({ queryKey: ["core-account-promotions"] });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Compte, courriel, code…"
            className="w-full h-8 pl-8 pr-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50" />
        </div>
        <div className="flex gap-1.5">
          {(["active", "expired", "all"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${statusFilter === s ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "text-[#94A3B8] border border-[hsl(220,15%,18%)] hover:text-[#CBD5E1]"}`}>
              {s === "active" ? "Actives" : s === "expired" ? "Expirées" : "Toutes"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["Compte", "Code", "Label", "Type", "Montant", "Mois restants", "Prochaine facture", "Statut", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(220,15%,14%)]">
              {isLoading ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-[#64748B]"><Loader2 className="inline h-4 w-4 animate-spin" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-[#64748B]">Aucune assignation</td></tr>
              ) : (
                filtered.map((r) => {
                  const active = r.is_active && r.months_remaining > 0;
                  const nextAmount = active && r.promotion_type === "monthly_discount"
                    ? `- ${Number(r.amount).toFixed(2)} $`
                    : "—";
                  return (
                    <tr key={r.id} className="hover:bg-[hsl(220,15%,13%)] transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="text-[#F8FAFC] font-medium">{r.account_number || r.account_id.slice(0, 8)}</div>
                        {r.account_email && <div className="text-[10px] text-[#94A3B8]">{r.account_email}</div>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[#38BDF8]">{r.promo_code || "—"}</td>
                      <td className="px-3 py-2.5 text-[#CBD5E1]">{r.label}</td>
                      <td className="px-3 py-2.5 text-[#94A3B8] text-[11px]">{r.promotion_type}</td>
                      <td className="px-3 py-2.5 text-[#F8FAFC]">{Number(r.amount).toFixed(2)} $</td>
                      <td className="px-3 py-2.5 text-[#F8FAFC]">{r.months_remaining} / {r.duration_months}</td>
                      <td className="px-3 py-2.5 text-emerald-400 font-medium">{nextAmount}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${active ? "bg-emerald-500/15 text-emerald-400" : "bg-[#64748B]/20 text-[#64748B]"}`}>
                          {active ? "Actif" : r.months_remaining === 0 ? "Terminé" : "Désactivé"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {active && (
                          <button onClick={() => deactivate(r.id)} title="Désactiver"
                            className="h-6 w-6 flex items-center justify-center rounded border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-red-400 transition-colors">
                            <ToggleRight className="h-3 w-3" />
                          </button>
                        )}
                        {!active && <ToggleLeft className="h-3 w-3 text-[#64748B] mx-2" />}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-3 py-2 text-[11px] text-[#64748B] border-t border-[hsl(220,15%,14%)]">
            {filtered.length} assignation{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
            {statusFilter === "active" && " • Appliquées automatiquement à chaque renouvellement mensuel"}
          </div>
        )}
      </div>
    </div>
  );
}
