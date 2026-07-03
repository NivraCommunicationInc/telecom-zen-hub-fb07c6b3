/**
 * Nivra Core — Customer 360 / Account 360 Workspace
 * Telecom-grade operations console with header, KPI strip, 3-column layout.
 */
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAccountProfile } from "@/core-app/hooks/useAccountProfile";
import { corePath } from "@/core-app/lib/corePaths";
import { Loader2, User, AlertTriangle, LayoutGrid, Repeat, ShoppingCart, FileText, CreditCard, Package, MessageSquare, Calendar, Shield, Activity, Briefcase, Receipt } from "lucide-react";

import { Account360Header } from "@/core-app/components/account-360/Account360Header";
import { Account360KPIStrip } from "@/core-app/components/account-360/Account360KPIStrip";
import { Account360QuickActions } from "@/core-app/components/account-360/Account360QuickActions";
import { AccountAdjustmentsList } from "@/core-app/components/account-actions/AccountAdjustmentsList";
import { Account360RightPanel } from "@/core-app/components/account-360/Account360RightPanel";
import { Account360ProfileEditDialog } from "@/core-app/components/account-360/Account360ProfileEditDialog";
import { ClientPaymentsHistory } from "@/shared-ops/components/ClientPaymentsHistory";
import {
  ProfileSection, BillingSection, SubscriptionsSection, OrdersSection,
  InvoicesSection, PaymentsSection, EquipmentSection, TicketsSection,
  AppointmentsSection, KycSection, ContractsSection, TimelineSection,
  FinancialDocsSection, AdminDocsSection,
} from "@/core-app/components/account-360/Account360Sections";

/* ── Section definitions ── */
type SectionId = "profile" | "billing" | "subscriptions" | "orders" | "invoices" | "payments" | "kyc" | "equipment" | "appointments" | "contracts" | "financial_docs" | "admin_docs" | "tickets" | "timeline";

const SECTIONS: { id: SectionId; label: string; icon: any }[] = [
  { id: "profile", label: "Profil", icon: User },
  { id: "billing", label: "Facturation / Compte", icon: LayoutGrid },
  { id: "subscriptions", label: "Services actifs", icon: Repeat },
  { id: "orders", label: "Commandes", icon: ShoppingCart },
  { id: "invoices", label: "Factures", icon: FileText },
  { id: "payments", label: "Paiements", icon: CreditCard },
  { id: "kyc", label: "KYC / Identité", icon: Shield },
  { id: "equipment", label: "Équipements", icon: Package },
  { id: "appointments", label: "RDV / Technicien", icon: Calendar },
  { id: "contracts", label: "Contrats & Documents", icon: Briefcase },
  { id: "financial_docs", label: "Documents financiers", icon: Receipt },
  { id: "admin_docs", label: "Documents administratifs", icon: FileText },
  { id: "tickets", label: "Support / Tickets", icon: MessageSquare },
  { id: "timeline", label: "Chronologie", icon: Activity },
];

