/**
 * EmployeePayments — Payment operational handling.
 * Sections: Manual pending, Confirmed, Failed.
 * READ-ONLY canonical amounts. Operational actions only.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";

type PaymentTab = "manual" | "confirmed" | "failed";

const TABS: { key: PaymentTab; label: string; icon: typeof Clock }[] = [
  { key: "manual", label: "En attente", icon: Clock },
  { key: "confirmed", label: "Confirmés", icon: CheckCircle },
  { key: "failed", label: "Échoués", icon: XCircle },
];

function useEmployeePayments(tab: PaymentTab) {
  return useQuery({
    queryKey: ["employee-payments", tab],
    queryFn: async () => {
      let query = supabase
        .from("billing_payments")
        .select("id, payment_number, amount, method, status, created_at, reference, customer_id, invoice_id")
        .eq("environment", "live")
        .order("created_at", { ascending: false })
        .limit(50);

      switch (tab) {
        case "manual": query = query.eq("status", "pending"); break;
        case "confirmed": query = query.eq("status", "confirmed"); break;
        case "failed": query = query.in("status", ["failed", "declined", "cancelled"]); break;
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export default function EmployeePayments() {
  const [tab, setTab] = useState<PaymentTab>("manual");
  const { data: payments = [], isLoading } = useEmployeePayments(tab);

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: "text-amber-400 bg-amber-500/10",
      confirmed: "text-emerald-400 bg-emerald-500/10",
      failed: "text-red-400 bg-red-500/10",
      declined: "text-red-400 bg-red-500/10",
      cancelled: "text-[hsl(220,10%,50%)] bg-[hsl(220,15%,15%)]",
    };
    return map[s] ?? "text-[hsl(220,10%,50%)] bg-[hsl(220,15%,15%)]";
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Paiements</h1>
        <p className="text-sm text-[hsl(220,10%,45%)]">Gestion opérationnelle des paiements</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              tab === t.key
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "text-[hsl(220,10%,45%)] hover:text-white hover:bg-[hsl(220,15%,12%)] border border-transparent"
            )}
          >
            <t.icon className="h-3 w-3" />
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16">
          <CreditCard className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,25%)]" />
          <p className="text-sm text-[hsl(220,10%,35%)]">Aucun paiement dans cette catégorie.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[hsl(220,15%,13%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)]">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Numéro</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Montant</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Méthode</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Statut</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Référence</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(220,20%,9%)] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-white">{p.payment_number}</td>
                    <td className="px-4 py-3 text-xs text-white font-medium">{p.amount.toFixed(2)} $</td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,50%)]">{p.method}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", statusColor(p.status ?? ""))}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,45%)] font-mono">{p.reference ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,45%)]">
                      {p.created_at ? format(new Date(p.created_at), "d MMM yyyy", { locale: fr }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
