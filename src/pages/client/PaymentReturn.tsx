import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClientLayout from "@/components/client/ClientLayout";

/**
 * /portal/payment-success — PayPal redirects here after approval.
 * Extracts the PayPal token (order ID) from query params,
 * calls paypal-capture-order, then shows result.
 */
const PaymentReturn = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"capturing" | "success" | "error">("capturing");
  const [errorMsg, setErrorMsg] = useState("");
  const [captureDetails, setCaptureDetails] = useState<any>(null);

  useEffect(() => {
    const token = params.get("token"); // PayPal order ID
    if (!token) {
      setStatus("error");
      setErrorMsg("Aucun identifiant de commande PayPal trouvé.");
      return;
    }

    const capture = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("paypal-capture-order", {
          body: { paypal_order_id: token },
        });

        if (error) throw error;
        if (!data?.capture_id && !data?.already_processed) {
          throw new Error("Capture échouée — aucun ID de capture retourné.");
        }

        console.log("[PaymentReturn] Capture result:", data);
        setCaptureDetails(data);
        setStatus("success");
        toast.success("Paiement confirmé!");
      } catch (err: any) {
        console.error("[PaymentReturn] Capture error:", err);
        setStatus("error");
        setErrorMsg(err?.message || "Erreur lors de la confirmation du paiement.");
      }
    };

    capture();
  }, [params]);

  return (
    <ClientLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full text-center space-y-6">
          {status === "capturing" && (
            <>
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <h2 className="text-xl font-semibold text-foreground">
                Confirmation du paiement en cours…
              </h2>
              <p className="text-sm text-muted-foreground">
                Ne fermez pas cette page.
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
              <h2 className="text-2xl font-bold text-foreground">Paiement réussi!</h2>
              <p className="text-muted-foreground">
                Votre paiement de{" "}
                <strong>
                  {captureDetails?.amount?.toLocaleString("fr-CA", {
                    style: "currency",
                    currency: "CAD",
                  }) || ""}
                </strong>{" "}
                a été confirmé.
              </p>
              {captureDetails?.updated_invoice && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <p>
                    Facture:{" "}
                    <span className="font-mono font-semibold">
                      {captureDetails.updated_invoice.invoice_number}
                    </span>
                  </p>
                  <p>
                    Statut:{" "}
                    <span className="text-emerald-600 font-semibold">
                      {captureDetails.updated_invoice.status === "paid" ? "Payée" : captureDetails.updated_invoice.status}
                    </span>
                  </p>
                </div>
              )}
              <Button onClick={() => navigate("/portal/invoices")} className="mt-4">
                Voir mes factures
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="w-16 h-16 text-destructive mx-auto" />
              <h2 className="text-xl font-bold text-foreground">Erreur de paiement</h2>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <div className="flex gap-3 justify-center mt-4">
                <Button variant="outline" onClick={() => navigate("/portal/invoices")}>
                  Retour aux factures
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </ClientLayout>
  );
};

export default PaymentReturn;
