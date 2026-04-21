import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";

export default function ClientBalancePaymentSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) { setStatus("error"); setError("Aucun jeton PayPal reçu"); return; }
    (async () => {
      try {
        const { data, error: e } = await supabase.functions.invoke("paypal-balance-pay-capture", {
          body: { paypal_order_id: token },
        });
        if (e || data?.error) throw new Error(data?.error || e?.message);
        setResult(data);
        setStatus("success");
      } catch (err: any) {
        setError(err.message || "Erreur lors de la capture");
        setStatus("error");
      }
    })();
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
              <h1 className="text-xl font-bold">Traitement du paiement…</h1>
              <p className="text-sm text-muted-foreground">Application du paiement à vos factures.</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="w-12 h-12 mx-auto text-emerald-500" />
              <h1 className="text-xl font-bold">Paiement réussi</h1>
              <p className="text-sm text-muted-foreground">
                {result?.captured_amount?.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} appliqué à {result?.apply_result?.invoices_paid_count || 0} facture(s).
              </p>
              <Button onClick={() => navigate("/portal/billing")} className="w-full">
                Retour à la facturation
              </Button>
            </>
          )}
          {status === "error" && (
            <>
              <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
              <h1 className="text-xl font-bold">Erreur de paiement</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={() => navigate("/portal/billing")} variant="outline" className="w-full">
                Retour à la facturation
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
