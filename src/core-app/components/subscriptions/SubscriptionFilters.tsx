/**
 * Advanced subscription filters
 */
import { Search, Filter, Layers } from "lucide-react";
import { SUB_STATUSES, SUB_CATEGORIES } from "./SubscriptionConstants";

interface Props {
  search: string;
  onSearch: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
  category: string;
  onCategory: (v: string) => void;
  dateFrom: string;
  onDateFrom: (v: string) => void;
  dateTo: string;
  onDateTo: (v: string) => void;
  renewalFrom: string;
  onRenewalFrom: (v: string) => void;
  renewalTo: string;
  onRenewalTo: (v: string) => void;
  resultCount: number;
  totalCount: number;
}

const selectCls = "appearance-none rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2 pr-8 text-xs text-[#CBD5E1] outline-none cursor-pointer";
const dateCls = "rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2 text-xs text-[#CBD5E1] outline-none w-[130px]";

export function SubscriptionFilters(props: Props) {
  const hasFilters = props.search || props.status || props.category || props.dateFrom || props.dateTo || props.renewalFrom || props.renewalTo;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="flex-1 min-w-[280px] flex items-center gap-2 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2">
          <Search className="h-4 w-4 text-[#64748B]" />
          <input
            value={props.search}
            onChange={e => props.onSearch(e.target.value)}
            placeholder="Rechercher par plan, client, compte, catégorie…"
            className="flex-1 bg-transparent text-xs text-[#F8FAFC] placeholder:text-[#64748B] outline-none"
          />
        </div>

        {/* Status */}
        <div className="relative">
          <select value={props.status} onChange={e => props.onStatus(e.target.value)} className={selectCls}>
            <option value="">Tous statuts</option>
            {Object.entries(SUB_STATUSES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B] pointer-events-none" />
        </div>

        {/* Category */}
        <div className="relative">
          <select value={props.category} onChange={e => props.onCategory(e.target.value)} className={selectCls}>
            <option value="">Toutes catégories</option>
            {Object.entries(SUB_CATEGORIES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <Layers className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B] pointer-events-none" />
        </div>

        {/* Activation date range */}
        <div className="flex items-center gap-1.5">
          <input type="date" value={props.dateFrom} onChange={e => props.onDateFrom(e.target.value)} className={dateCls} title="Activation depuis" />
          <span className="text-[#64748B] text-xs">→</span>
          <input type="date" value={props.dateTo} onChange={e => props.onDateTo(e.target.value)} className={dateCls} title="Activation jusqu'à" />
        </div>

        {/* Renewal date range */}
        <div className="flex items-center gap-1.5">
          <input type="date" value={props.renewalFrom} onChange={e => props.onRenewalFrom(e.target.value)} className={dateCls} title="Renouvellement depuis" />
          <span className="text-[#64748B] text-xs">→</span>
          <input type="date" value={props.renewalTo} onChange={e => props.onRenewalTo(e.target.value)} className={dateCls} title="Renouvellement jusqu'à" />
        </div>

        {hasFilters && (
          <button
            onClick={() => {
              props.onSearch(""); props.onStatus(""); props.onCategory("");
              props.onDateFrom(""); props.onDateTo("");
              props.onRenewalFrom(""); props.onRenewalTo("");
            }}
            className="text-[10px] text-[#94A3B8] hover:text-[#F8FAFC] underline transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {hasFilters && (
        <p className="text-[11px] text-[#94A3B8]">
          {props.resultCount} résultat{props.resultCount !== 1 ? "s" : ""} sur {props.totalCount}
        </p>
      )}
    </div>
  );
}
