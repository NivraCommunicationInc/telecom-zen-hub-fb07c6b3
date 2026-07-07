import { useSearchParams, useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClientLayout from "@/components/client/ClientLayout";

/**
 * /portal/payment-success — Legacy PayPal capture return handler.
 *
 * Phase 3.B.3 (2026-07-07): PayPal is decommissioned. This page is retained
 * only to catch any stale bookmarks / email links pointing to the old
 * PayPal approval-return URL. It performs NO payment capture and NO edge
 * function call. Users are directed to their billing hub to pay via Square.
 */
const PaymentReturn = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const hadToken = !!params.get("token");

  return (
    <ClientLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full text-center space-y-6">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">
            Paiement PayPal indisponible
          </h2>
          <p className="text-sm text-muted-foreground">
            {hadToken
              ? "Le paiement PayPal n'est plus supporté. Si un montant a été prélevé, il sera automatiquement remboursé sous 3 à 5 jours ouvrables."
              : "Cette page n'est plus utilisée."}{" "}
            Veuillez régler vos factures par carte de crédit ou débit depuis votre portail.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate("/portal/billing")}>
              Aller à la facturation
            </Button>
            <Button variant="outline" onClick={() => navigate("/portal/invoices")}>
              Mes factures
            </Button>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
};

export default PaymentReturn;
