/**
 * CoreContestedInvoicesPage — Transferred from AdminContestedInvoices.tsx
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileText, Search } from "lucide-react";

const formatCAD = (amount: number | null | undefined) =>
  Number(amount ?? 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

export default function CoreContestedInvoicesPage() {
  const [search, setSearch] = useState("");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["core-contested-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("billing_invoices")
        .select("*, billing_customers(first_name, last_name, email)")
        .eq("status", "disputed")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv: any) => {
      const c = inv.billing_customers;
      return [inv.invoice_number, c?.first_name, c?.last_name, c?.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [invoices, search]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-core-text-primary flex items-center gap-2">
          <FileText className="w-5 h-5 text-core-warning" /> Factures contestées
        </h1>
        <p className="text-sm text-core-text-secondary">{invoices.length} facture{invoices.length > 1 ? "s" : ""} en litige</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-core-text-label" />
          <Input placeholder="Facture, client, email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-core-card-raised border-core-border-strong text-core-text-primary" />
        </div>
        <span className="text-xs text-core-text-label">{filteredInvoices.length} résultat{filteredInvoices.length > 1 ? "s" : ""}</span>
      </div>
      <div className="space-y-2">
        {isLoading && <div className="text-center py-12 text-core-text-label">Chargement…</div>}
        {!isLoading && filteredInvoices.map((inv: any) => (
          <div key={inv.id} className="p-3 rounded-lg border border-core-border bg-core-card flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-core-text-primary truncate">{inv.invoice_number}</p>
              <p className="text-xs text-core-text-secondary truncate">{(inv as any).billing_customers?.first_name} {(inv as any).billing_customers?.last_name} · {formatCAD(inv.total)}</p>
            </div>
            <Badge className="bg-core-danger/15 text-core-danger border-0 shrink-0">Contestée</Badge>
          </div>
        ))}
        {!isLoading && filteredInvoices.length === 0 && <div className="text-center py-12 text-core-text-label">Aucune facture contestée</div>}
      </div>
    </div>
  );
}
