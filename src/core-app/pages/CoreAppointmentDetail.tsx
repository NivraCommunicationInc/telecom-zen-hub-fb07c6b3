/**
 * CoreAppointmentDetail — Full appointment detail page for Nivra Core.
 * Accessible via /core/appointments/:id
 */
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { corePath } from "@/core-app/lib/corePaths";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import {
  ArrowLeft, Calendar, MapPin, User, Clock, Wrench, Phone, Mail,
  FileText, Package, Loader2, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function CoreAppointmentDetail() {
  const { id } = useParams<{ id: string }>();

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
        <button
          onClick={() => refetch()}
          className="text-[11px] text-[hsl(220,10%,45%)] hover:text-white transition-colors"
        >
          Rafraîchir
        </button>
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
          {/* Schedule */}
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide">Date & heure</p>
              <p className="text-[13px] text-white">
                {scheduledDate
                  ? format(scheduledDate, "d MMMM yyyy 'à' HH:mm", { locale: fr })
                  : "—"}
              </p>
            </div>
          </div>

          {/* Service Type */}
          <div className="flex items-start gap-3">
            <Wrench className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide">Type de service</p>
              <p className="text-[13px] text-white">{apt.service_type || "—"}</p>
            </div>
          </div>

          {/* Installation Method */}
          <div className="flex items-start gap-3">
            <Package className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide">Méthode</p>
              <p className="text-[13px] text-white capitalize">{apt.installation_method || "—"}</p>
            </div>
          </div>

          {/* Address */}
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide">Adresse</p>
              <p className="text-[13px] text-white">
                {[apt.service_address, apt.service_city, apt.service_postal_code].filter(Boolean).join(", ") || "—"}
              </p>
            </div>
          </div>

          {/* Client */}
          <div className="flex items-start gap-3">
            <User className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide">Client</p>
              {apt.client_email && (
                <p className="text-[13px] text-white flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {apt.client_email}
                </p>
              )}
              {apt.client_phone && (
                <p className="text-[13px] text-white flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {apt.client_phone}
                </p>
              )}
            </div>
          </div>

          {/* Fees */}
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

      {/* Order link */}
      {apt.order_id && (
        <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] p-4">
          <p className="text-[11px] text-[hsl(220,10%,45%)] uppercase tracking-wide mb-2">Commande liée</p>
          <Link
            to={corePath(`/orders/${apt.order_id}`)}
            className="text-[13px] text-emerald-400 hover:underline font-mono"
          >
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
    </div>
  );
}