const CoreAccountDetail = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const data = useAccountProfile(accountId);
  const [activeSection, setActiveSection] = useState<SectionId>("profile");
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  /* ── Loading ── */
  if (data.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-core-text-label" />
      </div>
    );
  }

  /* ── Error ── */
  if (data.accountError) {
    return (
      <div className="py-16 text-center space-y-2">
        <AlertTriangle className="h-6 w-6 mx-auto text-red-400/60" />
        <p className="text-red-400 text-xs font-medium">Erreur de chargement</p>
        <p className="text-core-text-label text-[11px] max-w-sm mx-auto">{(data.accountError as any)?.message || "Vérifiez votre session."}</p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <button onClick={() => data.refetch()} className="rounded-md bg-emerald-600 px-4 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-500 transition-colors">Réessayer</button>
          <Link to={corePath("/accounts")} className="text-emerald-400 text-[11px] hover:underline">← Comptes</Link>
        </div>
      </div>
    );
  }

  /* ── Not found ── */
  if (!data.account) {
    return (
      <div className="py-16 text-center space-y-2">
        <User className="h-6 w-6 mx-auto text-core-text-disabled" />
        <p className="text-core-text-label text-xs">Compte introuvable</p>
        <p className="text-core-text-disabled text-[10px] font-mono">{accountId}</p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <button onClick={() => data.refetch()} className="rounded-md border border-[hsl(220,15%,16%)] px-3 py-1.5 text-[11px] text-core-text-label hover:text-core-text-primary transition-colors">Réessayer</button>
          <Link to={corePath("/accounts")} className="text-emerald-400 text-[11px] hover:underline">← Comptes</Link>
        </div>
      </div>
    );
  }

  /* ── Computed values ── */
  const acct = data.account;
  const prof = data.profile;
  const clientName = prof ? `${prof.first_name || ""} ${prof.last_name || ""}`.trim() || "Client" : "Client";
  // CANONICAL INVARIANT: paid/void/cancelled invoices NEVER contribute to balance
  const CLOSED_STATUSES = ["paid", "paid_by_promo", "void", "cancelled", "refunded"];
  const unpaidInvoices = data.invoices.filter((inv: any) =>
    !CLOSED_STATUSES.includes(inv.status) && (inv.balance_due ?? 0) > 0
  );
  const totalDue = unpaidInvoices.reduce((sum, inv: any) => sum + (inv.balance_due ?? 0), 0);
  const activeSubs = data.subscriptions.filter((s: any) => s.status === "active");
  const suspendedSubs = data.subscriptions.filter((s: any) => s.status === "suspended");
  const latestKyc = data.kycSessions[0];
  // CANONICAL: Only count confirmed payments in total
  const totalPaid = data.payments
    .filter((p: any) => p.status === "confirmed" || p.status === "completed")
    .reduce((s, p: any) => s + (p.amount ?? 0), 0);
  const monthlyRevenue = activeSubs.reduce((s, sub: any) => s + (sub.plan_price ?? 0), 0);
  const openTickets = data.tickets.filter((t: any) => ["open", "in_progress", "waiting_client"].includes(t.status));
  const now = new Date();
  const upcomingAppts = data.appointments.filter((a: any) => a.scheduled_at && new Date(a.scheduled_at) >= now);
  const recentPayments = data.payments.filter((p: any) => {
    if (!p.created_at) return false;
    const d = new Date(p.created_at);
    return (now.getTime() - d.getTime()) < 30 * 24 * 60 * 60 * 1000;
  });

  /* ── Section badge counts ── */
  const sectionCounts: Partial<Record<SectionId, number>> = {
    subscriptions: data.subscriptions.length,
    orders: data.orders.length,
    invoices: data.invoices.length,
    payments: data.payments.length,
    equipment: data.equipment.length,
    tickets: data.tickets.length,
    appointments: data.appointments.length,
    kyc: data.kycSessions.length,
    timeline: data.activityLogs.length,
  };

  const actionProps = {
    customerId: data.customerId,
    clientId: data.clientId,
    clientEmail: prof?.email,
    clientName,
    accountId,
    onRefresh: data.refetch,
  };

  const renderSection = () => {
    switch (activeSection) {
      case "profile": return <ProfileSection data={data} acct={acct} prof={prof} clientName={clientName} />;
      case "billing": return <BillingSection acct={acct} data={data} totalDue={totalDue} monthlyRevenue={monthlyRevenue} unpaidInvoices={unpaidInvoices} totalPaid={totalPaid} />;
      case "subscriptions": return <SubscriptionsSection data={data} customerId={data.customerId} onRefresh={data.refetch} />;
      case "orders": return <OrdersSection data={data} accountId={accountId} clientId={data.clientId} clientEmail={prof?.email} clientName={clientName} onRefresh={data.refetch} />;
      case "invoices": return <InvoicesSection data={data} customerId={data.customerId} customerUserId={data.clientId} profileEmail={prof?.email} billingCustomerEmail={data.billingCustomer?.email} onRefresh={data.refetch} />;
      case "payments": return <PaymentsSection data={data} customerId={data.customerId} customerUserId={data.clientId} profileEmail={prof?.email} billingCustomerEmail={data.billingCustomer?.email} onRefresh={data.refetch} />;
      case "kyc": return <KycSection data={data} />;
      case "equipment": return <EquipmentSection data={data} accountId={accountId} onRefresh={data.refetch} />;
      case "appointments": return <AppointmentsSection data={data} {...actionProps} />;
      case "contracts": return <ContractsSection data={data} />;
      case "financial_docs": return <FinancialDocsSection data={data} acct={acct} prof={prof} clientName={clientName} />;
      case "admin_docs": return <AdminDocsSection data={data} acct={acct} prof={prof} clientName={clientName} />;
      case "tickets": return <TicketsSection data={data} {...actionProps} />;
      case "timeline": return <TimelineSection data={data} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-3">
      {/* Header with identity banner */}
      <Account360Header
        account={acct}
        profile={prof}
        clientName={clientName}
        latestKyc={latestKyc}
        totalDue={totalDue}
        monthlyRevenue={monthlyRevenue}
        unpaidCount={unpaidInvoices.length}
        subscriptions={data.subscriptions}
        onRefresh={data.refetch}
      />

      {/* KPI strip */}
      <Account360KPIStrip
        activeSubs={activeSubs.length}
        suspendedSubs={suspendedSubs.length}
        unpaidInvoices={unpaidInvoices.length}
        recentPayments={recentPayments.length}
        openTickets={openTickets.length}
        upcomingAppointments={upcomingAppts.length}
        equipmentCount={data.equipment.length}
        ordersCount={data.orders.length}
      />

      {/* Quick actions bar */}
      <Account360QuickActions
        accountId={accountId}
        clientId={data.clientId}
        accountStatus={acct.status}
        customerId={data.customerId}
        clientName={clientName}
        clientEmail={data.profile?.email || data.billingCustomer?.email || null}
        monthlyRevenue={Number(data.subscriptions?.reduce((sum: number, s: any) => sum + (s.status === "active" ? Number(s.plan_price || 0) : 0), 0) || 0)}
        subscriptions={data.subscriptions}
        canonicalData={data}
        onRefresh={data.refetch}
        onNavigateSection={(s) => setActiveSection(s as SectionId)}
        onEditProfile={() => setEditProfileOpen(true)}
      />

      {/* Active manual adjustments (credits / fees) */}
      <AccountAdjustmentsList accountId={accountId} />

      {/* Always-visible payment history for the Account 360 page used by Core staff */}
      <ClientPaymentsHistory
        billingCustomerId={data.customerId}
        userId={data.clientId}
        fallbackEmail={data.profile?.email || data.billingCustomer?.email || null}
        invoiceHref={(invoiceId) => corePath(`/invoices/${invoiceId}`)}
      />

      {/* 3-column layout: Nav | Content | Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-[210px_1fr_280px] gap-3">
        {/* LEFT: Section Navigation */}
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] self-start lg:sticky lg:top-4">
          <div className="px-3 py-2.5 border-b border-[hsl(220,15%,14%)]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-core-text-label">Dossier client</span>
          </div>
          <nav className="py-1">
            {SECTIONS.map(s => {
              const isActive = activeSection === s.id;
              const count = sectionCounts[s.id];
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-[11px] font-semibold transition-colors ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-300 border-l-2 border-emerald-400"
                      : "text-core-text-secondary hover:text-core-text-primary hover:bg-[hsl(220,20%,13%)] border-l-2 border-transparent"
                  }`}
                >
                  <s.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-left truncate">{s.label}</span>
                  {count != null && count > 0 && (
                    <span className={`text-[9px] tabular-nums px-1.5 py-0.5 rounded-full font-medium ${
                      isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-[hsl(220,15%,14%)] text-core-text-label"
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* CENTER: Active Section Content */}
        <div className="min-h-[500px] min-w-0">
          {renderSection()}
        </div>

        {/* RIGHT: Persistent Summary Panel */}
        <Account360RightPanel
          account={acct}
          profile={prof}
          clientName={clientName}
          latestKyc={latestKyc}
          totalDue={totalDue}
          totalPaid={totalPaid}
          monthlyRevenue={monthlyRevenue}
          unpaidCount={unpaidInvoices.length}
          accountId={accountId}
          clientId={data.clientId}
          subscriptions={data.subscriptions}
          creditScore={data.creditScore}
          onRefresh={data.refetch}
        />
      </div>

      <Account360ProfileEditDialog
        open={editProfileOpen}
        onOpenChange={setEditProfileOpen}
        account={acct}
        profile={prof}
        clientId={data.clientId}
        onSaved={data.refetch}
      />
    </div>
  );
};

export default CoreAccountDetail;
