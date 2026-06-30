import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { AlertCircle, Copy, Send } from "lucide-react";
import { toast } from "sonner";

const INTERAC_EMAIL = "support@nivra-telecom.ca";

export const ClientPayBalanceCard = () => {
  const { user } = useClientAuth();
  const { data: canonicalData, isLoading } = useCanonicalClientData(user?.id);

  const accountNumber =
    (canonicalData?.profile as any)?.account_number ||
    (canonicalData?.account as any)?.account_number ||
    "—";

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
      return { totalBalance: total, invoiceCount: unpaid.length };
    },
    staleTime: 30_000,
  });

  const copy = (text: string, label: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copié !`));

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data || data.totalBalance <= 0) return null;

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
