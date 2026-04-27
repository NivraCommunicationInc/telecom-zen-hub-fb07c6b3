import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetClientId?: string;
  presetClientName?: string | null;
  presetClientEmail?: string | null;
  presetAddress?: string | null;
}

const APPOINTMENT_TYPES = ["Installation", "Réparation", "Retour équipement", "Inspection", "Autre"];
const DURATIONS = [30, 60, 120, 180];

export function CreateAppointmentDialog({ open, onOpenChange, presetClientId, presetClientName, presetClientEmail, presetAddress }: Props) {
  const queryClient = useQueryClient();
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(presetClientId ? { user_id: presetClientId, full_name: presetClientName, email: presetClientEmail } : null);
  const [type, setType] = useState("Installation");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [address, setAddress] = useState(presetAddress ?? "");
  const [technicianId, setTechnicianId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (presetClientId) setSelectedClient({ user_id: presetClientId, full_name: presetClientName, email: presetClientEmail });
    if (presetAddress) setAddress(presetAddress);
  }, [presetClientId, presetClientName, presetClientEmail, presetAddress]);

  const { data: clients = [], isLoading: searching } = useQuery({
    queryKey: ["employee-appointment-client-search", clientSearch],
    enabled: open && clientSearch.length >= 2 && !presetClientId,
    queryFn: async () => {
      const term = `%${clientSearch}%`;
      const { data } = await supabase.from("profiles").select("user_id, full_name, email, phone, service_address, service_city, service_postal_code").or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`).limit(8);
      return data ?? [];
    },
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["employee-appointment-technicians"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("technicians" as any).select("id, full_name, email").order("full_name");
      return data ?? [];
    },
  });

  const canSubmit = useMemo(() => selectedClient?.user_id && scheduledAt && address.trim(), [selectedClient, scheduledAt, address]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const actorId = sessionData.session?.user.id;
      if (!actorId) throw new Error("Non authentifié");

      const selectedTech = (technicians as any[]).find((t) => t.id === technicianId);
      const when = new Date(scheduledAt);
      const { data: appointment, error } = await supabase.from("appointments").insert({
        client_id: selectedClient.user_id,
        client_email: selectedClient.email ?? null,
        client_phone: selectedClient.phone ?? null,
        title: `${type} — ${selectedClient.full_name ?? "Client"}`,
        service_type: type.toLowerCase().replaceAll(" ", "_"),
        description: notes || null,
        internal_notes: notes || null,
        scheduled_at: when.toISOString(),
        duration_minutes: duration,
        status: "scheduled",
        technician_id: technicianId || null,
        service_address: address,
        service_city: selectedClient.service_city ?? null,
        service_postal_code: selectedClient.service_postal_code ?? null,
        created_by: actorId,
        environment: "live",
      } as any).select("id, appointment_number").single();
      if (error) throw error;

      if (selectedClient.email) {
        await supabase.from("email_queue").insert({
          event_key: `appointment_confirmed_${appointment.id}`,
          to_email: selectedClient.email,
          template_key: "appointment_confirmed",
          template_vars: {
            client_name: selectedClient.full_name ?? "Client",
            appointment_date: when.toISOString(),
            appointment_time: when.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }),
            technician_name: selectedTech?.full_name ?? "À confirmer",
            address,
          },
          status: "queued",
        } as any);
      }
      return appointment;
    },
    onSuccess: () => {
      toast.success("Rendez-vous créé");
      queryClient.invalidateQueries({ queryKey: ["shared-appointments-list"] });
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const selectClient = (client: any) => {
    setSelectedClient(client);
    setAddress([client.service_address, client.service_city, client.service_postal_code].filter(Boolean).join(", "));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Nouveau rendez-vous</DialogTitle>
          <DialogDescription>Créer et assigner un rendez-vous opérationnel.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!presetClientId && <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Client</label>
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="Nom, courriel, téléphone" /></div>
            {searching && <Loader2 className="h-4 w-4 animate-spin" />}
            {clients.map((c: any) => <button key={c.user_id} onClick={() => selectClient(c)} className="w-full text-left p-2 rounded-lg border border-border hover:bg-secondary text-sm"><span className="text-foreground font-medium">{c.full_name}</span><span className="block text-xs text-muted-foreground">{c.email}</span></button>)}
          </div>}
          {selectedClient && <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">Client: <span className="text-foreground font-medium">{selectedClient.full_name ?? selectedClient.email}</span></div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select label="Type" value={type} onChange={setType} options={APPOINTMENT_TYPES} />
            <Select label="Durée" value={String(duration)} onChange={(v) => setDuration(Number(v))} options={DURATIONS.map((d) => ({ value: String(d), label: d === 30 ? "30min" : `${d / 60}h` }))} />
            <Field label="Date et heure" type="datetime-local" value={scheduledAt} onChange={setScheduledAt} />
            <Select label="Technicien assigné" value={technicianId} onChange={setTechnicianId} options={[{ value: "", label: "Non assigné" }, ...(technicians as any[]).map((t) => ({ value: t.id, label: t.full_name ?? t.email ?? t.id }))]} />
            <div className="md:col-span-2"><Field label="Adresse" value={address} onChange={setAddress} /></div>
            <div className="md:col-span-2"><label className="text-xs text-muted-foreground">Notes pour le technicien</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button disabled={!canSubmit || submitMutation.isPending} onClick={() => submitMutation.mutate()}>{submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Créer</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <div><label className="text-xs text-muted-foreground">{label}</label><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<string | { value: string; label: string }> }) {
  return <div><label className="text-xs text-muted-foreground">{label}</label><select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">{options.map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>;
}
