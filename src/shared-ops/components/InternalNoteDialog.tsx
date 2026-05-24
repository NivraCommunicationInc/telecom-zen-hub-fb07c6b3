/**
 * InternalNoteDialog — Staff writes an internal note attached to a client.
 * Writes a public.client_internal_notes row via `account-ops-actions`
 * (add_internal_note). Internal only — no client email is sent.
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName?: string;
  accountId?: string | null;
}

const NOTE_TYPES = ["Général", "Facturation", "Technique", "Plainte", "Suivi", "Important"] as const;

export function InternalNoteDialog({ open, onClose, clientUserId, clientName, accountId }: Props) {
  const [busy, setBusy] = useState(false);
  const [noteType, setNoteType] = useState<typeof NOTE_TYPES[number]>("Général");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!open) return;
    setNoteType("Général"); setBody("");
  }, [open]);

  const submit = async () => {
    if (!body.trim()) { toast.error("Note requise"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("account-ops-actions", {
        body: {
          action: "add_internal_note",
          client_user_id: clientUserId,
          account_id: accountId ?? null,
          note_type: noteType,
          body: body.trim(),
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("Note interne enregistrée");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary" />
            Note interne
          </DialogTitle>
          <DialogDescription>
            {clientName ? `Client : ${clientName} · ` : ""}
            Visible uniquement par le personnel autorisé. Aucun courriel n'est envoyé au client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Type</Label>
            <Select value={noteType} onValueChange={(v) => setNoteType(v as typeof NOTE_TYPES[number])} disabled={busy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NOTE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="n-body">Contenu</Label>
            <Textarea
              id="n-body" rows={6} value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Détails du suivi, contexte, action prise…"
              disabled={busy}
            />
          </div>
          <Button onClick={submit} disabled={busy || !body.trim()} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <StickyNote className="h-4 w-4 mr-2" />}
            Enregistrer la note
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
