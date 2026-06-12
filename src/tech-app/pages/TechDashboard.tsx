/**
 * TechDashboard — Home screen for the Nivra Tech portal.
 * Custom hero header (not TechHeader), punch card as primary action,
 * compact KPI strip, dispatch alert, next mission preview.
 */
import { useMemo, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Clock, MapPin, ChevronRight, Package, AlertTriangle,
  Loader2, CheckCircle2, Play, Square, Power, Zap, Radio,
  Bell, CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTechAssignments } from "../lib/useTechAssignments";
import { useAvailableAssignments } from "../lib/useAvailableAssignments";
import { useOpenPunch, usePunchIn, usePunchOut } from "../lib/usePunch";
import { Progress } from "@/components/ui/progress";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ""}`;
  return `${m}min`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TechDashboard() {
  const navigate = useNavigate();
  const { data: assignments = [], isLoading } = useTechAssignments();
  const { data: available = [] } = useAvailableAssignments();
  const { data: openPunch } = useOpenPunch();
  const punchIn = usePunchIn();
  const punchOut = usePunchOut();
  const [profile, setProfile] = useState<{ full_name?: string; first_name?: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [alertCount] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
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
  const todays = useMemo(() => assignments.filter((a) => a.scheduled_date === today), [assignments, today]);
  const completedToday = todays.filter((a) => a.status === "completed").length;
  const missedToday = todays.filter((a) => ["missed", "no_show"].includes(a.status));
  const activeCount = assignments.filter((a) => !["completed", "cancelled", "missed", "no_show"].includes(a.status)).length;
  const nextMission = useMemo(
    () =>
      todays.find((a) => !["completed", "cancelled", "missed", "no_show"].includes(a.status)) ??
      assignments.find((a) => !["completed", "cancelled", "missed", "no_show"].includes(a.status)),
    [todays, assignments],
  );

  const onShift = !!openPunch;
  const shiftMs = openPunch ? now - new Date(openPunch.punch_in_at).getTime() : 0;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  })();

  const firstName = profile?.first_name || profile?.full_name?.split(" ")?.[0] || "Technicien";
  const dateLabel = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });

  const urgentCount = available.filter((j) => j.dispatch_priority === "urgent").length;

  return (
    <div className="min-h-screen bg-slate-950">

      {/* ── Custom hero header ──────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 pt-[env(safe-area-inset-top)]"
        style={{
          background: "rgba(10,10,18,0.97)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-3 px-5 h-[60px]">
          {/* Brand */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className="h-7 w-7 rounded-[8px] flex items-center justify-center text-white font-black text-[12px] shrink-0"
              style={{ background: "linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)", boxShadow: "0 4px 10px rgba(124,58,237,0.3)" }}
            >
              N
            </div>
            <span className="text-[13px] font-black text-white tracking-[0.06em] uppercase">Nivra Tech</span>
            {/* Shift status chip */}
            {onShift ? (
              <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                En service
              </span>
            ) : (
              <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-800 border border-white/5 rounded-full px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                Hors service
              </span>
            )}
          </div>
          <button
            className="relative shrink-0 h-10 w-10 flex items-center justify-center rounded-full text-slate-400 hover:bg-white/5 active:bg-white/8"
          >
            <Bell className="h-[18px] w-[18px]" />
            {(missedToday.length > 0 || alertCount > 0) && (
              <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500" style={{ boxShadow: "0 0 0 2px rgba(10,10,18,0.97)" }} />
            )}
          </button>
        </div>
      </header>

      <div className="px-4 pt-5 pb-6 space-y-4">

        {/* ── Greeting ──────────────────────────────────────────────────────── */}
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.1em]">{dateLabel}</p>
          <h2 className="text-[26px] font-black text-white tracking-[-0.03em] leading-tight">
            {greeting}, {firstName}
          </h2>
        </div>

        {/* ── Punch card ─────────────────────────────────────────────────────── */}
        <section
          className="rounded-2xl overflow-hidden"
          style={{ background: onShift ? "linear-gradient(135deg, #052E16 0%, #0C0C14 80%)" : "#0C0C14", border: onShift ? "1px solid rgba(52,211,153,0.2)" : "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="p-5">
            {onShift ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-[0.1em]">En service</span>
                  <span className="ml-auto text-[13px] font-bold text-emerald-300 tabular-nums">
                    {formatElapsed(shiftMs)}
                  </span>
                </div>
                <p className="text-[13px] text-slate-400 mb-4">
                  Pointez pour terminer votre journée et enregistrer vos heures.
                </p>
                <button
                  onClick={() => punchOut.mutate(openPunch!.id)}
                  disabled={punchOut.isPending}
                  className="w-full h-[60px] rounded-xl text-[15px] font-bold text-white flex items-center justify-center gap-3 disabled:opacity-60 transition-all active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg,#DC2626 0%,#B91C1C 100%)", boxShadow: "0 4px 20px rgba(220,38,38,0.25)" }}
                >
                  {punchOut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Square className="h-5 w-5" fill="currentColor" strokeWidth={0} />}
                  Pointer — Fin de journée
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center">
                    <Power className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-white">Hors service</p>
                    <p className="text-[12px] text-slate-500">Commencez votre journée de travail</p>
                  </div>
                </div>
                <button
                  onClick={() => punchIn.mutate()}
                  disabled={punchIn.isPending}
                  className="w-full h-[60px] rounded-xl text-[15px] font-bold text-white flex items-center justify-center gap-3 disabled:opacity-60 transition-all active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg,#059669 0%,#047857 100%)", boxShadow: "0 4px 20px rgba(5,150,105,0.25)" }}
                >
                  {punchIn.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" fill="currentColor" strokeWidth={0} />}
                  Pointer — Début de journée
                </button>
              </>
            )}
          </div>
        </section>

        {/* ── KPI strip ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Aujourd'hui", value: `${completedToday}/${todays.length}`, sub: "complétées", color: "text-violet-400" },
            { label: "En attente", value: String(activeCount), sub: "missions", color: "text-amber-400" },
            { label: "Dispatch", value: String(available.length), sub: "dispo", color: urgentCount > 0 ? "text-red-400" : "text-orange-400" },
          ].map(({ label, value, sub, color }) => (
            <div
              key={label}
              className="rounded-xl p-3 flex flex-col gap-1"
              style={{ background: "#0C0C14", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] truncate">{label}</p>
              <p className={`text-[22px] font-black tabular-nums leading-none ${color}`}>{value}</p>
              <p className="text-[10px] text-slate-600">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Missed alert ───────────────────────────────────────────────────── */}
        {missedToday.length > 0 && (
          <section
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)" }}
          >
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-white">{missedToday.length} rendez-vous manqué{missedToday.length > 1 ? "s" : ""}</p>
              <p className="text-[11px] text-red-400 mt-0.5">Action requise — à replanifier</p>
            </div>
            <Link to="/tech/assignments" className="shrink-0 h-9 px-4 rounded-full bg-red-600 text-white text-[12px] font-bold flex items-center">
              Voir
            </Link>
          </section>
        )}

        {/* ── Dispatch alert ─────────────────────────────────────────────────── */}
        {available.length > 0 && (
          <section
            className="rounded-2xl p-4 flex items-center gap-3"
            style={
              urgentCount > 0
                ? { background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }
                : { background: "rgba(234,88,12,0.08)", border: "1px solid rgba(234,88,12,0.2)" }
            }
          >
            {urgentCount > 0
              ? <Zap className="h-5 w-5 text-red-400 shrink-0" />
              : <Radio className="h-5 w-5 text-orange-400 shrink-0 animate-pulse" />}
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-white">
                {available.length} mission{available.length > 1 ? "s" : ""} disponible{available.length > 1 ? "s" : ""}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: urgentCount > 0 ? "#F87171" : "#FB923C" }}>
                {urgentCount > 0 ? `${urgentCount} URGENT — action immédiate` : "Consultez la liste pour vous attribuer"}
              </p>
            </div>
            <Link
              to="/tech/assignments"
              className="shrink-0 h-9 px-4 rounded-full text-white text-[12px] font-bold flex items-center"
              style={{ background: urgentCount > 0 ? "#DC2626" : "#EA580C" }}
            >
              Voir
            </Link>
          </section>
        )}

        {/* ── Today's progress ───────────────────────────────────────────────── */}
        {todays.length > 0 && (
          <section style={{ background: "#0C0C14", border: "1px solid rgba(255,255,255,0.07)" }} className="rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.08em] flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> Aujourd'hui
              </p>
              <span className="text-[11px] text-slate-500">
                {completedToday}/{todays.length} complétée{todays.length > 1 ? "s" : ""}
              </span>
            </div>
            <Progress
              value={todays.length > 0 ? (completedToday / todays.length) * 100 : 0}
              className="h-1.5 bg-slate-800"
              indicatorClassName="bg-emerald-500"
            />
          </section>
        )}

        {/* ── Next mission ───────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : nextMission ? (
          <section style={{ background: "#0C0C14", border: "1px solid rgba(255,255,255,0.07)" }} className="rounded-2xl overflow-hidden">
            <div className="px-4 pt-4 pb-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.08em]">Prochaine mission</p>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-bold text-white truncate">{nextMission.client_name || "Client"}</p>
                <span className="shrink-0 text-[13px] font-bold text-violet-300 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {nextMission.scheduled_time_start?.slice(0, 5)}
                </span>
              </div>
              {nextMission.client_address && (
                <p className="text-[13px] text-slate-400 flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-600" />
                  <span>{nextMission.client_address}</span>
                </p>
              )}
              {nextMission.order_items && nextMission.order_items.length > 0 && (
                <p className="text-[12px] text-slate-500 flex items-start gap-2">
                  <Package className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span className="line-clamp-1">
                    {nextMission.order_items.map((i: any) => i.plan_name || i.description).filter(Boolean).join(" · ")}
                  </span>
                </p>
              )}
            </div>
            <div className="px-4 pb-4">
              <button
                onClick={() => navigate(`/tech/installation/${nextMission.id}`)}
                className="w-full h-[52px] rounded-xl text-[14px] font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg,#7C3AED 0%,#6D28D9 100%)", boxShadow: "0 4px 16px rgba(124,58,237,0.2)" }}
              >
                Démarrer l'installation <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        ) : !isLoading && (
          <section
            className="rounded-2xl p-6 text-center"
            style={{ background: "#0C0C14", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <CheckCircle2 className="h-10 w-10 text-emerald-500/30 mx-auto mb-2" />
            <p className="text-[14px] font-semibold text-white">Tout est à jour</p>
            <p className="text-[12px] text-slate-500 mt-1">Aucune mission planifiée.</p>
          </section>
        )}

        {/* ── Stats ──────────────────────────────────────────────────────────── */}
        <section style={{ background: "#0C0C14", border: "1px solid rgba(255,255,255,0.07)" }} className="rounded-2xl p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.08em] mb-3">Total</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[28px] font-black text-white tabular-nums leading-none">
                {assignments.filter((a) => a.status === "completed").length}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Installations complétées</p>
            </div>
            <div>
              <p className="text-[28px] font-black text-white tabular-nums leading-none">
                {activeCount}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Missions actives</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
