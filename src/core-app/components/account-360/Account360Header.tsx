/**
 * Account360Header — Identity summary banner for the Customer 360 workspace.
 * Shows full customer identity, account status, KYC, contact, billing cycle info.
 */
import { Link } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import {
  User, Hash, Mail, Phone, MapPin, Calendar, Shield, ArrowLeft,
  RefreshCw, AlertTriangle, Clock,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};
const fmtCAD = (n: number | null | undefined) => (n != null ? `${n.toFixed(2)} $` : "—");

const STATUS_LABELS: Record<string, string> = {
  active: "Actif", pending: "En attente", suspended: "Suspendu", cancelled: "Annulé",
  closed: "Fermé", approved: "Approuvé", rejected: "Rejeté", pending_review: "En révision",
  submitted: "Soumis", manual_review: "Révision manuelle",
};
const label = (s: string | null | undefined) => STATUS_LABELS[s || ""] || s || "—";

interface Props {
  account: any;
  profile: any;
  clientName: string;
  latestKyc: any;
  totalDue: number;
  monthlyRevenue: number;
  unpaidCount: number;
  subscriptions?: any[];
  onRefresh: () => void;
}

export function Account360Header({ account, profile, clientName, latestKyc, totalDue, monthlyRevenue, unpaidCount, subscriptions = [], onRefresh }: Props) {
  const acct = account;
  // Fallback: derive cycle day from active subscription anchor when account column is empty.
  let effectiveCycleDay: number | null = acct?.billing_cycle_day ?? null;
  if (effectiveCycleDay == null) {
    const sub = subscriptions.find((s: any) => s?.status === "active" && (s?.billing_cycle_anchor || s?.cycle_start_date))
      || subscriptions.find((s: any) => s?.billing_cycle_anchor || s?.cycle_start_date);
    const anchor = sub?.billing_cycle_anchor || sub?.cycle_start_date;
    if (anchor) {
      const d = new Date(anchor).getUTCDate();
      if (Number.isFinite(d) && d > 0) effectiveCycleDay = d;
    }
  }
  const cycleLabel = effectiveCycleDay ? `Cycle: jour ${effectiveCycleDay}` : "Cycle à régénérer";
  const hasRisk = totalDue > 0 || acct.status === "suspended";

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link to={corePath("/accounts")} className="flex items-center gap-1 text-[11px] text-core-text-label hover:text-core-text-primary transition-colors">
          <ArrowLeft className="h-3 w-3" /> Comptes
        </Link>
        <button onClick={onRefresh} className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-1.5 text-[11px] font-medium text-core-text-label hover:text-core-text-primary hover:border-emerald-500/30 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </button>
      </div>

      {/* Risk alert strip */}
      {hasRisk && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-red-400">
              {acct.status === "suspended" ? "Compte suspendu" : ""}
              {acct.status === "suspended" && totalDue > 0 ? " · " : ""}
              {totalDue > 0 ? `Solde impayé : ${fmtCAD(totalDue)} (${unpaidCount} facture${unpaidCount > 1 ? "s" : ""})` : ""}
            </p>
          </div>
        </div>
      )}

      {/* Identity banner */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)]">
        <div className="px-4 py-3">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="h-11 w-11 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <User className="h-5 w-5 text-emerald-400" />
            </div>

            {/* Identity grid */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-core-text-primary tracking-tight">{clientName}</h1>
                <StatusBadge label={label(acct.status)} variant={statusToVariant(acct.status || "active")} size="sm" />
                {latestKyc && (
                  <span className="flex items-center gap-1 text-[10px]">
                    <Shield className="h-3 w-3" />
                    <StatusBadge label={label(latestKyc.status)} variant={statusToVariant(latestKyc.status || "")} size="sm" />
                  </span>
                )}
                {!latestKyc && (
                  <span className="text-[10px] text-core-text-disabled flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Non vérifié
                  </span>
                )}
              </div>

              {/* Contact row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[11px] text-core-text-secondary">
                <span className="flex items-center gap-1 font-mono text-core-text-primary">
                  <Hash className="h-3 w-3 text-core-text-label" />{acct.account_number}
                </span>
                {profile?.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3 text-core-text-label" />{profile.email}
                  </span>
                )}
                {profile?.phone && (
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="h-3 w-3 text-core-text-label" />{profile.phone}
                  </span>
                )}
                {acct.primary_service_address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-core-text-label" />
                    {[acct.primary_service_address, acct.primary_service_city].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>

              {/* Bottom metadata row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[10px] text-core-text-label">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Créé le {fmtDate(acct.created_at)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {cycleLabel}
                </span>
                <span>Classe: {acct.credit_class || "C"}</span>
                {acct.recouvrement_reminder_sent_at && (
                  <span className="text-amber-400 font-medium">⚠ Rappel recouvrement envoyé</span>
                )}
              </div>
            </div>

            {/* Right-side financial summary */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider text-core-text-label font-medium">Rev. mensuel</p>
                <p className="text-sm font-bold tabular-nums text-emerald-400">{fmtCAD(monthlyRevenue)}</p>
              </div>
              <div className="w-px h-8 bg-[hsl(220,15%,16%)]" />
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider text-core-text-label font-medium">Solde dû</p>
                <p className={`text-sm font-bold tabular-nums ${totalDue > 0 ? "text-red-400" : "text-emerald-400"}`}>{fmtCAD(totalDue)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
