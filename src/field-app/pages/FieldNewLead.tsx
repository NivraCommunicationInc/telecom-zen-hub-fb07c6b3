/**
 * FieldNewLead — Create a new field lead via backend engine.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createNewLead } from "@/field-app/lib/fieldServices";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AddressAutocomplete } from "@/components/shared/AddressAutocomplete";

const SERVICE_OPTIONS = ["Internet", "Mobile", "TV", "Internet + TV", "Internet + Mobile", "Combo complet", "Autre"];
const PAYMENT_INTENTS = ["Carte de crédit", "Virement Interac", "Paiement comptant", "À déterminer"];

export default function FieldNewLead() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", address: "", city: "",
    postal_code: "", service_need: "", eligibility_notes: "", payment_method_intent: "", notes: "",
  });

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const canSubmit = form.first_name.trim() && form.last_name.trim() && form.phone.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      await createNewLead(form);
      toast.success("Lead créé avec succès");
      navigate(fieldPath("/leads"));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erreur lors de la création du lead");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(fieldPath("/leads"))} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Nouveau lead</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contact</legend>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Prénom *" value={form.first_name} onChange={(e) => update("first_name", e.target.value)} className={inputClass} required />
            <input placeholder="Nom *" value={form.last_name} onChange={(e) => update("last_name", e.target.value)} className={inputClass} required />
          </div>
          <input placeholder="Téléphone *" value={form.phone} onChange={(e) => update("phone", e.target.value)} className={inputClass} required type="tel" />
          <input placeholder="Email" value={form.email} onChange={(e) => update("email", e.target.value)} className={inputClass} type="email" />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Adresse</legend>
          <input placeholder="Adresse" value={form.address} onChange={(e) => update("address", e.target.value)} className={inputClass} />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Ville" value={form.city} onChange={(e) => update("city", e.target.value)} className={inputClass} />
            <input placeholder="Code postal" value={form.postal_code} onChange={(e) => update("postal_code", e.target.value)} className={inputClass} />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Qualification</legend>
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">Besoin de service</label>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_OPTIONS.map((s) => (
                <button key={s} type="button" onClick={() => update("service_need", s)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    form.service_need === s ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-border hover:border-muted-foreground"
                  )}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">Méthode de paiement préférée</label>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_INTENTS.map((p) => (
                <button key={p} type="button" onClick={() => update("payment_method_intent", p)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    form.payment_method_intent === p ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-border hover:border-muted-foreground"
                  )}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <textarea placeholder="Notes d'éligibilité / disponibilité…" value={form.eligibility_notes} onChange={(e) => update("eligibility_notes", e.target.value)} rows={2} className={inputClass} />
          <textarea placeholder="Notes internes…" value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className={inputClass} />
        </fieldset>

        <button type="submit" disabled={!canSubmit || loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Créer le lead
        </button>
      </form>
    </div>
  );
}
