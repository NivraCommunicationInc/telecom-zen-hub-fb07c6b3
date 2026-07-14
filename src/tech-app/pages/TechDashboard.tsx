/**
 * TechDashboard — High-level operations dashboard for technicians.
 * First screen is a real command center: today's installs, dispatch, GPS, stock, quick modules.
 */
import { useMemo, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle, Bell, CalendarClock, CheckCircle2, ChevronRight, Clock,
  FileSignature, LayoutGrid, Loader2, MapPin, Navigation, Package,
  Play, Power, Radio, ScanLine, Square, Truck,
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
  const enRouteCount = assignments.filter((a) => ["en_route", "arrived", "in_progress"].includes(a.status)).length;
  const nextMission = useMemo(
    () =>
      todays.find((a) => !["completed", "cancelled", "missed", "no_show"].includes(a.status)) ??
      assignments.find((a) => !["completed", "cancelled", "missed", "no_show"].includes(a.status)),
    [todays, assignments],
  );
  const upcoming = assignments
    .filter((a) => !["completed", "cancelled", "missed", "no_show"].includes(a.status))
    .slice(0, 4);

  const onShift = !!openPunch;
  const punchStart = openPunch ? ((openPunch as any).punch_in_at || (openPunch as any).punch_in) : null;
  const shiftMs = punchStart ? now - new Date(punchStart).getTime() : 0;
  const firstName = profile?.first_name || profile?.full_name?.split(" ")?.[0] || "Technicien";
  const dateLabel = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
  const urgentCount = available.filter((j) => j.dispatch_priority === "urgent").length;
  const progressPct = todays.length > 0 ? Math.round((completedToday / todays.length) * 100) : 0;
  const lowStock = Boolean(vanStock?.lowStock);

  return (
    <div className="tp-shell min-h-screen">
      <header className="tp-ops-header sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="max-w-[1180px] mx-auto h-[68px] px-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-md flex items-center justify-center font-black italic text-[17px]" style={{ background: "var(--tp-primary)", color: "var(--tp-dark)" }}>N</div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase" style={{ color: "var(--tp-primary)" }}>Nivra Tech Command</p>
            <h1 className="text-[20px] font-black italic uppercase leading-none truncate" style={{ color: "var(--tp-dark-text)" }}>Ops terrain · {firstName}</h1>
          </div>
          <Link to="/tech/appointments" className="hidden sm:flex h-10 px-4 rounded-md items-center gap-2 font-black italic uppercase text-[12px]" style={{ background: "var(--tp-primary)", color: "var(--tp-dark)" }}>
            <CalendarClock className="h-4 w-4" /> Rendez-vous
          </Link>
          <button aria-label="Notifications" className="relative h-11 w-11 rounded-md flex items-center justify-center" style={{ background: "var(--tp-dark-2)", color: "var(--tp-dark-text)" }}>
            <Bell className="h-5 w-5" />
            {(missedToday.length > 0 || urgentCount > 0) && <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full" style={{ background: "var(--tp-danger)", boxShadow: "0 0 0 2px var(--tp-dark)" }} />}
          </button>
        </div>
      </header>

      <div className="tp-page space-y-4">
        <section className="tp-ops-hero">
          <div className="tp-ops-hero-grid">
            <div className="tp-ops-hero-main p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase" style={{ color: "var(--tp-primary)" }}>{dateLabel}</p>
                  <h2 className="mt-1 text-[32px] sm:text-[42px] font-black italic uppercase leading-none" style={{ color: "var(--tp-dark-text)" }}>Dashboard tech</h2>
                  <p className="mt-2 text-[14px] max-w-[560px]" style={{ color: "var(--tp-dark-text-dim)" }}>
                    {todays.length > 0 ? `${todays.length} rendez-vous installation aujourd'hui · ${completedToday} complété${completedToday > 1 ? "s" : ""}` : "Aucun rendez-vous planifié aujourd'hui"}
                  </p>
                </div>
                <span className="tp-hv-pill"><span className="tp-live-dot" /> {onShift ? "Shift live" : "Hors shift"}</span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="tp-dark-kpi is-active"><span className="tp-dark-kpi-label">RDV actifs</span><span className="tp-dark-kpi-value">{activeCount}</span></div>
                <div className="tp-dark-kpi"><span className="tp-dark-kpi-label">En route</span><span className="tp-dark-kpi-value">{enRouteCount}</span></div>
                <div className="tp-dark-kpi"><span className="tp-dark-kpi-label">Dispatch</span><span className="tp-dark-kpi-value">{available.length}</span></div>
              </div>
            </div>

            <div className="tp-ops-hero-side p-4 sm:p-6">
              <p className="text-[11px] font-black italic uppercase" style={{ color: "var(--tp-primary)" }}>Prochaine installation</p>
              {isLoading ? (
                <div className="h-[174px] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--tp-primary)" }} /></div>
              ) : nextMission ? (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[22px] font-black leading-tight truncate" style={{ color: "var(--tp-dark-text)" }}>{nextMission.client_name || "Client"}</h3>
                    <span className="text-[22px] font-black tabular-nums" style={{ color: "var(--tp-primary)" }}>{nextMission.scheduled_time_start?.slice(0, 5) ?? "—"}</span>
                  </div>
                  {nextMission.client_address && <p className="text-[13px] line-clamp-2 flex gap-2" style={{ color: "var(--tp-dark-text-dim)" }}><MapPin className="h-4 w-4 shrink-0" />{nextMission.client_address}</p>}
                  <button onClick={() => navigate(`/tech/installation/${nextMission.id}`)} className="tp-btn-amber w-full h-[54px] flex items-center justify-center gap-2">
                    Ouvrir le dossier <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="mt-5 rounded-md p-4" style={{ background: "var(--tp-dark-2)", color: "var(--tp-dark-text-dim)" }}>Aucune installation active.</div>
              )}
            </div>
          </div>
        </section>

        <section className="tp-control-strip">
          <Link to="/tech/appointments" className="tp-control-card"><CalendarClock className="h-5 w-5 mb-3" /><p className="text-[11px] font-black uppercase">Liste RDV</p><p className="text-[22px] font-black">{activeCount}</p></Link>
          <Link to="/tech/assignments" className="tp-control-card"><Radio className="h-5 w-5 mb-3" /><p className="text-[11px] font-black uppercase">À prendre</p><p className="text-[22px] font-black">{available.length}</p></Link>
          <Link to="/tech/map" className="tp-control-card"><Navigation className="h-5 w-5 mb-3" /><p className="text-[11px] font-black uppercase">Carte live</p><p className="text-[22px] font-black">GPS</p></Link>
          <Link to="/tech/stock" className="tp-control-card"><Package className="h-5 w-5 mb-3" /><p className="text-[11px] font-black uppercase">Stock van</p><p className="text-[22px] font-black" style={{ color: lowStock ? "var(--tp-danger)" : "var(--tp-text)" }}>{lowStock ? "Bas" : "OK"}</p></Link>
        </section>

        <section>
          <div className="tp-section-title"><h2 className="text-[16px] font-black italic uppercase">Modules rapides</h2></div>
          <div className="tp-module-grid">
            {[
              { to: "/tech/appointments", icon: CalendarClock, title: "Rendez-vous", hint: "Toutes les installations" },
              { to: "/tech/workorder", icon: FileSignature, title: "Bon de travail", hint: "Photos · signature" },
              { to: "/tech/scanner", icon: ScanLine, title: "Scanner équipement", hint: "Série · MAC · IMEI" },
              { to: "/tech/menu", icon: LayoutGrid, title: "Tous les menus", hint: "Ops · terrain · perf" },
            ].map((m) => {
              const Icon = m.icon;
              return <Link key={m.to} to={m.to} className="tp-module-tile"><span className="tp-module-icon"><Icon className="h-5 w-5" /></span><span className="min-w-0"><span className="block text-[14px] font-black italic uppercase truncate">{m.title}</span><span className="block text-[11px] truncate" style={{ color: "var(--tp-text-dim)" }}>{m.hint}</span></span><ChevronRight className="h-4 w-4" /></Link>;
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
          <section className="tp-card overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: "var(--tp-border)" }}>
              <div><p className="text-[11px] font-black uppercase" style={{ color: "var(--tp-text-dim)" }}>Agenda installation</p><h2 className="text-[18px] font-black italic uppercase">Prochains rendez-vous</h2></div>
              <Link to="/tech/appointments" className="text-[12px] font-black italic uppercase flex items-center gap-1" style={{ color: "var(--tp-primary-deep)" }}>Liste complète <ChevronRight className="h-4 w-4" /></Link>
            </div>
            {upcoming.length === 0 ? (
              <div className="p-8 text-center"><CheckCircle2 className="h-10 w-10 mx-auto mb-2" style={{ color: "var(--tp-success)" }} /><p className="font-bold">Aucun rendez-vous actif</p></div>
            ) : (
              <div className="p-3 space-y-2">
                {upcoming.map((a) => (
                  <Link key={a.id} to={`/tech/installation/${a.id}`} className="tp-schedule-row">
                    <span className="rounded-md flex flex-col items-center justify-center" style={{ background: "var(--tp-dark)", color: "var(--tp-primary)" }}><strong className="text-[18px] leading-none">{a.scheduled_time_start?.slice(0, 5) ?? "—"}</strong><span className="text-[9px] font-black uppercase" style={{ color: "var(--tp-dark-text-dim)" }}>{a.scheduled_date?.slice(5)}</span></span>
                    <span className="min-w-0"><span className="block text-[15px] font-black truncate">{a.client_name || "Client"}</span><span className="block text-[12px] truncate" style={{ color: "var(--tp-text-muted)" }}><MapPin className="inline h-3.5 w-3.5 mr-1" />{a.client_address || "Adresse à confirmer"}</span></span>
                    <span className="tp-schedule-row-action self-center tp-status-chip">{a.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="tp-card p-4 flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center gap-2">
                {onShift ? <span className="tp-live-dot" /> : <Power className="h-4 w-4" style={{ color: "var(--tp-text-dim)" }} />}
                <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: onShift ? "var(--tp-success)" : "var(--tp-text-dim)" }}>{onShift ? "En service" : "Hors service"}</p>
              </div>
              {onShift ? (
                <>
                  <p className="tp-kpi text-[26px] mt-2" style={{ color: "var(--tp-text)" }}>{formatElapsed(shiftMs)}</p>
                  <button onClick={() => punchOut.mutate((openPunch as any).id)} disabled={punchOut.isPending} className="mt-2 h-10 rounded-md flex items-center justify-center gap-1.5 text-[12px] font-black disabled:opacity-60 transition active:scale-95" style={{ background: "linear-gradient(135deg,#DC2626,#B91C1C)", color: "#fff" }}>
                    {punchOut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" fill="currentColor" />} Terminer
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[12px] mt-2" style={{ color: "var(--tp-text-muted)" }}>Commencer la journée terrain</p>
                  <button onClick={() => punchIn.mutate()} disabled={punchIn.isPending} className="mt-2 h-10 rounded-md flex items-center justify-center gap-1.5 text-[12px] font-black disabled:opacity-60 transition active:scale-95" style={{ background: "linear-gradient(135deg,var(--tp-success),#047857)", color: "#fff" }}>
                    {punchIn.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" fill="currentColor" />} Pointer
                  </button>
                </>
              )}
            </div>

            <div className="tp-card p-4 flex flex-col justify-between min-h-[132px]">
              <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: "var(--tp-text-dim)" }}>Progression aujourd'hui</p>
              <div><p className="tp-kpi text-[28px]" style={{ color: "var(--tp-primary-deep)" }}>{completedToday}<span className="text-[16px]" style={{ color: "var(--tp-text-dim)" }}>/{todays.length}</span></p><p className="text-[11px] mt-0.5" style={{ color: "var(--tp-text-muted)" }}>Installations complétées</p></div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "#e5e7eb" }}><div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg,var(--tp-primary),var(--tp-primary-glow))" }} /></div>
            </div>

            <Link to="/tech/map" className="tp-card tp-card-hover overflow-hidden relative min-h-[156px] flex flex-col justify-end" style={{ background: "var(--tp-dark)" }}>
              <TechMiniMap />
              <div aria-hidden className="absolute inset-x-0 bottom-0 h-20 pointer-events-none" style={{ background: "linear-gradient(180deg, transparent 0%, rgba(17,24,39,0.94) 75%)" }} />
              <div className="relative p-4"><p className="text-[10px] font-black uppercase mb-1" style={{ color: "var(--tp-primary)" }}>Carte opérationnelle</p><p className="text-[15px] font-black flex items-center gap-1" style={{ color: "var(--tp-dark-text)" }}><Navigation className="h-4 w-4" /> Voir les techniciens</p></div>
            </Link>

            <Link to="/tech/stock" className="tp-card tp-card-hover p-4 flex flex-col justify-between min-h-[128px]">
              <div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: "var(--tp-text-dim)" }}>Stock véhicule</p>{lowStock ? <AlertTriangle className="h-4 w-4" style={{ color: "var(--tp-warning)" }} /> : <Package className="h-4 w-4" />}</div>
              <div className="space-y-1.5 text-[12px]"><div className="flex items-center justify-between"><span>Bornes WiFi</span><span className="tp-kpi">{vanStock ? vanStock.bornes : "—"}</span></div><div className="flex items-center justify-between"><span>Terminaux TV</span><span className="tp-kpi">{vanStock ? vanStock.terminals : "—"}</span></div><div className="flex items-center justify-between"><span>POD WiFi</span><span className="tp-kpi">{vanStock ? vanStock.pods : "—"}</span></div></div>
            </Link>
          </aside>
        </div>

        {missedToday.length > 0 && (
          <section className="p-4 flex items-center gap-3 rounded-md" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.28)" }}>
            <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: "var(--tp-danger)" }} />
            <div className="flex-1 min-w-0"><p className="text-[14px] font-bold">{missedToday.length} rendez-vous manqué{missedToday.length > 1 ? "s" : ""}</p><p className="text-[11px] mt-0.5" style={{ color: "var(--tp-danger)" }}>Action requise — à replanifier</p></div>
            <Link to="/tech/appointments" className="shrink-0 h-9 px-4 rounded-md text-[12px] font-black flex items-center" style={{ background: "var(--tp-danger)", color: "#fff" }}>Voir</Link>
          </section>
        )}

        {available.length > 0 && (
          <section className="tp-card overflow-hidden mb-8">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between"><div className="flex items-center gap-2"><Truck className="h-4 w-4" style={{ color: urgentCount > 0 ? "var(--tp-danger)" : "var(--tp-primary-deep)" }} /><p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "var(--tp-text-dim)" }}>Dispatch live</p></div><Link to="/tech/assignments" className="text-[11px] font-bold flex items-center gap-0.5" style={{ color: "var(--tp-primary-deep)" }}>Tout voir <ChevronRight className="h-3 w-3" /></Link></div>
            <ul>{available.slice(0, 3).map((job) => (<li key={job.id}><Link to="/tech/assignments" className="flex items-center gap-3 px-4 py-3 transition-colors" style={{ borderTop: "1px solid var(--tp-border)" }}><div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0" style={{ background: job.dispatch_priority === "urgent" ? "rgba(220,38,38,0.14)" : "var(--tp-primary-soft)" }}><Clock className="h-4 w-4" style={{ color: job.dispatch_priority === "urgent" ? "var(--tp-danger)" : "var(--tp-primary-deep)" }} /></div><div className="min-w-0 flex-1"><p className="text-[13px] font-bold truncate">{[job.client_first_name, job.client_last_name].filter(Boolean).join(" ") || "Nouveau job"}</p><p className="text-[11px] truncate" style={{ color: "var(--tp-text-muted)" }}>{job.client_full_address || job.service_type || "—"}</p></div>{job.dispatch_priority === "urgent" && <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider" style={{ background: "var(--tp-danger)", color: "#fff" }}>Urgent</span>}<ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--tp-text-dim)" }} /></Link></li>))}</ul>
          </section>
        )}
      </div>
    </div>
  );
}
