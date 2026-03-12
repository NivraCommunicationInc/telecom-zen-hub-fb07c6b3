/**
 * CoreContestedInvoicesPage — Transferred from AdminContestedInvoices.tsx
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, FileText } from "lucide-react";

export default function CoreContestedInvoicesPage() {
  const [search, setSearch] = useState("");
  const { data: invoices = [] } = useQuery({
    queryKey: ["core-contested-invoices"],
    queryFn: async () => {
      const { data } = await supabase.from("billing_invoices")
        .select("*, billing_customers(first_name, last_name, email)")
        .eq("status", "disputed")
        .order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
  });

  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Factures contestées</h1>
        <p className="text-sm text-[hsl(var(--core-text-secondary))]">{invoices.length} factures en litige</p></div>
      <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" />
        <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" /></div>
      <div className="space-y-2">
        {invoices.map((inv: any) => (
          <div key={inv.id} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{inv.invoice_number}</p>
              <p className="text-xs text-[hsl(var(--core-text-secondary))]">{(inv as any).billing_customers?.first_name} {(inv as any).billing_customers?.last_name} · {inv.total?.toFixed(2)}$</p>
            </div>
            <Badge className="bg-red-500/15 text-red-400 border-0">Contestée</Badge>
          </div>
        ))}
        {invoices.length === 0 && <div className="text-center py-12 text-[hsl(var(--core-text-label))]">Aucune facture contestée</div>}
      </div>
    </div>
  );
}
