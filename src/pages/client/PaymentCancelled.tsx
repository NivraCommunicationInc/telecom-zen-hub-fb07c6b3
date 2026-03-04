import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClientLayout from "@/components/client/ClientLayout";

const PaymentCancelled = () => {
  const navigate = useNavigate();

  return (
    <ClientLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full text-center space-y-6">
          <XCircle className="w-16 h-16 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Paiement annulé</h2>
          <p className="text-sm text-muted-foreground">
            Vous avez annulé le paiement PayPal. Aucun montant n'a été débité.
          </p>
          <Button onClick={() => navigate("/portal/invoices")}>
            Retour aux factures
          </Button>
        </div>
      </div>
    </ClientLayout>
  );
};

export default PaymentCancelled;
