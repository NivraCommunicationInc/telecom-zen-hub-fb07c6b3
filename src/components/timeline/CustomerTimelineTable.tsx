/**
 * CustomerTimelineTable — Canonical unified Timeline UI.
 *
 * The single Timeline implementation for the entire app (Client 360 Core,
 * Employee 360, Client Portal). Reads exclusively from `v_customer_timeline`
 * via `useCustomerTimeline`. NEVER reads source tables directly.
 *
 * Features:
 *  - correlation_id grouping (events sharing the same correlation_id are
 *    collapsed under the anchor row; expand to reveal siblings)
 *  - Expandable per-row diff (before_data / after_data / reason)
 *  - Filters: search, event_type, actor role, date range
 *  - visibility gating (portal → "client", staff surfaces → "all"/"staff")
 *  - Fully FR/EN via LanguageContext
 *
 *   <CustomerTimelineTable clientId={clientId} visibility="client" />
 */
import { useMemo, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CreditCard,
  DollarSign,
  Headphones,
  Layers,
  ShieldX,
  Link2,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useCustomerTimeline,
  type TimelineEvent,
  type TimelineEventType,
} from "@/hooks/useCustomerTimeline";
import { TimelineDiff } from "./TimelineDiff";
import { TimelineFilters, defaultTimelineFilters, type TimelineFiltersState } from "./TimelineFilters";

const TYPE_ICON: Record<TimelineEventType, React.ComponentType<{ className?: string }>> = {
  billing: CreditCard,
  payment: DollarSign,
  support: Headphones,
  cancellation: ShieldX,
  audit: Activity,
  system: Activity,
};

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

