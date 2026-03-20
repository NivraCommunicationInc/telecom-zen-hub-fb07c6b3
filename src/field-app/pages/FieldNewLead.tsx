/**
 * FieldNewLead — Create a new field lead with qualification form.
 * Mobile-first, step-by-step form.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { cn } from "@/lib/utils";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { toast } from "sonner";

const SERVICE_OPTIONS = [
  "Internet",
  "Mobile",
  "TV",
  "Internet + TV",
  "Internet + Mobile",
  "Combo complet",
  "Autre",
];

const PAYMENT_INTENTS = [
  "Carte de crédit",
  "Virement Interac",
  "Paiement comptant",
  "À déterminer",
];

export default function FieldNewLead() {
  const navigate = useNavigate();
  const { user } = useStaffUser();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postal_code: "",
    service_need: "",
    eligibility_notes: "",
    payment_method_intent: "",
    notes: "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canSubmit = form.first_name.trim() && form.last_name.trim() && form.phone.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user?.id) return;

    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const { error } = await supabase.from("field_leads").insert({
        agent_id: user.id,
        agent_name: profile?.full_name || "Agent",
        ...form,
      });

      if (error) throw error;

      await logInternalAudit({
        action: "create_lead",
        category: "operations",
        portal: "field",
        details: { first_name: form.first_name, last_name: form.last_name },
      });

      toast.success("Lead créé avec succès");
      navigate(fieldPath("/leads"));
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la création du lead");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg border border-[hsl(225,15%,14%)] bg-[hsl(225,20%,8%)] text-sm text-white placeholder:text-[hsl(220,10%,35%)] focus:outline-none focus:border-amber-500/50";

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(fieldPath("/leads"))} className="p-2 rounded-lg hover:bg-[hsl(225,15%,12%)] transition-colors">
          <ArrowLeft className="h-4 w-4 text-[hsl(220,10%,45%)]" />
        </button>
        <h1 className="text-xl font-bold tracking-tight">Nouveau lead</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Contact */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-[hsl(220,10%,50%)] uppercase tracking-wider mb-2">
            Contact
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Prénom *" value={form.first_name} onChange={(e) => update("first_name", e.target.value)} className={inputClass} required />
            <input placeholder="Nom *" value={form.last_name} onChange={(e) => update("last_name", e.target.value)} className={inputClass} required />
          </div>
          <input placeholder="Téléphone *" value={form.phone} onChange={(e) => update("phone", e.target.value)} className={inputClass} required type="tel" />
          <input placeholder="Email" value={form.email} onChange={(e) => update("email", e.target.value)} className={inputClass} type="email" />
        </fieldset>

        {/* Address */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-[hsl(220,10%,50%)] uppercase tracking-wider mb-2">
            Adresse
          </legend>
          <input placeholder="Adresse" value={form.address} onChange={(e) => update("address", e.target.value)} className={inputClass} />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Ville" value={form.city} onChange={(e) => update("city", e.target.value)} className={inputClass} />
            <input placeholder="Code postal" value={form.postal_code} onChange={(e) => update("postal_code", e.target.value)} className={inputClass} />
          </div>
        </fieldset>

        {/* Qualification */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-[hsl(220,10%,50%)] uppercase tracking-wider mb-2">
            Qualification
          </legend>
          <div>
            <label className="text-[11px] text-[hsl(220,10%,45%)] mb-1 block">Besoin de service</label>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => update("service_need", s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    form.service_need === s
                      ? "bg-amber-600/20 text-amber-400 border-amber-500/30"
                      : "text-[hsl(220,10%,50%)] border-[hsl(225,15%,14%)] hover:border-[hsl(225,15%,20%)]"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-[hsl(220,10%,45%)] mb-1 block">Méthode de paiement préférée</label>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_INTENTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => update("payment_method_intent", p)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    form.payment_method_intent === p
                      ? "bg-amber-600/20 text-amber-400 border-amber-500/30"
                      : "text-[hsl(220,10%,50%)] border-[hsl(225,15%,14%)] hover:border-[hsl(225,15%,20%)]"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <textarea
            placeholder="Notes d'éligibilité / disponibilité…"
            value={form.eligibility_notes}
            onChange={(e) => update("eligibility_notes", e.target.value)}
            rows={2}
            className={inputClass}
          />
          <textarea
            placeholder="Notes internes…"
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={2}
            className={inputClass}
          />
        </fieldset>

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-600 text-white font-semibold text-sm hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Créer le lead
        </button>
      </form>
    </div>
  );
}
