import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, CreditCard, ExternalLink } from "lucide-react";

interface Row {
  id: string;
  amount: number;
  created_at: string;
  received_at: string | null;
  provider_payment_id: string | null;
  square_payment_id: string | null;
  square_receipt_url: string | null;
  payer_ip: string | null;
  invoice: { invoice_number: string | null; customer: { first_name: string | null; last_name: string | null; email: string | null } | null } | null;
}

export default function CorePublicPaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["core-public-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_payments")
        .select(
          "id, amount, created_at, received_at, provider_payment_id, square_payment_id, square_receipt_url, payer_ip, invoice:billing_invoices(invoice_number, customer:billing_customers(first_name, last_name, email))",
        )
        .eq("source", "public_pay")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as Row[];
    },
  });

  const fmt = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Paiements publics</h1>
          <p className="text-sm text-muted-foreground">Paiements reçus via la page publique /payer</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement…
          </div>
        ) : !data || data.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Aucun paiement public à afficher.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Client</th>
                  <th className="p-3 font-medium">Facture</th>
                  <th className="p-3 font-medium text-right">Montant</th>
                  <th className="p-3 font-medium">Réf Square</th>
                  <th className="p-3 font-medium">IP</th>
                  <th className="p-3 font-medium">Reçu</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => {
                  const c = r.invoice?.customer;
                  const name = c ? `${c.first_name || ""} ${c.last_name || ""}`.trim() : "—";
                  const ref = r.square_payment_id || r.provider_payment_id || "—";
                  const dt = new Date(r.received_at || r.created_at).toLocaleString("fr-CA");
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 whitespace-nowrap">{dt}</td>
                      <td className="p-3">
                        <div>{name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{c?.email || ""}</div>
                      </td>
                      <td className="p-3 font-mono text-xs">{r.invoice?.invoice_number || "—"}</td>
                      <td className="p-3 text-right font-medium">{fmt(Number(r.amount))}</td>
                      <td className="p-3 font-mono text-xs">{ref.slice(0, 16)}…</td>
                      <td className="p-3 font-mono text-xs">{r.payer_ip || "—"}</td>
                      <td className="p-3">
                        {r.square_receipt_url ? (
                          <a href={r.square_receipt_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                            Voir <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