const TYPE_BADGE: Record<TimelineEventType, string> = {
  billing: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  payment: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  support: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  cancellation: "bg-red-500/10 text-red-400 border-red-500/20",
  audit: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  system: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const TYPE_LABEL_FR: Record<TimelineEventType, string> = {
  billing: "Facturation",
  payment: "Paiement",
  support: "Support",
  cancellation: "Annulation",
  audit: "Audit",
  system: "Système",
};
const TYPE_LABEL_EN: Record<TimelineEventType, string> = {
  billing: "Billing",
  payment: "Payment",
  support: "Support",
  cancellation: "Cancellation",
  audit: "Audit",
  system: "System",
};

interface Props {
  clientId: string;
  /** RLS-aware visibility gate. Portal → "client". Staff/Core → "all". */
  visibility?: "all" | "client" | "staff";
  limit?: number;
  /** Override supabase client (portal vs core). */
  client?: SupabaseClient<any, any, any>;
  /** Hide the top filter bar (embedded contexts). */
  hideFilters?: boolean;
  /** Hide the actor-role filter (portal). */
  hideActorRole?: boolean;
  className?: string;
}

interface EventGroup {
  anchor: TimelineEvent;
  siblings: TimelineEvent[];
}

export function CustomerTimelineTable({
  clientId,
  visibility = "all",
  limit = 200,
  client,
  hideFilters = false,
  hideActorRole = false,
  className,
}: Props) {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const dateLocale = isFr ? fr : enUS;

  const [filters, setFilters] = useState<TimelineFiltersState>(defaultTimelineFilters);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const { events, isLoading, error } = useCustomerTimeline(clientId, {
    limit,
    visibility,
    types: filters.type === "all" ? undefined : [filters.type],
    actorRoles: filters.actorRole === "all" ? undefined : [filters.actorRole],
    search: filters.search,
    client,
  });

  const actorRoles = useMemo(() => {
    const s = new Set<string>();
    events.forEach((e) => e.actor_role && s.add(e.actor_role));
    return Array.from(s).sort();
  }, [events]);

  // Date-range filter is client-side (view lacks native indexes on generated col).
  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filters.dateFrom && e.occurred_at < filters.dateFrom) return false;
      if (filters.dateTo && e.occurred_at > filters.dateTo + "T23:59:59") return false;
      return true;
    });
  }, [events, filters.dateFrom, filters.dateTo]);

  // Group by correlation_id (events without one are singletons).
  const groups = useMemo<EventGroup[]>(() => {
    const seen = new Set<string>();
    const out: EventGroup[] = [];
    for (const e of filtered) {
      if (e.correlation_id && seen.has(e.correlation_id)) continue;
      if (!e.correlation_id) {
        out.push({ anchor: e, siblings: [] });
        continue;
      }
      seen.add(e.correlation_id);
      const siblings = filtered.filter(
        (x) => x.correlation_id === e.correlation_id && x.event_id !== e.event_id,
      );
      out.push({ anchor: e, siblings });
    }
    return out;
  }, [filtered]);

  const toggle = (id: string, set: Set<string>, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const renderRow = (event: TimelineEvent, opts: { isSibling?: boolean } = {}) => {
    const Icon = TYPE_ICON[event.event_type] ?? Activity;
    const isOpen = expanded.has(event.event_id);
    const typeLabel = (isFr ? TYPE_LABEL_FR : TYPE_LABEL_EN)[event.event_type] ?? event.event_type;

    return (
      <li
        key={event.event_id}
        className={cn(
          "rounded-lg border transition",
          opts.isSibling
            ? "ml-6 border-border/50 bg-muted/20"
            : "border-border bg-card hover:border-border/80",
        )}
      >
        <button
          type="button"
          onClick={() => toggle(event.event_id, expanded, setExpanded)}
          className="flex w-full items-start gap-3 p-3 text-left"
        >
          <span
            className={cn(
              "mt-1.5 h-2 w-2 flex-shrink-0 rounded-full",
              SEVERITY_DOT[event.severity] ?? "bg-slate-500",
            )}
            aria-hidden="true"
          />
          <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", TYPE_BADGE[event.event_type])}>
                {typeLabel}
              </span>
              <p className="flex-1 text-sm text-foreground">{event.summary}</p>
              {event.reason && (
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                  {isFr ? "Raison" : "Reason"}: {event.reason}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
              <span title={format(new Date(event.occurred_at), "PPpp", { locale: dateLocale })}>
                {formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true, locale: dateLocale })}
              </span>
              <span>
                {event.actor_name}
                {event.actor_role && ` (${event.actor_role})`}
              </span>
              <span className="font-mono">{event.source_table}</span>
              {event.correlation_id && !opts.isSibling && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-cyan-300/70">
                  <Link2 className="h-3 w-3" />
                  {event.correlation_id.slice(0, 8)}
                </span>
              )}
            </div>
          </div>
          {isOpen ? (
            <ChevronDown className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          )}
        </button>
        {isOpen && (
          <div className="border-t border-border bg-muted/30 px-3 py-2">
            <TimelineDiff before={event.before_data} after={event.after_data} details={event.details} />
          </div>
        )}
      </li>
    );
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400", className)}>
        <AlertTriangle className="mr-2 inline h-4 w-4" />
        {isFr ? "Impossible de charger la chronologie." : "Failed to load timeline."}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {!hideFilters && (
        <TimelineFilters
          filters={filters}
          onChange={setFilters}
          actorRoles={actorRoles}
          hideActorRole={hideActorRole}
        />
      )}

      {groups.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {isFr ? "Aucun événement pour ces critères." : "No events match these filters."}
        </div>
      ) : (
        <ol className="space-y-2">
          {groups.map((g) => {
            const groupKey = g.anchor.correlation_id ?? g.anchor.event_id;
            const groupOpen = openGroups.has(groupKey);
            return (
              <li key={groupKey} className="space-y-2">
                {renderRow(g.anchor)}
                {g.siblings.length > 0 && (
                  <div className="ml-6">
                    <button
                      type="button"
                      onClick={() => toggle(groupKey, openGroups, setOpenGroups)}
                      className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                    >
                      <Layers className="h-3 w-3" />
                      {groupOpen
                        ? isFr
                          ? `Masquer ${g.siblings.length} événement(s) liés`
                          : `Hide ${g.siblings.length} related event(s)`
                        : isFr
                          ? `Voir ${g.siblings.length} événement(s) liés`
                          : `Show ${g.siblings.length} related event(s)`}
                    </button>
                    {groupOpen && (
                      <ol className="mt-2 space-y-2">
                        {g.siblings.map((s) => renderRow(s, { isSibling: true }))}
                      </ol>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default CustomerTimelineTable;
