/**
 * TechAppointments — Liste dédiée des rendez-vous installation.
 * Vue terrain claire: aujourd'hui, semaine, toutes les installations, actions rapides.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle, CalendarClock, CheckCircle2, ChevronRight, Clock,
  Loader2, MapPin, Phone, Radio, Search, Wrench,
} from "lucide-react";
import TechHeader from "../components/TechHeader";
import { useTechAssignments } from "../lib/useTechAssignments";
import { useAvailableAssignments } from "../lib/useAvailableAssignments";

type Filter = "today" | "week" | "active" | "all";

const TERMINAL = new Set(["completed", "cancelled", "missed", "no_show"]);

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDate(date: string | null | undefined) {
  if (!date) return "—";
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" });
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    accepted: "Accepté",
    scheduled: "Planifié",
    confirmed: "Confirmé",
    en_route: "En route",
    arrived: "Arrivé",
    in_progress: "En cours",
    completed: "Terminé",
    missed: "Manqué",
    no_show: "Absent",
    cancelled: "Annulé",
    rescheduled: "Replanifié",
  };
  return labels[status] ?? status;
}

export default function TechAppointments() {
  const { data: assignments = [], isLoading } = useTechAssignments();
  const { data: available = [], isLoading: loadingDispatch } = useAvailableAssignments();
  const [filter, setFilter] = useState<Filter>("today");
  const [query, setQuery] = useState("");

  const today = isoDate(new Date());
  const weekEnd = isoDate(new Date(Date.now() + 7 * 86_400_000));
  const activeAssignments = assignments.filter((a) => !TERMINAL.has(a.status));

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
      <TechHeader title="Rendez-vous" subtitle="Installations terrain" />
      <main className="tp-page">
        <section className="tp-ops-hero p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase" style={{ color: "var(--tp-primary)" }}>Agenda installation</p>
              <h1 className="text-[30px] sm:text-[40px] font-black italic uppercase leading-none" style={{ color: "var(--tp-dark-text)" }}>Liste des RDV</h1>
              <p className="mt-2 text-[13px]" style={{ color: "var(--tp-dark-text-dim)" }}>Tous les rendez-vous assignés + missions disponibles au dispatch.</p>
            </div>
            <span className="tp-hv-pill"><CalendarClock className="h-3.5 w-3.5" /> {activeAssignments.length} actifs</span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="tp-dark-kpi is-active"><span className="tp-dark-kpi-label">Aujourd'hui</span><span className="tp-dark-kpi-value">{assignments.filter((a) => a.scheduled_date === today).length}</span></div>
            <div className="tp-dark-kpi"><span className="tp-dark-kpi-label">Semaine</span><span className="tp-dark-kpi-value">{assignments.filter((a) => a.scheduled_date >= today && a.scheduled_date <= weekEnd).length}</span></div>
            <div className="tp-dark-kpi"><span className="tp-dark-kpi-label">Disponibles</span><span className="tp-dark-kpi-value">{available.length}</span></div>
          </div>
        </section>

        <section className="mt-4 grid gap-3 lg:grid-cols-[1fr_260px]">
          <div className="tp-card p-3 flex items-center gap-2">
            <Search className="h-4 w-4" style={{ color: "var(--tp-text-dim)" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher client, adresse, téléphone, commande..." className="tp-field-input flex-1 min-h-[44px] px-3 text-[14px]" />
          </div>
          <Link to="/tech/assignments" className="tp-btn-primary flex items-center justify-center gap-2 px-4"><Radio className="h-4 w-4" /> Dispatch disponible</Link>
        </section>

        <section className="mt-4">
          <div className="grid grid-cols-4 gap-2">
            {([["today", "Aujourd'hui"], ["week", "Semaine"], ["active", "Actifs"], ["all", "Tous"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} className="min-h-[44px] rounded-md text-[11px] font-black italic uppercase" style={{ background: filter === id ? "var(--tp-dark)" : "var(--tp-panel)", color: filter === id ? "var(--tp-primary)" : "var(--tp-text-muted)", border: "1px solid var(--tp-border)" }}>{label}</button>
            ))}
          </div>
        </section>

        <section className="mt-4 space-y-2">
          {isLoading ? (
            <div className="tp-card p-10 flex items-center justify-center gap-3"><Loader2 className="h-5 w-5 animate-spin" /> Chargement des rendez-vous...</div>
          ) : filtered.length === 0 ? (
            <div className="tp-card p-10 text-center"><AlertCircle className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--tp-text-dim)" }} /><p className="font-black">Aucun rendez-vous dans cette vue</p><p className="text-[13px] mt-1" style={{ color: "var(--tp-text-muted)" }}>Vérifie les missions disponibles si un dispatch vient d'être ajouté.</p></div>
          ) : (
            filtered.map((a) => (
              <Link key={a.id} to={`/tech/installation/${a.id}`} className="tp-schedule-row">
                <span className="rounded-md flex flex-col items-center justify-center" style={{ background: "var(--tp-dark)", color: "var(--tp-primary)" }}><strong className="text-[18px] leading-none tabular-nums">{a.scheduled_time_start?.slice(0, 5) ?? "—"}</strong><span className="text-[9px] font-black uppercase text-center" style={{ color: "var(--tp-dark-text-dim)" }}>{formatDate(a.scheduled_date)}</span></span>
                <span className="min-w-0 py-1"><span className="flex items-center gap-2 min-w-0"><span className="block text-[16px] font-black truncate">{a.client_name || "Client"}</span><span className="tp-status-chip shrink-0">{statusLabel(a.status)}</span></span><span className="mt-1 block text-[12px] truncate" style={{ color: "var(--tp-text-muted)" }}><MapPin className="inline h-3.5 w-3.5 mr-1" />{a.client_address || "Adresse à confirmer"}</span><span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: "var(--tp-text-dim)" }}><span><Wrench className="inline h-3.5 w-3.5 mr-1" />{a.service_type || "Installation"}</span>{a.client_phone && <span><Phone className="inline h-3.5 w-3.5 mr-1" />{a.client_phone}</span>}{a.order_number && <span>Commande {a.order_number}</span>}</span></span>
                <span className="tp-schedule-row-action self-center flex items-center gap-2 text-[12px] font-black italic uppercase" style={{ color: "var(--tp-primary-deep)" }}>Ouvrir <ChevronRight className="h-4 w-4" /></span>
              </Link>
            ))
          )}
        </section>

        <section className="mt-5 mb-8">
          <div className="tp-section-title"><h2 className="text-[16px] font-black italic uppercase">Missions disponibles</h2></div>
          {loadingDispatch ? (
            <div className="tp-card p-5 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Chargement dispatch...</div>
          ) : available.length === 0 ? (
            <div className="tp-card p-5 flex items-center gap-3"><CheckCircle2 className="h-5 w-5" style={{ color: "var(--tp-success)" }} /> Aucune mission disponible.</div>
          ) : (
            <div className="tp-module-grid">
              {available.slice(0, 8).map((job) => (
                <Link key={job.id} to="/tech/assignments" className="tp-module-tile"><span className="tp-module-icon"><Clock className="h-5 w-5" /></span><span className="min-w-0"><span className="block text-[14px] font-black italic uppercase truncate">{[job.client_first_name, job.client_last_name].filter(Boolean).join(" ") || "Nouveau RDV"}</span><span className="block text-[11px] truncate" style={{ color: "var(--tp-text-dim)" }}>{job.client_full_address || job.service_type || "À planifier"}</span></span><ChevronRight className="h-4 w-4" /></Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
