/**
 * FieldMyPaySection — "Ma Paie" block shown in FieldProfile.
 *
 * Reads from payroll_entries (new schema columns) for the current agent:
 *  - Last paystub with breakdown
 *  - Prochaine paie estimée (sum of approved commissions before next Thursday 18h EST minus est. deductions)
 *  - YTD summary
 *  - History of all paystubs with download
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Download, Loader2, Wallet } from "lucide-react";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
  } catch { return "—"; }
};

// Estimate deductions for "Prochaine paie" preview (≈ 28% combined Fed+QC+RRQ+AE+RQAP+disability for typical commission income)
const EST_DEDUCTION_RATE = 0.28;

function lastThursdayCutoff(now = new Date()): Date {
  const ref = new Date(now);
  for (let i = 0; i < 8; i++) {
    const d = new Date(ref);
    d.setUTCDate(ref.getUTCDate() - i);
    d.setUTCHours(23, 0, 0, 0);
    if (d.getUTCDay() === 4 && d.getTime() <= now.getTime()) return d;
  }
  return ref;
}

export default function FieldMyPaySection() {
  const { data: userId } = useQuery({
    queryKey: ["field-my-pay-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const { data: entries, isLoading } = useQuery({
    queryKey: ["field-my-pay-entries", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_entries")
        .select("id, payroll_number, total_gross, gross_pay, commission_gross, bonus_amount, federal_tax, quebec_tax, rrq, ae, rqap, disability_insurance, total_deductions, deductions_total, net_pay, payment_method, payment_status, paystub_pdf_url, pdf_url, ytd_gross, ytd_net, created_at, payment_date")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(24);
      return data ?? [];
    },
  });

  const { data: pendingCommissions } = useQuery({
    queryKey: ["field-my-pay-pending", userId],
    enabled: !!userId,
    queryFn: async () => {
      const cutoff = lastThursdayCutoff(new Date());
      const nextCutoff = new Date(cutoff);
      nextCutoff.setUTCDate(cutoff.getUTCDate() + 7);
      const { data } = await supabase
        .from("field_commissions")
        .select("amount")
        .eq("agent_id", userId!)
        .eq("status", "approved")
        .lte("earned_at", nextCutoff.toISOString());
      return (data ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0);
    },
  });

  const last = entries?.[0];
  const ytd = useMemo(() => {
    if (!entries?.length) return { gross: 0, deductions: 0, net: 0 };
    return entries.reduce((acc, e: any) => ({
      gross: acc.gross + Number(e.total_gross || e.gross_pay || 0),
      deductions: acc.deductions + Number(e.total_deductions || e.deductions_total || 0),
      net: acc.net + Number(e.net_pay || 0),
    }), { gross: 0, deductions: 0, net: 0 });
  }, [entries]);

  const estimatedNext = (pendingCommissions || 0) * (1 - EST_DEDUCTION_RATE);

  if (isLoading) {
    return (
      <section className="bg-[#1A1A2E] border border-gray-700 rounded-2xl p-5 flex items-center justify-center min-h-[120px]">
        <Loader2 className="h-5 w-5 animate-spin text-[#7C3AED]" />
      </section>
    );
  }

  return (
    <section className="bg-[#1A1A2E] border border-gray-700 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Wallet className="h-4 w-4 text-[#7C3AED]" />
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ma Paie</h2>
      </div>

      {/* Prochaine paie estimée */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] border border-[#DDD6FE] mb-4">
        <p className="text-xs text-gray-400 mb-1">Prochaine paie estimée</p>
        <p className="text-2xl font-bold text-[#7C3AED]">{fmtMoney(estimatedNext)}</p>
        <p className="text-xs text-gray-400 mt-1">
          {fmtMoney(pendingCommissions || 0)} en commissions approuvées (estimation après déductions)
        </p>
      </div>

      {/* Dernier talon */}
      {last && (
        <div className="p-4 rounded-xl bg-gray-800 border border-gray-700 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-400">Dernier talon</p>
              <p className="text-sm font-semibold text-white">{last.payroll_number || "—"}</p>
              <p className="text-xs text-gray-400">{fmtDate(last.created_at)}</p>
            </div>
            {(last.paystub_pdf_url || last.pdf_url) && (
              <a
                href={(last.paystub_pdf_url || last.pdf_url) as string}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#7C3AED] text-white text-xs font-semibold hover:bg-[#6D28D9] transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </a>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-400">Brut</div>
            <div className="text-right font-medium text-white">{fmtMoney(Number(last.total_gross || last.gross_pay || 0))}</div>
            <div className="text-gray-400">Déductions</div>
            <div className="text-right text-red-400">- {fmtMoney(Number(last.total_deductions || last.deductions_total || 0))}</div>
            <div className="text-white font-bold border-t border-gray-700 pt-2 mt-1">NET</div>
            <div className="text-right text-emerald-400 font-bold border-t border-gray-700 pt-2 mt-1">{fmtMoney(Number(last.net_pay || 0))}</div>
          </div>
        </div>
      )}

      {/* YTD */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-3 rounded-lg bg-gray-800 border border-gray-700">
          <p className="text-[10px] text-gray-400 uppercase">Brut YTD</p>
          <p className="text-sm font-bold text-white">{fmtMoney(ytd.gross)}</p>
        </div>
        <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA]">
          <p className="text-[10px] text-gray-400 uppercase">Déductions</p>
          <p className="text-sm font-bold text-red-400">{fmtMoney(ytd.deductions)}</p>
        </div>
        <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
          <p className="text-[10px] text-gray-400 uppercase">Net YTD</p>
          <p className="text-sm font-bold text-emerald-400">{fmtMoney(ytd.net)}</p>
        </div>
      </div>

      {/* Historique */}
      {entries && entries.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-[#7C3AED] font-medium py-2">
            Historique ({entries.length} talons)
          </summary>
          <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
            {entries.slice(1).map((e: any) => (
              <div key={e.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-800 border border-gray-700">
                <div>
                  <p className="text-xs font-medium text-white">{e.payroll_number || fmtDate(e.created_at)}</p>
                  <p className="text-[10px] text-gray-400">{fmtDate(e.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-emerald-400">{fmtMoney(Number(e.net_pay || 0))}</span>
                  {(e.paystub_pdf_url || e.pdf_url) && (
                    <a
                      href={(e.paystub_pdf_url || e.pdf_url) as string}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded text-[#7C3AED] hover:bg-[#EDE9FE]"
                      title="Télécharger"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {!entries?.length && (
        <p className="text-sm text-gray-400 text-center py-4">Aucun talon de paie pour le moment.</p>
      )}
    </section>
  );
}
