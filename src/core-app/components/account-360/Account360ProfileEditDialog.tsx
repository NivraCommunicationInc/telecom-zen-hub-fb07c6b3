/**
 * Account360ProfileEditDialog — Core Account 360 client profile editor.
 *
 * Module 49 Phase B2: routes all writes through the canonical
 * `client-account-actions` Edge Function via callCoreAction.
 * No more direct .from("profiles").update / .from("accounts").update.
 *
 * Scope of this dialog is now PROFILE FIELDS ONLY:
 *   first_name, last_name, phone, date_of_birth, preferred_language
 *
 * Address editing (service + billing) has its own dedicated managers
 * (ServiceAddressPicker + ClientBillingAddressSection) which also use the gateway.
 * Email change goes through the email_change_requests workflow (unchanged).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPen } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { callCoreAction } from "@/core-app/lib/callCoreAction";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: any;
  profile: any;
  clientId?: string;
  onSaved: () => void;
  isAdminCore?: boolean;
}

const formSchema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis").max(80),
  last_name: z.string().trim().min(1, "Nom requis").max(80),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  date_of_birth: z.string().optional().or(z.literal("")),
  preferred_language: z.enum(["fr", "en"]).optional(),
});

type FormValues = z.infer<typeof formSchema>;

const buildInitial = (profile: any): FormValues => ({
  first_name: profile?.first_name || "",
  last_name: profile?.last_name || "",
  phone: profile?.phone || "",
  date_of_birth: profile?.date_of_birth || "",
  preferred_language: (profile?.preferred_language as "fr" | "en") || "fr",
});

export function Account360ProfileEditDialog({ open, onOpenChange, account, profile, clientId, onSaved, isAdminCore = false }: Props) {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const initial = useMemo(() => buildInitial(profile), [profile]);
  const [form, setForm] = useState<FormValues>(initial);

  useEffect(() => {
    if (open) {
      setForm(initial);
      setErrors({});
    }
  }, [open, initial]);

  const setField = (key: keyof FormValues, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value as any }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = () => {
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0] as string;
        nextErrors[key] = issue.message;
      });
      setErrors(nextErrors);
      return null;
    }
    if (parsed.data.phone && !/^[0-9+()\-\s]{7,25}$/.test(parsed.data.phone)) {
      setErrors((prev) => ({ ...prev, phone: "Téléphone invalide" }));
      return null;
    }
    if (parsed.data.date_of_birth && Number.isNaN(new Date(parsed.data.date_of_birth).getTime())) {
      setErrors((prev) => ({ ...prev, date_of_birth: "Date de naissance invalide" }));
      return null;
    }
    return parsed.data;
  };

  const buildDiffPayload = (base: FormValues, current: FormValues): Record<string, string | null> => {
    const patch: Record<string, string | null> = {};
    (Object.keys(current) as (keyof FormValues)[]).forEach((k) => {
      const before = (base[k] ?? "") as string;
      const after = (current[k] ?? "") as string;
      if (before !== after) {
        patch[k] = (after || null) as any;
      }
    });
    return patch;
  };

  const handleSave = async () => {
    if (!account?.id) {
      toast.error("Contexte client introuvable");
      return;
    }
    const valid = validate();
    if (!valid) return;

    const patch = buildDiffPayload(initial, valid);
    // Module 50: phone changes now require the OTP workflow — strip from profile.update.
    if ('phone' in patch) {
      delete (patch as any).phone;
      toast.info("Le changement de téléphone requiert une vérification OTP (à venir).");
    }
    if (Object.keys(patch).length === 0) {
      toast.info("Aucune modification détectée");
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      const idempotencyKey = `profile-update:${account.id}:${new Date().toISOString().slice(0, 16)}:${Object.keys(patch).sort().join(",")}`;
      const correlationId = crypto.randomUUID();
      const res = await callCoreAction("client-account-actions", {
        action: "profile.update",
        account_id: account.id,
        payload: patch,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      }, {
        reason: `Modification du profil client (${Object.keys(patch).join(", ")})`,
        successMessage: "Profil client mis à jour",
        errorMessage: "Échec de la mise à jour du profil",
      });
      if (!res.ok) return; // toast already shown
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Erreur pendant la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPen className="h-4 w-4 text-primary" />
            Modifier le profil client
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            L'adresse de service et l'adresse de facturation se gèrent via leurs modules dédiés.
            Le changement d'email suit le flux <code>email_change_requests</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Informations personnelles</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Prénom" value={form.first_name} onChange={(v) => setField("first_name", v)} error={errors.first_name} />
              <Field label="Nom" value={form.last_name} onChange={(v) => setField("last_name", v)} error={errors.last_name} />
              <Field label="Téléphone" value={form.phone || ""} onChange={(v) => setField("phone", v)} error={errors.phone} />
              {profile?.dob_locked && !isAdminCore ? (
                <div>
                  <Label className="text-[11px] text-muted-foreground">Date de naissance 🔒</Label>
                  <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-muted text-sm text-muted-foreground">
                    {form.date_of_birth || "Non renseignée"}
                    <span className="text-[10px]" title="Modification réservée à admin_core">Verrouillé</span>
                  </div>
                </div>
              ) : (
                <Field label="Date de naissance" type="date" value={form.date_of_birth || ""} onChange={(v) => setField("date_of_birth", v)} error={errors.date_of_birth} />
              )}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Langue préférée</Label>
                <Select value={form.preferred_language || "fr"} onValueChange={(v) => setField("preferred_language", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sauvegarde...</> : "Sauvegarder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={error ? "border-destructive" : ""} />
      {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
    </div>
  );
}
