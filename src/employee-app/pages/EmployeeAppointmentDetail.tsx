/**
 * EmployeeAppointmentDetail — Appointment detail with actions, using shared-ops.
 */
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Calendar, MapPin, User, Phone, Mail, Clock, Wrench, Hash, AlertTriangle, Pencil } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { useAppointmentDetail } from "@/shared-ops/hooks/useAppointmentDetail";
import { addOperationalNote } from "@/shared-ops";
import { ActionConfirmButton } from "@/employee-app/components/ActionConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function EmployeeAppointmentDetail() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { data, isLoading, error } = useAppointmentDetail(appointmentId);
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");

  const statusMutation = useMutation({
    mutationFn: async ({ newStatus }: { newStatus: string }) => {
      if (!appointmentId) throw new Error("ID manquant");
      const { error } = await supabase.from("appointments")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", appointmentId);
      if (error) throw error;
      await addOperationalNote({ entityId: appointmentId, entityType: "appointment", note: `Statut → ${newStatus}`, portal: "employee" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-appointment-detail", appointmentId] });
      toast.success("Rendez-vous mis à jour");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addNoteMutation = useMutation({
    mutationFn: (note: string) => addOperationalNote({ entityId: appointmentId!, entityType: "appointment", note, portal: "employee" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-appointment-detail", appointmentId] });
      setNoteText("");
      toast.success("Note ajoutée");
    },
  });

  // ── Edit appointment dialog ────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [editTechnicianId, setEditTechnicianId] = useState<string>("");
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const { data: technicians = [] } = useQuery({
    queryKey: ["employee-technicians-list"],
    enabled: editOpen,
    queryFn: async () => {
      const { data } = await supabase
        .from("technicians")
        .select("id, full_name, is_active")
        .eq("is_active", true)
        .order("full_name");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!editOpen || !data) return;
    const apt = data.appointment;
    setEditScheduledAt(apt.scheduled_at ? new Date(apt.scheduled_at).toISOString().slice(0, 16) : "");
    setEditTechnicianId(apt.technician_id ?? "");
    setEditAddress(apt.service_address ?? "");
    setEditNotes(apt.internal_notes ?? "");
  }, [editOpen, data]);

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!appointmentId) throw new Error("ID manquant");
      if (!editScheduledAt) throw new Error("Date et heure requises");
      const newIso = new Date(editScheduledAt).toISOString();
      const { error: updErr } = await supabase
        .from("appointments")
        .update({
          scheduled_at: newIso,
          technician_id: editTechnicianId || null,
          service_address: editAddress || null,
          internal_notes: editNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointmentId);
      if (updErr) throw updErr;

      // Send reschedule email (best-effort)
      try {
        await supabase.functions.invoke("appointment-rescheduled", {
          body: { appointment_id: appointmentId },
        });
      } catch (e) {
        console.warn("[appointment-rescheduled] invoke failed", e);
      }

      await addOperationalNote({
        entityId: appointmentId,
        entityType: "appointment",
        note: `Rendez-vous modifié (date, technicien ou adresse)`,
        portal: "employee",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-appointment-detail", appointmentId] });
      toast.success("Rendez-vous modifié et client notifié");
      setEditOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!appointmentId) {
    return <div className="py-20 text-center"><p className="text-sm text-muted-foreground">Rendez-vous introuvable</p></div>;
  }

  if (isLoading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
        <p className="text-destructive text-sm">Erreur de chargement</p>
        <Link to={employeePath("/appointments")} className="text-primary text-xs mt-2 inline-block hover:underline">← Retour</Link>
      </div>
    );
  }

  const { appointment: apt, order, profile, technician, logs } = data;
  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      scheduled: "text-blue-400 bg-blue-500/10", confirmed: "text-emerald-400 bg-emerald-500/10",
      in_progress: "text-indigo-400 bg-indigo-500/10", completed: "text-emerald-400 bg-emerald-500/10",
      cancelled: "text-red-400 bg-red-500/10", no_show: "text-amber-400 bg-amber-500/10",
    };
    return map[s] ?? "text-muted-foreground bg-muted";
  };

  const actions: { label: string; status: string; consequence: string }[] = [];
  const s = apt.status ?? "scheduled";
  if (s === "scheduled") actions.push({ label: "Confirmer", status: "confirmed", consequence: "Le rendez-vous sera confirmé au client" });
  if (s === "confirmed" || s === "scheduled") actions.push({ label: "Démarrer", status: "in_progress", consequence: "Le technicien est en route / intervention démarrée" });
  if (s === "in_progress") actions.push({ label: "Terminer", status: "completed", consequence: "L'intervention sera marquée comme terminée" });
  if (!["completed", "cancelled"].includes(s)) actions.push({ label: "Annuler", status: "cancelled", consequence: "Le rendez-vous sera annulé" });

  return (
    <div className="space-y-4">
      <Link to={employeePath("/appointments")} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Rendez-vous
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {apt.appointment_number ?? "Rendez-vous"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{apt.title}</p>
        </div>
        <span className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold uppercase", statusColor(s))}>
          {s}
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Planification" icon={<Clock className="h-4 w-4" />}>
          <InfoRow label="Date" value={format(new Date(apt.scheduled_at), "EEEE d MMMM yyyy", { locale: fr })} />
          <InfoRow label="Heure" value={format(new Date(apt.scheduled_at), "HH:mm", { locale: fr })} />
          <InfoRow label="Type" value={apt.service_type ?? apt.installation_method ?? "—"} />
          {apt.description && <InfoRow label="Description" value={apt.description} />}
        </Section>

        <Section title="Lieu" icon={<MapPin className="h-4 w-4" />}>
          <InfoRow label="Adresse" value={apt.service_address ?? "—"} />
          <InfoRow label="Ville" value={apt.service_city ?? "—"} />
          {apt.service_postal_code && <InfoRow label="Code postal" value={apt.service_postal_code} />}
        </Section>

        <Section title="Client" icon={<User className="h-4 w-4" />}>
          {profile ? (
            <>
              <InfoRow label="Nom" value={profile.full_name ?? "—"} />
              {profile.email && <InfoRow label="Email" value={profile.email} />}
              {profile.phone && <InfoRow label="Tél" value={profile.phone} />}
            </>
          ) : (
            <>
              {apt.client_email && <InfoRow label="Email" value={apt.client_email} />}
              {apt.client_phone && <InfoRow label="Tél" value={apt.client_phone} />}
            </>
          )}
          {apt.client_id && (
            <Link to={employeePath(`/clients/${apt.client_id}`)} className="text-[10px] text-primary hover:underline mt-1 inline-block">
              Voir profil →
            </Link>
          )}
        </Section>

        {technician && (
          <Section title="Technicien" icon={<Wrench className="h-4 w-4" />}>
            <InfoRow label="Nom" value={technician.full_name ?? "—"} />
            {technician.email && <InfoRow label="Email" value={technician.email} />}
            {technician.phone && <InfoRow label="Tél" value={technician.phone} />}
          </Section>
        )}
      </div>

      {/* Traceability */}
      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground font-mono">
        <span>apt: {apt.id.slice(0, 8)}</span>
        {order && <span>· order: {order.order_number}</span>}
        {apt.client_id && <span>· client: {apt.client_id.slice(0, 8)}</span>}
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Actions</h3>
          <div className="flex flex-wrap gap-2">
            {actions.map(a => (
              <ActionConfirmButton
                key={a.status}
                label={a.label}
                consequence={a.consequence}
                onConfirm={() => statusMutation.mutate({ newStatus: a.status })}
                isPending={statusMutation.isPending}
                variant={a.status === "cancelled" ? "warning" : "primary"}
              />
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="flex gap-2">
        <input
          type="text"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Ajouter une note…"
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
          onKeyDown={(e) => e.key === "Enter" && noteText.trim() && addNoteMutation.mutate(noteText.trim())}
        />
        <button
          onClick={() => noteText.trim() && addNoteMutation.mutate(noteText.trim())}
          disabled={!noteText.trim() || addNoteMutation.isPending}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40"
        >
          Envoyer
        </button>
      </div>

      {/* Timeline */}
      {logs.length > 0 && (
        <Section title="Historique" icon={<Clock className="h-4 w-4" />}>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {logs.map((log: any, i: number) => (
              <div key={i} className="text-xs">
                <p className="text-foreground font-medium">{log.action}</p>
                <p className="text-muted-foreground text-[10px]">
                  {log.actor_name ?? "Système"} · {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: fr })}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Link to order */}
      {order && (
        <Link
          to={employeePath(`/orders/${order.order_number ?? order.id}`)}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          Commande {order.order_number} ({order.status}) →
        </Link>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start text-xs py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
