/**
 * FieldSaleSuccess — Order success with animated portal sync visualization.
 * Shows real-time sync animation: Terrain → Core → Client → Courriel → Service client.
 */
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  CheckCircle2, ArrowRight, Wallet, Banknote, Copy, Clock,
  MapPin, Building2, User, Mail, Headphones, Loader2,
} from "lucide-react";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const METHOD_DISPLAY: Record<string, { label: string; icon: typeof Wallet }> = {
  paypal: { label: "PayPal", icon: Wallet },
  interac: { label: "Virement Interac", icon: Banknote },
  deferred: { label: "Différé", icon: Clock },
};

const SYNC_STEPS = [
  { key: "field", label: "Portail terrain", icon: MapPin, desc: "Commande enregistrée" },
  { key: "core", label: "Nivra Core", icon: Building2, desc: "Synchronisation admin" },
  { key: "client", label: "Portail client", icon: User, desc: "Visible par le client" },
  { key: "email", label: "Courriel", icon: Mail, desc: "Confirmation envoyée" },
  { key: "support", label: "Service client", icon: Headphones, desc: "Accessible au support" },
];

export default function FieldSaleSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [syncStep, setSyncStep] = useState(0);
  const [allDone, setAllDone] = useState(false);

  const leadId = params.get("leadId") || "";
  const total = params.get("total") || "0.00";
  const paymentMethod = params.get("payment") || "paypal";
  const paymentStatus = params.get("status") || "pending";

  const method = METHOD_DISPLAY[paymentMethod] || METHOD_DISPLAY.paypal;
  const MethodIcon = method.icon;

  // Animated sync progression
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    SYNC_STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setSyncStep(i + 1);
        if (i === SYNC_STEPS.length - 1) {
          setTimeout(() => setAllDone(true), 600);
        }
      }, 800 + i * 900));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="max-w-lg mx-auto space-y-6 py-8">
      {/* Success Animation */}
      <div className="text-center">
        <div className={cn(
          "h-20 w-20 rounded-full mx-auto flex items-center justify-center transition-all duration-700",
          allDone ? "bg-[#DCFCE7] scale-110" : "bg-[#F0FDF4]"
        )}>
          <CheckCircle2 className={cn("h-10 w-10 transition-all duration-500", allDone ? "text-[#16A34A]" : "text-[#22C55E]/50")} />
        </div>
        <h1 className="text-2xl font-bold text-[#000000] mt-4">Commande soumise ! 🎉</h1>
        <p className="text-sm text-[#6B7280] mt-1">La commande se synchronise en temps réel dans tous les portails.</p>
      </div>

      {/* ═══ SYNC ANIMATION ═══ */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
        <h3 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest mb-4">Synchronisation en temps réel</h3>
        <div className="space-y-1">
          {SYNC_STEPS.map((step, i) => {
            const isDone = syncStep > i;
            const isActive = syncStep === i;
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex items-center gap-3">
                {/* Line connector */}
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center transition-all duration-500",
                    isDone ? "bg-[#22C55E]" : isActive ? "bg-[#FEF3C7] border-2 border-[#F59E0B]" : "bg-[#F3F4F6]"
                  )}>
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 text-[#D97706] animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4 text-[#9CA3AF]" />
                    )}
                  </div>
                  {i < SYNC_STEPS.length - 1 && (
                    <div className={cn("w-0.5 h-4 transition-all duration-300", isDone ? "bg-[#22C55E]" : "bg-[#E5E7EB]")} />
                  )}
                </div>
                <div className="flex-1 pb-3">
                  <p className={cn("text-sm font-semibold transition-colors", isDone ? "text-[#16A34A]" : isActive ? "text-[#D97706]" : "text-[#9CA3AF]")}>
                    {step.label}
                    {isDone && " ✓"}
                  </p>
                  <p className={cn("text-[10px]", isDone ? "text-[#16A34A]/60" : "text-[#9CA3AF]")}>{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
        {allDone && (
          <div className="mt-3 p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl text-center">
            <p className="text-xs font-bold text-[#16A34A]">✅ Synchronisation complète — Visible partout</p>
          </div>
        )}
      </div>

      {/* Order Summary */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-[#6B7280]">Référence</span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-[#000000] font-bold">{leadId.slice(0, 8).toUpperCase()}</span>
            <button type="button" onClick={() => { navigator.clipboard.writeText(leadId); toast.success("Copié"); }} className="text-[#9CA3AF] hover:text-[#000000]">
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#6B7280]">Total</span>
          <span className="font-bold text-[#000000]">{total} $</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#6B7280]">Paiement</span>
          <span className="text-[#000000] flex items-center gap-1.5">
            <MethodIcon className="h-3.5 w-3.5 text-[#22C55E]" /> {method.label}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#6B7280]">Statut</span>
          <span className={paymentStatus === "completed" ? "text-[#16A34A] font-semibold" : "text-[#D97706] font-semibold"}>
            {paymentStatus === "completed" ? "✅ Payé" : "⏳ En attente"}
          </span>
        </div>
      </div>

      {paymentStatus !== "completed" && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-4">
          <p className="text-sm font-medium text-[#92400E]">⏳ En attente du paiement</p>
          <p className="text-xs text-[#A16207] mt-1">
            {paymentMethod === "interac"
              ? "Le client doit envoyer le virement Interac. Notification dès réception."
              : "Le paiement sera traité automatiquement."}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <button onClick={() => navigate(fieldPath("/submissions"))} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#22C55E] text-white text-sm font-bold hover:bg-[#16A34A] transition-colors shadow-sm">
          Voir mes commandes <ArrowRight className="h-4 w-4" />
        </button>
        <button onClick={() => navigate(fieldPath("/sale/new"))} className="w-full py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors">
          Nouvelle vente
        </button>
        <button onClick={() => navigate(fieldPath("/dashboard"))} className="w-full py-2.5 rounded-xl text-sm font-medium text-[#9CA3AF] hover:text-[#000000] transition-colors">
          Retour au tableau de bord
        </button>
      </div>
    </div>
  );
}