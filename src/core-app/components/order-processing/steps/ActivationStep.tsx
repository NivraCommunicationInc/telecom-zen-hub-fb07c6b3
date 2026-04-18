/**
 * ActivationStep — Step 7: Activation / Provisioning
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
  const canActivate = invoicePaid && !isActivated;

  const handleActivate = async () => {
    if (!proc.activateService) { toast.error("Méthode d'activation non disponible"); return; }
    setIsActivating(true);
    try {
      await proc.activateService({
        providerRef: providerRef || undefined,
        activationNotes: activationNotes || undefined,
      });
    } catch (err: any) {
      console.error("[ActivationStep] Activation failed:", err);
      toast.error(err?.message || "Erreur lors de l'activation");
    } finally { setIsActivating(false); }
  };

  const handleConfirmOrder = async () => {
    try { await proc.changeStatus("confirmed", "Passage en état opérationnel confirmé"); }
    catch (err: any) { toast.error(err?.message || "Erreur"); }
  };

  const handleStartProcessing = async () => {
    try { await proc.changeStatus("processing", "Début du traitement"); }
    catch (err: any) { toast.error(err?.message || "Erreur"); }
  };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Activation / Provisionnement</div>

      {isActivated && (
        <div className="bg-green-950/50 border border-green-700/50 text-green-300 rounded-lg px-3 py-2 text-sm mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Service activé — abonnement créé
        </div>
      )}

      {!invoicePaid && !isActivated && (
        <div className="bg-amber-950/50 border border-amber-700/50 text-amber-300 rounded-lg px-3 py-2 text-sm mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> La facture doit être payée avant l'activation du service.
        </div>
      )}

      {!isActivated && invoicePaid && (
        <div className="bg-blue-950/50 border border-blue-700/50 text-blue-300 rounded-lg px-3 py-2 text-sm mb-4">
          <p className="text-xs font-medium mb-1">État actuel: <span className="font-bold">{currentStatus}</span></p>
          {isInIntake && <p className="text-xs opacity-80">La commande est en intake. L'activation va automatiquement transiter par les états opérationnels requis.</p>}
          {isInOperational && <p className="text-xs opacity-80">La commande est en traitement. Vous pouvez procéder à l'activation.</p>}
        </div>
      )}

      {/* Service details */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
        <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
          <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Détails du service</h4>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-slate-500">Type:</span> <span className="font-medium text-slate-100 ml-1">{order.service_type}</span></div>
          <div><span className="text-slate-500">Statut:</span> <span className="font-medium text-slate-100 ml-1">{order.status}</span></div>
          <div><span className="text-slate-500">Compte:</span> <span className="font-mono text-slate-100 ml-1">{account?.account_number || "—"}</span></div>
          <div><span className="text-slate-500">Cycle:</span> <span className="text-slate-100 ml-1">{account?.billing_cycle_day ? `${account.billing_cycle_day} du mois` : "À définir"}</span></div>
          {serviceType.includes("mobile") && (
            <>
              <div><span className="text-slate-500">SIM:</span> <span className="font-mono text-slate-100 ml-1">{order.sim_number || "—"}</span></div>
              <div><span className="text-slate-500">IMEI:</span> <span className="font-mono text-slate-100 ml-1">{order.imei_number || "—"}</span></div>
            </>
          )}
          {(serviceType.includes("internet") || serviceType.includes("tv")) && (
            <>
              <div><span className="text-slate-500">Équipement:</span> <span className="text-slate-100 ml-1">{order.serial_number || "—"}</span></div>
              <div><span className="text-slate-500">Installation:</span> <span className="text-slate-100 ml-1">{order.installation_type || "—"}</span></div>
            </>
          )}
          {order.confirmation_number && (
            <div><span className="text-slate-500">Réf. fournisseur:</span> <span className="font-mono text-slate-100 ml-1">{order.confirmation_number}</span></div>
          )}
          {invoice && (
            <div><span className="text-slate-500">Facture:</span> <span className="font-mono text-slate-100 ml-1">{invoice.invoice_number} ({invoice.status})</span></div>
          )}
        </div>
      </div>

      {hasMobile && (
        <MobileNumberSection portRequest={portRequest} mobileFulfillment={mobileFulfillment} />
      )}

      {!isActivated && (
        <>
          <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
            <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
              <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Référence & notes</h4>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Référence fournisseur</Label>
                <Input
                  value={providerRef}
                  onChange={(e) => setProviderRef(e.target.value)}
                  placeholder="Numéro de confirmation…"
                  className="h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 rounded-lg font-mono"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Notes d'activation</Label>
                <Textarea
                  value={activationNotes}
                  onChange={(e) => setActivationNotes(e.target.value)}
                  placeholder="Notes techniques…"
                  className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg min-h-[56px]"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {canActivate && (
        <div className="bg-blue-950/50 border border-blue-700/50 text-blue-300 rounded-lg px-3 py-2 text-sm mb-4">
          <p className="text-xs font-medium mb-1">L'activation va :</p>
          <ul className="text-xs opacity-90 list-disc ml-4 space-y-0.5">
            <li>Créer l'abonnement récurrent lié au compte</li>
            <li>Provisionner les services (Internet, TV, Mobile…)</li>
            <li>Ancrer le cycle de facturation à aujourd'hui</li>
            <li>Générer la prochaine date de facture</li>
            <li>Marquer la commande comme activée</li>
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-700/50">
        {isInIntake && invoicePaid && (
          <Button size="sm" onClick={handleConfirmOrder} disabled={proc.isUpdating} className="text-sm bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800">
            <ArrowRight className="w-3 h-3 mr-1" /> Confirmer la commande
          </Button>
        )}
        {currentStatus === "confirmed" && (
          <Button size="sm" onClick={handleStartProcessing} disabled={proc.isUpdating} className="text-sm bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800">
            <ArrowRight className="w-3 h-3 mr-1" /> Démarrer le traitement
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleActivate}
          disabled={isActivating || proc.isUpdating || !canActivate}
          className="text-sm bg-green-600 hover:bg-green-700 text-white"
        >
          <Zap className="w-3 h-3 mr-1" />
          {isActivating ? "Activation en cours…" : "Activer le service"}
        </Button>
        {!isActivated && (
          <Button size="sm" onClick={() => proc.changeStatus("provisioning", "Réessai")} disabled={proc.isUpdating} className="text-sm bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800">
            <RefreshCw className="w-3 h-3 mr-1" /> Réessayer
          </Button>
        )}
      </div>
    </div>
  );
}
