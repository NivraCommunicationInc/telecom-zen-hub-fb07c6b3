/**
 * Advanced invoice filters
 */
import { Search, Filter, Calendar, FileText } from "lucide-react";
import { INVOICE_STATUSES, INVOICE_TYPES } from "./InvoiceConstants";

interface Props {
  search: string;
  onSearch: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
  type: string;
  onType: (v: string) => void;
  dateFrom: string;
  onDateFrom: (v: string) => void;
  dateTo: string;
  onDateTo: (v: string) => void;
  dueFrom: string;
  onDueFrom: (v: string) => void;
  dueTo: string;
  onDueTo: (v: string) => void;
  unpaidOnly: boolean;
  onUnpaidOnly: (v: boolean) => void;
  disputedOnly: boolean;
  onDisputedOnly: (v: boolean) => void;
  resultCount: number;
  totalCount: number;
}

const selectCls = "appearance-none rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2 pr-8 text-xs text-[#CBD5E1] outline-none cursor-pointer";
const dateCls = "rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2 text-xs text-[#CBD5E1] outline-none w-[130px]";

export function InvoiceFilters(props: Props) {
  const hasFilters = props.search || props.status || props.type || props.dateFrom || props.dateTo || props.dueFrom || props.dueTo || props.unpaidOnly || props.disputedOnly;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="flex-1 min-w-[280px] flex items-center gap-2 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2">
          <Search className="h-4 w-4 text-[#64748B]" />
          <input
            value={props.search}
            onChange={e => props.onSearch(e.target.value)}
            placeholder="Rechercher par #facture, client, compte, commande…"
            className="flex-1 bg-transparent text-xs text-[#F8FAFC] placeholder:text-[#64748B] outline-none"
          />
        </div>

        {/* Status */}
        <div className="relative">
          <select value={props.status} onChange={e => props.onStatus(e.target.value)} className={selectCls}>
            <option value="">Tous statuts</option>
            {Object.entries(INVOICE_STATUSES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B] pointer-events-none" />
        </div>

        {/* Type */}
        <div className="relative">
          <select value={props.type} onChange={e => props.onType(e.target.value)} className={selectCls}>
            <option value="">Tous types</option>
            {Object.entries(INVOICE_TYPES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <FileText className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B] pointer-events-none" />
        </div>

        {/* Issue date range */}
        <div className="flex items-center gap-1.5">
          <input type="date" value={props.dateFrom} onChange={e => props.onDateFrom(e.target.value)} className={dateCls} title="Date début" />
          <span className="text-[#64748B] text-xs">→</span>
          <input type="date" value={props.dateTo} onChange={e => props.onDateTo(e.target.value)} className={dateCls} title="Date fin" />
        </div>

        {/* Quick toggles */}
        <button
          onClick={() => props.onUnpaidOnly(!props.unpaidOnly)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
            props.unpaidOnly
              ? "border-red-500/40 bg-red-500/10 text-red-400"
              : "border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] text-[#94A3B8] hover:text-[#CBD5E1]"
          }`}
        >
          💰 Impayées
        </button>

        <button
          onClick={() => props.onDisputedOnly(!props.disputedOnly)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
            props.disputedOnly
              ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
              : "border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] text-[#94A3B8] hover:text-[#CBD5E1]"
          }`}
        >
          ⚠️ Litiges
        </button>

        {hasFilters && (
          <button
            onClick={() => {
              props.onSearch(""); props.onStatus(""); props.onType("");
              props.onDateFrom(""); props.onDateTo("");
              props.onDueFrom(""); props.onDueTo("");
              props.onUnpaidOnly(false); props.onDisputedOnly(false);
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
