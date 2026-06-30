/**
 * Account360Sections — All section content components for the Customer 360 workspace.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import {
  Panel, PanelHeader, InfoLine, MiniTable, trClass, fmtCAD, fmtDate, fmtDateTime, label, resolveAccountCycle,
} from "./Account360Helpers";
import {
  Repeat, ShoppingCart, FileText, CreditCard, Package, MessageSquare,
  Calendar, Shield, Activity, AlertTriangle, ExternalLink, Zap, User,
  MapPin, Globe, Hash, Clock, CheckCircle2, Wallet, TrendingUp, TrendingDown,
} from "lucide-react";
import { InvoiceActionMenu } from "@/core-app/components/account-actions/InvoiceActions";
import { SubscriptionActionMenu } from "@/core-app/components/account-actions/SubscriptionActions";
import { EquipmentActionMenu } from "@/core-app/components/account-actions/EquipmentActions";
import { AccountActionMenu } from "@/core-app/components/account-actions/AccountQuickActions";
import { OrderActionMenu } from "@/core-app/components/account-actions/OrderActions";
import { CoreSquarePaymentDialog } from "@/core-app/components/account-360/CoreSquarePaymentDialog";
import { FinancialDocumentsPanel } from "@/components/admin/FinancialDocumentsPanel";
import { AdminDocumentsPanel } from "@/components/admin/AdminDocumentsPanel";
import { EquipmentDetailDialog, KycDetailDialog } from "./Account360DetailDialogs";
import { InvoiceDetailDialog, PaymentDetailDialog, ContractDetailDialog } from "./Account360RowDialogs";

/* ── Profile ── */
export const ProfileSection = ({ data, acct, prof, clientName, isAdminCore }: any) => (
  <div className="space-y-3">
    <Panel>
      <PanelHeader icon={User} title="Informations personnelles" />
      <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
        <InfoLine label="Nom complet" value={clientName} />
        <InfoLine label="Prénom" value={prof?.first_name || "—"} />
        <InfoLine label="Nom" value={prof?.last_name || "—"} />
        <InfoLine label="Courriel" value={prof?.email || "—"} />
        <InfoLine label="Téléphone" value={prof?.phone || "—"} mono />
        <div className="flex items-start justify-between py-1.5 border-b border-[hsl(220,15%,14%)] last:border-0">
          <span className="text-[11px] text-[hsl(220,10%,45%)]">Date de naissance</span>
          <span className="text-[11px] text-white text-right flex items-center gap-1.5">
            {prof?.date_of_birth ? fmtDate(prof.date_of_birth) : "Non renseignée"}
            {prof?.dob_locked && !isAdminCore && (
              <span title="Champ verrouillé — modification réservée à admin_core" className="cursor-help">🔒</span>
            )}
          </span>
        </div>
        <InfoLine label="Langue" value={prof?.preferred_language || "fr"} />
        <InfoLine label="Identité vérifiée" value={prof?.identity_verified ? "✓ Oui" : "✗ Non"} accent={!!prof?.identity_verified} />
      </div>
    </Panel>
    <Panel>
      <PanelHeader icon={MapPin} title="Adresses" />
      <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
        <InfoLine label="Adresse de service" value={[acct.primary_service_address, acct.primary_service_city, acct.primary_service_postal_code].filter(Boolean).join(", ") || "—"} />
        <InfoLine label="Province" value={acct.primary_service_province || "QC"} />
        <InfoLine label="Adresse facturation" value={[acct.billing_address, acct.billing_city, acct.billing_postal_code].filter(Boolean).join(", ") || "—"} />
      </div>
    </Panel>
    {data.authorizedUsers.length > 0 && (
      <Panel>
        <PanelHeader icon={User} title="Utilisateurs autorisés" count={data.authorizedUsers.length} />
        <MiniTable headers={["Nom", "Courriel", "Relation", "Niveau", "Ajouté le"]}>
          {data.authorizedUsers.map((u: any) => (
            <tr key={u.id} className={trClass}>
              <td className="px-3 py-1.5 text-core-text-primary text-[11px] font-medium">{u.full_name}</td>
              <td className="px-3 py-1.5 text-core-text-secondary text-[11px]">{u.email || "—"}</td>
              <td className="px-3 py-1.5 text-core-text-secondary text-[11px]">{u.relationship_label || "—"}</td>
              <td className="px-3 py-1.5 text-core-text-label text-[11px]">{u.permission_level}</td>
              <td className="px-3 py-1.5 text-core-text-label text-[11px]">{fmtDate(u.created_at)}</td>
            </tr>
          ))}
        </MiniTable>
      </Panel>
    )}
  </div>
);

