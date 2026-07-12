/**
 * Module 52 Phase B — Phone change dialog.
 * Two-step workflow via client-account-actions:
 *   1) phone.request_change  → creates request + enqueues SMS OTP
 *   2) phone.verify_otp      → applies new phone if OTP matches
 * Reason is mandatory on request. Correlation ID propagated across calls.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { callCoreAction } from "@/core-app/lib/callCoreAction";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  account: any;
  currentPhone?: string | null;
  onSaved: () => void;
}

export function PhoneChangeOtpDialog({ open, onOpenChange, account, currentPhone, onSaved }: Props) {
  const [step, setStep] = useState<"request" | "verify">("request");
  const [newPhone, setNewPhone] = useState("");
  const [reason, setReason] = useState("");
  const [otp, setOtp] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setStep("request"); setNewPhone(""); setReason(""); setOtp(""); setRequestId(null); setCorrelationId(null); }
  }, [open]);

  const request = async () => {
    if (!/^\+?[\d\s\-()]{7,20}$/.test(newPhone)) return toast.error("Numéro de téléphone invalide");
    if (reason.trim().length < 3) return toast.error("Raison obligatoire");
    setBusy(true);
    try {
      const cid = crypto.randomUUID();
      const res = await callCoreAction("client-account-actions", {
        action: "phone.request_change",
        account_id: account.id,
        payload: { new_phone: newPhone.trim() },
        idempotency_key: `phone-req:${account.id}:${newPhone.replace(/\D/g, "")}:${Date.now()}`,
        correlation_id: cid,
      }, { reason, successMessage: "OTP envoyé par SMS", errorMessage: "Échec de la demande" });
      if (!res.ok) return;
      const reqId = (res.data as any)?.request_id;
      if (!reqId) { toast.error("request_id manquant"); return; }
      setCorrelationId(cid); setRequestId(reqId); setStep("verify");
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!/^\d{6}$/.test(otp.trim())) return toast.error("OTP à 6 chiffres");
    if (!requestId) return toast.error("Aucune requête en cours");
    setBusy(true);
    try {
      const res = await callCoreAction("client-account-actions", {
        action: "phone.verify_otp",
        account_id: account.id,
        payload: { request_id: requestId, otp: otp.trim() },
        idempotency_key: `phone-verify:${requestId}`,
        correlation_id: correlationId ?? crypto.randomUUID(),
      }, { reason: `Vérification OTP (req ${requestId})`, successMessage: "Téléphone mis à jour", errorMessage: "OTP invalide" });
      if (!res.ok) return;
      onOpenChange(false);
      onSaved();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> Changer le téléphone</DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Téléphone actuel : <span className="font-mono">{currentPhone || "—"}</span>
          </DialogDescription>
        </DialogHeader>

        {step === "request" ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Nouveau téléphone</Label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+1 514 555-1234" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Raison (obligatoire)</Label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: mise à jour à la demande du client" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">Entrez le code à 6 chiffres reçu par SMS.</p>
            <div className="space-y-1">
              <Label className="text-[11px]">OTP</Label>
              <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" inputMode="numeric" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>Annuler</Button>
          {step === "request" ? (
            <Button size="sm" onClick={request} disabled={busy}>
              {busy ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Envoi…</> : "Envoyer OTP"}
            </Button>
          ) : (
            <Button size="sm" onClick={confirm} disabled={busy}>
              {busy ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Vérification…</> : "Vérifier"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
