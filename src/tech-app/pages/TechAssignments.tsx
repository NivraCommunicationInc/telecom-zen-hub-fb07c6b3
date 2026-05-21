/**
 * TechAssignments — List of all assignments (mine + available to claim).
 */
import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Clock, MapPin, Truck, AlertCircle, CheckCircle2, UserPlus, Phone, PlayCircle, RotateCcw, XCircle, Wrench, PackageCheck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TechTopBar from "../components/TechTopBar";
import { useTechAssignments, type TechAssignment } from "../lib/useTechAssignments";

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  en_route: "bg-orange-500/20 text-orange-300 border-orange-500/40 animate-pulse",
  arrived: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  in_progress: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  missed: "bg-red-500/20 text-red-300 border-red-500/40",
  rescheduled: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  cancelled: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  no_show: "bg-red-500/20 text-red-300 border-red-500/40",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Planifié",
  en_route: "En route",
  arrived: "Arrivé",
  in_progress: "En cours",
  completed: "Complété",
  missed: "Manqué",
  rescheduled: "Replanifié",
  cancelled: "Annulé",
  no_show: "Absent",
};

const terminalStatuses = ["completed", "cancelled", "missed", "no_show"];

type Filter = "mine" | "available" | "all";

export default function TechAssignments() {
  const { data = [], isLoading } = useTechAssignments();
  const [filter, setFilter] = useState<Filter>("all");
  const [uid, setUid] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const claim = useMutation({
    mutationFn: async (id: string) => {
      if (!uid) throw new Error("Non authentifié");
      const { error } = await supabase
        .from("technician_assignments")
        .update({ technician_id: uid })
        .eq("id", id)
        .is("technician_id", null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tech-assignments-all"] });
      toast.success("Mission acceptée");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status, vars }: { id: string; status: string; vars?: any }) => {
      const { error } = await (supabase.rpc as any)("tech_update_assignment_status", {
        p_assignment_id: id,
        p_status: status,
        p_note: vars?.note ?? null,
        p_eta: vars?.eta ?? null,
      });
      if (error) throw error;

      if (status === "en_route" || status === "missed") {
        const a = data.find((x) => x.id === id);
        if (a?.order_id) {
          const { data: o } = await supabase
            .from("orders")
            .select("client_email, client_first_name, order_number")
            .eq("id", a.order_id)
            .maybeSingle();
          if (o?.client_email) {
            await supabase.from("email_queue").insert({
              to_email: o.client_email,
              template_key: status === "en_route" ? "tech_en_route" : "tech_missed",
              template_vars: {
                first_name: o.client_first_name || "Client",
                tech_name: "Votre technicien Nivra",
                eta: vars?.eta || "sous peu",
                scheduled_date: a.scheduled_date,
                order_number: o.order_number,
              },
              status: "queued",
            });
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tech-assignments-all"] });
      qc.invalidateQueries({ queryKey: ["tech-assignment"] });
      toast.success("Statut mis à jour");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const filtered = useMemo(() => {
    if (filter === "mine") return data.filter((a) => a.technician_id === uid || !a.technician_id);
    if (filter === "available") return data.filter((a) => !a.technician_id);
    return data;
  }, [data, filter, uid]);

  return (
    <div>
      <TechTopBar title="Missions" />
      <div className="px-4 py-4">
        <div role="tablist" className="flex gap-2 mb-4 overflow-x-auto -mx-1 px-1">
          {([
            ["all", "Toutes"],
            ["mine", "Mes missions"],
            ["available", "Disponibles"],
          ] as const).map(([k, lbl]) => (
            <button
              key={k}
              role="tab"
              aria-selected={filter === k}
              onClick={() => setFilter(k)}
              className={`min-h-[44px] px-5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === k
                  ? "bg-violet-600 text-white"
                  : "bg-slate-900 border border-slate-800 text-slate-300"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-center text-slate-400 py-12">Chargement...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-slate-300">Aucune mission</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((a) => (
              <AssignmentCard
                key={a.id}
                assignment={a}
                isMine={a.technician_id === uid}
                onClaim={() => claim.mutate(a.id)}
                onEnRoute={() => {
                  const eta = window.prompt("Heure d'arrivée estimée (ex: 14h30)", "");
                  if (eta !== null) setStatus.mutate({ id: a.id, status: "en_route", vars: { eta } });
                }}
                onArrived={() => setStatus.mutate({ id: a.id, status: "arrived" })}
                onInProgress={() => setStatus.mutate({ id: a.id, status: "in_progress" })}
                onReschedule={() => {
                  const note = window.prompt("Note pour replanification :", "");
                  if (note !== null) setStatus.mutate({ id: a.id, status: "rescheduled", vars: { note } });
                }}
                onCancel={() => {
                  const note = window.prompt("Raison de l'annulation :", "");
                  if (note !== null) setStatus.mutate({ id: a.id, status: "cancelled", vars: { note } });
                }}
                onMissed={() => {
                  const note = window.prompt("Raison du rendez-vous manqué / client absent :", "Client absent");
                  if (note !== null) {
                    setStatus.mutate({ id: a.id, status: "missed", vars: { note } });
                  }
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AssignmentCard({
  assignment: a,
  isMine,
  onClaim,
  onEnRoute,
  onArrived,
  onInProgress,
  onReschedule,
  onCancel,
  onMissed,
}: {
  assignment: TechAssignment;
  isMine: boolean;
  onClaim: () => void;
  onEnRoute: () => void;
  onArrived: () => void;
  onInProgress: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onMissed: () => void;
}) {
  const effectiveStatus = a.appointment_status === "no_show" ? "missed" : a.status;
  const badge = STATUS_STYLES[effectiveStatus] || STATUS_STYLES.scheduled;
  const isDone = terminalStatuses.includes(effectiveStatus);
  const unassigned = !a.technician_id;
  const serviceLabels = [
    a.service_type,
    a.category,
    ...(a.order_items ?? []).map((item: any) => item.plan_name || item.description).filter(Boolean),
  ].filter(Boolean);
  const equipmentCount = Array.isArray(a.equipment_details) ? a.equipment_details.length : a.equipment_details ? 1 : 0;
  const channelCount = Array.isArray(a.selected_channels) ? a.selected_channels.length : 0;

  return (
    <li className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-4 shadow-lg shadow-slate-950/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-white font-semibold">
          <Clock className="h-4 w-4 text-violet-400" />
          <span>
            {a.scheduled_date} · {a.scheduled_time_start?.slice(0, 5)} – {a.scheduled_time_end?.slice(0, 5)}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${badge}`}>
            {STATUS_LABELS[effectiveStatus]}
          </span>
          {unassigned && (
            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full border bg-violet-500/20 text-violet-300 border-violet-500/40">
              Disponible
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-base font-semibold text-white">{a.client_name || "Client"}</p>
        {a.client_address && (
          <p className="text-sm text-slate-300 flex items-start gap-2 leading-relaxed">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-slate-500" />
            <span>{a.client_address}</span>
          </p>
        )}
        {a.client_phone && (
          <a href={`tel:${a.client_phone}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-slate-700 bg-slate-800/70 px-3 text-sm font-semibold text-violet-300">
            <Phone className="h-4 w-4" /> {a.client_phone}
          </a>
        )}
      </div>

      <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-300">
          <Wrench className="h-4 w-4" /> Services à installer
        </div>
        <div className="flex flex-wrap gap-2">
          {serviceLabels.length ? serviceLabels.slice(0, 5).map((label, idx) => (
            <span key={`${label}-${idx}`} className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200">
              {String(label)}
            </span>
          )) : <span className="text-xs text-slate-500">Service non précisé</span>}
          {a.order_number && <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-mono text-slate-300">#{a.order_number}</span>}
          {a.appointment_number && <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-mono text-slate-300">RDV {a.appointment_number}</span>}
        </div>
        {(equipmentCount > 0 || channelCount > 0 || a.appointment_notes) && (
          <div className="grid gap-2 text-xs text-slate-400">
            {equipmentCount > 0 && <span className="inline-flex items-center gap-1"><PackageCheck className="h-3.5 w-3.5" /> {equipmentCount} équipement(s) prévu(s)</span>}
            {channelCount > 0 && <span>{channelCount} chaîne(s) TV sélectionnée(s)</span>}
            {a.appointment_notes && <p className="line-clamp-2">Note: {a.appointment_notes}</p>}
          </div>
        )}
      </div>

      {unassigned ? (
        <button
          onClick={onClaim}
          className="w-full min-h-[48px] rounded-full bg-violet-600 text-white text-sm font-semibold flex items-center justify-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Accepter cette mission
        </button>
      ) : isMine && !isDone ? (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={onEnRoute}
            className="min-h-[48px] rounded-full bg-orange-600/20 border border-orange-600/40 text-orange-300 text-sm font-semibold flex items-center justify-center gap-1"
          >
            <Truck className="h-4 w-4" />
            En route
          </button>
          <button
            onClick={onArrived}
            className="min-h-[48px] rounded-full bg-blue-600/20 border border-blue-600/40 text-blue-300 text-sm font-semibold flex items-center justify-center gap-1"
          >
            <MapPin className="h-4 w-4" />
            Arrivé
          </button>
          <Link
            to={`/tech/installation/${a.id}`}
            className="min-h-[48px] rounded-full bg-violet-600 text-white text-sm font-semibold flex items-center justify-center"
          >
            <PlayCircle className="h-4 w-4 mr-1" /> Installer
          </Link>
          <button
            onClick={onInProgress}
            className="min-h-[48px] rounded-full bg-violet-600/20 border border-violet-600/40 text-violet-300 text-sm font-semibold flex items-center justify-center gap-1"
          >
            Démarrer
          </button>
          <button
            onClick={onMissed}
            className="min-h-[48px] rounded-full bg-red-600/20 border border-red-600/40 text-red-300 text-sm font-semibold flex items-center justify-center gap-1"
          >
            <AlertCircle className="h-4 w-4" />
            Manqué
          </button>
          <button
            onClick={onReschedule}
            className="min-h-[48px] rounded-full bg-purple-600/20 border border-purple-600/40 text-purple-300 text-sm font-semibold flex items-center justify-center gap-1"
          >
            <RotateCcw className="h-4 w-4" /> Replanifier
          </button>
          <button
            onClick={onCancel}
            className="min-h-[48px] rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-sm font-semibold flex items-center justify-center gap-1"
          >
            <XCircle className="h-4 w-4" /> Annuler
          </button>
        </div>
      ) : isMine ? (
        <Link
          to={`/tech/installation/${a.id}`}
          className="block w-full text-center min-h-[44px] py-3 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-sm font-semibold"
        >
          Voir détails
        </Link>
      ) : (
        <p className="text-xs text-slate-500 italic">Assignée à un autre technicien</p>
      )}
    </li>
  );
}
