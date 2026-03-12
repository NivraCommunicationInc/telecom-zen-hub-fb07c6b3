/**
 * CoreContestedPaymentsPage — Transferred from AdminContestedPayments.tsx
 * Payment disputes management
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gavel, Search } from "lucide-react";

export default function CoreContestedPaymentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: disputes = [] } = useQuery({
    queryKey: ["core-payment-disputes", statusFilter],
    queryFn: async () => {
      let q = supabase.from("billing_payments")
        .select("*, billing_customers(first_name, last_name, email), billing_invoices(invoice_number)")
        .eq("status", "disputed")
        .order("created_at", { ascending: false }).limit(200);
      const { data } = await q;
      return data || [];
    },
  });

  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Contestations de paiements</h1>
        <p className="text-sm text-[hsl(var(--core-text-secondary))]">{disputes.length} litiges</p></div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" />
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" /></div>
      </div>
      <div className="space-y-2">
        {disputes.map((d: any) => (
          <div key={d.id} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{d.payment_number} — {(d as any).billing_customers?.first_name} {(d as any).billing_customers?.last_name}</p>
              <p className="text-xs text-[hsl(var(--core-text-secondary))]">Facture: {(d as any).billing_invoices?.invoice_number} · {d.amount?.toFixed(2)}$</p>
            </div>
            <Badge className="bg-red-500/15 text-red-400 border-0">Contesté</Badge>
          </div>
        ))}
        {disputes.length === 0 && <div className="text-center py-12 text-[hsl(var(--core-text-label))]">Aucune contestation active</div>}
      </div>
    </div>
  );
}
