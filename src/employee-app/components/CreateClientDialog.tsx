/**
 * CreateClientDialog — Employee creates a new client (profile + account).
 * Direct action: no Core approval required.
 *
 * Inserts:
 *   1. profiles (full_name, first_name, last_name, email, phone, dob, address)
 *   2. accounts  (account_number auto-generated, billing/service address)
 *
 * The auth user is NOT created here — clients are created as profile-only
 * records that can later be claimed via portal signup using their email.
 *
 * On success → redirects to /employee/clients/:user_id
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UserPlus, X } from "lucide-react";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { z } from "zod";

interface Props {
  open: boolean;
  onClose: () => void;
}

const schema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis").max(80),
  last_name: z.string().trim().min(1, "Nom requis").max(80),
  email: z.string().trim().email("Courriel invalide").max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  date_of_birth: z.string().optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  postal: z.string().trim().max(10).optional().or(z.literal("")),
  province: z.string().trim().min(2).max(2),
});

export default function CreateClientDialog({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    address: "",
    city: "",
    postal: "",
    province: "QC",
  });

  if (!open) return null;

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const firstErr = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      toast.error(firstErr ?? "Champs invalides");
      return;
    }
    const v = parsed.data;
    setSubmitting(true);
    try {
      // 1) Verify email not already used
      const { data: existing } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", v.email)
        .maybeSingle();
      if (existing) {
        throw new Error("Un client existe déjà avec ce courriel");
      }

      // 2) Generate identifiers
      const newUserId = crypto.randomUUID();
      const fullName = `${v.first_name} ${v.last_name}`.trim();
      const clientNumber = `CL-${Date.now().toString(36).toUpperCase()}`;
      const accountNumber = `AC-${Date.now().toString(36).toUpperCase()}`;

      // 3) Insert profile
      const { error: profErr } = await supabase.from("profiles").insert({
        user_id: newUserId,
        client_number: clientNumber,
        first_name: v.first_name,
        last_name: v.last_name,
        full_name: fullName,
        email: v.email,
        phone: v.phone || null,
        date_of_birth: v.date_of_birth || null,
        service_address: v.address || null,
        service_city: v.city || null,
        service_postal_code: v.postal || null,
        service_province: v.province,
        client_type: "individual",
        account_status: "active",
      });
      if (profErr) throw profErr;

      // 4) Insert account (mirrors service address as billing address)
      const { data: account, error: acctErr } = await supabase
        .from("accounts")
        .insert({
          client_id: newUserId,
          account_number: accountNumber,
          account_name: "Primary",
          status: "active",
          billing_address: v.address || null,
          billing_city: v.city || null,
          billing_postal_code: v.postal || null,
          billing_province: v.province,
          primary_service_address: v.address || null,
          primary_service_city: v.city || null,
          primary_service_postal_code: v.postal || null,
          primary_service_province: v.province,
        })
        .select("id")
        .single();
      if (acctErr) throw acctErr;

      // 5) Audit log
      await logInternalAudit({
        action: "client_created_by_employee",
        category: "operations",
        portal: "employee",
        targetType: "profile",
        targetId: newUserId,
        details: {
          client_number: clientNumber,
          account_number: accountNumber,
          email: v.email,
          full_name: fullName,
        },
      });

      toast.success(`Client ${fullName} créé`);
      onClose();
      navigate(employeePath(`/clients/${newUserId}`));
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-client-title"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <h2 id="create-client-title" className="text-sm font-semibold text-foreground">
              Nouveau client
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom *" value={form.first_name} onChange={(v) => update("first_name", v)} required />
            <Field label="Nom *" value={form.last_name} onChange={(v) => update("last_name", v)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Courriel *" type="email" value={form.email} onChange={(v) => update("email", v)} required />
            <Field label="Téléphone" type="tel" value={form.phone} onChange={(v) => update("phone", v)} />
          </div>
          <Field
            label="Date de naissance"
            type="date"
            value={form.date_of_birth}
            onChange={(v) => update("date_of_birth", v)}
          />

          <div className="pt-3 border-t border-border space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Adresse de service
            </h3>
            <Field label="Adresse" value={form.address} onChange={(v) => update("address", v)} />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Ville" value={form.city} onChange={(v) => update("city", v)} />
              <Field label="Code postal" value={form.postal} onChange={(v) => update("postal", v)} />
              <div>
                <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                  Province
                </label>
                <select
                  value={form.province}
                  onChange={(e) => update("province", e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/50 min-h-[44px]"
                >
                  <option value="QC">QC</option>
                  <option value="ON">ON</option>
                  <option value="NB">NB</option>
                  <option value="NS">NS</option>
                  <option value="MB">MB</option>
                  <option value="AB">AB</option>
                  <option value="BC">BC</option>
                  <option value="SK">SK</option>
                  <option value="PE">PE</option>
                  <option value="NL">NL</option>
                  <option value="YT">YT</option>
                  <option value="NT">NT</option>
                  <option value="NU">NU</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border sticky bottom-0 bg-card">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors min-h-[44px]"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2 min-h-[44px]"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Créer le client
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 min-h-[44px]"
      />
    </div>
  );
}
