/**
 * ClientAutoPayStatus — Neutral status page shown DURING the PayPal pre-authorized flow.
 *
 * This route is used when:
 *  - The client has just been redirected to PayPal (flag set in sessionStorage)
 *  - On return from PayPal while we verify the agreement server-side
 *
 * It blocks the usual portal redirects and shows a calm "Configuration en cours" screen.
 * Used as a guard target by `<PayPalFlowGuard>`.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { clearPayPalFlowActive, isPayPalFlowActive } from "@/hooks/useClientAutoPayEnrollment";

const ClientAutoPayStatus = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [state, setState] = useState<"waiting" | "no_flow">(
    isPayPalFlowActive() ? "waiting" : "no_flow",
  );

  useEffect(() => {
    // If there's no active flow and no return params, send back to portal home.
    if (state === "no_flow" && !params.get("subscription_id")) {
      const t = setTimeout(() => navigate("/portal", { replace: true }), 1500);
      return () => clearTimeout(t);
    }
  }, [state, params, navigate]);

  const handleAbort = () => {
    clearPayPalFlowActive();
    navigate("/portal", { replace: true });
  };

  return (
    <div style={{ background: '#020209' }} className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 space-y-4 text-center">
          {state === "waiting" ? (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
              <h1 className="text-xl font-semibold">Configuration en cours</h1>
              <p className="text-sm text-muted-foreground">
                Nous finalisons votre paiement pré-autorisé PayPal. Cette page se mettra à jour
                automatiquement. Ne fermez pas cette fenêtre.
              </p>
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="w-3 h-3" />
                Paiement sécurisé via PayPal
              </div>
              <div className="pt-3 border-t flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={handleAbort}>
                  Annuler et retourner au portail
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <h1 className="text-xl font-semibold">Aucune configuration active</h1>
              <p className="text-sm text-muted-foreground">
                Redirection vers votre portail...
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientAutoPayStatus;
