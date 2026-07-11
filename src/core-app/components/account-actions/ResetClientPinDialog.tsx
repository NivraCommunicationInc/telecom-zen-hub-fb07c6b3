/**
 * ResetClientPinDialog — Reset/modify client 4-digit PIN from Nivra Core.
 * Generates a secure random temporary PIN. Core-only per policy.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { KeyRound, Copy, AlertTriangle, Eye, EyeOff } from "lucide-react";

import { logActivityLog } from "@/lib/logActivityLog";
const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50";
const btnPrimary = "rounded-md bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity";
const btnSecondary = "rounded-md border border-border px-4 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40 transition-colors";

interface Props {
  clientId: string | undefined;
  clientName: string;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

function generateRandomPin(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 10000).padStart(4, "0");
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "nivra_client_pin_salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export function ResetClientPinDialog({ clientId, clientName, open, onClose, onRefresh }: Props) {
  const [mode, setMode] = useState<"reset" | "custom">("reset");
  const [customPin, setCustomPin] = useState("");
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!clientId) { toast.error("Client introuvable"); return; }
    if (!reason.trim()) { toast.error("Raison obligatoire"); return; }
    
    const pin = mode === "custom" ? customPin : generateRandomPin();
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) { toast.error("Le NIP doit contenir exactement 4 chiffres"); return; }

    setLoading(true);
    try {
      const pinHash = await hashPin(pin);

      const { error } = await supabase.from("profiles").update({
        client_pin_hash: pinHash,
        pin_is_default: false,
      }).eq("user_id", clientId);
// Also update plaintext pin for legacy compatibility
      await supabase.from("profiles").update({
        client_pin: pin,
      }).eq("user_id", clientId);

      const user = (await supabase.auth.getUser()).data.user;
      await logActivityLog({
        user_id: user?.id || "system",
        entity_type: "profile",
        entity_id: clientId,
        action: "client_pin_reset",
        reason: reason.trim(),
        details: { source: "core", mode, actor: "admin" },
      });

      await supabase.from("internal_audit_log").insert({
        actor_user_id: user?.id || "system",
        actor_name: "Admin Core",
        action: "client_pin_reset",
        category: "security",
        portal: "core",
        target_type: "profile",
        target_id: clientId,
        details: { reason: reason.trim(), mode },
      });

      setGeneratedPin(pin);
      toast.success("NIP réinitialisé avec succès");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const copyPin = () => {
    if (generatedPin) {
      navigator.clipboard.writeText(generatedPin);
      toast.success("NIP copié");
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { setGeneratedPin(null); onClose(); }}>
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Réinitialiser le NIP client
          </DialogTitle>
        </DialogHeader>

        {generatedPin ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Nouveau NIP pour {clientName}</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-bold font-mono tracking-[0.3em] text-primary">
                  {showPin ? generatedPin : "••••"}
                </span>
                <button onClick={() => setShowPin(!showPin)} className="text-muted-foreground hover:text-foreground">
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button onClick={copyPin} className="text-muted-foreground hover:text-foreground">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-300">Ce NIP ne sera affiché qu'une seule fois. Communiquez-le au client de manière sécurisée.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">Client: <span className="text-foreground font-medium">{clientName}</span></p>
            
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Mode</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => setMode("reset")} className={`rounded-md border px-3 py-2 text-[11px] font-medium transition-all ${mode === "reset" ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  Générer aléatoire
                </button>
                <button onClick={() => setMode("custom")} className={`rounded-md border px-3 py-2 text-[11px] font-medium transition-all ${mode === "custom" ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  NIP personnalisé
                </button>
              </div>
            </div>

            {mode === "custom" && (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">NIP (4 chiffres)</label>
                <input
                  type="text"
                  maxLength={4}
                  value={customPin}
                  onChange={e => setCustomPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="0000"
                  className={`${inputCls} font-mono text-center text-lg tracking-[0.3em]`}
                />
              </div>
            )}

            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Raison de la réinitialisation</label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Client a oublié son NIP" className={inputCls} />
            </div>

            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-300">Cette action sera journalisée dans l'audit de sécurité.</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {generatedPin ? (
            <button onClick={() => { setGeneratedPin(null); onClose(); }} className={btnPrimary}>Fermer</button>
          ) : (
            <>
              <button onClick={onClose} className={btnSecondary}>Annuler</button>
              <button onClick={handleReset} disabled={loading} className={btnPrimary}>{loading ? "…" : "Réinitialiser"}</button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
