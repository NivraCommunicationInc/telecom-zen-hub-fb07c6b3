/**
 * Dialog wrapper for ContractSummaryView
 * Used in both client and admin portals
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { ContractSummaryView } from "./ContractSummaryView";
import { useContractSummary } from "@/hooks/useContractSummary";
import { generateContractSummaryPDF } from "@/lib/contractSummaryPdfGenerator";
import { toast } from "sonner";

interface ContractSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  usePortalClient?: boolean;
}

export function ContractSummaryDialog({
  open,
  onOpenChange,
  orderId,
  usePortalClient = false,
}: ContractSummaryDialogProps) {
  const { data, isLoading, error } = useContractSummary({ orderId, usePortalClient });

  const handleDownloadPDF = async () => {
    if (!data) {
      toast.error("Données du résumé non disponibles");
      return;
    }
    
    try {
      await generateContractSummaryPDF(data);
      toast.success("PDF téléchargé");
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      toast.error("Erreur lors de la génération du PDF");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Résumé du contrat
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isLoading || !data}
            >
              <Download className="w-4 h-4 mr-2" />
              Télécharger PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Chargement...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-destructive">
            <p>Erreur lors du chargement du résumé</p>
            <p className="text-sm text-muted-foreground mt-2">{String(error)}</p>
          </div>
        ) : data ? (
          <ContractSummaryView data={data} showSignatures />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>Aucun résumé disponible pour cette commande</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ContractSummaryDialog;
