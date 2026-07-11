/**
 * AccountProfileEditDialog — Full CRM profile edit with validation & audit logging
 */
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, UserPen } from "lucide-react";
import { adminClient as supabase } from "@/integrations/backend";
import { writeAccountJournal } from "@/lib/writeAccountJournal";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";

const PROVINCES = [
  "QC", "ON", "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "PE", "SK", "YT",
];

const profileSchema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis").max(100),
  last_name: z.string().trim().min(1, "Nom requis").max(100),
  email: z.string().trim().email("Courriel invalide").max(255),
  phone: z.string().trim().min(10, "Téléphone invalide (min 10 car.)").max(20).regex(/^[\d+\-() ]+$/, "Format téléphone invalide"),
  date_of_birth: z.string().optional(),
});

const addressSchema = z.object({
  billing_address: z.string().trim().max(255).optional(),
  billing_city: z.string().trim().max(100).optional(),
  billing_province: z.string().max(5).optional(),
  billing_postal_code: z.string().trim().max(10).optional(),
  primary_service_address: z.string().trim().max(255).optional(),
  primary_service_city: z.string().trim().max(100).optional(),
  primary_service_province: z.string().max(5).optional(),
  primary_service_postal_code: z.string().trim().max(10).optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: any;
  account: any;
  clientId: string;
  onSaved: () => void;
}

interface FormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  billing_address: string;
  billing_city: string;
  billing_province: string;
  billing_postal_code: string;
  primary_service_address: string;
  primary_service_city: string;
  primary_service_province: string;
  primary_service_postal_code: string;
}

