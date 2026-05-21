/**
 * TechDashboard — Mobile-first home for the technician.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, MapPin, Phone, ArrowRight } from "lucide-react";
import TechTopBar from "../components/TechTopBar";
import { useTechAssignments } from "../lib/useTechAssignments";

export default function TechDashboard() {
  const { data: assignments = [], isLoading } = useTechAssignments();

  const today = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  const todays = assignments.filter((a) => a.scheduled_date === today);
  const completedToday = todays.filter((a) => a.status === "completed").length;
  const next = todays.find((a) => !["completed", "cancelled", "missed"].includes(a.status));

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  })();

  return (
    <div>
      <TechTopBar title="Nivra Tech" />
      <div className="px-4 py-5 space-y-5">
        <section>
          <h2 className="text-2xl font-bold text-white">{greeting}</h2>
          <p className="text-sm text-slate-400 mt-1">
            {new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </section>

        {/* Today's missions */}
        <section className="rounded-2xl bg-violet-600/10 border border-violet-600/30 p-5">
          <div className="flex items-center gap-2 text-violet-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <Clock className="h-4 w-4" /> Missions du jour
          </div>
          {isLoading ? (
            <p className="text-slate-400 text-sm">Chargement...</p>
          ) : todays.length === 0 ? (
            <p className="text-slate-200 text-base">Aucune installation prévue aujourd'hui.</p>
          ) : (
            <>
              <p className="text-3xl font-bold text-white">
                {completedToday}/{todays.length}
              </p>
              <p className="text-sm text-slate-300 mt-1">complétées</p>
              {next && (
                <div className="mt-4 rounded-xl bg-slate-900/60 p-3">
                  <p className="text-xs text-slate-400">Prochain rendez-vous</p>
                  <p className="text-base font-semibold text-white mt-1">
                    {next.scheduled_time_start?.slice(0, 5)} — {next.client_name || "Client"}
                  </p>
                  {next.client_address && (
                    <p className="text-xs text-slate-400 mt-1 flex items-start gap-1">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{next.client_address}</span>
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          <Link
            to="/tech/assignments"
            className="mt-4 flex items-center justify-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-base font-semibold text-white"
          >
            Voir mes missions <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        {/* Quick actions */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Actions rapides</h3>
          <a
            href="mailto:support@nivra-telecom.ca"
            className="flex items-center gap-3 rounded-2xl bg-slate-900 border border-slate-800 px-5 py-4 min-h-[60px]"
          >
            <Phone className="h-6 w-6 text-violet-400" />
            <span className="text-base font-medium text-white">Contacter le support</span>
          </a>
        </section>

        {/* Stats */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Statistiques du jour
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                {completedToday}
              </p>
              <p className="text-xs text-slate-400 mt-1">Complétées</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{todays.length - completedToday}</p>
              <p className="text-xs text-slate-400 mt-1">Restantes</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
