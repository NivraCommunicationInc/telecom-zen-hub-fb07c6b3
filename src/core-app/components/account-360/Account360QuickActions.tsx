/**
 * Account360QuickActions — Visible action bar for the Account 360 workspace.
 * All critical actions as direct buttons (no hidden dropdowns per policy).
 * Now includes: restrictions, PIN reset, credits with duration.
 */
import { useState } from "react";
import {
  ShoppingCart, FileText, CreditCard, PauseCircle, PlayCircle,
  MessageSquare, Mail, Calendar, AlertTriangle, DollarSign,
  StickyNote, Package, UserPen, Shield, KeyRound, Gift, XCircle, Eye, Smartphone, Tv, Wifi, Wallet, Users,
} from "lucide-react";
import { AccountRestrictionsDialog } from "@/core-app/components/account-actions/AccountRestrictionsDialog";
import { ResetClientPinDialog } from "@/core-app/components/account-actions/ResetClientPinDialog";
import { AddCreditWithDurationDialog } from "@/core-app/components/account-actions/AddCreditWithDurationDialog";
import { AccountAdjustmentDialog } from "@/core-app/components/account-actions/AccountAdjustmentDialog";
import { PauseAccountDialog, CancelAccountDialog } from "@/core-app/components/account-360/Account360RowDialogs";
import { ReactivateAccountDialog } from "@/core-app/components/account-360/ReactivateAccountDialog";
import { useImpersonation } from "@/hooks/useImpersonation";
import { ClientAccountAccessDialog } from "@/shared-ops/components/ClientAccountAccessDialog";
import { MobileServiceActionsDialog } from "@/shared-ops/components/MobileServiceActionsDialog";
import { TVServiceActionsDialog } from "@/shared-ops/components/TVServiceActionsDialog";
import { InternetServiceActionsDialog } from "@/shared-ops/components/InternetServiceActionsDialog";
import { BillingServiceActionsDialog } from "@/shared-ops/components/BillingServiceActionsDialog";
import { EquipmentServiceActionsDialog } from "@/shared-ops/components/EquipmentServiceActionsDialog";
import { ClientReferralsDialog } from "@/shared-ops/components/ClientReferralsDialog";
import { QuickTicketDialog } from "@/shared-ops/components/QuickTicketDialog";
import { ScheduleAppointmentDialog } from "@/shared-ops/components/ScheduleAppointmentDialog";
import { InternalNoteDialog } from "@/shared-ops/components/InternalNoteDialog";
import { CollectionsDialog } from "@/shared-ops/components/CollectionsDialog";
import { BillingDisputesDialog } from "@/shared-ops/components/BillingDisputesDialog";
import { KYCReviewDialog } from "@/shared-ops/components/KYCReviewDialog";
import { AccountActivityTimelineDialog } from "@/shared-ops/components/AccountActivityTimelineDialog";
import { UserCog, ShieldCheck, History } from "lucide-react";


interface Props {
  accountId: string | undefined;
  clientId: string | undefined;
  accountStatus: string | null;
  customerId?: string;
  clientName?: string;
  clientEmail?: string | null;
  monthlyRevenue?: number;
  subscriptions?: any[];
  onRefresh: () => void;
  onNavigateSection: (section: string) => void;
  onEditProfile: () => void;
}

