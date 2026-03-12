/**
 * Professional subscriptions table
 */
import { Link, useNavigate } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { SUB_STATUSES, SUB_CATEGORIES, fmtCAD } from "./SubscriptionConstants";
import { TestBadge } from "@/core-app/components/CoreEnvironmentToggle";
import { ArrowRight, Repeat, Zap } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { AdminSubscription } from "@/core-app/hooks/useAdminSubscriptions";

interface Props {
  subs: AdminSubscription[];
  isLoading: boolean;
  onSelect: (sub: AdminSubscription) => void;
}

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};

const COLS = ["Compte", "Client", "Service", "Catégorie", "Prix/mois", "Statut", "Activation", "Renouvellement", "Auto-billing", "Commande", ""];

export function SubscriptionTable({ subs, isLoading, onSelect }: Props) {
  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[hsl(220,15%,16%)]">
              {COLS.map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-[hsl(220,15%,14%)]">
                  {Array.from({ length: COLS.length }).map((_, j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="h-3.5 w-16 rounded bg-[hsl(220,15%,14%)] animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : subs.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="text-center py-16 text-[#64748B]">
                  <Repeat className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Aucun abonnement trouvé</p>
                </td>
              </tr>
            ) : (
              subs.map(s => {
                const statusLabel = SUB_STATUSES[s.status ?? ""] || s.status || "—";
                const catLabel = SUB_CATEGORIES[s.service_category ?? ""] || s.service_category || "—";

                return (
                  <tr
                    key={s.id}
                    onClick={() => onSelect(s)}
                    className="border-b border-[hsl(220,15%,14%)] last:border-0 cursor-pointer hover:bg-[hsl(220,20%,13%)] transition-colors"
                  >
                    {/* Account */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[#CBD5E1]">{s.account_number || "—"}</span>
                        {s.environment === 'test' && <TestBadge />}
                      </div>
                    </td>

                    {/* Client */}
                    <td className="px-3 py-2.5">
                      <div className="max-w-[160px]">
                        <p className="text-[#F8FAFC] truncate font-medium">{s.client_name || "—"}</p>
                        <p className="text-[#64748B] text-[11px] truncate">{s.client_email || ""}</p>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="px-3 py-2.5">
                      <p className="text-[#F8FAFC] font-medium truncate max-w-[180px]">{s.plan_name}</p>
                      <p className="text-[#64748B] text-[11px] font-mono">{s.plan_code}</p>
                    </td>

                    {/* Category */}
                    <td className="px-3 py-2.5">
                      <span className="text-[#CBD5E1]">{catLabel}</span>
                    </td>

                    {/* Price */}
                    <td className="px-3 py-2.5">
                      <span className="tabular-nums text-emerald-400 font-semibold">{fmtCAD(s.plan_price)}</span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5">
                      <StatusBadge label={statusLabel} variant={statusToVariant(s.status ?? "")} size="sm" />
                    </td>

                    {/* Activation */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-[#CBD5E1]">{fmtDate(s.cycle_start_date)}</span>
                    </td>

                    {/* Renewal */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-[#CBD5E1]">{fmtDate(s.cycle_end_date)}</span>
                    </td>

                    {/* Auto-billing */}
                    <td className="px-3 py-2.5">
                      {s.auto_billing_enabled ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]"><Zap className="h-3 w-3" /> Oui</span>
                      ) : (
                        <span className="text-[#64748B] text-[11px]">Non</span>
                      )}
                    </td>

                    {/* Order */}
                    <td className="px-3 py-2.5">
                      {s.order_id ? (
                        <Link
                          to={corePath(`/orders/${s.order_id}`)}
                          onClick={e => e.stopPropagation()}
                          className="font-mono text-[11px] text-[#38BDF8] hover:underline"
                        >
                          Voir
                        </Link>
                      ) : (
                        <span className="text-[#64748B]">—</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-3 py-2.5">
                      <button
                        onClick={e => { e.stopPropagation(); onSelect(s); }}
                        className="h-7 w-7 flex items-center justify-center rounded-md border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-emerald-500/40 transition-colors"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
