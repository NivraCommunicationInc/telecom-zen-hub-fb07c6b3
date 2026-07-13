/**
 * TechDashboard — Nivra Tech home (bento-grid, Nivra Purple Bold).
 * Mobile-first dashboard: next job hero, live map, KPIs, van stock, dispatch feed.
 */
import { useMemo, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Clock, MapPin, ChevronRight, Package, AlertTriangle, Loader2,
  CheckCircle2, Play, Square, Power, Bell, Navigation, DollarSign,
  Radio, Zap, Wifi,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTechAssignments } from "../lib/useTechAssignments";
import { useAvailableAssignments } from "../lib/useAvailableAssignments";
import { useOpenPunch, usePunchIn, usePunchOut } from "../lib/usePunch";
import { useVanStock } from "../lib/useVanStock";
import TechMiniMap from "../components/TechMiniMap";

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}` : `${m}min`;
}

export default function TechDashboard() {
  const navigate = useNavigate();
  const { data: assignments = [], isLoading } = useTechAssignments();
  const { data: available = [] } = useAvailableAssignments();
  const { data: openPunch } = useOpenPunch();
  const { data: vanStock } = useVanStock();
  const punchIn = usePunchIn();
  const punchOut = usePunchOut();
  const [profile, setProfile] = useState<{ full_name?: string; first_name?: string } | null>(null);
  const [now, setNow] = useState(Date.now());

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
  const progressPct = todays.length > 0 ? Math.round((completedToday / todays.length) * 100) : 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--tp-bg)" }}>

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 pt-[env(safe-area-inset-top)]"
        style={{
          background: "rgba(15,15,26,0.94)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: "1px solid var(--tp-border)",
        }}
      >
        <div className="flex items-center gap-3 px-5 h-[60px]">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className="h-8 w-8 rounded-[10px] flex items-center justify-center text-white font-black text-[14px] shrink-0"
              style={{ background: "linear-gradient(135deg,var(--tp-primary) 0%,var(--tp-primary-deep) 100%)", boxShadow: "0 4px 14px rgba(0,102,204,0.4)" }}
            >
              N
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-black tp-display uppercase tracking-[0.08em]" style={{ color: "var(--tp-text)" }}>Nivra Tech</p>
              <p className="text-[10px] font-semibold" style={{ color: "var(--tp-text-dim)" }}>Portail technicien</p>
            </div>
            {onShift && (
              <span className="ml-1 inline-flex items-center gap-1.5 text-[10px] font-bold rounded-full px-2 py-1" style={{ color: "var(--tp-success-glow)", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
                <span className="tp-live-dot" />
                <span className="ml-1">Live</span>
              </span>
            )}
          </div>
          <button className="relative shrink-0 h-10 w-10 flex items-center justify-center rounded-full transition-colors" style={{ color: "var(--tp-text-muted)" }}>
            <Bell className="h-[19px] w-[19px]" />
            {(missedToday.length > 0 || urgentCount > 0) && (
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500" style={{ boxShadow: "0 0 0 2px var(--tp-bg)" }} />
            )}
          </button>
        </div>
      </header>

      <div className="px-4 pt-5 pb-6 space-y-3">

        {/* ── Greeting ──────────────────────────────────────────────────────── */}
        <div className="space-y-0.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--tp-text-dim)" }}>{dateLabel}</p>
          <h1 className="tp-display text-[30px] font-black leading-tight" style={{ color: "var(--tp-text)" }}>
            {greeting}, {firstName}
          </h1>
          <p className="text-[13px]" style={{ color: "var(--tp-text-muted)" }}>
            {todays.length > 0 ? `${todays.length} mission${todays.length > 1 ? "s" : ""} planifiée${todays.length > 1 ? "s" : ""} aujourd'hui` : "Aucune mission planifiée aujourd'hui"}
          </p>
        </div>

        {/* ── HERO: Next mission (bento XL) ──────────────────────────────────── */}
        {isLoading ? (
          <div className="tp-card p-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--tp-primary)" }} />
          </div>
        ) : nextMission ? (
          <section className="tp-card tp-card-primary overflow-hidden">
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--tp-primary-glow)" }}>Prochaine mission</p>
                  <h2 className="tp-display text-[22px] font-black leading-tight mt-1 truncate" style={{ color: "var(--tp-text)" }}>
                    {nextMission.client_name || "Client"}
                  </h2>
                </div>
                <div
                  className="shrink-0 rounded-xl px-3 py-2 text-center"
                  style={{ background: "rgba(15,15,26,0.6)", border: "1px solid var(--tp-border-strong)" }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--tp-text-dim)" }}>ETA</p>
                  <p className="tp-kpi text-[16px]" style={{ color: "var(--tp-primary-glow)" }}>
                    {nextMission.scheduled_time_start?.slice(0, 5) ?? "—"}
                  </p>
                </div>
              </div>

              {nextMission.client_address && (
                <div className="flex items-start gap-2 text-[13px]" style={{ color: "var(--tp-text-muted)" }}>
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--tp-primary-glow)" }} />
                  <span className="line-clamp-2">{nextMission.client_address}</span>
                </div>
              )}

              {nextMission.order_items && nextMission.order_items.length > 0 && (
                <div className="flex items-start gap-2 text-[12px]" style={{ color: "var(--tp-text-dim)" }}>
                  <Package className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="line-clamp-1">
                    {nextMission.order_items.map((i: any) => i.plan_name || i.description).filter(Boolean).join(" · ")}
                  </span>
                </div>
              )}

              <button
                onClick={() => navigate(`/tech/installation/${nextMission.id}`)}
                className="tp-btn-primary w-full h-[56px] flex items-center justify-center gap-2 text-[15px]"
              >
                Démarrer l'installation <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </section>
        ) : (
          <section className="tp-card p-6 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--tp-success)", opacity: 0.4 }} />
            <p className="text-[15px] font-bold" style={{ color: "var(--tp-text)" }}>Tout est à jour</p>
            <p className="text-[13px] mt-1" style={{ color: "var(--tp-text-dim)" }}>Aucune mission en cours.</p>
          </section>
        )}

        {/* ── Bento grid 2×2 ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">

          {/* Punch card */}
          <div className="tp-card p-4 flex flex-col justify-between min-h-[128px]">
            <div className="flex items-center gap-2">
              {onShift ? <span className="tp-live-dot" /> : <Power className="h-4 w-4" style={{ color: "var(--tp-text-dim)" }} />}
              <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: onShift ? "var(--tp-success-glow)" : "var(--tp-text-dim)" }}>
                {onShift ? "En service" : "Hors service"}
              </p>
            </div>
            {onShift ? (
              <>
                <p className="tp-kpi text-[26px] mt-2" style={{ color: "var(--tp-text)" }}>{formatElapsed(shiftMs)}</p>
                <button
                  onClick={() => punchOut.mutate(openPunch!.id)}
                  disabled={punchOut.isPending}
                  className="mt-2 h-9 rounded-lg flex items-center justify-center gap-1.5 text-[12px] font-bold text-white disabled:opacity-60 transition active:scale-95"
                  style={{ background: "linear-gradient(135deg,#DC2626,#B91C1C)" }}
                >
                  {punchOut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" fill="currentColor" />}
                  Terminer
                </button>
              </>
            ) : (
              <>
                <p className="text-[12px] mt-2" style={{ color: "var(--tp-text-muted)" }}>Commencez la journée</p>
                <button
                  onClick={() => punchIn.mutate()}
                  disabled={punchIn.isPending}
                  className="mt-2 h-9 rounded-lg flex items-center justify-center gap-1.5 text-[12px] font-bold text-white disabled:opacity-60 transition active:scale-95"
                  style={{ background: "linear-gradient(135deg,var(--tp-success),#047857)" }}
                >
                  {punchIn.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" fill="currentColor" />}
                  Pointer
                </button>
              </>
            )}
          </div>

          {/* KPI: Progression jour */}
          <div className="tp-card p-4 flex flex-col justify-between min-h-[128px]">
            <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: "var(--tp-text-dim)" }}>Aujourd'hui</p>
            <div>
              <p className="tp-kpi text-[28px]" style={{ color: "var(--tp-primary-glow)" }}>
                {completedToday}<span className="text-[16px]" style={{ color: "var(--tp-text-dim)" }}>/{todays.length}</span>
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--tp-text-muted)" }}>Complétées</p>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: "linear-gradient(90deg,var(--tp-primary),var(--tp-primary-glow))" }}
              />
            </div>
          </div>

          {/* Mini map — real Mapbox with all service addresses */}
          <Link
            to="/tech/map"
            className="tp-card tp-card-hover overflow-hidden relative min-h-[128px] flex flex-col justify-end"
            style={{ background: "#14142a" }}
          >
            <TechMiniMap />
            {/* Bottom fade for label legibility */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
              style={{ background: "linear-gradient(180deg, transparent 0%, rgba(15,15,26,0.92) 70%)" }}
            />
            <div className="relative p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-1" style={{ color: "var(--tp-text-dim)" }}>Itinéraire</p>
              <p className="tp-display text-[15px] font-bold flex items-center gap-1" style={{ color: "var(--tp-text)" }}>
                <Navigation className="h-4 w-4" style={{ color: "var(--tp-primary-glow)" }} />
                Voir la carte
              </p>
            </div>
          </Link>

          {/* Van stock (real) */}
          <Link
            to="/tech/stock"
            className="tp-card tp-card-hover p-4 flex flex-col justify-between min-h-[128px]"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: "var(--tp-text-dim)" }}>Stock van</p>
              {vanStock?.lowStock ? (
                <AlertTriangle className="h-4 w-4" style={{ color: "var(--tp-warning)" }} />
              ) : (
                <Package className="h-4 w-4" style={{ color: "var(--tp-text-dim)" }} />
              )}
            </div>
            <div className="space-y-1.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--tp-text-muted)" }}>Bornes WiFi</span>
                <span className="tp-kpi text-[15px]" style={{ color: (vanStock?.bornes ?? 0) < 2 ? "var(--tp-warning)" : "var(--tp-text)" }}>
                  {vanStock ? vanStock.bornes : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--tp-text-muted)" }}>Terminaux TV</span>
                <span className="tp-kpi text-[15px]" style={{ color: (vanStock?.terminals ?? 0) < 2 ? "var(--tp-warning)" : "var(--tp-text)" }}>
                  {vanStock ? vanStock.terminals : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--tp-text-muted)" }}>POD WiFi</span>
                <span className="tp-kpi text-[15px]" style={{ color: (vanStock?.pods ?? 0) < 2 ? "var(--tp-warning)" : "var(--tp-text)" }}>
                  {vanStock ? vanStock.pods : "—"}
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* ── Alertes ────────────────────────────────────────────────────────── */}
        {missedToday.length > 0 && (
          <section className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.24)" }}>
            <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: "var(--tp-danger)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold" style={{ color: "var(--tp-text)" }}>{missedToday.length} rendez-vous manqué{missedToday.length > 1 ? "s" : ""}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--tp-danger)" }}>Action requise — à replanifier</p>
            </div>
            <Link to="/tech/assignments" className="shrink-0 h-9 px-4 rounded-full bg-red-600 text-white text-[12px] font-bold flex items-center">
              Voir
            </Link>
          </section>
        )}

        {/* ── Feed dispatch live ─────────────────────────────────────────────── */}
        {available.length > 0 && (
          <section className="tp-card overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {urgentCount > 0 ? (
                  <Zap className="h-4 w-4" style={{ color: "var(--tp-danger)" }} />
                ) : (
                  <Radio className="h-4 w-4 animate-pulse" style={{ color: "var(--tp-primary-glow)" }} />
                )}
                <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "var(--tp-text-dim)" }}>Dispatch live</p>
              </div>
              <Link to="/tech/assignments" className="text-[11px] font-bold flex items-center gap-0.5" style={{ color: "var(--tp-primary-glow)" }}>
                Tout voir <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <ul>
              {available.slice(0, 3).map((job) => (
                <li key={job.id}>
                  <Link
                    to="/tech/assignments"
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5 active:bg-white/8"
                    style={{ borderTop: "1px solid var(--tp-border)" }}
                  >
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: job.dispatch_priority === "urgent"
                          ? "rgba(239,68,68,0.14)"
                          : "var(--tp-primary-soft)",
                      }}
                    >
                      <Wifi className="h-4 w-4" style={{ color: job.dispatch_priority === "urgent" ? "var(--tp-danger)" : "var(--tp-primary-glow)" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold truncate" style={{ color: "var(--tp-text)" }}>
                        {[job.client_first_name, job.client_last_name].filter(Boolean).join(" ") || "Nouveau job"}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: "var(--tp-text-muted)" }}>
                        {job.client_full_address || job.service_type || "—"}
                      </p>
                    </div>
                    {job.dispatch_priority === "urgent" && (
                      <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-red-600 text-white">Urgent</span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--tp-text-dim)" }} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Stats totales ──────────────────────────────────────────────────── */}
        <section className="tp-card p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-3" style={{ color: "var(--tp-text-dim)" }}>Vue d'ensemble</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="tp-kpi text-[22px]" style={{ color: "var(--tp-text)" }}>
                {assignments.filter((a) => a.status === "completed").length}
              </p>
              <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "var(--tp-text-dim)" }}>
                <CheckCircle2 className="h-3 w-3" /> Complétées
              </p>
            </div>
            <div>
              <p className="tp-kpi text-[22px]" style={{ color: "var(--tp-primary-glow)" }}>{activeCount}</p>
              <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "var(--tp-text-dim)" }}>
                <Clock className="h-3 w-3" /> Actives
              </p>
            </div>
            <div>
              <p className="tp-kpi text-[22px]" style={{ color: "var(--tp-warning)" }}>
                {available.length}
              </p>
              <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "var(--tp-text-dim)" }}>
                <DollarSign className="h-3 w-3" /> Dispo
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
