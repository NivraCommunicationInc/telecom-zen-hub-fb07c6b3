import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Upload } from "lucide-react";

type FormDef = {
  id: string;
  icon: string;
  title: string;
  description: string;
  defaultPriority: "low" | "normal" | "high" | "urgent";
};

const FORMS: FormDef[] = [
  { id: "complaint",   icon: "📋", title: "Plainte client",            description: "Signaler une plainte d'un client", defaultPriority: "high" },
  { id: "incident",    icon: "🚨", title: "Incident terrain",          description: "Incident survenu sur le terrain",  defaultPriority: "urgent" },
  { id: "expense",     icon: "💰", title: "Remboursement dépenses",    description: "Demande de remboursement",         defaultPriority: "normal" },
  { id: "promo",       icon: "📦", title: "Matériel promotionnel",     description: "Demande de matériel marketing",    defaultPriority: "low" },
  { id: "tech",        icon: "🔧", title: "Problème technique",        description: "Signaler un bug ou problème",       defaultPriority: "high" },
  { id: "suggestion",  icon: "🎁", title: "Suggestion amélioration",   description: "Proposer une amélioration",        defaultPriority: "low" },
  { id: "bug",         icon: "📱", title: "Signalement bug",           description: "Bug d'application ou portail",      defaultPriority: "high" },
  { id: "leave",       icon: "📝", title: "Demande de congé",          description: "Demande de congé / absence",       defaultPriority: "normal" },
];

function genTicket(): string {
  const rnd = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `TKT-${rnd}`;
}

interface SubmissionResult {
  ticket_number: string;
}

function FormDialog({
  form,
  open,
  onOpenChange,
  onDone,
}: {
  form: FormDef | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: (r: SubmissionResult) => void;
}) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>(form?.defaultPriority ?? "normal");
  const [files, setFiles] = useState<File[]>([]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("no form");
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Non authentifié");

      const ticket_number = genTicket();

      // Upload attachments
      const media_urls: string[] = [];
      for (const f of files) {
        const path = `${userId}/${ticket_number}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage
          .from("hub-media")
          .upload(path, f, { upsert: false });
        if (!upErr) {
          const { data: pub } = supabase.storage.from("hub-media").getPublicUrl(path);
          media_urls.push(pub.publicUrl);
        }
      }

      const { error } = await supabase.from("hub_tickets").insert({
        ticket_number,
        submitted_by: userId,
        section: form.id,
        subject: subject || form.title,
        description,
        priority,
        status: "open",
        form_data: { form_id: form.id, form_title: form.title },
        media_urls,
      });
      if (error) throw error;
      return { ticket_number };
    },
    onSuccess: (r) => {
      onDone(r);
      onOpenChange(false);
      setSubject("");
      setDescription("");
      setFiles([]);
    },
    onError: (e: any) => {
      toast.error(e.message ?? "Erreur lors de la soumission");
    },
  });

  if (!form) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{form.icon}</span> {form.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="subject">Sujet</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={form.title}
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Décrivez votre demande en détail…"
            />
          </div>
          <div>
            <Label>Priorité</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Basse</SelectItem>
                <SelectItem value="normal">Normale</SelectItem>
                <SelectItem value="high">Haute</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="files" className="flex items-center gap-2">
              <Upload className="w-4 h-4" /> Pièces jointes (photo / fichier)
            </Label>
            <Input
              id="files"
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {files.length} fichier(s) sélectionné(s)
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || (!description && !subject)}
          >
            {submit.isPending ? "Envoi…" : "Soumettre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function HubForms() {
  const [active, setActive] = useState<FormDef | null>(null);
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  if (FORMS.length === 0) {
    return (
      <Card className="p-10 text-center text-muted-foreground">
        Aucun formulaire disponible
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Formulaires</h2>
        <p className="text-sm text-muted-foreground">
          Soumettre une demande, un incident, une suggestion…
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {FORMS.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setActive(f);
              setOpen(true);
            }}
            className="text-left"
          >
            <Card className="p-4 hover:border-purple-500 hover:shadow-md transition cursor-pointer h-full">
              <div className="text-3xl mb-2">{f.icon}</div>
              <div className="font-semibold">{f.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{f.description}</div>
            </Card>
          </button>
        ))}
      </div>

      <FormDialog
        form={active}
        open={open}
        onOpenChange={setOpen}
        onDone={(r) => setSuccess(r.ticket_number)}
      />

      <Dialog open={!!success} onOpenChange={(v) => !v && setSuccess(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center gap-2">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              Demande envoyée
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Numéro de ticket :</div>
            <div className="text-2xl font-mono font-bold">{success}</div>
            <div className="text-xs text-muted-foreground">
              Conservez ce numéro pour le suivi.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSuccess(null)} className="w-full">Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
