/**
 * TechDashboard v2 — Nivra Tech command center.
 * Layout inspired by Linear / Stripe: hero mission, KPI grid, timeline, side panels.
 * Consumes existing hooks — zero business logic changes.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, ChevronRight,
  Clock, Loader2, MapPin, Navigation, Package, Phone, Radio, Sparkles,
  TrendingUp, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTechAssignments } from "../lib/useTechAssignments";
import { useAvailableAssignments } from "../lib/useAvailableAssignments";
import { useOpenPunch } from "../lib/usePunch";
import { useVanStock } from "../lib/useVanStock";
import TechMiniMap from "../components/TechMiniMap";

function formatShift(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export default function TechDashboard() {
  const navigate = useNavigate();
  const { data: assignments = [], isLoading } = useTechAssignments();
  const { data: available = [] } = useAvailableAssignments();
  const { data: openPunch } = useOpenPunch();
  const { data: vanStock } = useVanStock();
  const [profile, setProfile] = useState<{ first_name?: string; full_name?: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("first_name, full_name").eq("user_id", user.id).maybeSingle();
      setProfile(data ?? {});
    })();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todays = useMemo(() => assignments.filter((a) => a.scheduled_date === today), [assignments, today]);
  const completedToday = todays.filter((a) => a.status === "completed").length;
  const missed = todays.filter((a) => ["missed", "no_show"].includes(a.status));
  const activeCount = assignments.filter((a) => !["completed", "cancelled", "missed", "no_show"].includes(a.status)).length;
  const enRoute = assignments.filter((a) => ["en_route", "arrived", "in_progress"].includes(a.status)).length;
  const nextMission = useMemo(
    () => todays.find((a) => !["completed", "cancelled", "missed", "no_show"].includes(a.status)) ??
      assignments.find((a) => !["completed", "cancelled", "missed", "no_show"].includes(a.status)),
    [todays, assignments],
  );
  const upcoming = assignments.filter((a) => !["completed", "cancelled", "missed", "no_show"].includes(a.status)).slice(0, 5);

  const firstName = profile?.first_name || profile?.full_name?.split(" ")?.[0] || "Technicien";
  const dateLabel = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
  const timeLabel = new Date().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
  const progressPct = todays.length > 0 ? Math.round((completedToday / todays.length) * 100) : 0;
  const punchStart = openPunch ? ((openPunch as any).punch_in_at || (openPunch as any).punch_in) : null;
  const shiftMs = punchStart ? now - new Date(punchStart).getTime() : 0;
  const lowStock = Boolean(vanStock?.lowStock);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>{dateLabel} · {timeLabel}</p>
          <h1 className="text-[26px] sm:text-[32px] font-bold tracking-tight mt-1" style={{ color: "hsl(var(--foreground))" }}>
            Bonjour {firstName} 👋
          </h1>
        </div>
        {openPunch && (
          <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "hsl(var(--muted-foreground))" }}>
            <Clock className="h-3.5 w-3.5" style={{ color: "hsl(var(--success))" }} />
            Shift · <span className="tc-tabular font-semibold" style={{ color: "hsl(var(--foreground))" }}>{formatShift(shiftMs)}</span>
          </div>
        )}
      </div>

      {/* Hero mission */}
      <section className="tc-mission-hero animate-fade-in">
        {isLoading ? (
          <div className="h-32 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "hsl(var(--primary))" }} />
          </div>
        ) : nextMission ? (
          <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-end">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="tc-pill is-route"><span className="tc-pill-dot" />Prochaine mission</span>
                <span className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>{nextMission.scheduled_time_start?.slice(0, 5) ?? "—"}</span>
              </div>
              <h2 className="text-[22px] sm:text-[28px] font-bold tracking-tight" style={{ color: "hsl(var(--foreground))" }}>
                {nextMission.client_name || "Client"}
              </h2>
              <p className="text-[13.5px] mt-1.5 flex items-start gap-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                <MapPin className="h-4 w-4 mt-px shrink-0" />
                {nextMission.client_address || "Adresse à confirmer"}
              </p>
              {nextMission.service_type && (
                <p className="text-[12.5px] mt-1 uppercase tracking-wider font-medium" style={{ color: "hsl(var(--primary-glow))" }}>
                  {nextMission.service_type}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {nextMission.client_phone && (
                <a href={`tel:${nextMission.client_phone}`} className="tc-btn tc-btn-ghost"><Phone className="h-4 w-4" />Appeler</a>
              )}
              <button className="tc-btn tc-btn-ghost"><Navigation className="h-4 w-4" />Itinéraire</button>
              <button onClick={() => navigate(`/tech/installation/${nextMission.id}`)} className="tc-btn tc-btn-primary">
                Ouvrir la mission <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--success) / 0.15)" }}>
              <CheckCircle2 className="h-5 w-5" style={{ color: "hsl(var(--success))" }} />
            </div>
            <div>
              <p className="font-semibold">Aucune mission active</p>
              <p className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                Toutes vos installations sont terminées, bon travail.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* KPI row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="tc-kpi">
          <span className="tc-kpi-label">RDV aujourd'hui</span>
          <span className="tc-kpi-value">{todays.length}</span>
          <span className="tc-kpi-sub">{completedToday} complété{completedToday > 1 ? "s" : ""}</span>
        </div>
        <div className="tc-kpi">
          <span className="tc-kpi-label">En route</span>
          <span className="tc-kpi-value">{enRoute}</span>
          <span className="tc-kpi-sub">Missions actives</span>
        </div>
        <div className="tc-kpi">
          <span className="tc-kpi-label">Dispatch</span>
          <span className="tc-kpi-value">{available.length}</span>
          <span className="tc-kpi-sub">Disponibles à prendre</span>
        </div>
        <div className="tc-kpi">
          <span className="tc-kpi-label">Progression</span>
          <span className="tc-kpi-value">{progressPct}%</span>
          <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: "var(--tc-gradient-primary)" }} />
          </div>
        </div>
      </section>

      {/* Main grid: timeline + side */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* Timeline */}
        <div className="tc-surface overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "hsl(var(--border))" }}>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Agenda</p>
              <h3 className="text-[15px] font-semibold mt-0.5">Prochains rendez-vous</h3>
            </div>
            <Link to="/tech/appointments" className="text-[12.5px] font-medium inline-flex items-center gap-1" style={{ color: "hsl(var(--primary-glow))" }}>
              Voir tout <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="h-12 w-12 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: "hsl(var(--success) / 0.15)" }}>
                <CheckCircle2 className="h-5 w-5" style={{ color: "hsl(var(--success))" }} />
              </div>
              <p className="font-medium text-[14px]">Journée complétée</p>
              <p className="text-[12.5px] mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>Aucune mission active.</p>
            </div>
          ) : (
            <ul className="p-2 space-y-1.5">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <Link to={`/tech/installation/${a.id}`} className="tc-row tc-focus-ring">
                    <div className="h-11 rounded-lg flex flex-col items-center justify-center" style={{ background: "hsl(var(--muted))" }}>
                      <strong className="text-[14px] leading-none tc-tabular">{a.scheduled_time_start?.slice(0, 5) ?? "—"}</strong>
                      <span className="text-[9.5px] mt-1 uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>{a.scheduled_date?.slice(5)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold truncate">{a.client_name || "Client"}</p>
                      <p className="text-[12px] truncate mt-0.5 flex items-center gap-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                        <MapPin className="h-3 w-3 shrink-0" />{a.client_address || "Adresse à confirmer"}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Side panels */}
        <aside className="space-y-3">
          {/* Mini map */}
          <Link to="/tech/map" className="tc-surface tc-surface-hover block overflow-hidden relative h-[180px]">
            <TechMiniMap />
            <div className="absolute inset-x-0 bottom-0 p-3" style={{ background: "linear-gradient(180deg, transparent, hsl(var(--card)) 85%)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--primary-glow))" }}>Carte live</p>
              <p className="text-[13.5px] font-semibold flex items-center gap-1.5">
                <Navigation className="h-3.5 w-3.5" /> Voir la carte
              </p>
            </div>
          </Link>

          {/* Stock */}
          <Link to="/tech/stock" className="tc-surface tc-surface-hover block p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Stock véhicule</p>
              {lowStock ? <AlertTriangle className="h-4 w-4" style={{ color: "hsl(var(--warning))" }} /> : <Package className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />}
            </div>
            <div className="space-y-1.5 text-[13px]">
              <div className="flex justify-between"><span style={{ color: "hsl(var(--muted-foreground))" }}>Bornes WiFi</span><span className="font-semibold tc-tabular">{vanStock?.bornes ?? "—"}</span></div>
              <div className="flex justify-between"><span style={{ color: "hsl(var(--muted-foreground))" }}>Terminaux TV</span><span className="font-semibold tc-tabular">{vanStock?.terminals ?? "—"}</span></div>
              <div className="flex justify-between"><span style={{ color: "hsl(var(--muted-foreground))" }}>POD WiFi</span><span className="font-semibold tc-tabular">{vanStock?.pods ?? "—"}</span></div>
            </div>
          </Link>

          {/* Assistant IA */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("tech:open-ai"))}
            className="tc-surface tc-surface-hover w-full text-left p-4 flex items-start gap-3"
          >
            <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "hsl(var(--primary) / 0.14)" }}>
              <Sparkles className="h-4.5 w-4.5" style={{ color: "hsl(var(--primary-glow))" }} />
            </div>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold">Assistant IA terrain</p>
              <p className="text-[12px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Diagnostics, procédures, contexte client.</p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
          </button>
        </aside>
      </section>

      {/* Alerts row */}
      {(missed.length > 0 || available.length > 0 || lowStock) && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {missed.length > 0 && (
            <div className="tc-surface p-4 flex items-start gap-3" style={{ borderColor: "hsl(var(--destructive) / 0.35)", background: "hsl(var(--destructive) / 0.08)" }}>
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "hsl(var(--destructive))" }} />
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold">{missed.length} RDV manqué{missed.length > 1 ? "s" : ""}</p>
                <p className="text-[12px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>À replanifier avec dispatch.</p>
              </div>
              <Link to="/tech/appointments" className="text-[12px] font-semibold" style={{ color: "hsl(var(--destructive))" }}>Voir →</Link>
            </div>
          )}
          {available.length > 0 && (
            <div className="tc-surface p-4 flex items-start gap-3" style={{ borderColor: "hsl(var(--primary) / 0.35)", background: "hsl(var(--primary) / 0.08)" }}>
              <Radio className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "hsl(var(--primary-glow))" }} />
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold">{available.length} mission{available.length > 1 ? "s" : ""} disponible{available.length > 1 ? "s" : ""}</p>
                <p className="text-[12px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Dispatch ouvert dans votre zone.</p>
              </div>
              <Link to="/tech/assignments" className="text-[12px] font-semibold" style={{ color: "hsl(var(--primary-glow))" }}>Prendre →</Link>
            </div>
          )}
          {lowStock && (
            <div className="tc-surface p-4 flex items-start gap-3" style={{ borderColor: "hsl(var(--warning) / 0.35)", background: "hsl(var(--warning) / 0.08)" }}>
              <Package className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "hsl(var(--warning))" }} />
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold">Stock véhicule bas</p>
                <p className="text-[12px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Réapprovisionner avant la prochaine mission.</p>
              </div>
              <Link to="/tech/stock" className="text-[12px] font-semibold" style={{ color: "hsl(var(--warning))" }}>Voir →</Link>
            </div>
          )}
        </section>
      )}

      {/* Quick modules */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Modules</p>
            <h3 className="text-[15px] font-semibold mt-0.5">Accès rapide</h3>
          </div>
          <Link to="/tech/menu" className="text-[12.5px] font-medium inline-flex items-center gap-1" style={{ color: "hsl(var(--primary-glow))" }}>
            Tous les modules <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { to: "/tech/appointments", label: "Rendez-vous", icon: CalendarClock },
            { to: "/tech/scanner", label: "Scanner", icon: Zap },
            { to: "/tech/client360", label: "Clients", icon: TrendingUp },
            { to: "/tech/workorder", label: "Bon travail", icon: CheckCircle2 },
            { to: "/tech/tickets", label: "Tickets", icon: AlertTriangle },
            { to: "/tech/performance", label: "Performance", icon: TrendingUp },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <Link key={m.to} to={m.to} className="tc-surface tc-surface-hover p-3 flex flex-col items-start gap-2">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.14)" }}>
                  <Icon className="h-4 w-4" style={{ color: "hsl(var(--primary-glow))" }} />
                </div>
                <span className="text-[12.5px] font-semibold">{m.label}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
