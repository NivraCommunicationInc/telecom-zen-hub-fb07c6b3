/**
 * CrmQuickNoteDialog — Append a quick note to a contact without opening the call dialog.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CrmContact } from "../lib/crmTypes";
import { displayName } from "../lib/crmTypes";

interface Props {
  contact: CrmContact | null;
  onClose: () => void;
}

export function CrmQuickNoteDialog({ contact, onClose }: Props) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!contact) return null;

  const handleSave = async () => {
    if (!note.trim()) {
      toast.error("Note vide");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("crm_set_note", { p_contact_id: contact.id, p_note: note });
    setSaving(false);
    const res = data as any;
    if (error || !res?.ok) {
      toast.error(`Erreur : ${res?.error ?? error?.message ?? "inconnue"}`);
      return;
    }
    toast.success("Note ajoutée");
    setNote("");
    onClose();
  };

  return (
    <Dialog open={!!contact} onOpenChange={(o) => { if (!o) { setNote(""); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-amber-500" />
            Ajouter une note
          </DialogTitle>
          <DialogDescription>{displayName(contact)} — {contact.phone ?? "—"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: A demandé de rappeler après 17h, parle français seulement, intéressé par Internet 100Mbps…"
            rows={5}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !note.trim()} className="bg-violet-600 hover:bg-violet-500">
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Enregistrer la note
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
