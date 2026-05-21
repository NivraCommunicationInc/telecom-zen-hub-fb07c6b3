/**
 * TechAssignments — List of all assignments for the technician.
 */
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Clock, MapPin, Truck, AlertCircle, CheckCircle2 } from "lucide-react";
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
};

type Filter = "today" | "tomorrow" | "week";

export default function TechAssignments() {
  const { data = [], isLoading } = useTechAssignments();
  const [filter, setFilter] = useState<Filter>("today");
  const qc = useQueryClient();

  const setStatus = useMutation({
    mutationFn: async ({ id, status, vars }: { id: string; status: string; vars?: any }) => {
      const { error } = await supabase
        .from("technician_assignments")
        .update({
          status,
          ...(status === "missed" ? { missed_at: new Date().toISOString() } : {}),
        })
        .eq("id", id);
      if (error) throw error;

      // Trigger client email for en_route / missed
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
      qc.invalidateQueries({ queryKey: ["tech-assignments-self"] });
      toast.success("Statut mis à jour");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    if (filter === "today") return data.filter((a) => a.scheduled_date === today);
    if (filter === "tomorrow") return data.filter((a) => a.scheduled_date === tomorrow);
    return data.filter((a) => a.scheduled_date >= today && a.scheduled_date <= weekEnd);
  }, [data, filter]);

  return (
    <div>
      <TechTopBar title="Mes missions" />
      <div className="px-4 py-4">
        {/* Filter tabs */}
        <div role="tablist" className="flex gap-2 mb-4 overflow-x-auto -mx-1 px-1">
          {([
            ["today", "Aujourd'hui"],
            ["tomorrow", "Demain"],
            ["week", "Cette semaine"],
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
            <p className="text-slate-300">Aucune mission pour cette période</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((a) => (
              <AssignmentCard
                key={a.id}
                assignment={a}
                onEnRoute={() => {
                  const eta = window.prompt("Heure d'arrivée estimée (ex: 14h30)", "");
                  if (eta !== null) setStatus.mutate({ id: a.id, status: "en_route", vars: { eta } });
                }}
                onMissed={() => {
                  if (window.confirm("Marquer ce rendez-vous comme manqué ?")) {
                    setStatus.mutate({ id: a.id, status: "missed" });
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
  onEnRoute,
  onMissed,
}: {
  assignment: TechAssignment;
  onEnRoute: () => void;
  onMissed: () => void;
}) {
  const badge = STATUS_STYLES[a.status] || STATUS_STYLES.scheduled;
  const isDone = ["completed", "cancelled", "missed"].includes(a.status);
  return (
    <li className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-white font-semibold">
          <Clock className="h-4 w-4 text-violet-400" />
          <span>{a.scheduled_time_start?.slice(0, 5)} – {a.scheduled_time_end?.slice(0, 5)}</span>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${badge}`}>
          {STATUS_LABELS[a.status]}
        </span>
      </div>

      <div>
        <p className="text-base font-semibold text-white">{a.client_name || "Client"}</p>
        {a.client_address && (
          <p className="text-sm text-slate-400 mt-1 flex items-start gap-1">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-slate-500" />
            <span>{a.client_address}</span>
          </p>
        )}
      </div>

      <div className="text-xs text-slate-400">
        {a.service_type && <span className="capitalize">{a.service_type}</span>}
        {a.category && <span> · {a.category}</span>}
        {a.order_number && <span> · #{a.order_number}</span>}
      </div>

      {!isDone && (
        <div className="grid grid-cols-3 gap-2 pt-2">
          <button
            onClick={onEnRoute}
            className="min-h-[48px] rounded-full bg-orange-600/20 border border-orange-600/40 text-orange-300 text-sm font-semibold flex items-center justify-center gap-1"
          >
            <Truck className="h-4 w-4" />
            En route
          </button>
          <Link
            to={`/tech/installation/${a.id}`}
            className="min-h-[48px] rounded-full bg-violet-600 text-white text-sm font-semibold flex items-center justify-center"
          >
            Détails
          </Link>
          <button
            onClick={onMissed}
            className="min-h-[48px] rounded-full bg-red-600/20 border border-red-600/40 text-red-300 text-sm font-semibold flex items-center justify-center gap-1"
          >
            <AlertCircle className="h-4 w-4" />
            Manqué
          </button>
        </div>
      )}
    </li>
  );
}
