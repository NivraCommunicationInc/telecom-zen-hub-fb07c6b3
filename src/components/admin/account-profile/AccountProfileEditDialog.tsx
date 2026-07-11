/**
 * AccountProfileEditDialog — Module 50 migration
 *
 * All writes now route through the canonical `client-account-actions`
 * Edge Function gateway (Zod serveur, idempotency, audit, timeline, reason).
 * No more direct .from('profiles').update / .from('accounts').update.
 *
 * Scope:
 *   - Identity (first_name, last_name, date_of_birth, preferred_language) → profile.update
 *   - Email  → email.request_change + email.confirm_change (double opt-in)
 *   - Phone  → phone.request_change + phone.verify_otp (OTP)
 *
 * Address editing has been removed from this dialog. Use the dedicated
 * ServiceAddress / BillingAddress managers in Client 360 (Module 49).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, UserPen, Mail, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { callCoreAction } from "@/core-app/lib/callCoreAction";

const identitySchema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis").max(80),
  last_name: z.string().trim().min(1, "Nom requis").max(80),
  date_of_birth: z.string().optional().or(z.literal("")),
  preferred_language: z.enum(["fr", "en"]).optional(),
});
type IdentityValues = z.infer<typeof identitySchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: any;
  account: any;
  clientId: string;
  onSaved: () => void;
}

const buildInitial = (profile: any): IdentityValues => ({
  first_name: profile?.first_name || "",
  last_name: profile?.last_name || "",
  date_of_birth: profile?.date_of_birth || "",
  preferred_language: (profile?.preferred_language as "fr" | "en") || "fr",
});

export function AccountProfileEditDialog({
  open, onOpenChange, profile, account, onSaved,
}: Props) {
  const initial = useMemo(() => buildInitial(profile), [profile]);
  const [form, setForm] = useState<IdentityValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Email change state
  const [newEmail, setNewEmail] = useState("");
  const [emailReason, setEmailReason] = useState("");
  const [emailRequestId, setEmailRequestId] = useState<string | null>(null);
  const [emailToken, setEmailToken] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  // Phone change state
  const [newPhone, setNewPhone] = useState("");
  const [phoneReason, setPhoneReason] = useState("");
  const [phoneRequestId, setPhoneRequestId] = useState<string | null>(null);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial);
      setErrors({});
      setReason("");
      setNewEmail(""); setEmailReason(""); setEmailRequestId(null); setEmailToken("");
      setNewPhone(""); setPhoneReason(""); setPhoneRequestId(null); setPhoneOtp("");
    }
  }, [open, initial]);

  const setField = (k: keyof IdentityValues, v: string) => {
    setForm((p) => ({ ...p, [k]: v as any }));
    setErrors((prev) => { if (!prev[k]) return prev; const n = { ...prev }; delete n[k as string]; return n; });
  };

  const buildDiff = (): Record<string, string | null> => {
    const patch: Record<string, string | null> = {};
    (Object.keys(form) as (keyof IdentityValues)[]).forEach((k) => {
      const b = (initial[k] ?? "") as string;
      const a = (form[k] ?? "") as string;
      if (b !== a) patch[k as string] = (a || null) as any;
    });
    return patch;
  };

  const handleSaveIdentity = async () => {
    if (!account?.id) { toast.error("Compte introuvable"); return; }
    const parsed = identitySchema.safeParse(form);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { e[i.path[0] as string] = i.message; });
      setErrors(e); return;
    }
    if (reason.trim().length < 3) {
      toast.error("Motif requis (min. 3 caractères)");
      return;
    }
    const patch = buildDiff();
    if (Object.keys(patch).length === 0) {
      toast.info("Aucune modification détectée");
      onOpenChange(false); return;
    }

    setSaving(true);
    try {
      const idempotencyKey = `profile-update:${account.id}:${new Date().toISOString().slice(0, 16)}:${Object.keys(patch).sort().join(",")}`;
      const res = await callCoreAction("client-account-actions", {
        action: "profile.update",
        account_id: account.id,
        payload: patch,
        idempotency_key: idempotencyKey,
        correlation_id: crypto.randomUUID(),
      }, { reason, successMessage: "Profil client mis à jour", errorMessage: "Échec mise à jour profil" });
      if (!res.ok) return;
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleEmailRequest = async () => {
    if (!account?.id) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { toast.error("Courriel invalide"); return; }
    if (emailReason.trim().length < 3) { toast.error("Motif requis (min. 3 caractères)"); return; }
    setEmailBusy(true);
    try {
      const res = await callCoreAction<{ request_id?: string; new_email?: string }>(
        "client-account-actions",
        {
          action: "email.request_change",
          account_id: account.id,
          payload: { new_email: newEmail.trim().toLowerCase() },
          idempotency_key: `email-request:${account.id}:${newEmail}:${Date.now()}`,
          correlation_id: crypto.randomUUID(),
        },
        { reason: emailReason, successMessage: "Courriel de vérification envoyé", errorMessage: "Échec demande changement courriel" },
      );
      if (res.ok && (res.data as any)?.request_id) setEmailRequestId((res.data as any).request_id);
    } finally { setEmailBusy(false); }
  };

  const handleEmailConfirm = async () => {
    if (!account?.id || !emailToken.trim()) return;
    setEmailBusy(true);
    try {
      const res = await callCoreAction(
        "client-account-actions",
        {
          action: "email.confirm_change",
          account_id: account.id,
          payload: { verification_token: emailToken.trim() },
          idempotency_key: `email-confirm:${account.id}:${emailToken.trim().slice(0, 16)}`,
          correlation_id: crypto.randomUUID(),
        },
        { reason: emailReason || "Confirmation changement courriel", successMessage: "Courriel mis à jour", errorMessage: "Échec confirmation courriel" },
      );
      if (res.ok) {
        setEmailRequestId(null); setEmailToken(""); setNewEmail(""); setEmailReason("");
        onSaved();
      }
    } finally { setEmailBusy(false); }
  };

  const handlePhoneRequest = async () => {
    if (!account?.id) return;
    if (!/^\+?[\d\s\-()]{7,20}$/.test(newPhone)) { toast.error("Téléphone invalide"); return; }
    if (phoneReason.trim().length < 3) { toast.error("Motif requis (min. 3 caractères)"); return; }
    setPhoneBusy(true);
    try {
      const res = await callCoreAction<{ request_id?: string }>(
        "client-account-actions",
        {
          action: "phone.request_change",
          account_id: account.id,
          payload: { new_phone: newPhone.trim() },
          idempotency_key: `phone-request:${account.id}:${newPhone}:${Date.now()}`,
          correlation_id: crypto.randomUUID(),
        },
        { reason: phoneReason, successMessage: "Code OTP envoyé par SMS", errorMessage: "Échec demande changement téléphone" },
      );
      if (res.ok && (res.data as any)?.request_id) setPhoneRequestId((res.data as any).request_id);
    } finally { setPhoneBusy(false); }
  };

  const handlePhoneVerify = async () => {
    if (!account?.id || !phoneRequestId) return;
    if (!/^\d{6}$/.test(phoneOtp)) { toast.error("Code OTP à 6 chiffres requis"); return; }
    setPhoneBusy(true);
    try {
      const res = await callCoreAction(
        "client-account-actions",
        {
          action: "phone.verify_otp",
          account_id: account.id,
          payload: { request_id: phoneRequestId, otp: phoneOtp },
          idempotency_key: `phone-verify:${phoneRequestId}:${phoneOtp}`,
          correlation_id: crypto.randomUUID(),
        },
        { reason: phoneReason || "Vérification OTP téléphone", successMessage: "Téléphone mis à jour", errorMessage: "Échec vérification OTP" },
      );
      if (res.ok) {
        setPhoneRequestId(null); setPhoneOtp(""); setNewPhone(""); setPhoneReason("");
        onSaved();
      }
    } finally { setPhoneBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPen className="h-5 w-5 text-primary" /> Modifier le profil client
          </DialogTitle>
          <DialogDescription className="text-xs">
            Toutes les modifications passent par la passerelle canonique (audit, idempotency, timeline).
            L'édition des adresses est disponible dans les modules dédiés du Client 360.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Identity */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Identité
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Prénom *" value={form.first_name} onChange={(v) => setField("first_name", v)} error={errors.first_name} />
              <Field label="Nom *" value={form.last_name} onChange={(v) => setField("last_name", v)} error={errors.last_name} />
              <Field label="Date de naissance" type="date" value={form.date_of_birth || ""} onChange={(v) => setField("date_of_birth", v)} error={errors.date_of_birth} />
              <div className="space-y-1.5">
                <Label className="text-xs">Langue préférée</Label>
                <Select value={form.preferred_language || "fr"} onValueChange={(v) => setField("preferred_language", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Motif de la modification *</Label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex : correction demandée par le client" />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveIdentity} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Sauvegarde…</> : "Enregistrer identité"}
              </Button>
            </div>
          </section>

          <Separator />

          {/* Email change — double opt-in */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Courriel — double opt-in
            </p>
            <p className="text-xs text-muted-foreground">Courriel actuel : <span className="font-mono">{profile?.email || "—"}</span></p>
            {!emailRequestId ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nouveau courriel" type="email" value={newEmail} onChange={setNewEmail} />
                  <Field label="Motif *" value={emailReason} onChange={setEmailReason} />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={handleEmailRequest} disabled={emailBusy || !newEmail}>
                    {emailBusy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Envoi…</> : "Envoyer le lien de vérification"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs">Demande créée. Saisir le token reçu par courriel pour confirmer.</p>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                  <Field label="Token de vérification" value={emailToken} onChange={setEmailToken} />
                  <div className="flex items-end gap-2">
                    <Button size="sm" onClick={handleEmailConfirm} disabled={emailBusy || !emailToken}>
                      {emailBusy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />…</> : "Confirmer"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEmailRequestId(null); setEmailToken(""); }}>Annuler</Button>
                  </div>
                </div>
              </>
            )}
          </section>

          <Separator />

          {/* Phone change — OTP */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> Téléphone — OTP SMS
            </p>
            <p className="text-xs text-muted-foreground">Téléphone actuel : <span className="font-mono">{profile?.phone || "—"}</span></p>
            {!phoneRequestId ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nouveau téléphone" type="tel" value={newPhone} onChange={setNewPhone} />
                  <Field label="Motif *" value={phoneReason} onChange={setPhoneReason} />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={handlePhoneRequest} disabled={phoneBusy || !newPhone}>
                    {phoneBusy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Envoi…</> : "Envoyer le code OTP"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs">Code OTP envoyé. Saisir le code à 6 chiffres.</p>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                  <Field label="Code OTP" value={phoneOtp} onChange={(v) => setPhoneOtp(v.replace(/\D/g, "").slice(0, 6))} />
                  <div className="flex items-end gap-2">
                    <Button size="sm" onClick={handlePhoneVerify} disabled={phoneBusy || phoneOtp.length !== 6}>
                      {phoneBusy ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />…</> : "Vérifier"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setPhoneRequestId(null); setPhoneOtp(""); }}>Annuler</Button>
                  </div>
                </div>
              </>
            )}
          </section>

          <Separator />

          {/* Address deprecation notice */}
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
            <p className="font-semibold text-amber-700 dark:text-amber-400">Adresses — modules dédiés</p>
            <p className="text-muted-foreground mt-1">
              L'édition des adresses de service et de facturation se fait désormais dans les modules
              Client 360 — <code>ServiceAddressPicker</code> et <code>ClientBillingAddressSection</code>.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label, value, onChange, error, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; error?: string; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={`h-9 text-sm ${error ? "border-destructive" : ""}`} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
