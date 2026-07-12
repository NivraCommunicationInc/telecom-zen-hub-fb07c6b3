/**
 * Module 52 Phase B — Email change dialog.
 * Two-step workflow via client-account-actions:
 *   1) email.request_change  → creates request + enqueues verification token
 *   2) email.confirm_change  → applies new email via SECURITY DEFINER RPC
 * Reason is mandatory. Correlation ID propagated across both calls.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { callCoreAction } from "@/core-app/lib/callCoreAction";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  account: any;
  currentEmail?: string | null;
  onSaved: () => void;
}

export function EmailChangeOtpDialog({ open, onOpenChange, account, currentEmail, onSaved }: Props) {
  const [step, setStep] = useState<"request" | "verify">("request");
  const [newEmail, setNewEmail] = useState("");
  const [reason, setReason] = useState("");
  const [token, setToken] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("request"); setNewEmail(""); setReason(""); setToken("");
      setRequestId(null); setCorrelationId(null);
    }
  }, [open]);

  const request = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) return toast.error("Email invalide");
    if (reason.trim().length < 3) return toast.error("Raison obligatoire");
    setBusy(true);
    try {
      const cid = crypto.randomUUID();
      const res = await callCoreAction("client-account-actions", {
        action: "email.request_change",
        account_id: account.id,
        payload: { new_email: newEmail.trim() },
        idempotency_key: `email-req:${account.id}:${newEmail.trim().toLowerCase()}:${Date.now()}`,
        correlation_id: cid,
      }, { reason, successMessage: "Email de vérification envoyé", errorMessage: "Échec de la demande" });
      if (!res.ok) return;
      setCorrelationId(cid);
      setRequestId((res.data as any)?.request_id ?? null);
      setStep("verify");
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!token.trim() || token.trim().length < 16) return toast.error("Jeton de vérification invalide");
    setBusy(true);
    try {
      const res = await callCoreAction("client-account-actions", {
        action: "email.confirm_change",
        account_id: account.id,
        payload: { verification_token: token.trim() },
        idempotency_key: `email-confirm:${account.id}:${token.trim().slice(0, 16)}`,
        correlation_id: correlationId ?? crypto.randomUUID(),
      }, { reason: `Confirmation changement email (req ${requestId ?? "n/a"})`, successMessage: "Email mis à jour", errorMessage: "Échec de la confirmation" });
      if (!res.ok) return;
      onOpenChange(false);
      onSaved();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> Changer l'email</DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Email actuel : <span className="font-mono">{currentEmail || "—"}</span>
          </DialogDescription>
        </DialogHeader>

        {step === "request" ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Nouvel email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Raison (obligatoire)</Label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: demande client par téléphone (ticket #12345)" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Un lien de vérification a été envoyé au nouvel email. Collez le jeton reçu ci-dessous pour finaliser.
            </p>
            <div className="space-y-1">
              <Label className="text-[11px]">Jeton de vérification</Label>
              <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="verification_token" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>Annuler</Button>
          {step === "request" ? (
            <Button size="sm" onClick={request} disabled={busy}>
              {busy ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Envoi…</> : "Envoyer vérification"}
            </Button>
          ) : (
            <Button size="sm" onClick={confirm} disabled={busy}>
              {busy ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Confirmation…</> : "Confirmer"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
