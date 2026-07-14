/**
 * TechAppointments v2 — Liste moderne des rendez-vous.
 * Design aligné Nivra Core (Linear/Stripe direction).
 * Utilise MissionDetailDrawer pour l'aperçu contextuel sans changer de page.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle, CalendarClock, CheckCircle2, ChevronRight, Loader2,
  MapPin, Phone, Radio, Search, Wrench,
} from "lucide-react";
import TechPageHeader from "../components/TechPageHeader";
import MissionDetailDrawer from "../components/MissionDetailDrawer";
import { useTechAssignments } from "../lib/useTechAssignments";
import { useAvailableAssignments } from "../lib/useAvailableAssignments";

type Filter = "today" | "week" | "active" | "all";

const TERMINAL = new Set(["completed", "cancelled", "missed", "no_show"]);

const STATUS_META: Record<string, { label: string; variant: string }> = {
  scheduled:   { label: "Planifié",  variant: "is-offline" },
  accepted:    { label: "Accepté",   variant: "is-available" },
  confirmed:   { label: "Confirmé",  variant: "is-available" },
  en_route:    { label: "En route",  variant: "is-route" },
  arrived:     { label: "Sur place", variant: "is-route" },
  in_progress: { label: "En cours",  variant: "is-route" },
  completed:   { label: "Terminé",   variant: "is-available" },
  cancelled:   { label: "Annulé",    variant: "is-offline" },
  missed:      { label: "Manqué",    variant: "is-pause" },
  no_show:     { label: "Absent",    variant: "is-pause" },
  rescheduled: { label: "Replanifié", variant: "is-offline" },
};

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

function formatDate(date: string | null | undefined) {
  if (!date) return "—";
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" });
}

export default function TechAppointments() {
  const { data: assignments = [], isLoading } = useTechAssignments();
  const { data: available = [], isLoading: loadingDispatch } = useAvailableAssignments();
  const [filter, setFilter] = useState<Filter>("today");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const today = isoDate(new Date());
  const weekEnd = isoDate(new Date(Date.now() + 7 * 86_400_000));
  const active = assignments.filter((a) => !TERMINAL.has(a.status));
  const countToday = assignments.filter((a) => a.scheduled_date === today).length;
  const countWeek = assignments.filter((a) => a.scheduled_date >= today && a.scheduled_date <= weekEnd).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assignments
      .filter((a) => {
        if (filter === "today") return a.scheduled_date === today;
        if (filter === "week") return a.scheduled_date >= today && a.scheduled_date <= weekEnd;
        if (filter === "active") return !TERMINAL.has(a.status);
        return true;
      })
      .filter((a) => {
        if (!q) return true;
        return [a.client_name, a.client_address, a.client_phone, a.order_number, a.appointment_number, a.service_type]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      });
  }, [assignments, filter, query, today, weekEnd]);

  return (
    <>
      <TechPageHeader title="Rendez-vous" subtitle={`${active.length} actif${active.length > 1 ? "s" : ""}`} />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Hero + KPIs */}
        <section className="tc-mission-hero animate-fade-in">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--primary-glow))" }}>
                Agenda installation
              </p>
              <h1 className="text-[26px] sm:text-[32px] font-bold tracking-tight mt-1" style={{ color: "hsl(var(--foreground))" }}>
                Rendez-vous
              </h1>
              <p className="mt-1.5 text-[13.5px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                Tous vos rendez-vous assignés et les missions disponibles au dispatch.
              </p>
            </div>
            <Link to="/tech/assignments" className="tc-btn tc-btn-primary">
              <Radio className="h-4 w-4" />
              Dispatch <span className="tc-tabular">({available.length})</span>
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="tc-kpi">
              <span className="tc-kpi-label">Aujourd'hui</span>
              <span className="tc-kpi-value">{countToday}</span>
            </div>
            <div className="tc-kpi">
              <span className="tc-kpi-label">Semaine</span>
              <span className="tc-kpi-value">{countWeek}</span>
            </div>
            <div className="tc-kpi">
              <span className="tc-kpi-label">Actifs</span>
              <span className="tc-kpi-value">{active.length}</span>
            </div>
          </div>
        </section>

        {/* Search + Filters */}
        <section className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="tc-surface flex items-center gap-2 px-3">
            <Search className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher client, adresse, téléphone, commande…"
              className="flex-1 h-11 bg-transparent outline-none text-[14px]"
              style={{ color: "hsl(var(--foreground))" }}
            />
          </div>
          <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl" style={{ background: "hsl(var(--muted))" }}>
            {(["today", "week", "active", "all"] as const).map((id) => {
              const labels = { today: "Aujourd'hui", week: "Semaine", active: "Actifs", all: "Tous" } as const;
              const isActive = filter === id;
              return (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className="min-h-11 px-3 rounded-lg text-[12.5px] font-semibold transition-all tc-focus-ring"
                  style={{
                    background: isActive ? "hsl(var(--card))" : "transparent",
                    color: isActive ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                    boxShadow: isActive ? "var(--tc-elev-1)" : "none",
                  }}
                >
                  {labels[id]}
                </button>
              );
            })}
          </div>
        </section>

        {/* List */}
        <section className="space-y-2">
          {isLoading ? (
            <div className="tc-surface p-10 flex items-center justify-center gap-3" style={{ color: "hsl(var(--muted-foreground))" }}>
              <Loader2 className="h-5 w-5 animate-spin" />
              Chargement des rendez-vous…
            </div>
          ) : filtered.length === 0 ? (
            <div className="tc-surface p-10 text-center">
              <div className="h-12 w-12 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: "hsl(var(--muted))" }}>
                <AlertCircle className="h-5 w-5" style={{ color: "hsl(var(--muted-foreground))" }} />
              </div>
              <p className="text-[14.5px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>Aucun rendez-vous dans cette vue</p>
              <p className="text-[12.5px] mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                Vérifiez les missions disponibles si un dispatch vient d'être ajouté.
              </p>
            </div>
          ) : (
            filtered.map((a) => {
              const status = STATUS_META[a.status] ?? { label: a.status, variant: "is-offline" };
              return (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className="w-full text-left tc-surface tc-surface-hover p-3 flex items-center gap-3 tc-focus-ring"
                >
                  <div className="h-14 w-14 rounded-lg flex flex-col items-center justify-center shrink-0" style={{ background: "hsl(var(--muted))" }}>
                    <strong className="text-[15px] leading-none tc-tabular font-bold" style={{ color: "hsl(var(--foreground))" }}>
                      {a.scheduled_time_start?.slice(0, 5) ?? "—"}
                    </strong>
                    <span className="text-[9.5px] mt-1 uppercase tracking-wider font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {formatDate(a.scheduled_date)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[15px] font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>
                        {a.client_name || "Client"}
                      </span>
                      <span className={`tc-pill ${status.variant} shrink-0`}><span className="tc-pill-dot" />{status.label}</span>
                    </div>
                    <p className="mt-1 text-[12.5px] truncate flex items-center gap-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {a.client_address || "Adresse à confirmer"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                      <span className="flex items-center gap-1"><Wrench className="h-3 w-3" />{a.service_type || "Installation"}</span>
                      {a.client_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{a.client_phone}</span>}
                      {a.order_number && <span className="tc-tabular">#{a.order_number}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
                </button>
              );
            })
          )}
        </section>

        {/* Dispatch */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Dispatch</p>
              <h2 className="text-[15px] font-semibold mt-0.5" style={{ color: "hsl(var(--foreground))" }}>Missions disponibles</h2>
            </div>
            <Link to="/tech/assignments" className="text-[12.5px] font-medium inline-flex items-center gap-1" style={{ color: "hsl(var(--primary-glow))" }}>
              Voir tout <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {loadingDispatch ? (
            <div className="tc-surface p-5 flex items-center gap-2" style={{ color: "hsl(var(--muted-foreground))" }}>
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement dispatch…
            </div>
          ) : available.length === 0 ? (
            <div className="tc-surface p-5 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5" style={{ color: "hsl(var(--success))" }} />
              <span className="text-[13.5px]" style={{ color: "hsl(var(--muted-foreground))" }}>Aucune mission disponible pour le moment.</span>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {available.slice(0, 6).map((job: any) => (
                <Link key={job.id} to="/tech/assignments" className="tc-surface tc-surface-hover p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "hsl(var(--primary) / 0.14)" }}>
                    <CalendarClock className="h-4 w-4" style={{ color: "hsl(var(--primary-glow))" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>
                      {[job.client_first_name, job.client_last_name].filter(Boolean).join(" ") || "Nouvelle mission"}
                    </p>
                    <p className="text-[11.5px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {job.client_full_address || job.service_type || "À planifier"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <MissionDetailDrawer mission={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  );
}
