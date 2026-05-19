/**
 * CrmFollowUpEmailDialog — Send a templated post-call email to a contact
 * via the crm-send-followup-email edge function.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { displayName, type CrmContact } from "../lib/crmTypes";

type TemplateKey = "brochure" | "pricing" | "thanks" | "recap";

const TEMPLATE_OPTIONS: { key: TemplateKey; label: string; preview: string }[] = [
  { key: "brochure", label: "📄 Brochure d'offres", preview: "Aperçu Internet, TV, Mobile." },
  { key: "pricing",  label: "💲 Récap tarifaire",   preview: "Détail des prix discutés." },
  { key: "recap",    label: "📝 Récap d'appel",     preview: "Résumé de l'appel + prochaines étapes." },
  { key: "thanks",   label: "🙏 Remerciement",      preview: "Message court de remerciement." },
];

interface Props {
  contact: CrmContact | null;
  onClose: () => void;
}

export function CrmFollowUpEmailDialog({ contact, onClose }: Props) {
  const [template, setTemplate] = useState<TemplateKey>("brochure");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!contact) return;
    if (!contact.email) { toast.error("Ce contact n'a pas de courriel"); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("crm-send-followup-email", {
      body: { contact_id: contact.id, template, custom_message: custom || null },
    });
    setBusy(false);
    const res = data as any;
    if (error || !res?.ok) {
      toast.error(`Envoi échoué : ${res?.error ?? error?.message ?? "inconnu"}`);
      return;
    }
    toast.success("✉️ Courriel envoyé");
    setCustom("");
    onClose();
  };

  return (
    <Dialog open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-500" />
            Courriel de suivi
          </DialogTitle>
        </DialogHeader>
        {contact && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              À : <strong>{displayName(contact)}</strong> {contact.email ? `<${contact.email}>` : "(pas de courriel ⚠️)"}
            </p>
            <div className="space-y-2">
              {TEMPLATE_OPTIONS.map((t) => (
                <label key={t.key} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer ${template === t.key ? "border-violet-500 bg-violet-500/10" : "border-border"}`}>
                  <input
                    type="radio"
                    name="tpl"
                    checked={template === t.key}
                    onChange={() => setTemplate(t.key)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-semibold">{t.label}</div>
                    <div className="text-[11px] text-muted-foreground">{t.preview}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Message personnalisé (optionnel — remplace le gabarit)</label>
              <Textarea
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Bonjour…"
                rows={4}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button onClick={submit} disabled={busy || !contact?.email}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
