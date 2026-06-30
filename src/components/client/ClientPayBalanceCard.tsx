import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { AlertCircle, Copy, Send, CreditCard, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const INTERAC_EMAIL = "support@nivra-telecom.ca";
const BACKEND_URL = "https://lacxnbjvcyvhrttprkxr.supabase.co";
const BACKEND_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhY3huYmp2Y3l2aHJ0dHBya3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MjI2NjMsImV4cCI6MjA5NTk5ODY2M30.Jcc89WC7CofMuMc9IRpxzsDsEb-_C7AVgLEbNzdLa2g";

export const ClientPayBalanceCard = () => {
  const { user } = useClientAuth();
  const qc = useQueryClient();
  const { data: canonicalData, isLoading } = useCanonicalClientData(user?.id);
  const [paying, setPaying] = useState(false);
  const [allPaid, setAllPaid] = useState(false);

  const accountNumber =
    (canonicalData?.profile as any)?.account_number ||
    (canonicalData?.account as any)?.account_number ||
    "—";

  const billingCustomer = canonicalData?.billingCustomer as any;
  const customerId = billingCustomer?.id;
  const squareCardId = billingCustomer?.square_card_id;

  const { data } = useQuery({
    queryKey: ["client-balance-summary", user?.id],
    enabled: !!user?.id,
    queryFn: () => {
      const invoices = canonicalData?.invoices || [];
      const CLOSED = ["void", "cancelled", "refunded", "paid", "paid_by_promo"];
      const unpaid = invoices.filter(
        (i: any) => !CLOSED.includes(String(i.status || "")) && Number(i.balance_due) > 0
      );
      const total = Math.round(
        unpaid.reduce((s: number, i: any) => s + (Number(i.balance_due) || 0), 0) * 100
      ) / 100;
      return { totalBalance: total, invoiceCount: unpaid.length, unpaidInvoices: unpaid };
    },
    staleTime: 30_000,
  });

  const copy = (text: string, label: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copié !`));

  const handleSquarePayAll = async () => {
    if (!customerId || !data?.unpaidInvoices?.length) return;
    setPaying(true);
    try {
      let anyFailed = false;
      for (const inv of data.unpaidInvoices) {
        const res = await fetch(`${BACKEND_URL}/functions/v1/square-pay-invoice`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${BACKEND_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ invoice_id: inv.id, customer_id: customerId }),
        });
        const result = await res.json();
        if (!result?.ok) { anyFailed = true; toast.error(`Facture ${inv.invoice_number}: ${result?.error || "Erreur"}`); }
      }
      if (!anyFailed) {
        setAllPaid(true);
        toast.success("Toutes les factures payées !");
        qc.invalidateQueries({ queryKey: ["canonical-client"] });
      }
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setPaying(false);
    }
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data || data.totalBalance <= 0 || allPaid) return null;

  return (
    <Card className="border-amber-300/50 bg-amber-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-700">
          <AlertCircle className="w-5 h-5" />
          Solde total à payer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground mb-1">
            {data.invoiceCount} facture{data.invoiceCount > 1 ? "s" : ""} impayée{data.invoiceCount > 1 ? "s" : ""}
          </p>
          <p className="text-3xl font-bold text-amber-700">
            {data.totalBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
          </p>
        </div>

        {/* Option 1 — Square */}
        <div className="rounded-xl border-2 border-primary bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Payer par carte</p>
            <Badge className="ml-auto bg-primary/10 text-primary border-0 text-xs">Recommandé</Badge>
          </div>
          {squareCardId ? (
            <Button onClick={handleSquarePayAll} disabled={paying} className="w-full" size="sm">
              {paying
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Traitement...</>
                : <><CreditCard className="w-4 h-4 mr-2" />Payer {data.totalBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} par carte</>}
            </Button>
          ) : (
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground">Aucune carte enregistrée</p>
              <Button variant="outline" size="sm" asChild className="w-full">
                <a href="/portal/paiement">Enregistrer une carte →</a>
              </Button>
            </div>
          )}
        </div>

        {/* Option 2 — Interac */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Payer par virement Interac</p>
          </div>
          <div className="rounded-xl border border-border bg-background divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Adresse courriel</p>
                <p className="text-sm font-semibold">{INTERAC_EMAIL}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copy(INTERAC_EMAIL, "Courriel")}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Montant</p>
                <p className="text-sm font-semibold">
                  {data.totalBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copy(data.totalBalance.toFixed(2), "Montant")}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Réponse à la question de sécurité</p>
                <p className="text-sm font-bold">{accountNumber}</p>
                <p className="text-xs text-amber-600 mt-0.5">⚠️ Utilisez exactement ce numéro</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copy(String(accountNumber), "Numéro de compte")}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Traitement automatique dès réception du paiement.
        </p>
      </CardContent>
    </Card>
  );
};

export default ClientPayBalanceCard;
