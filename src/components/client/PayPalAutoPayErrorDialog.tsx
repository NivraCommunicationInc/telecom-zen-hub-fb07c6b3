/**
 * PayPalAutoPayErrorDialog
 * Detailed error screen for failed pre-authorized PayPal enrollments.
 * Shows status, debug_id, message, and links to the autopay log.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Mail, Copy } from "lucide-react";
import { toast } from "sonner";
import type { AutoPayEnrollError } from "@/hooks/useClientAutoPayEnrollment";

interface Props {
  error: AutoPayEnrollError | null;
  open: boolean;
  onClose: () => void;
  onRetry?: () => void;
  retrying?: boolean;
}

const REASON_LABELS: Record<string, string> = {
  AUTH_REQUIRED: "Vous devez être connecté",
  INVALID_SESSION: "Session expirée — reconnectez-vous",
  NOT_ELIGIBLE: "Votre compte n'est pas éligible",
  MISSING_SUB_ID: "Aucun abonnement à activer",
  ALREADY_ENROLLED: "Le pré-autorisé est déjà actif",
  FORBIDDEN: "Accès refusé à cet abonnement",
  PAYPAL_CREATE_FAILED: "PayPal a refusé la demande",
  NETWORK_ERROR: "Erreur de connexion",
  MISSING_APPROVAL_URL: "PayPal n'a pas retourné de lien d'approbation",
  EXCEPTION: "Erreur inattendue",
  NO_ELIGIBLE_SUBSCRIPTION: "Aucun forfait éligible",
};

export const PayPalAutoPayErrorDialog = ({ error, open, onClose, onRetry, retrying }: Props) => {
  if (!error) return null;

  const copyDebug = () => {
    if (error.debug_id) {
      navigator.clipboard.writeText(error.debug_id);
      toast.success("Identifiant PayPal copié");
    }
  };

  const friendlyTitle = error.code ? REASON_LABELS[error.code] || "Échec du paiement pré-autorisé" : "Échec du paiement pré-autorisé";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            {friendlyTitle}
          </DialogTitle>
          <DialogDescription>
            La configuration du paiement pré-autorisé n'a pas pu être finalisée.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Message</p>
              <p className="break-words">{error.message}</p>
            </div>
            {error.code && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Code</p>
                <p className="font-mono text-xs">{error.code}</p>
              </div>
            )}
            {error.http_status && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Statut HTTP</p>
                <p className="font-mono text-xs">{error.http_status}</p>
              </div>
            )}
            {error.debug_id && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">PayPal debug_id</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs flex-1 truncate">{error.debug_id}</p>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copyDebug}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
            {error.attempt_id && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">ID de tentative</p>
                <p className="font-mono text-xs truncate">{error.attempt_id}</p>
              </div>
            )}
          </div>

        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
          <Button variant="outline" asChild>
            <a href="mailto:info@nivra-telecom.ca">
              <Mail className="w-4 h-4 mr-1.5" />
              Contacter le support
            </a>
          </Button>
          {onRetry && (
            <Button onClick={onRetry} disabled={retrying} className="bg-[#0070ba] hover:bg-[#005ea6]">
              <RefreshCw className={`w-4 h-4 mr-1.5 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Réessai en cours..." : "Réessayer"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
