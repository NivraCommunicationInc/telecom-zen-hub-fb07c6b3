import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send } from "lucide-react";

const INTERAC_EMAIL = "support@nivra-telecom.ca";

export const ClientPaymentMethodCard = () => {
  return (
    <Card className="border-emerald-300/50 bg-emerald-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-emerald-700">
          <Send className="h-4 w-4" />
          Mode de paiement
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground font-medium">Virement Interac</p>
        <p className="text-sm text-muted-foreground mt-1">
          Envoyez votre paiement à <span className="font-semibold text-foreground">{INTERAC_EMAIL}</span>. Traitement automatique dès réception.
        </p>
      </CardContent>
    </Card>
  );
};