/* ── Credit Score helpers ── */
const CREDIT_FACTOR_LABELS: Record<string, string> = {
  anciennete_2ans:               "Ancienneté 2+ ans",
  anciennete_1an:                "Ancienneté 1+ an",
  anciennete_6mois:              "Ancienneté 6+ mois",
  paiements_ponctuels:           "Factures payées",
  comptes_bon_standing:          "Compte en bon standing",
  factures_overdue:              "Factures impayées actuelles",
  factures_serieusement_overdue: "Factures > 90 jours",
  factures_non_payees:           "Créances irrécouvrables",
  comptes_annules:               "Compte annulé précédent",
  chargebacks:                   "Rétrofacturations",
};

/* ── Billing / Account ── */
export const BillingSection = ({ acct, data, totalDue, monthlyRevenue, unpaidInvoices, totalPaid }: any) => {
  const paypalSub = (data.subscriptions || []).find(
    (s: any) => s.paypal_subscription_id && s.status === "active"
  );
  const isPreAuth = !!paypalSub;
  const [chargeOpen, setChargeOpen] = useState(false);
  const cycle = resolveAccountCycle(acct, data.subscriptions || []);
  const cycleDayLabel = cycle.cycleDay ? `Le ${cycle.cycleDay} de chaque mois` : "À régénérer";
  const nextInvoiceLabel = cycle.nextInvoiceDate ? fmtDate(cycle.nextInvoiceDate) : "À régénérer";
  const anchorLabel = cycle.anchorDate ? fmtDate(cycle.anchorDate) : "À régénérer";

  return (
  <div className="space-y-3">
    {unpaidInvoices.length > 0 && (
      <Panel className="border-red-500/30">
        <PanelHeader icon={AlertTriangle} title="Factures impayées" count={unpaidInvoices.length} />
        <MiniTable headers={["Facture", "Total", "Solde", "Échéance"]}>
          {unpaidInvoices.map((inv: any) => (
            <tr key={inv.id} className={trClass}>
              <td className="px-3 py-1.5"><Link to={corePath(`/invoices/${inv.id}`)} className="font-mono text-core-text-primary hover:text-emerald-400 text-[11px]">{inv.invoice_number}</Link></td>
              <td className="px-3 py-1.5 tabular-nums text-core-text-primary text-[11px]">{fmtCAD(inv.total)}</td>
              <td className="px-3 py-1.5 tabular-nums text-red-400 font-medium text-[11px]">{fmtCAD(inv.balance_due)}</td>
              <td className="px-3 py-1.5 text-core-text-label text-[11px]">{fmtDate(inv.due_date)}</td>
            </tr>
          ))}
        </MiniTable>
      </Panel>
    )}

    {/* Mode de paiement */}
    <Panel>
      <PanelHeader icon={Wallet} title="Mode de paiement" />
      <div className="p-3 space-y-2">
        {isPreAuth ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3" /> Autopay PayPal actif
            </span>
            <p className="text-[10px] text-core-text-label font-mono">
              Sub: …{String(paypalSub.paypal_subscription_id).slice(-8)}
            </p>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-[hsl(220,15%,18%)] px-2 py-1 text-[11px] font-medium text-core-text-label border border-[hsl(220,15%,22%)]">
            Paiement manuel / Interac
          </span>
        )}
        {unpaidInvoices.length > 0 && (
          <>
            <button
              onClick={() => setChargeOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              <CreditCard className="h-3 w-3" /> Charger par carte (Square)
            </button>
            <CoreSquarePaymentDialog
              open={chargeOpen}
              onOpenChange={setChargeOpen}
              unpaidInvoices={unpaidInvoices}
              accountId={acct.id}
              customerName={data.profile ? `${data.profile.first_name || ""} ${data.profile.last_name || ""}`.trim() || null : null}
              customerEmail={data.profile?.email ?? null}
            />
          </>
        )}
      </div>
    </Panel>

    <Panel>
      <PanelHeader icon={Hash} title="Informations du compte" />
      <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
        <InfoLine label="Numéro de compte" value={acct.account_number} mono accent />
        <InfoLine label="Nom du compte" value={acct.account_name || "—"} />
        <InfoLine label="Statut" value={<StatusBadge label={label(acct.status)} variant={statusToVariant(acct.status || "active")} size="sm" />} />
        <InfoLine label="Classe de crédit" value={acct.credit_class || "C"} />
        <InfoLine label="Créé le" value={fmtDate(acct.created_at)} />
      </div>
    </Panel>
    {/* Score de crédit interne */}
    {data.creditScore && (
      <Panel className={
        data.creditScore.credit_grade === "A" || data.creditScore.credit_grade === "B"
          ? "border-emerald-500/30"
          : data.creditScore.credit_grade === "C"
          ? "border-amber-500/30"
          : "border-red-500/30"
      }>
        <PanelHeader icon={CreditCard} title="Score de crédit interne" />
        <div className="p-3 space-y-2">
          {/* Score bar */}
          <div className="flex items-center gap-3">
            <span className={`text-3xl font-bold font-mono ${
              data.creditScore.credit_grade === "A" || data.creditScore.credit_grade === "B" ? "text-emerald-400"
              : data.creditScore.credit_grade === "C" ? "text-amber-400"
              : "text-red-400"
            }`}>{data.creditScore.credit_grade}</span>
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-core-text-secondary">{data.creditScore.grade_label}</span>
                <span className="text-core-text-label tabular-nums">{data.creditScore.current_score}/100</span>
              </div>
              <div className="h-2 bg-[hsl(220,15%,14%)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    data.creditScore.credit_grade === "A" || data.creditScore.credit_grade === "B" ? "bg-emerald-500"
                    : data.creditScore.credit_grade === "C" ? "bg-amber-500"
                    : "bg-red-500"
                  }`}
                  style={{ width: `${data.creditScore.current_score}%` }}
                />
              </div>
            </div>
          </div>

          {/* Résumé */}
          {!data.creditScore.has_history ? (
            <p className="text-[11px] text-core-text-disabled italic">Nouveau client — score neutre (50/100), aucun historique chez Nivra.</p>
          ) : (
            <p className="text-[11px] text-core-text-label">
              {[
                data.creditScore.invoices_paid > 0 && `${data.creditScore.invoices_paid} facture${data.creditScore.invoices_paid > 1 ? "s" : ""} payée${data.creditScore.invoices_paid > 1 ? "s" : ""}`,
                data.creditScore.invoices_overdue > 0 && `${data.creditScore.invoices_overdue} en retard`,
                data.creditScore.invoices_bad_debt > 0 && `${data.creditScore.invoices_bad_debt} créance${data.creditScore.invoices_bad_debt > 1 ? "s" : ""} irrécouvrable${data.creditScore.invoices_bad_debt > 1 ? "s" : ""}`,
                data.creditScore.chargebacks > 0 && `${data.creditScore.chargebacks} chargeback${data.creditScore.chargebacks > 1 ? "s" : ""}`,
                data.creditScore.account_age_days > 0 && `${Math.floor(data.creditScore.account_age_days / 30)} mois d'ancienneté`,
              ].filter(Boolean).join(" · ")}
            </p>
          )}

          {/* Facteurs détaillés */}
          {data.creditScore.has_history && Object.keys(data.creditScore.factors || {}).length > 0 && (
            <div className="space-y-1 pt-1 border-t border-[hsl(220,15%,14%)]">
              {Object.entries(data.creditScore.factors as Record<string, number>).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[11px]">
                  <span className="text-core-text-secondary">{CREDIT_FACTOR_LABELS[k] || k.replace(/_/g, " ")}</span>
                  <span className={`font-semibold tabular-nums flex items-center gap-0.5 ${v > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {v > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {v > 0 ? "+" : ""}{v} pts
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-core-text-disabled">
            Calculé le {new Date(data.creditScore.last_assessed_at).toLocaleDateString("fr-CA")}
          </p>
        </div>
      </Panel>
    )}

    <Panel>
      <PanelHeader icon={Clock} title="Cycle de facturation" />
      <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
        <InfoLine label="Jour de cycle" value={cycleDayLabel} accent={!!cycle.cycleDay} />
        <InfoLine label="Prochaine facture" value={nextInvoiceLabel} accent={!!cycle.nextInvoiceDate} />
        <InfoLine label="Date d'ancrage" value={anchorLabel} />
        <InfoLine label="Fuseau horaire" value={acct.billing_cycle_timezone || "America/Toronto"} />
      </div>
    </Panel>
    <div className="grid grid-cols-2 gap-2">
      <Panel className="p-3">
        <p className="text-[9px] uppercase tracking-wider text-core-text-label font-medium">Revenu mensuel</p>
        <p className="text-lg font-bold tabular-nums text-emerald-400 mt-0.5">{fmtCAD(monthlyRevenue)}</p>
      </Panel>
      <Panel className="p-3">
        <p className="text-[9px] uppercase tracking-wider text-core-text-label font-medium">Total payé</p>
        <p className="text-lg font-bold tabular-nums text-core-text-primary mt-0.5">{fmtCAD(totalPaid)}</p>
      </Panel>
      <Panel className="p-3">
        <p className="text-[9px] uppercase tracking-wider text-core-text-label font-medium">Solde impayé</p>
        <p className={`text-lg font-bold tabular-nums mt-0.5 ${totalDue > 0 ? "text-red-400" : "text-emerald-400"}`}>{fmtCAD(totalDue)}</p>
      </Panel>
      <Panel className="p-3">
        <p className="text-[9px] uppercase tracking-wider text-core-text-label font-medium">Factures</p>
        <p className="text-lg font-bold tabular-nums text-core-text-primary mt-0.5">{data.invoices.length}</p>
      </Panel>
    </div>
  </div>
  );
};

/* ── Subscriptions ── */
const subscriptionCycleLabel = (s: any) => {
  const start = s?.cycle_start_date ? fmtDate(s.cycle_start_date) : null;
  const end = s?.cycle_end_date ? fmtDate(s.cycle_end_date) : null;
  return start && end ? `${start} → ${end}` : "Cycle à régénérer";
};

export const SubscriptionsSection = ({ data, customerId, onRefresh }: any) => (
  <Panel>
    <PanelHeader icon={Repeat} title="Services / Abonnements" count={data.subscriptions.length}
      actions={<SubscriptionActionMenu subscriptions={data.subscriptions} customerId={customerId} onRefresh={onRefresh} />} />
    <MiniTable headers={["Plan", "Cat.", "Prix/mois", "Statut", "Cycle", "Auto", ""]} empty={data.subscriptions.length === 0}>
      {data.subscriptions.map((s: any) => (
        <tr key={s.id} className={trClass}>
          <td className="px-3 py-1.5">
            <p className="text-core-text-primary font-medium text-[11px]">{s.plan_name}</p>
            <p className="text-core-text-label text-[10px] font-mono">{s.plan_code}</p>
          </td>
          <td className="px-3 py-1.5 text-core-text-secondary text-[11px]">{s.service_category || "—"}</td>
          <td className="px-3 py-1.5 tabular-nums text-emerald-400 font-medium text-[11px]">{fmtCAD(s.plan_price)}</td>
          <td className="px-3 py-1.5"><StatusBadge label={label(s.status)} variant={statusToVariant(s.status || "")} size="sm" /></td>
          <td className="px-3 py-1.5 whitespace-nowrap text-core-text-label text-[10px]">{subscriptionCycleLabel(s)}</td>
          <td className="px-3 py-1.5">{s.auto_billing_enabled ? <Zap className="h-3 w-3 text-emerald-400" /> : <span className="text-core-text-disabled text-[10px]">—</span>}</td>
          <td className="px-3 py-1.5"><Link to={corePath(`/subscriptions/${s.id}`)} className="text-core-text-label hover:text-emerald-400"><ExternalLink className="h-3 w-3" /></Link></td>
        </tr>
      ))}
    </MiniTable>
  </Panel>
);

/* ── Orders ── */
export const OrdersSection = ({ data, accountId, clientId, clientEmail, clientName, onRefresh }: any) => (
  <Panel>
    <PanelHeader icon={ShoppingCart} title="Commandes" count={data.orders.length}
      actions={<OrderActionMenu orders={data.orders} accountId={accountId} clientId={clientId} clientEmail={clientEmail} clientName={clientName} onRefresh={onRefresh} />} />
    <MiniTable headers={["#", "Service", "Statut", "Total", "Paiement", "Date", ""]} empty={data.orders.length === 0}>
      {data.orders.slice(0, 50).map((o: any) => (
        <tr key={o.id} className={trClass}>
          <td className="px-3 py-1.5 font-mono text-core-text-primary text-[11px]">{o.order_number || "—"}</td>
          <td className="px-3 py-1.5 text-core-text-secondary text-[11px]">{o.service_category || o.service_type || "—"}</td>
          <td className="px-3 py-1.5"><StatusBadge label={label(o.status)} variant={statusToVariant(o.status || "")} size="sm" /></td>
          <td className="px-3 py-1.5 tabular-nums text-core-text-secondary text-[11px]">{fmtCAD(o.total_today ?? o.order_total)}</td>
          <td className="px-3 py-1.5 text-core-text-label text-[11px]">{label(o.payment_status)}</td>
          <td className="px-3 py-1.5 whitespace-nowrap text-core-text-label text-[11px]">{fmtDate(o.created_at)}</td>
          <td className="px-3 py-1.5"><Link to={corePath(`/orders/${o.id}`)} className="text-core-text-label hover:text-emerald-400"><ExternalLink className="h-3 w-3" /></Link></td>
        </tr>
      ))}
    </MiniTable>
  </Panel>
);

/* ── Invoices ── */
export const InvoicesSection = ({ data, customerId, customerUserId, profileEmail, billingCustomerEmail, onRefresh }: any) => {
  const [selected, setSelected] = useState<any>(null);
  return (
    <Panel>
      <PanelHeader icon={FileText} title="Historique des factures" count={data.invoices.length}
        actions={<InvoiceActionMenu invoices={data.invoices} customerId={customerId} customerUserId={customerUserId} fallbackRecipientEmail={profileEmail} fallbackCustomerEmail={billingCustomerEmail} onRefresh={onRefresh} />} />
      <MiniTable headers={["Facture", "Type", "Total", "Payé", "Solde", "Statut", "Échéance", ""]} empty={data.invoices.length === 0}>
        {data.invoices.slice(0, 50).map((inv: any) => (
          <tr key={inv.id} className={`${trClass} cursor-pointer`} onClick={() => setSelected(inv)}>
            <td className="px-3 py-1.5 font-mono text-core-text-primary text-[11px]">{inv.invoice_number}</td>
            <td className="px-3 py-1.5 text-core-text-label text-[11px] capitalize">{inv.type}</td>
            <td className="px-3 py-1.5 tabular-nums text-core-text-primary text-[11px]">{fmtCAD(inv.total)}</td>
            <td className="px-3 py-1.5 tabular-nums text-emerald-400 text-[11px]">{fmtCAD(inv.amount_paid)}</td>
            <td className="px-3 py-1.5"><span className={`tabular-nums text-[11px] font-medium ${(inv.balance_due ?? 0) > 0 ? "text-red-400" : "text-core-text-disabled"}`}>{fmtCAD(inv.balance_due)}</span></td>
            <td className="px-3 py-1.5"><StatusBadge label={label(inv.status)} variant={statusToVariant(inv.status || "")} size="sm" /></td>
            <td className="px-3 py-1.5 whitespace-nowrap text-core-text-label text-[11px]">{fmtDate(inv.due_date)}</td>
            <td className="px-3 py-1.5 text-core-text-label hover:text-emerald-400 text-[10px]">Voir →</td>
          </tr>
        ))}
      </MiniTable>
      <InvoiceDetailDialog invoice={selected} open={!!selected} onClose={() => setSelected(null)} />
    </Panel>
  );
};

/* ── Payments ── */
export const PaymentsSection = ({ data, customerId, customerUserId, profileEmail, billingCustomerEmail, onRefresh }: any) => {
  const [selected, setSelected] = useState<any>(null);
  return (
    <Panel>
      <PanelHeader icon={CreditCard} title="Paiements" count={data.payments.length}
        actions={<InvoiceActionMenu invoices={data.invoices} customerId={customerId} customerUserId={customerUserId} fallbackRecipientEmail={profileEmail} fallbackCustomerEmail={billingCustomerEmail} onRefresh={onRefresh} />} />
      <MiniTable headers={["#", "Montant", "Méthode", "Statut", "Réf.", "Reçu le", ""]} empty={data.payments.length === 0}>
        {data.payments.slice(0, 50).map((p: any) => (
          <tr key={p.id} className={`${trClass} cursor-pointer`} onClick={() => setSelected(p)}>
            <td className="px-3 py-1.5 font-mono text-core-text-primary text-[11px]">{p.payment_number || "—"}</td>
            <td className="px-3 py-1.5 tabular-nums text-emerald-400 font-medium text-[11px]">{fmtCAD(p.amount)}</td>
            <td className="px-3 py-1.5 text-core-text-secondary text-[11px] capitalize">{p.method}</td>
            <td className="px-3 py-1.5"><StatusBadge label={label(p.status)} variant={statusToVariant(p.status || "")} size="sm" /></td>
            <td className="px-3 py-1.5 font-mono text-core-text-label text-[10px]">{p.reference || "—"}</td>
            <td className="px-3 py-1.5 whitespace-nowrap text-core-text-label text-[11px]">{fmtDate(p.received_at)}</td>
            <td className="px-3 py-1.5 text-core-text-label hover:text-emerald-400 text-[10px]">Voir →</td>
          </tr>
        ))}
      </MiniTable>
      <PaymentDetailDialog payment={selected} invoices={data.invoices} open={!!selected} onClose={() => setSelected(null)} />
    </Panel>
  );
};

/* ── Equipment ── */
export const EquipmentSection = ({ data, accountId, onRefresh }: any) => {
  const [selected, setSelected] = useState<any>(null);
  return (
    <Panel>
      <PanelHeader icon={Package} title="Équipements" count={data.equipment.length}
        actions={<EquipmentActionMenu equipment={data.equipment} accountId={accountId} clientId={data.clientId} orders={data.orders} subscriptions={data.subscriptions} onRefresh={onRefresh} />} />
      <MiniTable headers={["Article", "SKU", "Statut", "S/N", "MAC", "Assigné le", ""]} empty={data.equipment.length === 0}>
        {data.equipment.map((eq: any) => (
          <tr key={eq.id} className={`${trClass} cursor-pointer`} onClick={() => setSelected(eq)}>
            <td className="px-3 py-1.5 text-core-text-primary text-[11px]">{eq.catalog_name || eq.item_name}</td>
            <td className="px-3 py-1.5 font-mono text-core-text-label text-[10px]">{eq.sku || eq.item_sku || "—"}</td>
            <td className="px-3 py-1.5">
              {eq.status
                ? <StatusBadge label={label(eq.status)} variant={statusToVariant(eq.status)} size="sm" />
                : <span className="text-core-text-disabled text-[10px]">—</span>}
            </td>
            <td className="px-3 py-1.5 font-mono text-core-text-label text-[10px] max-w-[120px] truncate">
              {eq.serial_number || (Array.isArray(eq.serial_numbers) ? eq.serial_numbers.join(", ") : "—")}
            </td>
            <td className="px-3 py-1.5 font-mono text-core-text-label text-[10px]">{eq.mac_address || "—"}</td>
            <td className="px-3 py-1.5 whitespace-nowrap text-core-text-label text-[11px]">{fmtDate(eq.assigned_at || eq.created_at)}</td>
            <td className="px-3 py-1.5 text-core-text-label hover:text-emerald-400 text-[10px]">Gérer →</td>
          </tr>
        ))}
      </MiniTable>
      <EquipmentDetailDialog item={selected} open={!!selected} onClose={() => setSelected(null)} onRefresh={onRefresh} />
    </Panel>
  );
};

/* ── Tickets ── */
export const TicketsSection = ({ data, clientId, clientEmail, clientName, accountId, onRefresh }: any) => {
  const navigate = useNavigate();
  return (
  <Panel>
    <PanelHeader icon={MessageSquare} title="Tickets de support" count={data.tickets.length}
      actions={<AccountActionMenu clientId={clientId} clientEmail={clientEmail} clientName={clientName} accountId={accountId} onRefresh={onRefresh} />} />
    <MiniTable headers={["#", "Sujet", "Cat.", "Priorité", "Statut", "Créé le"]} empty={data.tickets.length === 0}>
      {data.tickets.slice(0, 30).map((t: any) => (
        <tr
          key={t.id}
          className={`${trClass} cursor-pointer`}
          onClick={() => navigate(corePath(`/support?ticket=${t.id}`))}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(corePath(`/support?ticket=${t.id}`)); } }}
        >
          <td className="px-3 py-1.5 font-mono text-emerald-400 hover:underline text-[11px]">{t.ticket_number || "—"}</td>
          <td className="px-3 py-1.5 text-core-text-primary max-w-[180px] truncate text-[11px]">{t.subject || t.title || "—"}</td>
          <td className="px-3 py-1.5 text-core-text-secondary text-[11px]">{t.category || "—"}</td>
          <td className="px-3 py-1.5 text-core-text-secondary text-[11px] capitalize">{t.priority || "—"}</td>
          <td className="px-3 py-1.5"><StatusBadge label={label(t.status)} variant={statusToVariant(t.status || "")} size="sm" /></td>
          <td className="px-3 py-1.5 whitespace-nowrap text-core-text-label text-[11px]">{fmtDate(t.created_at)}</td>
        </tr>
      ))}
    </MiniTable>
  </Panel>
  );
};

/* ── Appointments ── */
export const AppointmentsSection = ({ data, clientId, clientEmail, clientName, accountId, onRefresh }: any) => (
  <Panel>
    <PanelHeader icon={Calendar} title="Rendez-vous / Technicien" count={data.appointments.length}
      actions={<AccountActionMenu clientId={clientId} clientEmail={clientEmail} clientName={clientName} accountId={accountId} onRefresh={onRefresh} />} />
    <MiniTable headers={["#", "Titre", "Type", "Statut", "Date", "Adresse"]} empty={data.appointments.length === 0}>
      {data.appointments.map((a: any) => (
        <tr key={a.id} className={trClass}>
          <td className="px-3 py-1.5 font-mono text-core-text-secondary text-[10px]">{a.appointment_number || "—"}</td>
          <td className="px-3 py-1.5 text-core-text-primary text-[11px]">{a.title}</td>
          <td className="px-3 py-1.5 text-core-text-secondary text-[11px]">{a.service_type || a.installation_method || "—"}</td>
          <td className="px-3 py-1.5"><StatusBadge label={label(a.status)} variant={statusToVariant(a.status || "")} size="sm" /></td>
          <td className="px-3 py-1.5 whitespace-nowrap text-core-text-label text-[11px]">{fmtDateTime(a.scheduled_at)}</td>
          <td className="px-3 py-1.5 text-core-text-label text-[11px] max-w-[140px] truncate">{a.service_address || "—"}</td>
        </tr>
      ))}
    </MiniTable>
  </Panel>
);

/* ── KYC ── */
export const KycSection = ({ data }: any) => {
  const [selected, setSelected] = useState<any>(null);
  return (
    <Panel>
      <PanelHeader icon={Shield} title="Vérification KYC / Identité" count={data.kycSessions.length} />
      {data.kycSessions.length === 0 ? (
        <div className="px-3 py-6 text-center text-core-text-disabled text-[11px]">Aucune session KYC enregistrée</div>
      ) : (
        <MiniTable headers={["#", "Statut", "Document", "Soumis", "Révisé", ""]}>
          {data.kycSessions.map((k: any) => (
            <tr key={k.id} className={`${trClass} cursor-pointer`} onClick={() => setSelected(k)}>
              <td className="px-3 py-1.5 font-mono text-core-text-secondary text-[10px]">{k.case_number || k.id.slice(0, 8)}</td>
              <td className="px-3 py-1.5"><StatusBadge label={label(k.status)} variant={statusToVariant(k.status || "")} size="sm" /></td>
              <td className="px-3 py-1.5 text-core-text-secondary text-[11px]">{k.id_type || k.document_type || "—"}</td>
              <td className="px-3 py-1.5 whitespace-nowrap text-core-text-label text-[11px]">{fmtDate(k.submitted_at)}</td>
              <td className="px-3 py-1.5 whitespace-nowrap text-core-text-label text-[11px]">{fmtDate(k.reviewed_at)}</td>
              <td className="px-3 py-1.5 text-core-text-label hover:text-emerald-400 text-[10px]">Voir →</td>
            </tr>
          ))}
        </MiniTable>
      )}
      <KycDetailDialog session={selected} open={!!selected} onClose={() => setSelected(null)} />
    </Panel>
  );
};

/* ── Contracts & Documents ── */
export const ContractsSection = ({ data }: any) => {
  const [selected, setSelected] = useState<any>(null);
  const rows: any[] = [];
  (data.contracts || []).forEach((c: any) => rows.push({
    id: `c-${c.id}`,
    document_name: c.contract_number ? `Contrat ${c.contract_number}` : `Contrat ${String(c.id).slice(0, 8)}`,
    document_type: c.status || "contract",
    created_at: c.created_at,
    url: c.contract_pdf_url || c.contract_url || null,
    signed_at: c.client_signed_at || c.signed_at || null,
    signer: c.client_signer_name || null,
    contract_number: c.contract_number,
    status: c.status,
  }));
  (data.documents || []).forEach((d: any) => rows.push({
    id: `d-${d.id}`,
    document_name: d.document_name,
    document_type: d.document_type || "—",
    created_at: d.created_at,
    url: d.document_url || null,
  }));
  return (
    <Panel>
      <PanelHeader icon={FileText} title="Contrats & Documents" count={rows.length} />
      {rows.length === 0 ? (
        <div className="px-3 py-6 text-center text-core-text-disabled text-[11px]">
          Aucun document enregistré pour ce client.
        </div>
      ) : (
        <MiniTable headers={["Document", "Type", "Signé / Ajouté", ""]}>
          {rows.map((d: any) => (
            <tr key={d.id} className={`${trClass} cursor-pointer`} onClick={() => setSelected(d)}>
              <td className="px-3 py-1.5 text-core-text-primary text-[11px]">
                {d.document_name}
                {d.signer && <span className="block text-[10px] text-core-text-label">par {d.signer}</span>}
              </td>
              <td className="px-3 py-1.5 text-core-text-secondary text-[11px]">{d.document_type || "—"}</td>
              <td className="px-3 py-1.5 text-core-text-label text-[11px]">{fmtDate(d.signed_at || d.created_at)}</td>
              <td className="px-3 py-1.5 text-core-text-label hover:text-emerald-400 text-[10px]">Voir →</td>
            </tr>
          ))}
        </MiniTable>
      )}
      <ContractDetailDialog doc={selected} open={!!selected} onClose={() => setSelected(null)} />
    </Panel>
  );
};

/* ── Financial Documents (Lot 1) ── */
export const FinancialDocsSection = ({ data, acct, prof, clientName }: any) => {
  const client = {
    client_name: clientName,
    client_email: prof?.email || "",
    client_phone: prof?.phone || undefined,
    client_address: acct?.primary_service_address || acct?.billing_address || undefined,
    client_city: acct?.primary_service_city || acct?.billing_city || undefined,
    client_province: acct?.primary_service_province || acct?.billing_province || undefined,
    client_postal: acct?.primary_service_postal_code || acct?.billing_postal_code || undefined,
    account_number: acct?.account_number || "",
  };
  return (
    <FinancialDocumentsPanel
      accountId={acct?.id}
      client={client}
      invoices={data.invoices || []}
      payments={data.payments || []}
    />
  );
};

/* ── Admin Documents (Lots 2-5 — 17 templates) ── */
export const AdminDocsSection = ({ data, acct, prof, clientName }: any) => {
  const client = {
    client_name: clientName,
    client_email: prof?.email || "",
    client_phone: prof?.phone || undefined,
    client_address: acct?.primary_service_address || acct?.billing_address || undefined,
    client_city: acct?.primary_service_city || acct?.billing_city || undefined,
    client_province: acct?.primary_service_province || acct?.billing_province || undefined,
    client_postal: acct?.primary_service_postal_code || acct?.billing_postal_code || undefined,
    account_number: acct?.account_number || "",
  };
  return (
    <AdminDocumentsPanel
      client={client}
      invoices={data.invoices || []}
      subscriptions={data.subscriptions || []}
    />
  );
};

/* ── Timeline ── */
export const TimelineSection = ({ data }: any) => (
  <Panel>
    <PanelHeader icon={Activity} title="Chronologie d'activité" count={data.activityLogs.length} />
    {data.activityLogs.length === 0 ? (
      <div className="px-3 py-6 text-center text-core-text-disabled text-[11px]">Aucune activité enregistrée</div>
    ) : (
      <div className="divide-y divide-[hsl(220,15%,14%)] max-h-[600px] overflow-y-auto">
        {data.activityLogs.slice(0, 50).map((log: any) => (
          <div key={log.id} className="px-3 py-2 hover:bg-[hsl(220,20%,13%)] transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-core-text-primary leading-snug">{log.summary}</p>
                <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-core-text-disabled">
                  <span className="capitalize">{log.action_type?.replace(/_/g, " ")}</span>
                  {log.actor_name && <span>· {log.actor_name}</span>}
                </div>
              </div>
              <span className="text-[9px] text-core-text-disabled whitespace-nowrap shrink-0">{fmtDateTime(log.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
    )}
  </Panel>
);
