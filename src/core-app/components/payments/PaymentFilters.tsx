/**
 * Advanced payment filters — status, method, date, search
 */
import { Search, Filter, Wallet, Radio } from "lucide-react";
import { PAYMENT_STATUSES, PAYMENT_METHODS, PAYMENT_SOURCES } from "./PaymentConstants";

interface Props {
  search: string;
  onSearch: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
  method: string;
  onMethod: (v: string) => void;
  source: string;
  onSource: (v: string) => void;
  dateFrom: string;
  onDateFrom: (v: string) => void;
  dateTo: string;
  onDateTo: (v: string) => void;
  fraudOnly: boolean;
  onFraudOnly: (v: boolean) => void;
  resultCount: number;
  totalCount: number;
}

const selectCls = "appearance-none rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2 pr-8 text-xs text-[#CBD5E1] outline-none cursor-pointer";

export function PaymentFilters(props: Props) {
  const hasFilters = props.search || props.status || props.method || props.dateFrom || props.dateTo || props.fraudOnly;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="flex-1 min-w-[280px] flex items-center gap-2 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2">
          <Search className="h-4 w-4 text-[#64748B]" />
          <input
            value={props.search}
            onChange={e => props.onSearch(e.target.value)}
            placeholder="Rechercher par #paiement, client, facture, compte, référence…"
            className="flex-1 bg-transparent text-xs text-[#F8FAFC] placeholder:text-[#64748B] outline-none"
          />
        </div>

        {/* Status */}
        <div className="relative">
          <select value={props.status} onChange={e => props.onStatus(e.target.value)} className={selectCls}>
            <option value="">Tous statuts</option>
            {Object.entries(PAYMENT_STATUSES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B] pointer-events-none" />
        </div>

        {/* Method */}
        <div className="relative">
          <select value={props.method} onChange={e => props.onMethod(e.target.value)} className={selectCls}>
            <option value="">Toutes méthodes</option>
            {Object.entries(PAYMENT_METHODS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <Wallet className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B] pointer-events-none" />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <input type="date" value={props.dateFrom} onChange={e => props.onDateFrom(e.target.value)}
              className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2 text-xs text-[#CBD5E1] outline-none w-[130px]" />
          </div>
          <span className="text-[#64748B] text-xs">→</span>
          <div className="relative">
            <input type="date" value={props.dateTo} onChange={e => props.onDateTo(e.target.value)}
              className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2 text-xs text-[#CBD5E1] outline-none w-[130px]" />
          </div>
        </div>

        {/* Fraud toggle */}
        <button
          onClick={() => props.onFraudOnly(!props.fraudOnly)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
            props.fraudOnly
              ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
              : "border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] text-[#94A3B8] hover:text-[#CBD5E1]"
          }`}
        >
          🚩 Fraude
        </button>

        {hasFilters && (
          <button
            onClick={() => {
              props.onSearch("");
              props.onStatus("");
              props.onMethod("");
              props.onDateFrom("");
              props.onDateTo("");
              props.onFraudOnly(false);
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
