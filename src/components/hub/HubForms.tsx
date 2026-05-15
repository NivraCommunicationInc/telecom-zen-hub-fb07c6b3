/**
 * HubForms — 8 form types. Each submission creates a hub_tickets row
 * with optional file/photo attachments and returns its ticket_number.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ClipboardList, AlertTriangle, DollarSign, Package, Wrench,
  Calendar, Lightbulb, FileQuestion, Loader2, Paperclip, X, CheckCircle2,
} from "lucide-react";

type FormDef = {
  key: string;
  icon: any;
  color: string;
  title: string;
  description: string;
  section: string;
  defaultPriority: "low" | "normal" | "high" | "urgent";
};

const FORMS: FormDef[] = [
  { key: "complaint",    icon: ClipboardList,  color: "text-blue-600 bg-blue-100",       title: "Plainte client",          description: "Signaler un problème ou une plainte d'un client.",        section: "complaint",    defaultPriority: "high" },
  { key: "incident",     icon: AlertTriangle,  color: "text-red-600 bg-red-100",         title: "Incident terrain",        description: "Rapporter un incident lors d'une visite client.",          section: "incident",     defaultPriority: "urgent" },
  { key: "expense",      icon: DollarSign,     color: "text-emerald-600 bg-emerald-100", title: "Remboursement de dépenses", description: "Demande de remboursement des frais professionnels.",      section: "expense",      defaultPriority: "normal" },
  { key: "supplies",     icon: Package,        color: "text-violet-600 bg-violet-100",   title: "Matériel promotionnel",   description: "Commander brochures, cartes, dépliants ou goodies.",       section: "supplies",     defaultPriority: "low" },
  { key: "tech",         icon: Wrench,         color: "text-amber-600 bg-amber-100",     title: "Problème technique",      description: "Rapporter un bug ou un problème dans les outils.",         section: "tech",         defaultPriority: "high" },
  { key: "leave",        icon: Calendar,       color: "text-pink-600 bg-pink-100",       title: "Demande de congé",        description: "Soumettre une demande d'absence ou de vacances.",          section: "leave",        defaultPriority: "normal" },
  { key: "suggestion",   icon: Lightbulb,      color: "text-yellow-600 bg-yellow-100",   title: "Suggestion / Idée",       description: "Proposer une amélioration ou une nouvelle idée.",          section: "suggestion",   defaultPriority: "low" },
  { key: "other",        icon: FileQuestion,   color: "text-slate-600 bg-slate-100",     title: "Autre demande",           description: "Toute autre demande qui ne rentre pas dans les catégories.", section: "other",        defaultPriority: "normal" },
];

export default function HubForms() {
  const [active, setActive] = useState<FormDef | null>(null);
  const [submitted, setSubmitted] = useState<{ ticket_number: string } | null>(null);

  if (submitted) {
    return (
      <div className="max-w-md mx-auto rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-emerald-900">Ticket créé</h3>
        <p className="text-sm text-emerald-800 mt-1">
          Votre demande a été envoyée. Numéro de référence&nbsp;:
        </p>
        <p className="font-mono text-lg font-bold text-emerald-900 mt-2">{submitted.ticket_number}</p>
        <p className="text-xs text-emerald-700 mt-3">Suivez l'avancement dans <strong>Mes tickets</strong>.</p>
        <button
          onClick={() => { setSubmitted(null); setActive(null); }}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold min-h-[44px]"
        >
          Soumettre un autre formulaire
        </button>
      </div>
    );
  }

  if (active) {
    return <FormDialog form={active} onClose={() => setActive(null)} onSubmitted={(n) => setSubmitted({ ticket_number: n })} />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl">
      {FORMS.map((f) => {
        const Icon = f.icon;
        return (
          <button
            key={f.key}
            onClick={() => setActive(f)}
            className="text-left rounded-xl border border-border bg-card p-4 hover:border-violet-400 hover:shadow-sm transition-all min-h-[44px]"
          >
            <div className={`h-10 w-10 rounded-lg ${f.color} flex items-center justify-center mb-3`}>
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">{f.title}</h3>
            <p className="text-xs text-muted-foreground">{f.description}</p>
          </button>
        );
      })}
    </div>
  );
}

function FormDialog({ form, onClose, onSubmitted }: { form: FormDef; onClose: () => void; onSubmitted: (ticketNumber: string) => void }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(form.defaultPriority);
  const [files, setFiles] = useState<File[]>([]);

  const submit = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Vous devez être connecté");
      if (!subject.trim() || !description.trim()) throw new Error("Sujet et description requis");

      // Upload attachments to hub-attachments bucket (per-user folder).
      const media_urls: string[] = [];
      const document_urls: string[] = [];
      for (const f of files) {
        const path = `${user.id}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("hub-media").upload(path, f, { upsert: false });
        if (upErr) throw new Error(`Upload échoué: ${upErr.message}`);
        const { data: pub } = supabase.storage.from("hub-media").getPublicUrl(path);
        if (f.type.startsWith("image/")) media_urls.push(pub.publicUrl);
        else document_urls.push(pub.publicUrl);
      }

      const { data, error } = await supabase
        .from("hub_tickets")
        .insert({
          submitted_by: user.id,
          section: form.section,
          subject: subject.trim(),
          description: description.trim(),
          priority,
          status: "open",
          media_urls,
          document_urls,
          form_data: { form_type: form.key, form_title: form.title },
        })
        .select("ticket_number")
        .single();
      if (error) throw error;
      return data.ticket_number as string;
    },
    onSuccess: (n) => onSubmitted(n),
    onError: (e: any) => toast.error(e.message),
  });

  const Icon = form.icon;
  return (
    <div className="max-w-2xl space-y-4">
      <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        ← Retour aux formulaires
      </button>
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg ${form.color} flex items-center justify-center`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold">{form.title}</h2>
            <p className="text-xs text-muted-foreground">{form.description}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Sujet *</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={140}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            placeholder="Résumé en quelques mots"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            placeholder="Détaillez votre demande…"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Priorité</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="low">Faible</option>
            <option value="normal">Normal</option>
            <option value="high">Haute</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Pièces jointes (photos, PDF…)</label>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border bg-background text-xs cursor-pointer hover:border-violet-400 min-h-[44px]">
            <Paperclip className="h-4 w-4" /> Ajouter un fichier
            <input
              type="file"
              multiple
              accept="image/*,application/pdf,.doc,.docx,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = Array.from(e.target.files || []);
                setFiles((prev) => [...prev, ...f].slice(0, 5));
              }}
            />
          </label>
          {!!files.length && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between text-xs rounded-lg bg-muted/50 px-2 py-1">
                  <span className="truncate">{f.name}</span>
                  <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">Max 5 fichiers, 10 Mo chacun.</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground min-h-[44px]">
            Annuler
          </button>
          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || !subject.trim() || !description.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50 min-h-[44px]"
          >
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Soumettre le ticket
          </button>
        </div>
      </div>
    </div>
  );
}