export function AccountProfileEditDialog({ open, onOpenChange, profile, account, clientId, onSaved }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const buildInitial = (): FormData => ({
    first_name: profile?.first_name || "",
    last_name: profile?.last_name || "",
    email: profile?.email || "",
    phone: profile?.phone || "",
    date_of_birth: profile?.date_of_birth || "",
    billing_address: account?.billing_address || "",
    billing_city: account?.billing_city || "",
    billing_province: account?.billing_province || "QC",
    billing_postal_code: account?.billing_postal_code || "",
    primary_service_address: account?.primary_service_address || "",
    primary_service_city: account?.primary_service_city || "",
    primary_service_province: account?.primary_service_province || "QC",
    primary_service_postal_code: account?.primary_service_postal_code || "",
  });

  const [form, setForm] = useState<FormData>(buildInitial);

  useEffect(() => {
    if (open) {
      setForm(buildInitial());
      setErrors({});
    }
  }, [open, profile, account]);

  const update = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const validate = (): boolean => {
    const profileResult = profileSchema.safeParse({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone,
      date_of_birth: form.date_of_birth,
    });
    const addressResult = addressSchema.safeParse({
      billing_address: form.billing_address,
      billing_city: form.billing_city,
      billing_province: form.billing_province,
      billing_postal_code: form.billing_postal_code,
      primary_service_address: form.primary_service_address,
      primary_service_city: form.primary_service_city,
      primary_service_province: form.primary_service_province,
      primary_service_postal_code: form.primary_service_postal_code,
    });

    const newErrors: Record<string, string> = {};
    if (!profileResult.success) {
      profileResult.error.issues.forEach(i => { newErrors[i.path[0] as string] = i.message; });
    }
    if (!addressResult.success) {
      addressResult.error.issues.forEach(i => { newErrors[i.path[0] as string] = i.message; });
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const computeChanges = () => {
    const initial = buildInitial();
    const changes: { field: string; old_value: string; new_value: string }[] = [];
    for (const key of Object.keys(form) as (keyof FormData)[]) {
      if (form[key] !== initial[key]) {
        changes.push({ field: key, old_value: initial[key] || "", new_value: form[key] || "" });
      }
    }
    return changes;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const changes = computeChanges();
    if (changes.length === 0) {
      toast.info("Aucune modification détectée");
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      // 1. Update profiles table
      const profileFields = ["first_name", "last_name", "email", "phone", "date_of_birth"];
      const profileChanges = changes.filter(c => profileFields.includes(c.field));
      if (profileChanges.length > 0) {
        const profileUpdate: Record<string, string> = {};
        profileChanges.forEach(c => { profileUpdate[c.field] = c.new_value; });
        // Also update full_name
        if (profileUpdate.first_name || profileUpdate.last_name) {
          profileUpdate.full_name = `${form.first_name.trim()} ${form.last_name.trim()}`.trim();
        }
        const { error } = await supabase
          .from("profiles")
          .update(profileUpdate)
          .eq("user_id", clientId);
        if (error) throw error;
      }

      // 2. Update accounts table
      const accountFields = [
        "billing_address", "billing_city", "billing_province", "billing_postal_code",
        "primary_service_address", "primary_service_city", "primary_service_province", "primary_service_postal_code",
      ];
      const accountChanges = changes.filter(c => accountFields.includes(c.field));
      if (accountChanges.length > 0) {
        const accountUpdate: Record<string, string> = {};
        accountChanges.forEach(c => { accountUpdate[c.field] = c.new_value; });
        const { error } = await supabase
          .from("accounts")
          .update(accountUpdate)
          .eq("id", account.id);
        if (error) throw error;
      }

      // 3. Audit log — one entry per field changed
      const minuteBucket = new Date().toISOString().slice(0, 16);
      for (const c of changes) {
        await writeAccountJournal({
          targetTable: "client_activity_logs",
          eventKey: `profile_edit:${clientId}:${c.field}:${user?.id ?? "anon"}:${minuteBucket}`,
          visibility: "staff",
          payload: {
            client_id: clientId,
            action_type: "profile_edit",
            summary: `Champ "${c.field}" modifié`,
            before_data: { [c.field]: c.old_value },
            after_data: { [c.field]: c.new_value },
          },
        });
      }

      toast.success(`${changes.length} champ(s) mis à jour`);
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPen className="h-5 w-5 text-primary" />
            Modifier le profil client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Identity */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Identité</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Prénom *" value={form.first_name} onChange={v => update("first_name", v)} error={errors.first_name} />
              <Field label="Nom *" value={form.last_name} onChange={v => update("last_name", v)} error={errors.last_name} />
              <Field label="Courriel *" value={form.email} onChange={v => update("email", v)} error={errors.email} type="email" />
              <Field label="Téléphone *" value={form.phone} onChange={v => update("phone", v)} error={errors.phone} type="tel" />
              <Field label="Date de naissance" value={form.date_of_birth} onChange={v => update("date_of_birth", v)} error={errors.date_of_birth} type="date" />
            </div>
          </div>

          <Separator />

          {/* Service address */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Adresse de service</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Field label="Adresse" value={form.primary_service_address} onChange={v => update("primary_service_address", v)} error={errors.primary_service_address} />
              </div>
              <Field label="Ville" value={form.primary_service_city} onChange={v => update("primary_service_city", v)} error={errors.primary_service_city} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Province</Label>
                  <Select value={form.primary_service_province} onValueChange={v => update("primary_service_province", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Code postal" value={form.primary_service_postal_code} onChange={v => update("primary_service_postal_code", v)} error={errors.primary_service_postal_code} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Billing address */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Adresse de facturation</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Field label="Adresse" value={form.billing_address} onChange={v => update("billing_address", v)} error={errors.billing_address} />
              </div>
              <Field label="Ville" value={form.billing_city} onChange={v => update("billing_city", v)} error={errors.billing_city} />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Province</Label>
                  <Select value={form.billing_province} onValueChange={v => update("billing_province", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Code postal" value={form.billing_postal_code} onChange={v => update("billing_postal_code", v)} error={errors.billing_postal_code} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Sauvegarde...</> : "Sauvegarder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, error, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`h-9 text-sm ${error ? "border-destructive" : ""}`}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
