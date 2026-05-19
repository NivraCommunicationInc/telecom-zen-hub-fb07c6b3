/**
 * CrmScheduleCallbackDialog — Schedule a callback. Assigns agent and triggers
 * an email reminder cron (sent ~30min before the callback time).
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CrmContact } from "../lib/crmTypes";
import { displayName } from "../lib/crmTypes";

interface Props {
  contact: CrmContact | null;
  onClose: () => void;
}

function defaultDate(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000); // tomorrow same time
  d.setSeconds(0, 0);
  // toISOString -> 2026-05-20T13:25:00.000Z — slice for datetime-local format
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export function CrmScheduleCallbackDialog({ contact, onClose }: Props) {
  const [date, setDate] = useState(defaultDate());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!contact) return null;

  const handleSchedule = async () => {
    if (!date) {
      toast.error("Date requise");
      return;
    }
    const callbackAt = new Date(date).toISOString();
    if (new Date(callbackAt).getTime() < Date.now()) {
      toast.error("La date doit être dans le futur");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("crm_schedule_callback", {
      p_contact_id: contact.id,
      p_callback_at: callbackAt,
      p_notes: notes.trim() || null,
    });
    setSaving(false);
    const res = data as any;
    if (error || !res?.ok) {
      toast.error(`Erreur : ${res?.error ?? error?.message ?? "inconnue"}`);
      return;
    }
    toast.success("📅 Rappel planifié — un courriel vous sera envoyé avant l'appel", { duration: 5000 });
    setNotes("");
    onClose();
  };

  return (
    <Dialog open={!!contact} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-cyan-500" />
            Planifier un rappel
          </DialogTitle>
          <DialogDescription>{displayName(contact)} — {contact.phone ?? "—"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Date et heure du rappel</label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-input bg-background rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes pour ce rappel (optionnel)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: rappeler après son quart de travail, parler du forfait Internet 100Mbps…"
              rows={3}
            />
          </div>
          <div className="text-[11px] text-cyan-600 dark:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-md px-3 py-2 flex items-start gap-2">
            <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Le prospect vous sera assigné et un courriel de rappel sera envoyé automatiquement environ 30 min avant l'heure prévue.</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Annuler</Button>
            <Button onClick={handleSchedule} disabled={saving} className="bg-cyan-600 hover:bg-cyan-500 text-white">
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Planifier le rappel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
