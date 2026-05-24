/**
 * ScheduleAppointmentDialog — Staff books an appointment for a client from Account 360.
 * Writes a public.appointments row via `account-ops-actions` (schedule_appointment).
 * Sends a client email (`client_appointment_scheduled`, Violet Bold).
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName?: string;
  accountId?: string | null;
}

const SERVICE_TYPES = [
  { value: "Internet",        label: "Installation Internet" },
  { value: "TV",              label: "Installation TV" },
  { value: "Mobile",          label: "Activation mobile" },
  { value: "diagnostic",      label: "Diagnostic / Dépannage" },
  { value: "equipment_pickup", label: "Récupération d'équipement" },
  { value: "equipment_swap",  label: "Échange d'équipement" },
  { value: "consultation",    label: "Consultation" },
];

const DURATIONS = [30, 45, 60, 90, 120];

export function ScheduleAppointmentDialog({
  open, onClose, clientUserId, clientName, accountId,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");      // yyyy-mm-dd
  const [time, setTime] = useState("10:00"); // HH:MM
  const [duration, setDuration] = useState(60);
  const [serviceType, setServiceType] = useState("Internet");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    const t = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setTitle(""); setDate(t.toISOString().slice(0, 10)); setTime("10:00");
    setDuration(60); setServiceType("Internet");
    setAddress(""); setCity(""); setPostal(""); setPhone(""); setNotes("");
  }, [open]);

  const submit = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    if (!date || !time) { toast.error("Date et heure requises"); return; }
    // Build ISO assuming local time
    const local = new Date(`${date}T${time}:00`);
    if (Number.isNaN(local.getTime())) { toast.error("Date invalide"); return; }
    if (local.getTime() < Date.now() - 60_000) {
      toast.error("La date doit être dans le futur"); return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("account-ops-actions", {
        body: {
          action: "schedule_appointment",
          client_user_id: clientUserId,
          account_id: accountId ?? null,
          title: title.trim(),
          scheduled_at: local.toISOString(),
          duration_minutes: duration,
          service_type: serviceType,
          service_address: address.trim() || undefined,
          service_city: city.trim() || undefined,
          service_postal_code: postal.trim() || undefined,
          client_phone: phone.trim() || undefined,
          internal_notes: notes.trim() || undefined,
          idempotency_key: `appt-${clientUserId}-${local.getTime()}`,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("Rendez-vous planifié — courriel envoyé");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Planifier un rendez-vous
          </DialogTitle>
          <DialogDescription>
            {clientName ? `Client : ${clientName}` : "Nouveau rendez-vous"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="a-title">Titre</Label>
            <Input
              id="a-title" value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: Installation Internet — résidentiel"
              disabled={busy}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="a-date">Date</Label>
              <Input id="a-date" type="date" value={date}
                onChange={(e) => setDate(e.target.value)} disabled={busy} />
            </div>
            <div>
              <Label htmlFor="a-time">Heure</Label>
              <Input id="a-time" type="time" value={time}
                onChange={(e) => setTime(e.target.value)} disabled={busy} />
            </div>
            <div>
              <Label>Durée (min)</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))} disabled={busy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Type de service</Label>
            <Select value={serviceType} onValueChange={setServiceType} disabled={busy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="a-addr">Adresse du service (optionnel)</Label>
            <Input id="a-addr" value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 rue Example" disabled={busy} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="a-city">Ville</Label>
              <Input id="a-city" value={city}
                onChange={(e) => setCity(e.target.value)} disabled={busy} />
            </div>
            <div>
              <Label htmlFor="a-postal">Code postal</Label>
              <Input id="a-postal" value={postal}
                onChange={(e) => setPostal(e.target.value.toUpperCase())}
                placeholder="H1A 1A1" disabled={busy} />
            </div>
          </div>
          <div>
            <Label htmlFor="a-phone">Téléphone de contact (optionnel)</Label>
            <Input id="a-phone" type="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="514-555-0123" disabled={busy} />
          </div>
          <div>
            <Label htmlFor="a-notes">Notes internes (optionnel)</Label>
            <Textarea id="a-notes" rows={2} value={notes}
              onChange={(e) => setNotes(e.target.value)} disabled={busy} />
          </div>

          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calendar className="h-4 w-4 mr-2" />}
            Planifier
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
