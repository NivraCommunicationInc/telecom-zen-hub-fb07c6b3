/**
 * CoreAccountSummary — Account health panel for order console header
 * Shows account number, status, active services, unpaid invoices, risk level
 */
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { Link } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import {
  Hash, ShieldCheck, ShieldAlert, ShieldX, Wifi, FileWarning,
  AlertTriangle, CheckCircle2, ExternalLink, Loader2
} from "lucide-react";

interface Props {
  account: any;
}

export function CoreAccountSummary({ account }: Props) {
  const accountId = account?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["core-account-summary", accountId],
    enabled: !!accountId,
    staleTime: 30_000,
    queryFn: async () => {
      // Fetch active subscriptions count
      const { count: activeServices } = await supabase
        .from("billing_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", accountId)
        .in("status", ["active", "trialing"]);

      // Fetch unpaid invoices
      const { data: unpaidInvoices } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, balance_due, due_date, status")
        .eq("customer_id", accountId)
        .not("status", "in", '("paid","paid_by_promo","void","cancelled")')
        .gt("balance_due", 0)
        .order("due_date", { ascending: true })
        .limit(5);

      return {
        activeServices: activeServices || 0,
        unpaidInvoices: unpaidInvoices || [],
      };
    },
  });

  if (!account) {
    return (
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-[hsl(220,10%,35%)] font-semibold mb-1">Compte</p>
        <p className="text-[11px] text-[hsl(220,10%,30%)]">Aucun compte associé</p>
      </div>
    );
  }

  const status = account.status || "active";
  const creditClass = account.credit_class || "standard";
  const unpaidCount = data?.unpaidInvoices?.length || 0;
  const totalUnpaid = data?.unpaidInvoices?.reduce((s: number, inv: any) => s + Number(inv.balance_due || 0), 0) || 0;

  // Risk level computation
  const riskLevel = computeRisk(status, creditClass, unpaidCount, totalUnpaid);

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
      <div className="px-4 py-2 border-b border-[hsl(220,15%,14%)] bg-[hsl(220,20%,10%)]">
        <div className="flex items-center justify-between">
          <p className="text-[9px] uppercase tracking-widest text-[hsl(220,10%,40%)] font-semibold">
            Sommaire du compte
          </p>
          <Link
            to={corePath(`/accounts/${account.id}`)}
            className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
          >
            Ouvrir <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-[hsl(220,10%,35%)]" />
        </div>
      ) : (
        <div className="grid grid-cols-5 divide-x divide-[hsl(220,15%,14%)]">
          {/* Account Number */}
          <MetricCell
            icon={Hash}
            label="N° Compte"
            value={account.account_number}
            mono
          />

          {/* Account Status */}
          <MetricCell
            icon={status === "active" ? CheckCircle2 : ShieldAlert}
            label="Statut"
            value={status}
            accent={status === "active" ? "text-emerald-400" : status === "suspended" ? "text-red-400" : "text-amber-400"}
          />

          {/* Active Services */}
          <MetricCell
            icon={Wifi}
            label="Services actifs"
            value={String(data?.activeServices || 0)}
            accent={data?.activeServices ? "text-emerald-400" : "text-[hsl(220,10%,45%)]"}
          />

          {/* Unpaid Invoices */}
          <MetricCell
            icon={FileWarning}
            label="Impayées"
            value={unpaidCount > 0 ? `${unpaidCount} (${totalUnpaid.toFixed(2)} $)` : "0"}
            accent={unpaidCount > 0 ? "text-red-400" : "text-emerald-400"}
          />

          {/* Risk Level */}
          <MetricCell
            icon={riskLevel.icon}
            label="Risque"
            value={riskLevel.label}
            accent={riskLevel.color}
          />
        </div>
      )}
    </div>
  );
}

function MetricCell({ icon: Icon, label, value, mono, accent }: {
  icon: any; label: string; value: string; mono?: boolean; accent?: string;
}) {
  return (
    <div className="px-3 py-2.5 text-center">
      <Icon className={`h-3.5 w-3.5 mx-auto mb-1 ${accent || "text-[hsl(220,10%,40%)]"}`} />
      <p className={`text-xs font-medium ${accent || "text-[hsl(220,10%,65%)]"} ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
      <p className="text-[9px] uppercase tracking-wider text-[hsl(220,10%,35%)] mt-0.5">{label}</p>
    </div>
  );
}

function computeRisk(status: string, creditClass: string, unpaidCount: number, totalUnpaid: number) {
  if (status === "suspended" || status === "blocked") {
    return { label: "Critique", color: "text-red-400", icon: ShieldX };
  }
  if (unpaidCount >= 3 || totalUnpaid > 200 || creditClass === "high_risk") {
    return { label: "Élevé", color: "text-red-400", icon: ShieldAlert };
  }
  if (unpaidCount >= 1 || creditClass === "watch") {
    return { label: "Modéré", color: "text-amber-400", icon: AlertTriangle };
  }
  return { label: "Faible", color: "text-emerald-400", icon: ShieldCheck };
}
