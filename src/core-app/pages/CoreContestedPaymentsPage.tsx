/**
 * CoreContestedPaymentsPage — Transferred from AdminContestedPayments.tsx
 * Payment disputes management
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Search } from "lucide-react";

const formatCAD = (amount: number | null | undefined) =>
  Number(amount ?? 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

export default function CoreContestedPaymentsPage() {
  const [search, setSearch] = useState("");

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ["core-payment-disputes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("billing_payments")
        .select("*, billing_customers(first_name, last_name, email), billing_invoices(invoice_number)")
        .eq("status", "disputed")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const filteredDisputes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return disputes;
    return disputes.filter((d: any) => {
      const c = d.billing_customers;
      return [d.payment_number, d.billing_invoices?.invoice_number, c?.first_name, c?.last_name, c?.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [disputes, search]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-core-text-primary flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-core-danger" /> Contestations de paiements
        </h1>
        <p className="text-sm text-core-text-secondary">{disputes.length} litige{disputes.length > 1 ? "s" : ""}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-core-text-label" />
          <Input placeholder="Paiement, facture, client, email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-core-card-raised border-core-border-strong text-core-text-primary" />
        </div>
        <span className="text-xs text-core-text-label">{filteredDisputes.length} résultat{filteredDisputes.length > 1 ? "s" : ""}</span>
      </div>
      <div className="space-y-2">
        {isLoading && <div className="text-center py-12 text-core-text-label">Chargement…</div>}
        {!isLoading && filteredDisputes.map((d: any) => (
          <div key={d.id} className="p-3 rounded-lg border border-core-border bg-core-card flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-core-text-primary truncate">{d.payment_number} — {(d as any).billing_customers?.first_name} {(d as any).billing_customers?.last_name}</p>
              <p className="text-xs text-core-text-secondary truncate">Facture: {(d as any).billing_invoices?.invoice_number ?? "—"} · {formatCAD(d.amount)}</p>
            </div>
            <Badge className="bg-core-danger/15 text-core-danger border-0 shrink-0">Contesté</Badge>
          </div>
        ))}
        {!isLoading && filteredDisputes.length === 0 && <div className="text-center py-12 text-core-text-label">Aucune contestation active</div>}
      </div>
    </div>
  );
}
