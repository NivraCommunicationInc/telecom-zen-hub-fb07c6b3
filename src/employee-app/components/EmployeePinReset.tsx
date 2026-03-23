/**
 * EmployeePinReset — Secure per-account PIN reset for employees.
 * Uses generateTemporaryPin() — never static/shared PINs.
 * Shows temporary PIN once. Full audit trail.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Key, Loader2, AlertTriangle, CheckCircle, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { hashPin, generateTemporaryPin } from "@/lib/pinUtils";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { ActionConfirmButton } from "@/employee-app/components/ActionConfirmDialog";

interface Props {
  customerId: string;
  customerName?: string;
}

export function EmployeePinReset({ customerId, customerName }: Props) {
  const [tempPin, setTempPin] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Generate unique temporary PIN
      const newTempPin = generateTemporaryPin();
      const hashedPin = await hashPin(newTempPin);

      // Check if customer_security record exists
      const { data: existing } = await supabase
        .from("customer_security")
        .select("id")
        .eq("customer_id", customerId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("customer_security")
          .update({
            pin_hash: hashedPin,
            pin_salt: "nivra_pin_salt_2026",
            pin_attempts: 0,
            lock_until: null,
            must_reset: true,
            updated_at: new Date().toISOString(),
          })
          .eq("customer_id", customerId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("customer_security")
          .insert({
            customer_id: customerId,
            pin_hash: hashedPin,
            pin_salt: "nivra_pin_salt_2026",
            pin_attempts: 0,
            must_reset: true,
          });
        if (error) throw error;
      }

      // Mark profile as requiring PIN reset
      await supabase
        .from("profiles")
        .update({ security_requires_pin_reset: true })
        .eq("user_id", customerId);

      // Audit log
      await logInternalAudit({
        action: "customer_pin_reset_by_employee",
        category: "security",
        portal: "employee",
        targetType: "customer",
        targetId: customerId,
      });

      return newTempPin;
    },
    onSuccess: (pin) => {
      setTempPin(pin);
      setShowPin(true);
      toast.success("NIP temporaire généré");
    },
    onError: (err: any) => toast.error(`Erreur: ${err.message}`),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Key className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Réinitialisation NIP
        </h3>
      </div>

      {tempPin ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 text-xs">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">NIP temporaire généré</span>
          </div>

          <div className="flex items-center gap-2 bg-muted rounded-lg px-4 py-3">
            <span className="font-mono text-2xl font-bold text-foreground tracking-[0.3em]">
              {showPin ? tempPin : "••••"}
            </span>
            <button
              onClick={() => setShowPin(!showPin)}
              className="p-1 rounded hover:bg-secondary transition-colors"
            >
              {showPin ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>

          <div className="flex items-start gap-2 text-[10px] text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Communiquez ce NIP au client de manière sécurisée.</p>
              <p className="mt-0.5 text-amber-400/70">Le client devra changer ce NIP à sa prochaine connexion.</p>
            </div>
          </div>

          <button
            onClick={() => { setTempPin(null); setShowPin(false); }}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Fermer
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>Générer un NIP temporaire unique pour {customerName ?? "ce client"}. Le client devra le changer à sa prochaine connexion.</p>
          </div>

          <ActionConfirmButton
            label="Réinitialiser le NIP"
            consequence={`Un NIP temporaire unique sera généré pour ${customerName ?? "ce client"}. L'ancien NIP sera invalidé immédiatement.`}
            onConfirm={() => resetMutation.mutate()}
            isPending={resetMutation.isPending}
            variant="warning"
          />
        </div>
      )}
    </div>
  );
}
