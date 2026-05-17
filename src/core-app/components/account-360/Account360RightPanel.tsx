/**
 * Account360RightPanel — Persistent right-side summary panel for Account 360.
 * Shows account info, billing cycle, financial summary, KYC, and notes.
 */
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { Panel, PanelHeader, InfoLine, fmtCAD, fmtDate, label, resolveAccountCycle } from "./Account360Helpers";
import { CircleDot, Clock, DollarSign, User, Shield, StickyNote, MapPin } from "lucide-react";
import { ClientNotesPanel } from "@/core-app/components/notes/ClientNotesPanel";

interface Props {
  account: any;
  profile: any;
  clientName: string;
  latestKyc: any;
  totalDue: number;
  totalPaid: number;
  monthlyRevenue: number;
  unpaidCount: number;
  accountId: string | undefined;
  clientId: string | undefined;
  subscriptions?: any[];
  onRefresh: () => void;
}

export function Account360RightPanel({
  account, profile, clientName, latestKyc, totalDue, totalPaid,
  monthlyRevenue, unpaidCount, clientId, subscriptions = [], onRefresh,
}: Props) {
  const acct = account;
  const cycle = resolveAccountCycle(acct, subscriptions);

  return (
    <div className="space-y-3 self-start lg:sticky lg:top-4">
      {/* Account */}
      <Panel>
        <PanelHeader icon={CircleDot} title="Compte" />
        <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
          <InfoLine label="Numéro" value={acct.account_number} mono accent />
          <InfoLine label="Statut" value={<StatusBadge label={label(acct.status)} variant={statusToVariant(acct.status || "active")} size="sm" />} />
          <InfoLine label="Classe crédit" value={acct.credit_class || "C"} />
          <InfoLine label="Créé le" value={fmtDate(acct.created_at)} />
        </div>
      </Panel>

      {/* Billing cycle */}
      <Panel>
        <PanelHeader icon={Clock} title="Cycle facturation" />
        <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
          <InfoLine label="Jour de cycle" value={cycle.cycleDay ? `Le ${cycle.cycleDay}` : "—"} accent />
          <InfoLine label="Prochaine fact." value={fmtDate(cycle.nextInvoiceDate)} accent />
          <InfoLine label="Montant mensuel" value={fmtCAD(monthlyRevenue)} accent />
          <InfoLine label="Solde impayé" value={
            <span className={totalDue > 0 ? "text-red-400 font-semibold" : "text-emerald-400"}>{fmtCAD(totalDue)}</span>
          } />
          <InfoLine label="Fact. impayées" value={
            <span className={unpaidCount > 0 ? "text-red-400" : "text-emerald-400"}>{unpaidCount}</span>
          } />
        </div>
      </Panel>

      {/* Financial */}
      <Panel>
        <PanelHeader icon={DollarSign} title="Résumé financier" />
        <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
          <InfoLine label="Total payé" value={fmtCAD(totalPaid)} />
          <InfoLine label="Rev. mensuel" value={fmtCAD(monthlyRevenue)} accent />
        </div>
      </Panel>

      {/* Identity */}
      <Panel>
        <PanelHeader icon={User} title="Contact" />
        <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
          <InfoLine label="Nom" value={clientName} />
          <InfoLine label="Courriel" value={profile?.email || "—"} />
          <InfoLine label="Téléphone" value={profile?.phone || "—"} />
        </div>
      </Panel>

      {/* Address */}
      <Panel>
        <PanelHeader icon={MapPin} title="Adresses" />
        <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
          <InfoLine label="Service" value={[acct.primary_service_address, acct.primary_service_city].filter(Boolean).join(", ") || "—"} />
          <InfoLine label="Facturation" value={[acct.billing_address, acct.billing_city].filter(Boolean).join(", ") || "—"} />
        </div>
      </Panel>

      {/* KYC */}
      <Panel>
        <PanelHeader icon={Shield} title="KYC" />
        <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
          <InfoLine label="Statut" value={
            latestKyc
              ? <StatusBadge label={label(latestKyc.status)} variant={statusToVariant(latestKyc.status)} size="sm" />
              : <span className="text-core-text-disabled text-[10px]">Non vérifié</span>
          } />
          {latestKyc && (
            <>
              <InfoLine label="Document" value={latestKyc.document_type || "—"} />
              <InfoLine label="Révisé" value={fmtDate(latestKyc.reviewed_at)} />
            </>
          )}
        </div>
      </Panel>

      {/* Notes */}
      <Panel>
        <PanelHeader icon={StickyNote} title="Notes internes" />
        <div className="p-2">
          <ClientNotesPanel clientId={clientId} compact onMutationSuccess={onRefresh} />
        </div>
      </Panel>
    </div>
  );
}
