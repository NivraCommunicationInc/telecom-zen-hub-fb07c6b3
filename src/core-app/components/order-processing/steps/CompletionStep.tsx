/**
 * CompletionStep — Step 10: Final verification checklist + complete order
 */
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Circle, AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props { proc: any; }

const ORDER_FINAL_STATUSES = [
  { value: "pending", label: "En attente" },
  { value: "validated", label: "Validé" },
  { value: "prepared", label: "Préparé" },
  { value: "shipped", label: "Expédié" },
  { value: "delivered", label: "Livré" },
  { value: "installation_scheduled", label: "Installation planifiée" },
  { value: "installed", label: "Installé" },
  { value: "activated", label: "Activé" },
  { value: "completed", label: "Complété" },
  { value: "suspended", label: "Suspendu" },
  { value: "fraud", label: "Fraude" },
  { value: "invalid_payment", label: "Paiement invalide" },
  { value: "incomplete", label: "Incomplet" },
  { value: "cancelled", label: "Annulé" },
];

export function CompletionStep({ proc }: Props) {
  const { order, kycSession } = proc;
  const [finalStatus, setFinalStatus] = useState(order.status || "completed");
  const [loading, setLoading] = useState(false);

  const kycVerified =
    order.kyc_status === "approved" ||
    kycSession?.status === "approved" ||
    order.id_verification_status === "approved" ||
    order.id_verification_status === "verified" ||
    order.kyc_policy === "none" ||
    order.kyc_policy === "skip";

  // each item now has a `tone`: completed/required/pending — for left border color
  const checks: Array<{ label: string; done: boolean; tone: "done" | "required" | "pending" }> = [
    { label: "Client vérifié", done: !!(order.client_first_name && order.client_last_name && order.client_email), tone: order.client_first_name && order.client_last_name && order.client_email ? "done" : "required" },
    { label: "Commande vérifiée", done: order.status !== "pending", tone: order.status !== "pending" ? "done" : "pending" },
    { label: "Paiement vérifié", done: ["paid", "captured", "confirmed"].includes(order.payment_status || ""), tone: ["paid", "captured", "confirmed"].includes(order.payment_status || "") ? "done" : "required" },
    { label: "KYC vérifié", done: kycVerified, tone: kycVerified ? "done" : "required" },
    { label: "Fulfillment assigné", done: !!order.fulfillment_type, tone: order.fulfillment_type ? "done" : "pending" },
    { label: "Activation complétée", done: ["active", "activated", "completed"].includes(order.status || ""), tone: ["active", "activated", "completed"].includes(order.status || "") ? "done" : "pending" },
    { label: "Documents envoyés", done: !!order.related_contract_id || !!order.confirmation_email_sent_at, tone: (order.related_contract_id || order.confirmation_email_sent_at) ? "done" : "pending" },
  ];

  const allDone = checks.every((c) => c.done);
  const completedCount = checks.filter((c) => c.done).length;

  const handleComplete = async () => {
    setLoading(true);
    try {
      if (finalStatus === "completed") await proc.completeOrder();
      else await proc.changeStatus(finalStatus);
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Complétion</div>

      {/* Checklist */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
        <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
          <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Vérification finale</h4>
          <span className="text-[10px] text-slate-500">{completedCount}/{checks.length} complétés</span>
        </div>
        <div className="p-4 space-y-2">
          {checks.map((check, i) => {
            const borderClass =
              check.tone === "done" ? "border-l-green-500" :
              check.tone === "required" ? "border-l-red-500" :
              "border-l-slate-600";
            return (
              <div key={i} className={cn("flex items-center gap-2.5 pl-3 py-2 border-l-4 bg-[#0d1421] rounded", borderClass)}>
                {check.done ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                ) : (
                  <Circle className={cn("w-4 h-4 shrink-0", check.tone === "required" ? "text-red-400" : "text-slate-500")} />
                )}
                <span className={cn("text-sm", check.done ? "text-slate-100" : check.tone === "required" ? "text-red-300" : "text-slate-400")}>
                  {check.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {!allDone && (
        <div className="bg-amber-950/50 border border-amber-700/50 text-amber-300 rounded-lg px-3 py-2 text-sm mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Étapes incomplètes</p>
            <p className="text-xs opacity-80 mt-0.5">Certaines vérifications ne sont pas complétées. Vous pouvez quand même changer le statut.</p>
          </div>
        </div>
      )}

      <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
        <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
          <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Statut final</h4>
        </div>
        <div className="p-4">
          <Select value={finalStatus} onValueChange={setFinalStatus}>
            <SelectTrigger className="w-full max-w-xs h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_FINAL_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t border-slate-700/50">
        <Button
          size="sm"
          onClick={handleComplete}
          disabled={loading || proc.isUpdating}
          className={cn(
            "text-sm px-6",
            finalStatus === "completed" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
          {finalStatus === "completed" ? "Compléter la commande" : "Appliquer le statut"}
        </Button>
      </div>
    </div>
  );
}
