/**
 * CustomerTimeline — Chronological event feed for the 360 view.
 *
 *   <CustomerTimeline clientId={clientId} limit={50} />
 *
 * Each event shows: a coloured dot for severity, the summary line, the
 * actor + role, and a relative timestamp. Click to expand the raw `details`
 * payload for drill-down.
 */
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import {
  CreditCard,
  DollarSign,
  Headphones,
  ShieldX,
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCustomerTimeline,
  type TimelineEvent,
  type TimelineEventType,
  type TimelineSeverity,
} from "@/hooks/useCustomerTimeline";
import { useLanguage } from "@/contexts/LanguageContext";

const TYPE_ICON: Record<TimelineEventType, React.ComponentType<{ className?: string }>> = {
  billing: CreditCard,
  payment: DollarSign,
  support: Headphones,
  cancellation: ShieldX,
  audit: Activity,
  system: Activity,
};

const SEVERITY_DOT: Record<TimelineSeverity, string> = {
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
  limit?: number;
  filterTypes?: TimelineEventType[];
  className?: string;
}

export function CustomerTimeline({ clientId, limit = 50, filterTypes, className }: Props) {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const dateLocale = isFr ? fr : enUS;
  const { events, isLoading, error } = useCustomerTimeline(clientId, {
    limit,
    types: filterTypes,
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const byDay = new Map<string, TimelineEvent[]>();
    for (const e of events) {
      const day = e.occurred_at.split("T")[0];
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(e);
    }
    return Array.from(byDay.entries());
  }, [events]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
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

  if (events.length === 0) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground", className)}>
        {isFr ? "Aucun événement enregistré pour ce client." : "No events recorded for this client."}
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {grouped.map(([day, dayEvents]) => (
        <div key={day}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {new Date(day).toLocaleDateString(isFr ? "fr-CA" : "en-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </h3>
          <ol className="space-y-2">
            {dayEvents.map((event) => {
              const Icon = TYPE_ICON[event.event_type] ?? Activity;
              const isOpen = expanded.has(event.event_id);
              const typeLabel = (isFr ? TYPE_LABEL_FR : TYPE_LABEL_EN)[event.event_type] ?? event.event_type;

              return (
                <li
                  key={event.event_id}
                  className="rounded-lg border border-border bg-card transition hover:border-border/80"
                >
                  <button
                    type="button"
                    onClick={() => toggle(event.event_id)}
                    className="flex w-full items-start gap-3 p-3 text-left"
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 flex-shrink-0 rounded-full",
                        SEVERITY_DOT[event.severity],
                      )}
                      aria-hidden="true"
                    />
                    <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            TYPE_BADGE[event.event_type],
                          )}
                        >
                          {typeLabel}
                        </span>
                        <p className="flex-1 text-sm text-foreground">{event.summary}</p>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(event.occurred_at), {
                            addSuffix: true,
                            locale: dateLocale,
                          })}
                        </span>
                        <span>
                          {event.actor_name}
                          {event.actor_role && ` (${event.actor_role})`}
                        </span>
                        <span className="font-mono">{event.source_table}</span>
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
                      <pre className="overflow-x-auto text-[11px] text-muted-foreground">
                        {JSON.stringify(event.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
