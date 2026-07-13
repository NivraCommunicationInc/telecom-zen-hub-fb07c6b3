/**
 * CoreAppointmentDetail — Full appointment detail page for Nivra Core.
 * Accessible via /core/appointments/:id
 * NOW includes: Edit appointment dialog.
 */
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { corePath } from "@/core-app/lib/corePaths";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { EditAppointmentDialog } from "@/core-app/components/account-actions/EditAppointmentDialog";
import { AppointmentActionsMenu } from "@/core-app/components/appointments/AppointmentActionsMenu";
import {
  ArrowLeft, Calendar, MapPin, User, Wrench, Phone, Mail,
  FileText, Package, Loader2, AlertTriangle, Pencil, LifeBuoy,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function CoreAppointmentDetail() {
  const { id } = useParams<{ id: string }>();
  const [editOpen, setEditOpen] = useState(false);

  const { data: apt, isLoading, error, refetch } = useQuery({
    queryKey: ["core-appointment-detail", id],
    queryFn: async () => {
      if (!id) throw new Error("No appointment ID");
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: technician } = useQuery({
    queryKey: ["core-appointment-technician", apt?.technician_id],
    enabled: !!apt?.technician_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("id, full_name, email, phone, status")
        .eq("id", apt.technician_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: assignmentAssistance = [] } = useQuery({
    queryKey: ["core-appointment-assistance", apt?.order_id],
    enabled: !!apt?.order_id,
    queryFn: async () => {
      const orderId = apt?.order_id;
      if (!orderId) return [];
      const { data, error } = await supabase
        .from("technician_assignments")
        .select("id, status, scheduled_date, technician_notes, network_test_results, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((row: any) => row.network_test_results?.assistance?.requested_at || String(row.technician_notes || "").includes("[ASSISTANCE TERRAIN]"));
    },
  });

  const { data: linkedTickets = [] } = useQuery({
    queryKey: ["core-appointment-linked-tickets", apt?.order_id, apt?.client_email],
    enabled: !!apt?.order_id || !!apt?.client_email,
    queryFn: async () => {
      const orderId = apt?.order_id;
      const email = apt?.client_email;
      if (!orderId && !email) return [];

      const queries = [];
      if (orderId) {
        queries.push(
          supabase
            .from("support_tickets")
            .select("id, ticket_number, subject, status, priority, category, created_at, related_order_id, client_email")
            .eq("related_order_id", orderId)
            .order("created_at", { ascending: false })
            .limit(8),
        );
      }
      if (email) {
        queries.push(
          supabase
            .from("support_tickets")
            .select("id, ticket_number, subject, status, priority, category, created_at, related_order_id, client_email")
            .eq("client_email", email)
            .order("created_at", { ascending: false })
            .limit(8),
        );
      }

      const results = await Promise.all(queries);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
      const byId = new Map<string, any>();
      results.flatMap((r) => r.data ?? []).forEach((ticket: any) => byId.set(ticket.id, ticket));
      return Array.from(byId.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (error || !apt) {
    return (
      <div className="text-center py-32">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
        <p className="text-[hsl(220,10%,50%)] text-sm">
          {error instanceof Error ? error.message : "Rendez-vous introuvable"}
        </p>
        <Link to={corePath("/appointments")} className="text-emerald-400 text-xs mt-3 inline-block hover:underline">
          ← Retour aux rendez-vous
        </Link>
      </div>
    );
  }

  const scheduledDate = apt.scheduled_at ? new Date(apt.scheduled_at) : null;
  const equipment = (apt.equipment_details as any[] | null) || [];

  return (
    <div className="space-y-6">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <Link
          to={corePath("/appointments")}
          className="flex items-center gap-1.5 text-[12px] text-[hsl(220,10%,50%)] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Rendez-vous
        </Link>
        <div className="flex items-center gap-2">
          <AppointmentActionsMenu appointment={apt} onRefresh={() => refetch()} />
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 px-3 py-1.5 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Modifier
          </button>
          <button
            onClick={() => refetch()}
            className="text-[11px] text-[hsl(220,10%,45%)] hover:text-white transition-colors"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-white">{apt.title}</h1>
            <p className="text-[12px] text-[hsl(220,10%,45%)] font-mono mt-1">
              {apt.appointment_number || apt.id}
            </p>
          </div>
          <StatusBadge label={apt.status || "unknown"} variant={statusToVariant(apt.status || "")} />
        </div>

        {apt.description && (
          <p className="text-[13px] text-[hsl(220,10%,60%)] mb-4">{apt.description}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide">Date & heure</p>
              <p className="text-[13px] text-white">
                {scheduledDate ? format(scheduledDate, "d MMMM yyyy 'à' HH:mm", { locale: fr }) : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Wrench className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide">Type de service</p>
              <p className="text-[13px] text-white">{apt.service_type || "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Package className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide">Méthode</p>
              <p className="text-[13px] text-white capitalize">{apt.installation_method || "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide">Adresse</p>
              <p className="text-[13px] text-white">
                {[apt.service_address, apt.service_city, apt.service_postal_code].filter(Boolean).join(", ") || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <User className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide">Client</p>
              {apt.client_id && (
                <Link to={corePath(`/clients/${apt.client_id}`)} className="text-[13px] text-emerald-400 hover:underline">
                  Ouvrir le profil client
                </Link>
              )}
              {apt.client_email && (
                <p className="text-[13px] text-white flex items-center gap-1"><Mail className="h-3 w-3" /> {apt.client_email}</p>
              )}
              {apt.client_phone && (
                <p className="text-[13px] text-white flex items-center gap-1"><Phone className="h-3 w-3" /> {apt.client_phone}</p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide">Frais</p>
              <p className="text-[13px] text-white">
                Livraison: {apt.delivery_fee != null ? `${apt.delivery_fee}$` : "—"}
                {" · "}
                Installation: {apt.installation_fee != null ? `${apt.installation_fee}$` : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Technician */}
      <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] p-4">
        <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide mb-2">Technicien</p>
        {technician ? (
          <div className="text-[13px] text-white space-y-1">
            <p className="font-medium">{technician.full_name}</p>
            <p className="text-[hsl(220,10%,55%)]">{[technician.email, technician.phone, technician.status].filter(Boolean).join(" · ")}</p>
          </div>
        ) : (
          <p className="text-[13px] text-[hsl(220,10%,50%)]">Non assigné</p>
        )}
      </div>

      {/* Field assistance */}
      <div className={`rounded-xl border p-4 ${assignmentAssistance.length ? "border-red-500/35 bg-red-950/20" : "border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)]"}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide flex items-center gap-2">
              <LifeBuoy className="h-3.5 w-3.5" /> Assistance terrain
            </p>
            <p className="text-[12px] text-[hsl(220,10%,55%)] mt-1">Demandes technicien et tickets reliés à ce rendez-vous.</p>
          </div>
          {assignmentAssistance.length > 0 && (
            <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase text-red-300">
              Action requise
            </span>
          )}
        </div>

        {assignmentAssistance.length === 0 && linkedTickets.length === 0 ? (
          <p className="text-[13px] text-[hsl(220,10%,50%)]">Aucune assistance terrain ouverte pour ce rendez-vous.</p>
        ) : (
          <div className="space-y-3">
            {assignmentAssistance.map((row: any) => {
              const assistance = row.network_test_results?.assistance;
              const reason = assistance?.reason || String(row.technician_notes || "").replace("[ASSISTANCE TERRAIN]", "").trim() || "Assistance demandée";
              return (
                <div key={row.id} className="rounded-lg border border-red-500/25 bg-red-950/20 p-3 text-[13px]">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-red-200">{reason}</p>
                    <span className="text-[10px] uppercase text-red-300">{assistance?.status || row.status}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-[hsl(220,10%,60%)]">
                    Demandé: {assistance?.requested_at ? format(new Date(assistance.requested_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"}
                  </p>
                </div>
              );
            })}

            {linkedTickets.map((ticket: any) => (
              <div key={ticket.id} className="rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,8%)] p-3 text-[13px]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{ticket.subject || "Ticket support"}</p>
                    <p className="text-[12px] text-[hsl(220,10%,55%)]">{ticket.ticket_number || ticket.id} · {ticket.category || "support"}</p>
                  </div>
                  <span className="rounded-full border border-[hsl(220,15%,20%)] px-2 py-1 text-[10px] uppercase text-[hsl(220,10%,65%)]">
                    {ticket.status || "open"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order link */}
      {apt.order_id && (
        <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] p-4">
          <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide mb-2">Commande liée</p>
          <Link to={corePath(`/orders/${apt.order_id}`)} className="text-[13px] text-emerald-400 hover:underline font-mono">
            {apt.order_id}
          </Link>
        </div>
      )}

      {/* Equipment */}
      {equipment.length > 0 && (
        <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] p-4">
          <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide mb-3">Équipements</p>
          <div className="space-y-2">
            {equipment.map((eq: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-[13px]">
                <span className="text-white">{eq.name || eq.type}</span>
                <span className="text-[hsl(220,10%,50%)]">
                  {eq.quantity ? `×${eq.quantity}` : ""} {eq.fee != null ? `${eq.fee}$` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Internal Notes */}
      {apt.internal_notes && (
        <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] p-4">
          <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide mb-2">Notes internes</p>
          <p className="text-[13px] text-[hsl(220,10%,65%)] whitespace-pre-wrap">{apt.internal_notes}</p>
        </div>
      )}

      {/* Timestamps */}
      <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] p-4">
        <div className="grid grid-cols-2 gap-4 text-[12px]">
          <div>
            <span className="text-[hsl(220,10%,45%)]">Créé: </span>
            <span className="text-white">{apt.created_at ? format(new Date(apt.created_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"}</span>
          </div>
          <div>
            <span className="text-[hsl(220,10%,45%)]">Modifié: </span>
            <span className="text-white">{apt.updated_at ? format(new Date(apt.updated_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"}</span>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <EditAppointmentDialog
        appointment={apt}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onRefresh={() => refetch()}
      />
    </div>
  );
}
