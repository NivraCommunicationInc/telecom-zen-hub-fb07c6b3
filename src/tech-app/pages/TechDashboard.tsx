/**
 * TechDashboard — Mobile-first home for the technician.
 * Greeting + punch card + missions overview + quick actions + alerts.
 */
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Play, Square, Clock, MapPin, Phone, ChevronRight,
  Package, AlertTriangle, Loader2, CheckCircle2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import TechHeader from "../components/TechHeader";
import { useTechAssignments } from "../lib/useTechAssignments";
import { useOpenPunch, usePunchIn, usePunchOut } from "../lib/usePunch";
import { Progress } from "@/components/ui/progress";

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export default function TechDashboard() {
  const navigate = useNavigate();
  const { data: assignments = [], isLoading } = useTechAssignments();
  const { data: openPunch } = useOpenPunch();
  const punchIn = usePunchIn();
  const punchOut = usePunchOut();
  const [profile, setProfile] = useState<{ full_name?: string; first_name?: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, first_name")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfile(data ?? {});
    })();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todays = useMemo(
    () => assignments.filter((a) => a.scheduled_date === today),
    [assignments, today],
  );
  const completedToday = todays.filter((a) => a.status === "completed").length;
  const missedToday = todays.filter((a) => ["missed", "no_show"].includes(a.status));
  const nextMission = useMemo(
    () => todays.find((a) => !["completed", "cancelled", "missed", "no_show"].includes(a.status))
      ?? assignments.find((a) => !["completed", "cancelled", "missed", "no_show"].includes(a.status)),
    [todays, assignments],
  );

  const onShift = !!openPunch;
  const shiftMinutes = openPunch
    ? Math.max(0, Math.round((now - new Date(openPunch.punch_in_at).getTime()) / 60000))
    : 0;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  })();

  const firstName = profile?.first_name || profile?.full_name?.split(" ")?.[0] || "Technicien";

  return (
    <div>
      <TechHeader title="Nivra Tech" alertCount={missedToday.length} />
      <div className="px-4 py-5 space-y-5">
        {/* Greeting */}
        <section>
          <h2 className="text-2xl font-bold text-white">{greeting}, {firstName} 👋</h2>
          <p className="text-sm text-slate-400 mt-1">
            {new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </section>

        {/* Punch card */}
        <section className={`rounded-2xl border p-5 ${onShift ? "bg-emerald-600/10 border-emerald-600/40" : "bg-violet-600/10 border-violet-600/40"}`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-bold uppercase tracking-wider ${onShift ? "text-emerald-300" : "text-slate-400"}`}>
              {onShift ? "● EN SERVICE" : "○ HORS SERVICE"}
            </span>
            {onShift && (
              <span className="text-xs text-emerald-300 font-medium">
                Depuis {formatDuration(shiftMinutes)}
              </span>
            )}
          </div>
          {onShift ? (
            <button
              onClick={() => punchOut.mutate(openPunch!.id)}
              disabled={punchOut.isPending}
              className="w-full min-h-[64px] rounded-2xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-lg font-bold flex items-center justify-center gap-3 disabled:opacity-60 shadow-lg shadow-red-600/30"
            >
              {punchOut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Square className="h-5 w-5" fill="white" />}
              Pointer — Fin de journée
            </button>
          ) : (
            <button
              onClick={() => punchIn.mutate()}
              disabled={punchIn.isPending}
              className="w-full min-h-[64px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-lg font-bold flex items-center justify-center gap-3 disabled:opacity-60 shadow-lg shadow-emerald-600/30"
            >
              {punchIn.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" fill="white" />}
              Pointer — Début de journée
            </button>
          )}
        </section>

        {/* Alerts */}
        {missedToday.length > 0 && (
          <section className="rounded-2xl bg-red-600/10 border border-red-600/40 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white">
                  {missedToday.length} rendez-vous manqué{missedToday.length > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-red-300 mt-0.5">Action requise — replanifier</p>
              </div>
              <Link
                to="/tech/assignments"
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white min-h-[40px] flex items-center"
              >
                Voir
              </Link>
            </div>
          </section>
        )}

        {/* Missions of the day */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <h3 className="text-xs font-bold text-violet-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Missions aujourd'hui
          </h3>
          {isLoading ? (
            <p className="text-slate-400 text-sm">Chargement...</p>
          ) : (
            <>
              <p className="text-3xl font-bold text-white">
                {completedToday} <span className="text-base font-medium text-slate-400">/ {todays.length} total</span>
              </p>
              {todays.length > 0 && (
                <Progress
                  value={(completedToday / todays.length) * 100}
                  className="mt-3 h-2 bg-slate-800"
                  indicatorClassName="bg-emerald-500"
                />
              )}

              {nextMission && (
                <div className="mt-5 rounded-xl bg-slate-950 border border-violet-900/40 p-4">
                  <p className="text-xs text-violet-300 font-bold uppercase tracking-wider mb-2">
                    Prochaine mission
                  </p>
                  <p className="text-base font-bold text-white flex items-center gap-2">
                    <Clock className="h-4 w-4 text-violet-400" />
                    {nextMission.scheduled_date} · {nextMission.scheduled_time_start?.slice(0, 5)}
                  </p>
                  <p className="text-sm text-slate-300 mt-2">
                    👤 {nextMission.client_name || "Client"}
                  </p>
                  {nextMission.client_address && (
                    <p className="text-xs text-slate-400 mt-1 flex items-start gap-1">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{nextMission.client_address}</span>
                    </p>
                  )}
                  {nextMission.order_items && nextMission.order_items.length > 0 && (
                    <p className="text-xs text-slate-400 mt-1 flex items-start gap-1">
                      <Package className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{nextMission.order_items.map((i: any) => i.plan_name || i.description).filter(Boolean).join(" · ")}</span>
                    </p>
                  )}
                  <button
                    onClick={() => navigate(`/tech/installation/${nextMission.id}`)}
                    className="mt-4 w-full min-h-[48px] rounded-full bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-base font-semibold flex items-center justify-center gap-2"
                  >
                    Voir les détails <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Quick actions */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Actions rapides</h3>
          <Link
            to="/tech/assignments"
            className="w-full min-h-[56px] rounded-2xl bg-slate-900 border border-slate-800 px-5 flex items-center gap-3 hover:border-violet-600 active:bg-slate-800"
          >
            <MapPin className="h-6 w-6 text-orange-400" />
            <span className="flex-1 text-base font-semibold text-white text-left">Marquer en route</span>
            <ChevronRight className="h-5 w-5 text-slate-500" />
          </Link>
          <a
            href="mailto:support@nivra-telecom.ca"
            className="w-full min-h-[56px] rounded-2xl bg-slate-900 border border-slate-800 px-5 flex items-center gap-3 hover:border-violet-600 active:bg-slate-800"
          >
            <Phone className="h-6 w-6 text-violet-400" />
            <span className="flex-1 text-base font-semibold text-white text-left">Contacter le support</span>
            <ChevronRight className="h-5 w-5 text-slate-500" />
          </a>
        </section>

        {/* Stats */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Mes statistiques
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                {assignments.filter((a) => a.status === "completed").length}
              </p>
              <p className="text-xs text-slate-400 mt-1">Total complétées</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {assignments.filter((a) => !["completed", "cancelled", "missed", "no_show"].includes(a.status)).length}
              </p>
              <p className="text-xs text-slate-400 mt-1">Missions actives</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