export function Account360QuickActions({ accountId, clientId, accountStatus, customerId, clientName = "Client", clientEmail, monthlyRevenue = 0, subscriptions = [], onRefresh, onNavigateSection, onEditProfile }: Props) {
  const { startImpersonation } = useImpersonation();
  const [loading, setLoading] = useState(false);
  const [restrictionsOpen, setRestrictionsOpen] = useState(false);
  const [pinResetOpen, setPinResetOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tvOpen, setTvOpen] = useState(false);
  const [internetOpen, setInternetOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [referralsOpen, setReferralsOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [apptOpen, setApptOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [disputesOpen, setDisputesOpen] = useState(false);
  const [kycOpen, setKycOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const handleImpersonate = async () => {
    if (!clientId) return;
    setLoading(true);
    try { await startImpersonation({ clientId, clientEmail: clientEmail || null, clientName }); }
    finally { setLoading(false); }
  };

  const actions = [
    { icon: Eye, label: "Voir comme client", onClick: handleImpersonate, color: "violet" as const },
    { icon: UserPen, label: "Modifier le profil", onClick: onEditProfile, color: "emerald" },
    { icon: ShoppingCart, label: "Nouvelle commande", onClick: () => onNavigateSection("orders"), color: "default" },
    { icon: FileText, label: "Ouvrir facture", onClick: () => onNavigateSection("invoices"), color: "default" },
    { icon: CreditCard, label: "Enregistrer paiement", onClick: () => onNavigateSection("payments"), color: "default" },
    { icon: Gift, label: "Crédit / Promotion", onClick: () => setCreditOpen(true), color: "emerald" },
    { icon: DollarSign, label: "Crédit / Frais facture", onClick: () => setAdjustmentOpen(true), color: "emerald" },
    ...(accountStatus !== "suspended" && accountStatus !== "cancelled"
      ? [{ icon: PauseCircle, label: "Pause temporaire", onClick: () => setPauseOpen(true), color: "warning" as const }]
      : [{ icon: PlayCircle, label: "Réactiver le compte", onClick: () => setReactivateOpen(true), color: "success" as const }]
    ),
    ...(accountStatus !== "cancelled"
      ? [{ icon: XCircle, label: "Annuler le compte", onClick: () => setCancelOpen(true), color: "danger" as const }]
      : []
    ),
    { icon: UserCog, label: "Accès compte en ligne", onClick: () => setAccessOpen(true), color: "violet" as const },
    { icon: Smartphone, label: "Gestion ligne mobile", onClick: () => setMobileOpen(true), color: "violet" as const },
    { icon: Tv, label: "Gestion service TV", onClick: () => setTvOpen(true), color: "violet" as const },
    { icon: Wifi, label: "Gestion service Internet", onClick: () => setInternetOpen(true), color: "violet" as const },
    { icon: Wallet, label: "Gestion facturation", onClick: () => setBillingOpen(true), color: "violet" as const },
    { icon: Shield, label: "Restrictions", onClick: () => setRestrictionsOpen(true), color: "danger" },
    { icon: ShieldCheck, label: "Vérification KYC", onClick: () => setKycOpen(true), color: "violet" as const },
    { icon: KeyRound, label: "Réinitialiser NIP", onClick: () => setPinResetOpen(true), color: "warning" },
    { icon: MessageSquare, label: "Ticket support", onClick: () => setTicketOpen(true), color: "default" },
    { icon: Mail, label: "Envoyer rappel", onClick: () => setReminderOpen(true), color: "default" },
    { icon: Package, label: "Gestion équipement", onClick: () => setEquipmentOpen(true), color: "violet" as const },
    { icon: Users, label: "Parrainages", onClick: () => setReferralsOpen(true), color: "violet" as const },
    { icon: Calendar, label: "Planifier RDV", onClick: () => setApptOpen(true), color: "default" },
    { icon: AlertTriangle, label: "Cas recouvrement", onClick: () => setCollectionsOpen(true), color: "warning" },
    { icon: DollarSign, label: "Litige facturation", onClick: () => setDisputesOpen(true), color: "warning" },
    { icon: StickyNote, label: "Note interne", onClick: () => setNoteOpen(true), color: "default" },
    { icon: History, label: "Historique & activité", onClick: () => setTimelineOpen(true), color: "violet" as const },
  ];

  const colorMap: Record<string, string> = {
    default: "text-core-text-secondary hover:text-core-text-primary hover:border-emerald-500/30",
    emerald: "text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/40 bg-emerald-500/5",
    warning: "text-amber-400 hover:text-amber-300 hover:border-amber-500/40",
    success: "text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/40",
    danger: "text-red-400 hover:text-red-300 hover:border-red-500/40",
    violet: "text-violet-300 hover:text-violet-200 hover:border-violet-500/40 bg-violet-500/10",
  };

  return (
    <>
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-2">
        <div className="flex flex-wrap gap-1.5">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              disabled={loading}
              className={`flex items-center gap-1.5 rounded-md border border-[hsl(220,15%,18%)] px-2.5 py-1.5 text-[10px] font-medium transition-all disabled:opacity-40 ${colorMap[a.color]}`}
            >
              <a.icon className="h-3 w-3 shrink-0" />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <AccountRestrictionsDialog
        accountId={accountId}
        clientId={clientId}
        accountStatus={accountStatus}
        subscriptions={subscriptions}
        open={restrictionsOpen}
        onClose={() => setRestrictionsOpen(false)}
        onRefresh={onRefresh}
      />

      <ResetClientPinDialog
        clientId={clientId}
        clientName={clientName}
        open={pinResetOpen}
        onClose={() => setPinResetOpen(false)}
        onRefresh={onRefresh}
      />

      <AddCreditWithDurationDialog
        accountId={accountId}
        customerId={customerId}
        clientName={clientName}
        open={creditOpen}
        onClose={() => setCreditOpen(false)}
        onRefresh={onRefresh}
      />

      <AccountAdjustmentDialog
        accountId={accountId}
        clientName={clientName}
        open={adjustmentOpen}
        onClose={() => setAdjustmentOpen(false)}
        onRefresh={onRefresh}
      />

      <PauseAccountDialog
        accountId={accountId}
        monthlyRevenue={monthlyRevenue}
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        onRefresh={onRefresh}
      />

      <CancelAccountDialog
        accountId={accountId}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onRefresh={onRefresh}
      />

      <ReactivateAccountDialog
        accountId={accountId}
        customerId={customerId}
        accountStatus={accountStatus}
        subscriptions={subscriptions}
        open={reactivateOpen}
        onClose={() => setReactivateOpen(false)}
        onRefresh={onRefresh}
      />

      <ClientAccountAccessDialog
        open={accessOpen}
        onClose={() => setAccessOpen(false)}
        clientUserId={clientId}
        clientEmail={clientEmail}
        clientName={clientName}
      />

      {clientId && (
        <MobileServiceActionsDialog
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
        />
      )}

      {clientId && (
        <TVServiceActionsDialog
          open={tvOpen}
          onClose={() => setTvOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
        />
      )}

      {clientId && (
        <InternetServiceActionsDialog
          open={internetOpen}
          onClose={() => setInternetOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
        />
      )}

      {clientId && (
        <BillingServiceActionsDialog
          open={billingOpen}
          onClose={() => setBillingOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
        />
      )}

      {clientId && (
        <EquipmentServiceActionsDialog
          open={equipmentOpen}
          onClose={() => setEquipmentOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
        />
      )}

      {clientId && (
        <ClientReferralsDialog
          open={referralsOpen}
          onClose={() => setReferralsOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
        />
      )}

      {clientId && (
        <QuickTicketDialog
          open={ticketOpen}
          onClose={() => setTicketOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
          mode="ticket"
        />
      )}

      {clientId && (
        <QuickTicketDialog
          open={reminderOpen}
          onClose={() => setReminderOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
          mode="reminder"
        />
      )}

      {clientId && (
        <ScheduleAppointmentDialog
          open={apptOpen}
          onClose={() => setApptOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
        />
      )}

      {clientId && (
        <InternalNoteDialog
          open={noteOpen}
          onClose={() => setNoteOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
        />
      )}

      {clientId && (
        <CollectionsDialog
          open={collectionsOpen}
          onClose={() => setCollectionsOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
        />
      )}

      {clientId && (
        <BillingDisputesDialog
          open={disputesOpen}
          onClose={() => setDisputesOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
        />
      )}

      {clientId && (
        <KYCReviewDialog
          open={kycOpen}
          onClose={() => setKycOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
        />
      )}
    </>
  );
}
