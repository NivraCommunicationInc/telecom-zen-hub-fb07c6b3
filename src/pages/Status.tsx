/**
 * Status — Public service health page.
 *
 * Route: /status
 * Reads from:
 *   - public.service_status   (current state per service)
 *   - public.service_incidents (recent resolved incidents — last 30 days)
 *
 * No auth required. Auto-refreshes every 30 seconds.
 */
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Wrench,
  Activity,
  RefreshCw,
  Clock,
  ArrowRight,
} from "lucide-react";

type ServiceStatusRow = {
  id: string;
  service_name: string;
  display_name: string;
  description: string | null;
  status: "operational" | "degraded" | "partial_outage" | "major_outage" | "maintenance";
  status_message: string | null;
  last_incident_at: string | null;
  uptime_percent: number | null;
  response_time_ms: number | null;
  updated_at: string;
};

type IncidentRow = {
  id: string;
  service_name: string;
  service_display_name: string | null;
  status_at_incident: string;
  incident_title: string;
  incident_message: string | null;
  started_at: string;
  resolved_at: string | null;
  duration_minutes: number | null;
};

const STATUS_META: Record<
  ServiceStatusRow["status"],
  { label: string; tone: string; dot: string; icon: React.ComponentType<{ className?: string }> }
> = {
  operational: {
    label: "Opérationnel",
    tone: "text-emerald-600 bg-emerald-50 border-emerald-200",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
  },
  degraded: {
    label: "Performance dégradée",
    tone: "text-amber-600 bg-amber-50 border-amber-200",
    dot: "bg-amber-500",
    icon: AlertTriangle,
  },
  partial_outage: {
    label: "Panne partielle",
    tone: "text-orange-600 bg-orange-50 border-orange-200",
    dot: "bg-orange-500",
    icon: AlertTriangle,
  },
  major_outage: {
    label: "Panne majeure",
    tone: "text-red-600 bg-red-50 border-red-200",
    dot: "bg-red-500",
    icon: AlertOctagon,
  },
  maintenance: {
    label: "Maintenance planifiée",
    tone: "text-blue-600 bg-blue-50 border-blue-200",
    dot: "bg-blue-500",
    icon: Wrench,
  },
};

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hrs} h ${rem} min` : `${hrs} h`;
}

export default function Status() {
  const [services, setServices] = useState<ServiceStatusRow[] | null>(null);
  const [incidents, setIncidents] = useState<IncidentRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = async () => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
      const [{ data: svcData, error: svcErr }, { data: incData, error: incErr }] = await Promise.all([
        supabase
          .from("service_status")
          .select(
            "id, service_name, display_name, description, status, status_message, last_incident_at, uptime_percent, response_time_ms, updated_at",
          )
          .order("display_name"),
        supabase
          .from("service_incidents")
          .select(
            "id, service_name, service_display_name, status_at_incident, incident_title, incident_message, started_at, resolved_at, duration_minutes",
          )
          .not("resolved_at", "is", null)
          .gte("started_at", thirtyDaysAgo)
          .order("started_at", { ascending: false })
          .limit(20),
      ]);
      if (svcErr) throw svcErr;
      if (incErr) throw incErr;
      setServices((svcData ?? []) as ServiceStatusRow[]);
      setIncidents((incData ?? []) as IncidentRow[]);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      setLoadError(err?.message ?? "Impossible de charger le statut des services");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // Auto-refresh every 30s
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const overallStatus = useMemo<ServiceStatusRow["status"]>(() => {
    if (!services || services.length === 0) return "operational";
    if (services.some((s) => s.status === "major_outage")) return "major_outage";
    if (services.some((s) => s.status === "partial_outage")) return "partial_outage";
    if (services.some((s) => s.status === "degraded")) return "degraded";
    if (services.some((s) => s.status === "maintenance")) return "maintenance";
    return "operational";
  }, [services]);

  const overallMeta = STATUS_META[overallStatus];
  const OverallIcon = overallMeta.icon;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>État des services — Nivra Telecom</title>
        <meta
          name="description"
          content="État en temps réel des services Nivra Telecom : Internet, Télévision, Mobile, Streaming, Portail client, Facturation."
        />
        <link rel="canonical" href="https://nivra-telecom.ca/status" />
      </Helmet>
      <Header />

      <main id="main-content" tabIndex={-1} className="container mx-auto max-w-5xl px-4 py-10">
        {/* Hero / overall banner */}
        <section className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary mb-3">
            <Activity className="h-3.5 w-3.5" />
            ÉTAT DES SERVICES
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            État des services Nivra Telecom
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Suivez l'état de chaque service en temps réel. Cette page se met à jour automatiquement
            toutes les 30 secondes.
          </p>
        </section>

        {/* Overall status card */}
        <section
          className={`mb-8 rounded-2xl border-2 p-6 ${overallMeta.tone}`}
          aria-live="polite"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <OverallIcon className="h-8 w-8" />
              <div>
                <h2 className="text-xl font-bold">
                  {overallStatus === "operational"
                    ? "Tous les services fonctionnent normalement"
                    : overallStatus === "maintenance"
                    ? "Maintenance en cours"
                    : "Incident en cours sur un ou plusieurs services"}
                </h2>
                <p className="text-sm opacity-80 mt-0.5">
                  Dernière vérification : {lastRefreshedAt.toLocaleTimeString("fr-CA")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-full bg-background/80 px-4 py-2 text-sm font-medium hover:bg-background disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Actualiser
            </button>
          </div>
        </section>

        {/* Per-service grid */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-foreground mb-4">Services</h2>
          {loadError && (
            <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
              {loadError}
            </div>
          )}
          {services === null && !loadError && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          )}
          {services !== null && services.length === 0 && !loadError && (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Aucun service configuré.
            </div>
          )}
          <div className="grid gap-3">
            {(services ?? []).map((svc) => {
              const meta = STATUS_META[svc.status] ?? STATUS_META.operational;
              const Icon = meta.icon;
              return (
                <div
                  key={svc.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 h-3 w-3 rounded-full ${meta.dot}`} aria-hidden="true" />
                    <div>
                      <div className="font-semibold text-foreground">{svc.display_name}</div>
                      {svc.description && (
                        <p className="text-sm text-muted-foreground">{svc.description}</p>
                      )}
                      {svc.status_message && (
                        <p className="mt-1 text-xs text-foreground/80 italic">{svc.status_message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:justify-end">
                    {svc.uptime_percent != null && (
                      <div className="text-right text-xs text-muted-foreground">
                        <div>Disponibilité 30 j</div>
                        <div className="font-mono font-semibold text-foreground">
                          {Number(svc.uptime_percent).toFixed(2)}%
                        </div>
                      </div>
                    )}
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${meta.tone}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Recent incidents */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-foreground mb-4">
            Incidents récents (30 derniers jours)
          </h2>
          {incidents === null && !loadError && (
            <div className="h-20 animate-pulse rounded-xl bg-muted" />
          )}
          {incidents !== null && incidents.length === 0 && !loadError && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-700">
                Aucun incident résolu au cours des 30 derniers jours.
              </p>
            </div>
          )}
          <div className="space-y-3">
            {(incidents ?? []).map((inc) => (
              <article
                key={inc.id}
                className="rounded-xl border border-border bg-card p-5"
              >
                <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{inc.incident_title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {inc.service_display_name ?? inc.service_name}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Résolu
                  </span>
                </header>
                {inc.incident_message && (
                  <p className="mb-3 text-sm text-muted-foreground">{inc.incident_message}</p>
                )}
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Début : {formatDate(inc.started_at)}
                  </span>
                  {inc.resolved_at && (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Résolu : {formatDate(inc.resolved_at)}
                    </span>
                  )}
                  <span>Durée : {formatDuration(inc.duration_minutes)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Footer info */}
        <section className="rounded-xl border border-border bg-muted/30 p-6">
          <h2 className="text-lg font-bold text-foreground mb-2">Un problème de service ?</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Si votre service ne fonctionne pas alors que cette page indique « opérationnel »,
            contactez notre support ou consultez nos guides de dépannage.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Contacter le support
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/support"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2 text-sm font-medium hover:bg-muted"
            >
              Centre d'aide
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
