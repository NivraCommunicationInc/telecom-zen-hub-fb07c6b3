import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Wallet, ShieldCheck, CreditCard, ArrowRight } from "lucide-react";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { Link } from "react-router-dom";

export const ClientPaymentMethodCard = () => {
  const { user } = useClientAuth();
  const { data: canonical, isLoading } = useCanonicalClientData(user?.id);

  const squareCardId = (canonical?.billingCustomer as any)?.square_card_id ?? null;
  const hasCard = !!squareCardId;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={hasCard ? "border-emerald-300 bg-emerald-50/40" : "border-border"}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" />
          Mode de paiement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasCard ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Carte de crédit enregistrée ✓
              </Badge>
            </div>
            <div className="space-y-1 text-sm">
              <p className="flex items-center gap-1.5 text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                Votre compte bénéficie d'un rabais de 5 $/mois
              </p>
              <p className="text-muted-foreground">
                Vos factures sont débitées automatiquement à chaque renouvellement.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/portal/paiement">
                Gérer ma carte <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </>
        ) : (
          <>
            <Badge variant="secondary">Paiement manuel</Badge>
            <p className="text-sm text-muted-foreground">
              Enregistrez votre carte de crédit pour activer le paiement automatique et bénéficier d'un rabais de 5 $/mois.
            </p>
            <Button size="sm" className="gap-1" asChild>
              <Link to="/portal/paiement">
                <CreditCard className="h-3 w-3" />
                Enregistrer ma carte
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
