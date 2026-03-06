/**
 * ActivationStep — Step 7: Activation / Provisioning
 * Fields adapt by service type
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Zap, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props { proc: any; }

export function ActivationStep({ proc }: Props) {
  const { order } = proc;
  const serviceType = (order.service_type || "").toLowerCase();
  const [providerRef, setProviderRef] = useState("");
  const [activationNotes, setActivationNotes] = useState("");

  const isActivated = ["active", "activated", "completed"].includes(order.status || "");

  const handleActivate = async () => {
    const updates: Record<string, any> = { status: "activated" };
    if (providerRef) updates.confirmation_number = providerRef;
    if (activationNotes) {
      const existing = order.internal_notes || "";
      updates.internal_notes = existing + `\n[Activation] ${activationNotes}`;
    }
    await proc.updateOrder(updates);
    toast.success("Service activé");
  };

  const handleRetry = async () => {
    await proc.updateOrder({ status: "provisioning_in_progress" });
    toast.info("Réessai d'activation en cours…");
  };

  const handleMarkCompleted = async () => {
    await proc.updateOrder({ status: "activated" });
    toast.success("Activation marquée comme complétée");
  };

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Activation / Provisionnement</h3>

      {/* Status */}
      {isActivated && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 mb-4">
          <p className="text-sm text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Service déjà activé
          </p>
        </div>
      )}

      {/* Service-specific info */}
      <div className="bg-gray-50 rounded-lg border border-gray-100 p-4 mb-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Détails du service</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Type:</span> <span className="font-medium text-gray-900">{order.service_type}</span></div>
          <div><span className="text-gray-500">Statut actuel:</span> <span className="font-medium text-gray-900">{order.status}</span></div>
          {serviceType.includes("mobile") && (
            <>
              <div><span className="text-gray-500">SIM:</span> <span className="font-mono text-gray-900">{order.sim_number || "—"}</span></div>
              <div><span className="text-gray-500">IMEI:</span> <span className="font-mono text-gray-900">{order.imei_number || "—"}</span></div>
            </>
          )}
          {(serviceType.includes("internet") || serviceType.includes("tv")) && (
            <>
              <div><span className="text-gray-500">Équipement:</span> <span className="text-gray-900">{order.serial_number || "—"}</span></div>
              <div><span className="text-gray-500">Installation:</span> <span className="text-gray-900">{order.installation_type || "—"}</span></div>
            </>
          )}
          {order.confirmation_number && (
            <div><span className="text-gray-500">Réf. fournisseur:</span> <span className="font-mono text-gray-900">{order.confirmation_number}</span></div>
          )}
        </div>
      </div>

      {/* Provider reference */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <Label className="text-xs text-gray-500">Référence fournisseur</Label>
          <Input
            value={providerRef}
            onChange={(e) => setProviderRef(e.target.value)}
            placeholder="Numéro de confirmation…"
            className="h-9 text-sm border-gray-300 text-gray-900 font-mono"
          />
        </div>
      </div>

      {/* Activation notes */}
      <div className="mb-4">
        <Label className="text-xs text-gray-500">Notes d'activation</Label>
        <Textarea
          value={activationNotes}
          onChange={(e) => setActivationNotes(e.target.value)}
          placeholder="Notes techniques…"
          className="min-h-[60px] text-sm border-gray-300 text-gray-900"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
        <Button size="sm" onClick={handleActivate} disabled={proc.isUpdating || isActivated} className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Zap className="w-3 h-3 mr-1" /> Activer le service
        </Button>
        <Button size="sm" variant="outline" onClick={handleRetry} disabled={proc.isUpdating} className="text-xs h-8 border-gray-300 text-gray-700">
          <RefreshCw className="w-3 h-3 mr-1" /> Réessayer
        </Button>
        <Button size="sm" variant="outline" onClick={handleMarkCompleted} disabled={proc.isUpdating} className="text-xs h-8 border-gray-300 text-gray-700">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Marquer complété
        </Button>
      </div>
    </div>
  );
}
