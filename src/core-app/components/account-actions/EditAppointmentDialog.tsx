/**
 * EditAppointmentDialog — Modify appointment date/time, address, notes, status from Core.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Calendar, MapPin, Clock, FileText, AlertTriangle } from "lucide-react";

import { logActivityLog } from "@/lib/logActivityLog";
const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50";
const btnPrimary = "rounded-md bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity";
const btnSecondary = "rounded-md border border-border px-4 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40 transition-colors";

interface Props {
  appointment: any;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function EditAppointmentDialog({ appointment, open, onClose, onRefresh }: Props) {
  const apt = appointment;
  const [scheduledDate, setScheduledDate] = useState(apt?.scheduled_at?.slice(0, 16) || "");
  const [address, setAddress] = useState(apt?.service_address || "");
  const [city, setCity] = useState(apt?.service_city || "");
  const [postalCode, setPostalCode] = useState(apt?.service_postal_code || "");
  const [status, setStatus] = useState(apt?.status || "scheduled");
  const [notes, setNotes] = useState(apt?.internal_notes || "");
  const [installationMethod, setInstallationMethod] = useState(apt?.installation_method || "");
  const [loading, setLoading] = useState(false);

  if (!apt) return null;

  const handleSave = async () => {
    if (!scheduledDate) { toast.error("Date requise"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from("appointments").update({
        scheduled_at: new Date(scheduledDate).toISOString(),
        service_address: address || null,
        service_city: city || null,
        service_postal_code: postalCode || null,
        status,
        internal_notes: notes || null,
        installation_method: installationMethod || null,
        updated_at: new Date().toISOString(),
      }).eq("id", apt.id);
const user = (await supabase.auth.getUser()).data.user;
      await logActivityLog({
        user_id: user?.id || "system",
        entity_type: "appointment",
        entity_id: apt.id,
        action: "appointment_modified",
        details: { source: "core", changes: { status, scheduled_at: scheduledDate } },
      });

      toast.success("Rendez-vous modifié");
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Modifier le rendez-vous
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Date & heure</label>
              <input type="datetime-local" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Statut</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                <option value="scheduled">Planifié</option>
                <option value="confirmed">Confirmé</option>
                <option value="in_progress">En cours</option>
                <option value="completed">Complété</option>
                <option value="cancelled">Annulé</option>
                <option value="no_show">Non présenté</option>
                <option value="rescheduled">Reporté</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Méthode d'installation</label>
            <select value={installationMethod} onChange={e => setInstallationMethod(e.target.value)} className={inputCls}>
              <option value="">—</option>
              <option value="self_install">Auto-installation</option>
              <option value="technician">Technicien</option>
              <option value="delivery">Livraison</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Adresse de service</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 rue Exemple" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Ville</label>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="Montréal" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Code postal</label>
              <input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="H1A 1A1" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Notes internes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notes pour le technicien..." className={`${inputCls} resize-none`} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleSave} disabled={loading} className={btnPrimary}>{loading ? "…" : "Enregistrer"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
