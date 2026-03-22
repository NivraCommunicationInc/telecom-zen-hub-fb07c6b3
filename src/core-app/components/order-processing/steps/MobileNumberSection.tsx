/**
 * MobileNumberSection — Displays mobile number choice (transfer vs new)
 * from checkout data (order.port_request) and operational state (mobile_fulfillment).
 * 
 * Only rendered when the order includes a mobile service.
 * Null-safe: gracefully handles missing data.
 */
import { Phone, ArrowLeftRight, PlusCircle, CheckCircle2, Clock, AlertCircle } from "lucide-react";

const portStatusLabels: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "En attente", color: "text-amber-600 bg-amber-50 border-amber-200", icon: Clock },
  submitted: { label: "Soumis au fournisseur", color: "text-blue-600 bg-blue-50 border-blue-200", icon: Clock },
  in_progress: { label: "Transfert en cours", color: "text-cyan-600 bg-cyan-50 border-cyan-200", icon: Clock },
  completed: { label: "Transfert complété", color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  failed: { label: "Transfert échoué", color: "text-red-600 bg-red-50 border-red-200", icon: AlertCircle },
};

interface Props {
  portRequest: any;
  mobileFulfillment: any;
}

export function MobileNumberSection({ portRequest, mobileFulfillment }: Props) {
  // Determine choice from checkout data
  const isTransfer = !!(portRequest?.port_in) || !!(mobileFulfillment?.port_in_requested);
  const isNewNumber = !isTransfer;

  // Transfer details from checkout + operational state
  const transferNumber = portRequest?.phone_number || mobileFulfillment?.port_in_number || null;
  const transferCarrier = portRequest?.carrier || mobileFulfillment?.port_in_carrier || null;
  const transferAccountNumber = portRequest?.account_number || mobileFulfillment?.port_in_account_number || null;
  const portStatus = mobileFulfillment?.port_in_status || (isTransfer ? "pending" : null);
  const assignedNumber = mobileFulfillment?.assigned_number || null;
  const simIccid = mobileFulfillment?.sim_iccid || null;
  const activationStatus = mobileFulfillment?.activation_status || null;

  const statusInfo = portStatus ? portStatusLabels[portStatus] || portStatusLabels.pending : null;

  return (
    <div className="bg-muted/30 rounded-lg border border-border p-4 mb-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-1.5">
        <Phone className="w-3.5 h-3.5" /> Choix du numéro mobile
      </h4>

      {/* Choice indicator */}
      <div className="flex items-center gap-2 mb-3">
        {isTransfer ? (
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ArrowLeftRight className="w-4 h-4 text-primary" />
            Transfert d'un numéro existant
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <PlusCircle className="w-4 h-4 text-primary" />
            Nouveau numéro demandé
          </div>
        )}
      </div>

      {/* Transfer details */}
      {isTransfer && (
        <div className="space-y-2">
          {/* Port-in status badge */}
          {statusInfo && (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}>
              <statusInfo.icon className="w-3 h-3" />
              {statusInfo.label}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-sm mt-2">
            {transferNumber && (
              <div>
                <span className="text-muted-foreground text-xs">Numéro à transférer:</span>
                <p className="font-mono font-medium text-foreground">{transferNumber}</p>
              </div>
            )}
            {transferCarrier && (
              <div>
                <span className="text-muted-foreground text-xs">Fournisseur actuel:</span>
                <p className="font-medium text-foreground">{transferCarrier}</p>
              </div>
            )}
            {transferAccountNumber && (
              <div>
                <span className="text-muted-foreground text-xs">Nº compte fournisseur:</span>
                <p className="font-mono text-foreground">{transferAccountNumber}</p>
              </div>
            )}
            {mobileFulfillment?.port_in_submitted_at && (
              <div>
                <span className="text-muted-foreground text-xs">Soumis le:</span>
                <p className="text-foreground">{mobileFulfillment.port_in_submitted_at.slice(0, 10)}</p>
              </div>
            )}
            {mobileFulfillment?.port_in_completed_at && (
              <div>
                <span className="text-muted-foreground text-xs">Complété le:</span>
                <p className="text-foreground">{mobileFulfillment.port_in_completed_at.slice(0, 10)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New number / assigned number */}
      {isNewNumber && (
        <div className="text-sm text-muted-foreground">
          {assignedNumber ? (
            <div>
              <span className="text-xs text-muted-foreground">Numéro assigné:</span>
              <p className="font-mono font-medium text-foreground">{assignedNumber}</p>
            </div>
          ) : (
            <p className="text-xs italic">Un nouveau numéro sera assigné lors de l'activation.</p>
          )}
        </div>
      )}

      {/* Assigned number (also shown for transfers after completion) */}
      {isTransfer && assignedNumber && portStatus === "completed" && (
        <div className="mt-2">
          <span className="text-xs text-muted-foreground">Numéro actif:</span>
          <p className="font-mono font-medium text-foreground">{assignedNumber}</p>
        </div>
      )}

      {/* SIM info */}
      {simIccid && (
        <div className="mt-2">
          <span className="text-xs text-muted-foreground">SIM ICCID:</span>
          <p className="font-mono text-xs text-foreground">{simIccid}</p>
        </div>
      )}

      {/* Activation status */}
      {activationStatus && activationStatus !== "pending" && (
        <div className="mt-2">
          <span className="text-xs text-muted-foreground">Statut activation mobile:</span>
          <p className="text-sm font-medium text-foreground capitalize">{activationStatus}</p>
        </div>
      )}
    </div>
  );
}
