/**
 * CoreRecouvrementPage — Transferred from AdminRecouvrement.tsx
 * Collections / renewal management for prepaid telecom
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Search, DollarSign, Clock, Users, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function CoreRecouvrementPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const { data: overdueInvoices = [], isLoading } = useQuery({
    queryKey: ["core-recouvrement"],
    queryFn: async () => {
      const { data } = await supabase.from("billing_invoices")
        .select("*, billing_customers(first_name, last_name, email, phone)")
        .in("status", ["overdue", "issued"])
        .order("due_date", { ascending: true }).limit(200);
      return data || [];
    },
  });

  const filtered = overdueInvoices.filter((inv: any) => {
    if (search) {
      const c = (inv as any).billing_customers;
      const haystack = [c?.first_name, c?.last_name, c?.email, inv.invoice_number].join(" ").toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    if (filter === "overdue") return inv.status === "overdue";
    if (filter === "issued") return inv.status === "issued";
    return true;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Recouvrement</h1>
        <p className="text-sm text-[hsl(var(--core-text-secondary))]">Gestion des renouvellements et factures en attente</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-red-400" /><span className="text-xs text-[hsl(var(--core-text-label))]">En souffrance</span></div>
          <p className="text-2xl font-bold text-[hsl(var(--core-text-primary))]">{overdueInvoices.filter((i: any) => i.status === "overdue").length}</p>
        </div>
        <div className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-400" /><span className="text-xs text-[hsl(var(--core-text-label))]">Émises</span></div>
          <p className="text-2xl font-bold text-[hsl(var(--core-text-primary))]">{overdueInvoices.filter((i: any) => i.status === "issued").length}</p>
        </div>
        <div className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-sky-400" /><span className="text-xs text-[hsl(var(--core-text-label))]">Montant total</span></div>
          <p className="text-2xl font-bold text-[hsl(var(--core-text-primary))]">{overdueInvoices.reduce((s: number, i: any) => s + (i.balance_due || i.total || 0), 0).toFixed(2)}$</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" />
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="overdue">En souffrance</SelectItem><SelectItem value="issued">Émises</SelectItem></SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.map((inv: any) => {
          const c = (inv as any).billing_customers;
          return (
            <div key={inv.id} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{inv.invoice_number} — {c?.first_name} {c?.last_name}</p>
                <p className="text-xs text-[hsl(var(--core-text-secondary))]">{c?.email} · Échéance: {inv.due_date && format(new Date(inv.due_date), "d MMM yyyy", { locale: fr })}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">{(inv.balance_due || inv.total)?.toFixed(2)}$</span>
                <Badge className={inv.status === "overdue" ? "bg-red-500/15 text-red-400 border-0" : "bg-amber-500/15 text-amber-400 border-0"}>{inv.status}</Badge>
              </div>
            </div>
          );
        })}
        {!isLoading && filtered.length === 0 && <div className="text-center py-12 text-[hsl(var(--core-text-label))]">Aucune facture en recouvrement</div>}
      </div>
    </div>
  );
}
