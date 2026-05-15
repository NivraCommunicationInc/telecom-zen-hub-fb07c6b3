/**
 * Account360ProfileEditDialog — Direct client profile/account editing from Core Account 360.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: any;
  profile: any;
  clientId?: string;
  onSaved: () => void;
  isAdminCore?: boolean;
}

const PROVINCES = ["QC", "ON", "BC", "AB", "MB", "NB", "NL", "NS", "PE", "SK", "NT", "NU", "YT"];

const formSchema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis").max(100),
  last_name: z.string().trim().min(1, "Nom requis").max(100),
  email: z.string().trim().email("Email invalide").max(255),
  phone: z.string().trim().max(25).optional().or(z.literal("")),
  date_of_birth: z.string().optional().or(z.literal("")),
  primary_service_address: z.string().trim().max(255).optional().or(z.literal("")),
  primary_service_city: z.string().trim().max(100).optional().or(z.literal("")),
  primary_service_province: z.string().trim().max(8).optional().or(z.literal("")),
  primary_service_postal_code: z.string().trim().max(12).optional().or(z.literal("")),
  billing_address: z.string().trim().max(255).optional().or(z.literal("")),
  billing_city: z.string().trim().max(100).optional().or(z.literal("")),
  billing_province: z.string().trim().max(8).optional().or(z.literal("")),
  billing_postal_code: z.string().trim().max(12).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

const normalizePostal = (v?: string | null) => (v || "").trim().toUpperCase();
const normalizeEmail = (v?: string | null) => (v || "").trim().toLowerCase();

const buildInitial = (account: any, profile: any): FormValues => ({
  first_name: profile?.first_name || "",
  last_name: profile?.last_name || "",
  email: profile?.email || "",
  phone: profile?.phone || "",
  date_of_birth: profile?.date_of_birth || "",
  primary_service_address: account?.primary_service_address || "",
  primary_service_city: account?.primary_service_city || "",
  primary_service_province: account?.primary_service_province || "QC",
  primary_service_postal_code: account?.primary_service_postal_code || "",
  billing_address: account?.billing_address || "",
  billing_city: account?.billing_city || "",
  billing_province: account?.billing_province || "QC",
  billing_postal_code: account?.billing_postal_code || "",
});

export function Account360ProfileEditDialog({ open, onOpenChange, account, profile, clientId, onSaved, isAdminCore = false }: Props) {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const initial = useMemo(() => buildInitial(account, profile), [account, profile]);
  const [form, setForm] = useState<FormValues>(initial);

  useEffect(() => {
    if (open) {
      setForm(initial);
      setErrors({});
    }
  }, [open, initial]);

  const setField = (key: keyof FormValues, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = () => {
    const candidate: FormValues = {
      ...form,
      email: normalizeEmail(form.email),
      primary_service_postal_code: normalizePostal(form.primary_service_postal_code),
      billing_postal_code: normalizePostal(form.billing_postal_code),
    };

    const parsed = formSchema.safeParse(candidate);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0] as string;
        nextErrors[key] = issue.message;
      });
      setErrors(nextErrors);
      return null;
    }

    if (candidate.phone && !/^[0-9+()\-\s]{7,25}$/.test(candidate.phone)) {
      setErrors((prev) => ({ ...prev, phone: "Téléphone invalide" }));
      return null;
    }

    if (candidate.date_of_birth && Number.isNaN(new Date(candidate.date_of_birth).getTime())) {
      setErrors((prev) => ({ ...prev, date_of_birth: "Date de naissance invalide" }));
      return null;
    }

    return parsed.data;
  };

  const diffMap = (base: FormValues, current: FormValues) => {
    const changed: Record<string, { before: string; after: string }> = {};
    (Object.keys(current) as (keyof FormValues)[]).forEach((k) => {
      if ((base[k] || "") !== (current[k] || "")) {
        changed[k] = { before: base[k] || "", after: current[k] || "" };
      }
    });
    return changed;
  };

  const handleSave = async () => {
    if (!account?.id || !clientId) {
      toast.error("Contexte client introuvable");
      return;
    }

    const valid = validate();
    if (!valid) return;

    const cleaned: FormValues = {
      ...valid,
      email: normalizeEmail(valid.email),
      primary_service_postal_code: normalizePostal(valid.primary_service_postal_code),
      billing_postal_code: normalizePostal(valid.billing_postal_code),
    };

    const changed = diffMap(initial, cleaned);
    if (Object.keys(changed).length === 0) {
      toast.info("Aucune modification détectée");
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user?.id) throw new Error("Session admin invalide");

      const profilePatch: Record<string, any> = {};
      const accountPatch: Record<string, any> = {};

      ["first_name", "last_name", "email", "phone", "date_of_birth"].forEach((k) => {
        if (changed[k]) profilePatch[k] = cleaned[k as keyof FormValues] || null;
      });

      [
        "primary_service_address", "primary_service_city", "primary_service_province", "primary_service_postal_code",
        "billing_address", "billing_city", "billing_province", "billing_postal_code",
      ].forEach((k) => {
        if (changed[k]) accountPatch[k] = cleaned[k as keyof FormValues] || null;
      });

      if (Object.keys(profilePatch).length > 0) {
        if (changed.first_name || changed.last_name) {
          profilePatch.full_name = `${cleaned.first_name} ${cleaned.last_name}`.trim();
        }
        const { error } = await supabase
          .from("profiles")
          .update(profilePatch)
          .eq("user_id", clientId);
        if (error) throw error;
      }

      if (Object.keys(accountPatch).length > 0) {
        const { error } = await supabase
          .from("accounts")
          .update({ ...accountPatch, updated_at: new Date().toISOString() })
          .eq("id", account.id);
        if (error) throw error;
      }

      const changedFields = Object.keys(changed);
      const { error: auditError } = await supabase.from("client_activity_logs").insert({
        client_id: clientId,
        actor_user_id: authData.user.id,
        actor_role: "admin",
        actor_name: authData.user.email || "admin",
        action_type: "profile_update",
        summary: `Mise à jour profil client (${changedFields.join(", ")})`,
        entity_type: "account_profile",
        entity_id: account.id,
        before_data: Object.fromEntries(changedFields.map((f) => [f, changed[f].before])),
        after_data: Object.fromEntries(changedFields.map((f) => [f, changed[f].after])),
      });
      if (auditError) throw auditError;

      toast.success("Profil client mis à jour");
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPen className="h-4 w-4 text-primary" />
            Modifier le profil client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Informations personnelles</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Prénom" value={form.first_name} onChange={(v) => setField("first_name", v)} error={errors.first_name} />
              <Field label="Nom" value={form.last_name} onChange={(v) => setField("last_name", v)} error={errors.last_name} />
              <Field label="Email" type="email" value={form.email} onChange={(v) => setField("email", v)} error={errors.email} />
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
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Adresse service</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Field label="Adresse service" value={form.primary_service_address || ""} onChange={(v) => setField("primary_service_address", v)} error={errors.primary_service_address} />
              </div>
              <Field label="Ville" value={form.primary_service_city || ""} onChange={(v) => setField("primary_service_city", v)} error={errors.primary_service_city} />
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Province" value={form.primary_service_province || "QC"} onChange={(v) => setField("primary_service_province", v)} options={PROVINCES} />
                <Field label="Code postal" value={form.primary_service_postal_code || ""} onChange={(v) => setField("primary_service_postal_code", v)} error={errors.primary_service_postal_code} />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Adresse facturation</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Field label="Adresse facturation" value={form.billing_address || ""} onChange={(v) => setField("billing_address", v)} error={errors.billing_address} />
              </div>
              <Field label="Ville" value={form.billing_city || ""} onChange={(v) => setField("billing_city", v)} error={errors.billing_city} />
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Province" value={form.billing_province || "QC"} onChange={(v) => setField("billing_province", v)} options={PROVINCES} />
                <Field label="Code postal" value={form.billing_postal_code || ""} onChange={(v) => setField("billing_postal_code", v)} error={errors.billing_postal_code} />
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

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
