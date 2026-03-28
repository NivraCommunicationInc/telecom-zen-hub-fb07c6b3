/**
 * FilterBar — Reusable advanced filter bar for HR module tabs.
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";

export interface FilterConfig {
  statusOptions?: { value: string; label: string }[];
  agentOptions?: { value: string; label: string }[];
  showDateRange?: boolean;
  showSearch?: boolean;
  onExport?: () => void;
}

interface FilterState {
  status: string;
  agentId: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  config: FilterConfig;
}

export const defaultFilters: FilterState = { status: "all", agentId: "all", dateFrom: "", dateTo: "", search: "" };

export default function FilterBar({ filters, onChange, config }: FilterBarProps) {
  const hasActive = filters.status !== "all" || filters.agentId !== "all" || filters.dateFrom || filters.dateTo || filters.search;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {config.showSearch && (
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Rechercher…"
          className="w-48 h-8 text-xs"
        />
      )}
      {config.statusOptions && (
        <Select value={filters.status} onValueChange={(v) => onChange({ ...filters, status: v })}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {config.statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {config.agentOptions && (
        <Select value={filters.agentId} onValueChange={(v) => onChange({ ...filters, agentId: v })}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Agent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les agents</SelectItem>
            {config.agentOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {config.showDateRange && (
        <>
          <Input type="date" value={filters.dateFrom} onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })} className="w-36 h-8 text-xs" />
          <Input type="date" value={filters.dateTo} onChange={(e) => onChange({ ...filters, dateTo: e.target.value })} className="w-36 h-8 text-xs" />
        </>
      )}
      {hasActive && (
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onChange(defaultFilters)}>
          <X className="h-3 w-3 mr-1" /> Réinitialiser
        </Button>
      )}
      {config.onExport && (
        <Button size="sm" variant="outline" className="h-8 text-xs ml-auto" onClick={config.onExport}>
          <Download className="h-3 w-3 mr-1" /> Export CSV
        </Button>
      )}
    </div>
  );
}

export function applyFilters<T extends Record<string, any>>(
  data: T[],
  filters: FilterState,
  opts: { statusKey?: string; agentKey?: string; dateKey?: string; searchKeys?: string[] }
): T[] {
  let result = data;
  if (filters.status !== "all" && opts.statusKey) {
    result = result.filter((d) => d[opts.statusKey!] === filters.status);
  }
  if (filters.agentId !== "all" && opts.agentKey) {
    result = result.filter((d) => d[opts.agentKey!] === filters.agentId);
  }
  if (filters.dateFrom && opts.dateKey) {
    result = result.filter((d) => d[opts.dateKey!] >= filters.dateFrom);
  }
  if (filters.dateTo && opts.dateKey) {
    result = result.filter((d) => d[opts.dateKey!] <= filters.dateTo + "T23:59:59");
  }
  if (filters.search && opts.searchKeys?.length) {
    const q = filters.search.toLowerCase();
    result = result.filter((d) => opts.searchKeys!.some((k) => String(d[k] || "").toLowerCase().includes(q)));
  }
  return result;
}
