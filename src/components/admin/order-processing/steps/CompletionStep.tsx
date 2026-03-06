/**
 * CompletionStep — Step 10: Final verification checklist + complete order
 */
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props { proc: any; }

const ORDER_FINAL_STATUSES = [
  { value: "pending", label: "En attente" },
  { value: "validated", label: "Validé" },
  { value: "fraud", label: "Fraude" },
  { value: "shipped", label: "Expédié" },
  { value: "installation_scheduled", label: "Installation planifiée" },
  { value: "installed", label: "Installé" },
  { value: "activated", label: "Activé" },
  { value: "suspended", label: "Suspendu" },
  { value: "invalid_payment", label: "Paiement invalide" },
  { value: "incomplete", label: "Incomplet" },
  { value: "completed", label: "Complété" },
  { value: "cancelled", label: "Annulé" },
];

export function CompletionStep({ proc }: Props) {
  const { order } = proc;
  const [finalStatus, setFinalStatus] = useState(order.status || "completed");

  // Checklist items
  const checks = [
    { label: "Client vérifié", done: !!(order.client_first_name && order.client_last_name && order.client_email) },
    { label: "Commande vérifiée", done: order.status !== "pending" },
    { label: "Paiement vérifié", done: ["paid", "captured", "confirmed"].includes(order.payment_status || "") },
    { label: "KYC vérifié", done: order.id_verification_status === "approved" || order.kyc_policy === "none" || order.kyc_policy === "skip" },
    { label: "Fulfillment assigné", done: !!order.fulfillment_type },
    { label: "Activation complétée", done: ["active", "activated", "completed"].includes(order.status || "") },
    { label: "Documents envoyés", done: !!order.related_contract_id || !!order.confirmation_email_sent_at },
  ];

  const allDone = checks.every((c) => c.done);
  const completedCount = checks.filter((c) => c.done).length;

  const handleComplete = async () => {
    if (finalStatus === "completed") {
      await proc.completeOrder();
    } else {
      await proc.changeStatus(finalStatus);
    }
  };

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Complétion</h3>

      {/* Checklist */}
      <div className="bg-gray-50 rounded-lg border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase">Vérification finale</h4>
          <span className="text-xs text-gray-500">{completedCount}/{checks.length} complétés</span>
        </div>
        <div className="space-y-2">
          {checks.map((check, i) => (
            <div key={i} className="flex items-center gap-2.5">
              {check.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-gray-300 shrink-0" />
              )}
              <span className={cn("text-sm", check.done ? "text-gray-900" : "text-gray-400")}>
                {check.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {!allDone && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Étapes incomplètes</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Certaines vérifications ne sont pas complétées. Vous pouvez quand même changer le statut.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status selection */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 block mb-1.5">Statut final de la commande</label>
        <Select value={finalStatus} onValueChange={setFinalStatus}>
          <SelectTrigger className="w-full max-w-xs h-9 text-sm border-gray-300 text-gray-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_FINAL_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Complete */}
      <div className="flex gap-2 pt-4 border-t border-gray-100">
        <Button
          size="sm"
          onClick={handleComplete}
          disabled={proc.isUpdating || order.status === "completed"}
          className={cn(
            "text-xs h-9 px-6",
            finalStatus === "completed"
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-gray-900 hover:bg-gray-800 text-white"
          )}
        >
          <CheckCircle2 className="w-4 h-4 mr-1.5" />
          {finalStatus === "completed" ? "Compléter la commande" : "Appliquer le statut"}
        </Button>
      </div>
    </div>
  );
}
