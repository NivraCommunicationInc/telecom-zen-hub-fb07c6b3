/**
 * ActivationStep — Step 7: Activation / Provisioning
 * Calls canonical provision_services_for_order RPC, creates subscription,
 * updates account billing cycle, and marks order as activated.
 * 
 * GATED: Only shows "Activer" when order is in a valid pre-activation state
 * and invoice is paid.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Zap, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { MobileNumberSection } from "./MobileNumberSection";

interface Props { proc: any; }

/** Canonical order lifecycle states */
const INTAKE_STATES = ["submitted", "pending_admin_review", "received"];
const OPERATIONAL_STATES = ["confirmed", "processing", "in_progress", "provisioning", "shipping", "installing",
  "shipped", "delivered", "technician_en_route", "installation_completed"];
const TERMINAL_STATES = ["active", "activated"];

export function ActivationStep({ proc }: Props) {
  const { order, account, invoice, mobileFulfillment, portRequest } = proc;
  const serviceType = (order.service_type || "").toLowerCase();
  const hasMobile = serviceType.includes("mobile");
  const [providerRef, setProviderRef] = useState("");
  const [activationNotes, setActivationNotes] = useState("");
  const [isActivating, setIsActivating] = useState(false);

  const currentStatus = order.status || "";
  const isActivated = TERMINAL_STATES.includes(currentStatus);
  const isInIntake = INTAKE_STATES.includes(currentStatus);
  const isInOperational = OPERATIONAL_STATES.includes(currentStatus);
  const invoicePaid = ["paid", "partially_paid", "paid_by_promo"].includes(invoice?.status || "");

  // Can activate if invoice is paid AND order is not already terminal
  // The hook handles safe state transitions internally
  const canActivate = invoicePaid && !isActivated;

  const handleActivate = async () => {
    if (!proc.activateService) {
      toast.error("Méthode d'activation non disponible");
      return;
    }
    setIsActivating(true);
    try {
      await proc.activateService({
        providerRef: providerRef || undefined,
        activationNotes: activationNotes || undefined,
      });
    } catch (err: any) {
      console.error("[ActivationStep] Activation failed:", err);
      toast.error(err?.message || "Erreur lors de l'activation");
    } finally {
      setIsActivating(false);
    }
  };

  // Move to "confirmed" operational state (first step from intake)
  const handleConfirmOrder = async () => {
    try {
      await proc.changeStatus("confirmed", "Passage en état opérationnel confirmé");
    } catch (err: any) {
      toast.error(err?.message || "Erreur");
    }
  };

  // Move to "processing" operational state
  const handleStartProcessing = async () => {
    try {
      await proc.changeStatus("processing", "Début du traitement");
    } catch (err: any) {
      toast.error(err?.message || "Erreur");
    }
  };

  return (
    <div>
      <h3 className="text-base font-bold text-foreground mb-4">Activation / Provisionnement</h3>

      {/* Already activated */}
      {isActivated && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Service activé — abonnement créé
          </p>
        </div>
      )}

      {/* Warning if invoice not paid */}
      {!invoicePaid && !isActivated && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-amber-800 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" /> La facture doit être payée avant l'activation du service.
          </p>
        </div>
      )}

      {/* Guide: show current state and required transitions */}
      {!isActivated && invoicePaid && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-blue-800 font-medium mb-1">État actuel: <span className="font-bold">{currentStatus}</span></p>
          {isInIntake && (
            <p className="text-xs text-blue-700">
              La commande est en état d'intake. L'activation va automatiquement transiter par les états opérationnels requis (confirmé → traitement → activé).
            </p>
          )}
          {isInOperational && (
            <p className="text-xs text-blue-700">
              La commande est en traitement. Vous pouvez procéder à l'activation.
            </p>
          )}
        </div>
      )}

      {/* Service details */}
      <div className="bg-muted/50 rounded-lg border border-border p-4 mb-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Détails du service</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Type:</span> <span className="font-medium text-foreground">{order.service_type}</span></div>
          <div><span className="text-muted-foreground">Statut:</span> <span className="font-medium text-foreground">{order.status}</span></div>
          <div><span className="text-muted-foreground">Compte:</span> <span className="font-mono text-foreground">{account?.account_number || "—"}</span></div>
          <div><span className="text-muted-foreground">Cycle facturation:</span> <span className="text-foreground">{account?.billing_cycle_day ? `${account.billing_cycle_day} du mois` : "À définir"}</span></div>
          {serviceType.includes("mobile") && (
            <>
              <div><span className="text-muted-foreground">SIM:</span> <span className="font-mono text-foreground">{order.sim_number || "—"}</span></div>
              <div><span className="text-muted-foreground">IMEI:</span> <span className="font-mono text-foreground">{order.imei_number || "—"}</span></div>
            </>
          )}
          {(serviceType.includes("internet") || serviceType.includes("tv")) && (
            <>
              <div><span className="text-muted-foreground">Équipement:</span> <span className="text-foreground">{order.serial_number || "—"}</span></div>
              <div><span className="text-muted-foreground">Installation:</span> <span className="text-foreground">{order.installation_type || "—"}</span></div>
            </>
          )}
          {order.confirmation_number && (
            <div><span className="text-muted-foreground">Réf. fournisseur:</span> <span className="font-mono text-foreground">{order.confirmation_number}</span></div>
          )}
          {invoice && (
            <div><span className="text-muted-foreground">Facture:</span> <span className="font-mono text-foreground">{invoice.invoice_number} ({invoice.status})</span></div>
          )}
        </div>
      </div>

      {/* Mobile number choice section — only for mobile orders */}
      {hasMobile && (
        <MobileNumberSection portRequest={portRequest} mobileFulfillment={mobileFulfillment} />
      )}

      {/* Provider reference + notes */}
      {!isActivated && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-xs text-muted-foreground">Référence fournisseur</Label>
              <Input
                value={providerRef}
                onChange={(e) => setProviderRef(e.target.value)}
                placeholder="Numéro de confirmation…"
                className="h-9 text-sm font-mono"
              />
            </div>
          </div>
          <div className="mb-4">
            <Label className="text-xs text-muted-foreground">Notes d'activation</Label>
            <Textarea
              value={activationNotes}
              onChange={(e) => setActivationNotes(e.target.value)}
              placeholder="Notes techniques…"
              className="min-h-[60px] text-sm"
            />
          </div>
        </>
      )}

      {/* What activation does */}
      {canActivate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-blue-800 font-medium mb-1">L'activation va :</p>
          <ul className="text-xs text-blue-700 list-disc ml-4 space-y-0.5">
            <li>Créer l'abonnement récurrent lié au compte</li>
            <li>Provisionner les services (Internet, TV, Mobile…)</li>
            <li>Ancrer le cycle de facturation à aujourd'hui</li>
            <li>Générer la prochaine date de facture</li>
            <li>Marquer la commande comme activée</li>
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
        {/* Manual intermediate transitions (optional but available) */}
        {isInIntake && invoicePaid && (
          <>
            <Button size="sm" variant="outline" onClick={handleConfirmOrder} disabled={proc.isUpdating} className="text-xs h-8">
              <ArrowRight className="w-3 h-3 mr-1" /> Confirmer la commande
            </Button>
          </>
        )}
        {currentStatus === "confirmed" && (
          <Button size="sm" variant="outline" onClick={handleStartProcessing} disabled={proc.isUpdating} className="text-xs h-8">
            <ArrowRight className="w-3 h-3 mr-1" /> Démarrer le traitement
          </Button>
        )}

        {/* Main activation button */}
        <Button
          size="sm"
          onClick={handleActivate}
          disabled={isActivating || proc.isUpdating || !canActivate}
          className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Zap className="w-3 h-3 mr-1" />
          {isActivating ? "Activation en cours…" : "Activer le service"}
        </Button>
        {!isActivated && (
          <Button size="sm" variant="outline" onClick={() => proc.changeStatus("provisioning", "Réessai")} disabled={proc.isUpdating} className="text-xs h-8">
            <RefreshCw className="w-3 h-3 mr-1" /> Réessayer
          </Button>
        )}
      </div>
    </div>
  );
}
