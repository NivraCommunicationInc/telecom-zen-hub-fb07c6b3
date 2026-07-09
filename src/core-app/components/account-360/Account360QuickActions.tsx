/**
 * Account360QuickActions — Visible action bar for the Account 360 workspace.
 * All critical actions as direct buttons (no hidden dropdowns per policy).
 * Now includes: restrictions, PIN reset, credits with duration.
 */
import { useState } from "react";
import {
  ShoppingCart, FileText, CreditCard, PauseCircle, PlayCircle,
  MessageSquare, Mail, Calendar, AlertTriangle, DollarSign,
  StickyNote, Package, UserPen, Shield, KeyRound, Gift, XCircle, Eye, Smartphone, Tv, Wifi, Wallet, Users, Award,
} from "lucide-react";
import { AccountRestrictionsDialog } from "@/core-app/components/account-actions/AccountRestrictionsDialog";
import { ResetClientPinDialog } from "@/core-app/components/account-actions/ResetClientPinDialog";
import { AdjustmentsModule } from "@/core-app/components/account-360/modules/AdjustmentsModule";
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
import { AccountDocumentsDialog } from "@/shared-ops/components/AccountDocumentsDialog";
import { AccountSecurityDialog } from "@/shared-ops/components/AccountSecurityDialog";
import { AccountCommunicationDialog } from "@/shared-ops/components/AccountCommunicationDialog";
import { AccountSmsDialog } from "@/shared-ops/components/AccountSmsDialog";
import { AccountCallsDialog } from "@/shared-ops/components/AccountCallsDialog";
import { AccountPreferencesDialog } from "@/shared-ops/components/AccountPreferencesDialog";
import { AccountTagsDialog } from "@/shared-ops/components/AccountTagsDialog";
import { AccountFollowupsDialog } from "@/shared-ops/components/AccountFollowupsDialog";
import { AccountPrivacyRequestsDialog } from "@/shared-ops/components/AccountPrivacyRequestsDialog";
import { AccountFraudRiskDialog } from "@/shared-ops/components/AccountFraudRiskDialog";
import { UserCog, ShieldCheck, History, FolderOpen, ShieldAlert, Send, MessageCircle, PhoneCall, Settings2, Tag, ListTodo, ShieldQuestion, ScanSearch, RotateCcw, Undo2, Banknote, Repeat, Activity, TrendingUp, Home, ArrowUpCircle, TicketCheck, Sparkles, Star, ChevronDown, ChevronRight } from "lucide-react";
import {
  AccountWriteOffDialog, PaymentPlanDialog, AutopayRetryDialog,
  RemoteRebootDialog, LineDiagnosticDialog, QuickPlanChangeDialog, ServiceMoveDialog,
  SupervisorEscalationDialog, CompensationVoucherDialog, VipChurnToggleDialog,
  FreezeCycleTrialDialog, NpsSatisfactionDialog, FraudLockDialog, ConsentJournalDialog,
} from "@/core-app/components/account-360/Account360NewActionDialogs";
import { ClientNotesDrawer } from "@/core-app/components/notes/ClientNotesDrawer";
import { PlanChangeModule } from "@/core-app/components/account-360/modules/PlanChangeModule";
import { KycModule } from "@/core-app/components/account-360/modules/KycModule";
import { RecordPaymentModule } from "@/core-app/components/account-360/modules/RecordPaymentModule";
import { RefundModule } from "@/core-app/components/account-360/modules/RefundModule";



interface Props {
  accountId: string | undefined;
  clientId: string | undefined;
  accountStatus: string | null;
  customerId?: string;
  clientName?: string;
  clientEmail?: string | null;
  monthlyRevenue?: number;
  subscriptions?: any[];
  canonicalData?: any;
  onRefresh: () => void;
  onNavigateSection: (section: string) => void;
  onEditProfile: () => void;
}

