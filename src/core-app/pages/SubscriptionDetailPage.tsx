/**
 * Nivra Core — Subscription Detail (ops-grade)
 * Reuses useAdminSubscriptionDetail — zero duplicated business logic.
 */
import { useParams, Link } from "react-router-dom";
import { useAdminSubscriptionDetail } from "@/core-app/hooks/useAdminSubscriptionDetail";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { corePath } from "@/core-app/lib/corePaths";
import {
  ArrowLeft, User, MapPin, Package, FileText, History,
  Zap, ExternalLink, ToggleRight, Calendar, CreditCard,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const fmtCAD = (n: number | null | undefined) =>
  n != null ? `${n.toFixed(2)} $` : "—";
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};
const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy HH:mm", { locale: fr }); } catch { return "—"; }
};

export default function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { subscription, customer, address, invoices, audit, accountNumber, isLoading } =
    useAdminSubscriptionDetail(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 rounded bg-[hsl(220,15%,14%)] animate-pulse" />
        <div className="h-40 w-full rounded-lg bg-[hsl(220,15%,14%)] animate-pulse" />
        <div className="h-40 w-full rounded-lg bg-[hsl(220,15%,14%)] animate-pulse" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="text-center py-20">
        <p className="text-[hsl(220,10%,40%)] text-sm">Abonnement introuvable</p>
        <Link to={corePath("/subscriptions")} className="text-emerald-400 text-xs hover:underline mt-2 inline-block">
          ← Retour aux abonnements
        </Link>
      </div>
    );
  }

  const services = subscription.billing_subscription_services || [];
  const clientName = customer ? `${customer.first_name} ${customer.last_name}` : "—";

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/core/subscriptions"
          className="flex items-center gap-1 text-[hsl(220,10%,45%)] hover:text-white text-xs transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Abonnements
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">{subscription.plan_name}</h1>
          <p className="text-[12px] text-[hsl(220,10%,45%)] font-mono mt-0.5">{subscription.plan_code}</p>
        </div>
        <StatusBadge
          label={subscription.status || "—"}
          variant={statusToVariant(subscription.status || "")}
          size="md"
        />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Prix mensuel" value={fmtCAD(subscription.plan_price)} accent />
        <KPI label="Début cycle" value={fmtDate(subscription.cycle_start_date)} />
        <KPI label="Fin cycle" value={fmtDate(subscription.cycle_end_date)} />
        <KPI
          label="Auto-facturation"
          value={subscription.auto_billing_enabled ? "Activée" : "Désactivée"}
          icon={subscription.auto_billing_enabled ? <Zap className="h-3.5 w-3.5 text-emerald-400" /> : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Client */}
        <Section title="Client" icon={User}>
          <Row label="Nom" value={clientName} />
          <Row label="Email" value={customer?.email || "—"} />
          <Row label="Téléphone" value={customer?.phone || "—"} />
          {accountNumber && <Row label="N° compte" value={accountNumber} mono />}
        </Section>

        {/* Address */}
        <Section title="Adresse de service" icon={MapPin}>
          {address ? (
            <>
              <Row label="Adresse" value={address.address_line1 || "—"} />
              {address.address_line2 && <Row label="" value={address.address_line2} />}
              <Row label="Ville" value={address.city || "—"} />
              <Row label="Province" value={address.province || "QC"} />
              <Row label="Code postal" value={address.postal_code || "—"} />
            </>
          ) : (
            <p className="text-[hsl(220,10%,35%)] text-xs">Aucune adresse liée</p>
          )}
        </Section>
      </div>

      {/* Services inclus */}
      <Section title="Services inclus" icon={Package} noPad>
        {services.length === 0 ? (
          <p className="text-[hsl(220,10%,35%)] text-xs text-center py-6">Aucun service inclus</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[hsl(220,15%,16%)]">
                  {["Service", "Code", "Type", "Prix unitaire", "Qté", "Actif"].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] ${i === 3 ? "text-right" : i === 4 ? "text-center" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {services.map((svc: any) => (
                  <tr key={svc.id} className="border-b border-[hsl(220,15%,14%)] last:border-0">
                    <td className="px-4 py-2.5 text-white font-medium">{svc.service_name}</td>
                    <td className="px-4 py-2.5 font-mono text-[hsl(220,10%,50%)]">{svc.service_code}</td>
                    <td className="px-4 py-2.5 text-[hsl(220,10%,55%)]">{svc.service_type || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400">{fmtCAD(svc.unit_price)}</td>
                    <td className="px-4 py-2.5 text-center text-white">{svc.quantity}</td>
                    <td className="px-4 py-2.5">
                      {svc.is_active ? (
                        <ToggleRight className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <span className="text-[hsl(220,10%,35%)]">Inactif</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Source order */}
      {subscription.order_id && (
        <Section title="Commande source" icon={CreditCard}>
          <Link
            to={`/core/orders/${subscription.order_id}`}
            className="text-xs text-emerald-400 hover:underline flex items-center gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Voir la commande
          </Link>
        </Section>
      )}

      {/* Invoices */}
      <Section title="Historique des factures" icon={FileText} noPad>
        {invoices.length === 0 ? (
          <p className="text-[hsl(220,10%,35%)] text-xs text-center py-6">Aucune facture</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[hsl(220,15%,16%)]">
                  {["N° facture", "Statut", "Type", "Total", "Solde dû", "Date"].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] ${i === 3 || i === 4 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)] transition-colors">
                    <td className="px-4 py-2.5">
                      <Link to={`/core/invoices/${inv.id}`} className="font-mono text-emerald-400 hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge label={inv.status || "—"} variant={statusToVariant(inv.status || "")} size="sm" />
                    </td>
                    <td className="px-4 py-2.5 text-[hsl(220,10%,55%)]">{inv.type || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-white">{fmtCAD(inv.total)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {inv.balance_due > 0 ? (
                        <span className="text-red-400 font-medium">{fmtCAD(inv.balance_due)}</span>
                      ) : (
                        <span className="text-[hsl(220,10%,35%)]">0,00 $</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[hsl(220,10%,45%)] whitespace-nowrap">{fmtDate(inv.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Audit trail */}
      <Section title="Journal d'audit" icon={History} noPad>
        {audit.length === 0 ? (
          <p className="text-[hsl(220,10%,35%)] text-xs text-center py-6">Aucun événement</p>
        ) : (
          <div className="divide-y divide-[hsl(220,15%,14%)]">
            {audit.map((entry: any) => (
              <div key={entry.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">{entry.action}</span>
                  <span className="text-[10px] text-[hsl(220,10%,40%)]">{fmtDateTime(entry.created_at)}</span>
                </div>
                {entry.reason && <p className="text-[11px] text-[hsl(220,10%,45%)] mt-0.5">{entry.reason}</p>}
                {entry.details && typeof entry.details === "object" && (
                  <pre className="text-[10px] text-[hsl(220,10%,40%)] mt-1 bg-[hsl(220,20%,8%)] rounded p-2 overflow-x-auto">
                    {JSON.stringify(entry.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ── Reusable sub-components ── */

function KPI({ label, value, accent, icon }: { label: string; value: string; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,40%)] font-medium">{label}</p>
      <div className="flex items-center gap-1.5 mt-1">
        {icon}
        <p className={`text-lg font-bold tabular-nums ${accent ? "text-emerald-400" : "text-white"}`}>{value}</p>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, noPad }: { title: string; icon: any; children: React.ReactNode; noPad?: boolean }) {
  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[hsl(220,15%,16%)]">
        <Icon className="h-4 w-4 text-[hsl(220,10%,45%)]" />
        <h2 className="text-xs font-semibold text-white uppercase tracking-wider">{title}</h2>
      </div>
      <div className={noPad ? "" : "px-4 py-3 space-y-2"}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      {label && <span className="text-[hsl(220,10%,45%)] shrink-0">{label}</span>}
      <span className={`text-white ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
