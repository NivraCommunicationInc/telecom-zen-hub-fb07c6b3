/**
 * StaffRecordPaymentDialog - Payment recording component for Employee Portal
 * DEPRECATED: Staff payment recording has been disabled.
 * All payment operations must go through the canonical admin Core console.
 */
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";
import { toast } from "sonner";

interface StaffRecordPaymentDialogProps {
  billingId: string;
  userId: string;
  balanceDue: number;
  invoiceNumber?: string;
  clientEmail?: string;
  onSuccess?: () => void;
}

export function StaffRecordPaymentDialog({
  invoiceNumber,
}: StaffRecordPaymentDialogProps) {
  const handleClick = () => {
    toast.info("L'enregistrement de paiement est maintenant géré via la console Admin Core.", {
      description: `Facture: ${invoiceNumber || "—"}`,
      duration: 5000,
    });
  };

  return (
    <Button
      onClick={handleClick}
      variant="outline"
      className="border-slate-700 text-slate-400 hover:bg-slate-800"
      disabled
    >
      <DollarSign className="h-4 w-4 mr-2" />
      Paiement (via Admin)
    </Button>
  );
}