export function Account360QuickActions({ accountId, clientId, accountStatus, customerId, clientName = "Client", clientEmail, monthlyRevenue = 0, subscriptions = [], canonicalData, onRefresh, onNavigateSection, onEditProfile }: Props) {
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
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [callsOpen, setCallsOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [followupsOpen, setFollowupsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [fraudOpen, setFraudOpen] = useState(false);

  // New action states
  const [quickRefundOpen, setQuickRefundOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [paymentPlanOpen, setPaymentPlanOpen] = useState(false);
  const [autopayRetryOpen, setAutopayRetryOpen] = useState(false);
  const [rebootOpen, setRebootOpen] = useState(false);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [planChangeOpen, setPlanChangeOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [escalationOpen, setEscalationOpen] = useState(false);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [vipOpen, setVipOpen] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [npsOpen, setNpsOpen] = useState(false);
  const [fraudLockOpen, setFraudLockOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [notesDrawerOpen, setNotesDrawerOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);

  const handleImpersonate = async () => {
    if (!clientId) return;
    setLoading(true);
    try { await startImpersonation({ clientId, clientEmail: clientEmail || null, clientName }); }
    finally { setLoading(false); }
  };

  // Latest unpaid invoice / payment for finance actions
  const invoices: any[] = canonicalData?.invoices ?? [];
  const payments: any[] = canonicalData?.payments ?? [];
  const latestUnpaidInvoice = invoices.find((i: any) => Number(i.balance_due || 0) > 0);
  const latestPayment = payments[0];

  type Action = { icon: any; label: string; onClick: () => void; color?: "default"|"emerald"|"warning"|"success"|"danger"|"violet" };

  const groups: { title: string; actions: Action[] }[] = [
    {
      title: "Compte",
      actions: [
        { icon: Eye, label: "Voir comme client", onClick: handleImpersonate, color: "violet" },
        { icon: UserPen, label: "Modifier le profil", onClick: onEditProfile, color: "emerald" },
        { icon: UserCog, label: "Accès en ligne", onClick: () => setAccessOpen(true), color: "violet" },
        { icon: Star, label: "VIP / Churn risk", onClick: () => setVipOpen(true), color: "warning" },
        ...(accountStatus !== "suspended" && accountStatus !== "cancelled"
          ? [{ icon: PauseCircle, label: "Pause temporaire", onClick: () => setPauseOpen(true), color: "warning" as const }]
          : [{ icon: PlayCircle, label: "Réactiver le compte", onClick: () => setReactivateOpen(true), color: "success" as const }]),
        ...(accountStatus !== "cancelled"
          ? [{ icon: XCircle, label: "Annuler le compte", onClick: () => setCancelOpen(true), color: "danger" as const }]
          : []),
      ],
    },
    {
      title: "Facturation",
      actions: [
        { icon: CreditCard, label: "Enregistrer paiement", onClick: () => setRecordPaymentOpen(true), color: "emerald" },
        { icon: FileText, label: "Ouvrir facture", onClick: () => onNavigateSection("invoices") },
        { icon: Gift, label: "Crédit / Promotion", onClick: () => setCreditOpen(true), color: "emerald" },
        { icon: DollarSign, label: "Crédit / Frais facture", onClick: () => setAdjustmentOpen(true), color: "emerald" },
        { icon: Undo2, label: "Remboursement rapide", onClick: () => setQuickRefundOpen(true), color: "warning" },
        { icon: Banknote, label: "Write-off / Ajustement", onClick: () => setWriteOffOpen(true), color: "danger" },
        { icon: Repeat, label: "Plan de paiement", onClick: () => setPaymentPlanOpen(true), color: "violet" },
        { icon: RotateCcw, label: "Force AutoPay", onClick: () => setAutopayRetryOpen(true), color: "warning" },
        { icon: CreditCard, label: "Méthode de paiement", onClick: () => setBillingOpen(true), color: "violet" },
        { icon: Wallet, label: "Gestion facturation", onClick: () => setBillingOpen(true), color: "violet" },
        { icon: AlertTriangle, label: "Cas recouvrement", onClick: () => setCollectionsOpen(true), color: "warning" },
        { icon: DollarSign, label: "Litige facturation", onClick: () => setDisputesOpen(true), color: "warning" },
      ],
    },
    {
      title: "Services",
      actions: [
        { icon: Wifi, label: "Service Internet", onClick: () => setInternetOpen(true), color: "violet" },
        { icon: Tv, label: "Service TV", onClick: () => setTvOpen(true), color: "violet" },
        { icon: Smartphone, label: "Ligne mobile", onClick: () => setMobileOpen(true), color: "violet" },
        { icon: RotateCcw, label: "Reboot équipement", onClick: () => setRebootOpen(true), color: "warning" },
        { icon: Activity, label: "Diagnostic ligne", onClick: () => setDiagnosticOpen(true), color: "emerald" },
        { icon: ArrowUpCircle, label: "Upgrade/Downgrade", onClick: () => setPlanChangeOpen(true), color: "emerald" },
        { icon: PauseCircle, label: "Geler cycle / essai", onClick: () => setFreezeOpen(true), color: "warning" },
        { icon: Home, label: "Transfert (déménagement)", onClick: () => setMoveOpen(true), color: "violet" },
        { icon: Package, label: "Gestion équipement", onClick: () => setEquipmentOpen(true), color: "violet" },
      ],
    },
    {
      title: "Commandes & Fidélité",
      actions: [
        { icon: ShoppingCart, label: "Nouvelle commande", onClick: () => onNavigateSection("orders") },
        { icon: Award, label: "Récompenses", onClick: () => onNavigateSection("loyalty"), color: "emerald" },
        { icon: Users, label: "Parrainages", onClick: () => setReferralsOpen(true), color: "violet" },
        { icon: Sparkles, label: "Bon de compensation", onClick: () => setVoucherOpen(true), color: "emerald" },
      ],
    },
    {
      title: "Communication",
      actions: [
        { icon: MessageSquare, label: "Ticket support", onClick: () => setTicketOpen(true) },
        { icon: TicketCheck, label: "Escalade superviseur", onClick: () => setEscalationOpen(true), color: "danger" },
        { icon: Send, label: "Envoyer un message", onClick: () => setCommunicationOpen(true), color: "violet" },
        { icon: MessageCircle, label: "Envoyer un SMS", onClick: () => setSmsOpen(true), color: "violet" },
        { icon: Mail, label: "Envoyer rappel", onClick: () => setReminderOpen(true) },
        { icon: PhoneCall, label: "Appels & téléphonie", onClick: () => setCallsOpen(true), color: "violet" },
        { icon: Calendar, label: "Planifier RDV", onClick: () => setApptOpen(true) },
        { icon: TrendingUp, label: "NPS / Satisfaction", onClick: () => setNpsOpen(true), color: "emerald" },
        { icon: StickyNote, label: "Note interne", onClick: () => setNoteOpen(true) },
        { icon: Settings2, label: "Préférences comm.", onClick: () => setPreferencesOpen(true), color: "violet" },
      ],
    },
    {
      title: "Conformité & Sécurité",
      actions: [
        { icon: ShieldCheck, label: "Vérification KYC", onClick: () => setKycOpen(true), color: "violet" },
        { icon: KeyRound, label: "Réinitialiser NIP", onClick: () => setPinResetOpen(true), color: "warning" },
        { icon: Shield, label: "Restrictions", onClick: () => setRestrictionsOpen(true), color: "danger" },
        { icon: ShieldAlert, label: "Verrouiller compte (fraude)", onClick: () => setFraudLockOpen(true), color: "danger" },
        { icon: Tag, label: "Étiquettes & alertes", onClick: () => setTagsOpen(true), color: "warning" },
        { icon: ListTodo, label: "Tâches & suivis", onClick: () => setFollowupsOpen(true), color: "violet" },
        { icon: FolderOpen, label: "Documents", onClick: () => setDocumentsOpen(true), color: "violet" },
        { icon: History, label: "Historique & activité", onClick: () => setTimelineOpen(true), color: "violet" },
        { icon: ShieldCheck, label: "Journal consentements", onClick: () => setConsentOpen(true), color: "violet" },
        { icon: ShieldAlert, label: "Sécurité & sessions", onClick: () => setSecurityOpen(true), color: "danger" },
        { icon: ShieldQuestion, label: "Demandes Loi 25", onClick: () => setPrivacyOpen(true), color: "danger" },
        { icon: ScanSearch, label: "Risque & fraude", onClick: () => setFraudOpen(true), color: "danger" },
      ],
    },
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
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-wider text-core-text-disabled font-semibold">Actions rapides</p>
        <button
          onClick={() => setNotesDrawerOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-[hsl(220,15%,18%)] px-2.5 py-1 text-[10px] font-medium text-violet-300 hover:text-violet-200 hover:border-violet-500/40 bg-violet-500/5 transition-colors"
        >
          <StickyNote className="h-3 w-3" /> Notes internes
        </button>
      </div>
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.title}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-core-text-secondary">{group.title}</span>
              <span className="text-[9px] text-core-text-disabled">({group.actions.length})</span>
              <div className="flex-1 h-px bg-[hsl(220,15%,16%)]" />
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
              {group.actions.map((a, i) => (
                <button
                  key={i}
                  onClick={a.onClick}
                  disabled={loading}
                  className={`flex min-h-[44px] w-full items-center gap-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] px-3 py-2 text-left text-[11px] font-medium leading-tight transition-all disabled:opacity-40 ${colorMap[a.color ?? "default"]}`}
                >
                  <a.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 break-words">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
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
          customerId={customerId ?? null}
        />
      )}

      {clientId && (
        <EquipmentServiceActionsDialog
          open={equipmentOpen}
          onClose={() => setEquipmentOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
          initialItems={canonicalData?.equipment || []}
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
          payments={canonicalData?.payments || []}
        />
      )}

      {clientId && accountId && (
        <KycModule
          open={kycOpen}
          onClose={() => setKycOpen(false)}
          clientId={clientId}
          accountId={accountId}
          clientName={clientName}
          clientEmail={clientEmail}
        />
      )}

      {clientId && (
        <AccountActivityTimelineDialog
          open={timelineOpen}
          onClose={() => setTimelineOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          clientEmail={clientEmail}
          accountId={accountId ?? null}
          initialActivity={canonicalData?.activityLogs || []}
        />
      )}

      {clientId && (
        <AccountDocumentsDialog
          open={documentsOpen}
          onClose={() => setDocumentsOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
          initialData={canonicalData}
          isAdmin={true}
          isStaff={true}
        />
      )}

      {clientId && (
        <AccountSecurityDialog
          open={securityOpen}
          onClose={() => setSecurityOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          clientEmail={clientEmail}
        />
      )}

      {clientId && (
        <AccountCommunicationDialog
          open={communicationOpen}
          onClose={() => setCommunicationOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          clientEmail={clientEmail}
          accountId={accountId ?? null}
        />
      )}

      {clientId && (
        <AccountSmsDialog
          open={smsOpen}
          onClose={() => setSmsOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
        />
      )}

      {clientId && (
        <AccountCallsDialog
          open={callsOpen}
          onClose={() => setCallsOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
        />
      )}

      {clientId && (
        <AccountPreferencesDialog
          open={preferencesOpen}
          onClose={() => setPreferencesOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
        />
      )}

      {clientId && (
        <AccountTagsDialog
          open={tagsOpen}
          onClose={() => setTagsOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
        />
      )}

      {clientId && (
        <AccountFollowupsDialog
          open={followupsOpen}
          onClose={() => setFollowupsOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
        />
      )}

      {clientId && (
        <AccountPrivacyRequestsDialog
          open={privacyOpen}
          onClose={() => setPrivacyOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
        />
      )}

      {clientId && (
        <AccountFraudRiskDialog
          open={fraudOpen}
          onClose={() => setFraudOpen(false)}
          clientUserId={clientId}
          clientName={clientName}
          accountId={accountId ?? null}
        />

      )}

      {/* Advanced 360 actions */}
      {accountId && clientId && (
        <RefundModule
          open={quickRefundOpen}
          onClose={() => setQuickRefundOpen(false)}
          accountId={accountId}
          clientId={clientId}
          clientName={clientName}
          clientEmail={clientEmail}
          canonicalData={canonicalData}
        />
      )}
      <AccountWriteOffDialog
        open={writeOffOpen}
        onClose={() => setWriteOffOpen(false)}
        accountId={accountId ?? null}
        clientUserId={clientId ?? null}
        clientName={clientName}
        clientEmail={clientEmail}
        onRefresh={onRefresh}
      />
      <PaymentPlanDialog
        open={paymentPlanOpen}
        onClose={() => setPaymentPlanOpen(false)}
        accountId={accountId ?? null}
        clientUserId={clientId ?? null}
        clientName={clientName}
        clientEmail={clientEmail}
        onRefresh={onRefresh}
      />
      <AutopayRetryDialog
        open={autopayRetryOpen}
        onClose={() => setAutopayRetryOpen(false)}
        accountId={accountId ?? null}
        clientUserId={clientId ?? null}
        clientName={clientName}
        clientEmail={clientEmail}
        invoiceId={latestUnpaidInvoice?.id ?? null}
        invoiceNumber={latestUnpaidInvoice?.invoice_number ?? null}
        amount={latestUnpaidInvoice?.balance_due ?? undefined}
        onRefresh={onRefresh}
      />
      <RemoteRebootDialog
        open={rebootOpen}
        onClose={() => setRebootOpen(false)}
        accountId={accountId ?? null}
        clientUserId={clientId ?? null}
        clientName={clientName}
        clientEmail={clientEmail}
        onRefresh={onRefresh}
      />
      <LineDiagnosticDialog
        open={diagnosticOpen}
        onClose={() => setDiagnosticOpen(false)}
        accountId={accountId ?? null}
        clientUserId={clientId ?? null}
        clientName={clientName}
        clientEmail={clientEmail}
        onRefresh={onRefresh}
      />
      {accountId && clientId && (
        <PlanChangeModule
          open={planChangeOpen}
          onClose={() => setPlanChangeOpen(false)}
          accountId={accountId}
          clientId={clientId}
          clientName={clientName}
          subscriptions={subscriptions}
        />
      )}
      {accountId && clientId && (
        <RecordPaymentModule
          open={recordPaymentOpen}
          onClose={() => setRecordPaymentOpen(false)}
          accountId={accountId}
          clientId={clientId}
          clientName={clientName}
          clientEmail={clientEmail}
          canonicalData={canonicalData}
        />
      )}
      <ServiceMoveDialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        accountId={accountId ?? null}
        clientUserId={clientId ?? null}
        clientName={clientName}
        clientEmail={clientEmail}
        onRefresh={onRefresh}
      />
      <SupervisorEscalationDialog
        open={escalationOpen}
        onClose={() => setEscalationOpen(false)}
        accountId={accountId ?? null}
        clientUserId={clientId ?? null}
        clientName={clientName}
        clientEmail={clientEmail}
        onRefresh={onRefresh}
      />
      <CompensationVoucherDialog
        open={voucherOpen}
        onClose={() => setVoucherOpen(false)}
        accountId={accountId ?? null}
        clientUserId={clientId ?? null}
        clientName={clientName}
        clientEmail={clientEmail}
        monthlyRevenue={monthlyRevenue}
        onRefresh={onRefresh}
      />
      <VipChurnToggleDialog
        open={vipOpen}
        onClose={() => setVipOpen(false)}
        accountId={accountId ?? null}
        clientUserId={clientId ?? null}
        clientName={clientName}
        clientEmail={clientEmail}
        onRefresh={onRefresh}
      />
      <FreezeCycleTrialDialog
        open={freezeOpen}
        onClose={() => setFreezeOpen(false)}
        accountId={accountId ?? null}
        clientUserId={clientId ?? null}
        clientName={clientName}
        clientEmail={clientEmail}
        onRefresh={onRefresh}
      />
      <NpsSatisfactionDialog
        open={npsOpen}
        onClose={() => setNpsOpen(false)}
        accountId={accountId ?? null}
        clientUserId={clientId ?? null}
        clientName={clientName}
        clientEmail={clientEmail}
        onRefresh={onRefresh}
      />
      <FraudLockDialog
        open={fraudLockOpen}
        onClose={() => setFraudLockOpen(false)}
        accountId={accountId ?? null}
        clientUserId={clientId ?? null}
        clientName={clientName}
        clientEmail={clientEmail}
        onRefresh={onRefresh}
      />
      <ConsentJournalDialog
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        accountId={accountId ?? null}
        clientUserId={clientId ?? null}
        clientName={clientName}
        clientEmail={clientEmail}
        onRefresh={onRefresh}
      />
      <ClientNotesDrawer
        open={notesDrawerOpen}
        onClose={() => setNotesDrawerOpen(false)}
        clientId={clientId}
        onMutationSuccess={onRefresh}
      />

    </>
  );
}
