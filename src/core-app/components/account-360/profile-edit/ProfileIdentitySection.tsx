/**
 * Module 52 Phase B — Identity section of the Profile Edit orchestrator.
 * Writes go exclusively through `client-account-actions` (profile.update).
 * Fields: first_name, last_name, date_of_birth.
 * Phone/email are handled by ProfileContactSection (OTP flows).
 * Language lives in ProfilePreferencesSection.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, UserPen } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { callCoreAction } from "@/core-app/lib/callCoreAction";

interface Props {
  account: any;
  profile: any;
  isAdminCore?: boolean;
  onSaved: () => void;
}

const schema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis").max(80),
  last_name: z.string().trim().min(1, "Nom requis").max(80),
  date_of_birth: z.string().optional().or(z.literal("")),
});

type Values = z.infer<typeof schema>;

const initFrom = (p: any): Values => ({
  first_name: p?.first_name || "",
  last_name: p?.last_name || "",
  date_of_birth: p?.date_of_birth || "",
});

export function ProfileIdentitySection({ account, profile, isAdminCore, onSaved }: Props) {
  const initial = useMemo(() => initFrom(profile), [profile]);
  const [form, setForm] = useState<Values>(initial);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(initial); setReason(""); setErrors({}); }, [initial]);

  const set = (k: keyof Values, v: string) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setErrors((prev) => { const n = { ...prev }; delete n[k]; return n; });
  };

  const diff = () => {
    const patch: Record<string, string | null> = {};
    (Object.keys(form) as (keyof Values)[]).forEach((k) => {
      const before = (initial[k] ?? "") as string;
      const after = (form[k] ?? "") as string;
      if (before !== after) patch[k] = (after || null) as any;
    });
    return patch;
  };

  const save = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { e[i.path[0] as string] = i.message; });
      setErrors(e);
      return;
    }
    if (parsed.data.date_of_birth && Number.isNaN(new Date(parsed.data.date_of_birth).getTime())) {
      setErrors({ date_of_birth: "Date invalide" });
      return;
    }
    const patch = diff();
    if (Object.keys(patch).length === 0) {
      toast.info("Aucune modification détectée");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Raison obligatoire (min. 3 caractères)");
      return;
    }
    setSaving(true);
    try {
      const correlationId = crypto.randomUUID();
      const idempotencyKey = `profile-identity:${account.id}:${new Date().toISOString().slice(0, 16)}:${Object.keys(patch).sort().join(",")}`;
      const res = await callCoreAction("client-account-actions", {
        action: "profile.update",
        account_id: account.id,
        payload: patch,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
      }, {
        reason,
        successMessage: "Identité mise à jour",
        errorMessage: "Échec de la mise à jour d'identité",
      });
      if (!res.ok) return;
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const dobLocked = profile?.dob_locked && !isAdminCore;

  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2">
        <UserPen className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Identité</h3>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Prénom</Label>
          <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} className={errors.first_name ? "border-destructive" : ""} />
          {errors.first_name && <p className="text-[10px] text-destructive">{errors.first_name}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Nom</Label>
          <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} className={errors.last_name ? "border-destructive" : ""} />
          {errors.last_name && <p className="text-[10px] text-destructive">{errors.last_name}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Date de naissance {dobLocked && "🔒"}</Label>
          {dobLocked ? (
            <div className="flex items-center h-9 px-3 rounded-md border border-input bg-muted text-sm text-muted-foreground">
              {form.date_of_birth || "Non renseignée"}
            </div>
          ) : (
            <Input type="date" value={form.date_of_birth || ""} onChange={(e) => set("date_of_birth", e.target.value)} />
          )}
          {errors.date_of_birth && <p className="text-[10px] text-destructive">{errors.date_of_birth}</p>}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Raison de la modification (obligatoire)</Label>
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: correction demandée par le client (ticket #12345)" />
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Sauvegarde…</> : "Enregistrer identité"}
        </Button>
      </div>
    </section>
  );
}
