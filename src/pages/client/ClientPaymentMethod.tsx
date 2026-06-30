import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send, Copy, Lock } from "lucide-react";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { toast } from "sonner";

const INTERAC_EMAIL = "support@nivra-telecom.ca";

const ClientPaymentMethod = () => {
  const { user } = useClientAuth();
  const { data: canonicalData } = useCanonicalClientData(user?.id);

  const accountNumber =
    (canonicalData?.profile as any)?.account_number ||
    (canonicalData?.account as any)?.account_number ||
    "—";

  const copy = (text: string, label: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copié !`));

  return (
    <ClientLayout>
      <div className="space-y-6 max-w-lg">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Mode de paiement</h1>
          <p className="text-muted-foreground mt-1">Instructions pour effectuer votre paiement.</p>
        </div>

        <Card className="border-2 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Virement Interac
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-muted/30 divide-y divide-border">
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
                  <p className="text-xs text-muted-foreground">Réponse à la question de sécurité</p>
                  <p className="text-sm font-bold">{accountNumber}</p>
                  <p className="text-xs text-amber-600 mt-0.5">⚠️ Utilisez exactement ce numéro</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => copy(String(accountNumber), "Numéro")}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Lock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Votre paiement est traité automatiquement et appliqué à votre compte dès réception.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ClientPaymentMethod;
