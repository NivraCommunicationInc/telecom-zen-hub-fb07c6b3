/**
 * TimelineFilters — Reusable filter bar for CustomerTimelineTable.
 * Filters are held by the parent and passed back on change.
 */
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TimelineEventType } from "@/hooks/useCustomerTimeline";

export interface TimelineFiltersState {
  search: string;
  type: TimelineEventType | "all";
  actorRole: string;
  dateFrom: string;
  dateTo: string;
}

export const defaultTimelineFilters: TimelineFiltersState = {
  search: "",
  type: "all",
  actorRole: "all",
  dateFrom: "",
  dateTo: "",
};

interface Props {
  filters: TimelineFiltersState;
  onChange: (f: TimelineFiltersState) => void;
  actorRoles?: string[];
  hideActorRole?: boolean;
}

const TYPE_LABELS_FR: Record<TimelineEventType | "all", string> = {
  all: "Tous les types",
  billing: "Facturation",
  payment: "Paiement",
  support: "Support",
  cancellation: "Annulation",
  audit: "Audit",
  system: "Système",
};
const TYPE_LABELS_EN: Record<TimelineEventType | "all", string> = {
  all: "All types",
  billing: "Billing",
  payment: "Payment",
  support: "Support",
  cancellation: "Cancellation",
  audit: "Audit",
  system: "System",
};

export function TimelineFilters({ filters, onChange, actorRoles = [], hideActorRole }: Props) {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const labels = isFr ? TYPE_LABELS_FR : TYPE_LABELS_EN;
  const hasActive =
    filters.search || filters.type !== "all" || filters.actorRole !== "all" || filters.dateFrom || filters.dateTo;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder={isFr ? "Rechercher…" : "Search…"}
          className="h-8 w-56 pl-7 text-xs"
        />
      </div>

      <Select value={filters.type} onValueChange={(v) => onChange({ ...filters, type: v as any })}>
        <SelectTrigger className="h-8 w-40 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(labels) as (TimelineEventType | "all")[]).map((k) => (
            <SelectItem key={k} value={k}>
              {labels[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!hideActorRole && actorRoles.length > 0 && (
        <Select value={filters.actorRole} onValueChange={(v) => onChange({ ...filters, actorRole: v })}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder={isFr ? "Auteur" : "Actor"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isFr ? "Tous les auteurs" : "All actors"}</SelectItem>
            {actorRoles.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Input
        type="date"
        value={filters.dateFrom}
        onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
        className="h-8 w-36 text-xs"
      />
      <Input
        type="date"
        value={filters.dateTo}
        onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
        className="h-8 w-36 text-xs"
      />

      {hasActive && (
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onChange(defaultTimelineFilters)}>
          <X className="mr-1 h-3 w-3" />
          {isFr ? "Réinitialiser" : "Reset"}
        </Button>
      )}
    </div>
  );
}

export default TimelineFilters;
