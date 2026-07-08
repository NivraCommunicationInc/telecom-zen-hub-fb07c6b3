/**
 * EmployeeClientDetail — Complete Client 360 customer-service workspace.
 * All 12 sections: Header, Alerts, NBA, Quick Actions, Billing, Services,
 * Orders, Support, Appointments, Documents, Equipment, Timeline.
 */
import { useParams, Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Loader2, User, ShoppingCart, FileText, CreditCard,
  Zap, MessageSquare, Clock, ChevronRight, Calendar, Cpu,
  Phone, Mail,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { StatusBadge } from "@/employee-app/components/StatusBadge";
import { CustomerPinGate } from "@/employee-app/components/CustomerPinGate";
import { CreateTicketDialog } from "@/employee-app/components/CreateTicketDialog";
import { EmployeePinReset } from "@/employee-app/components/EmployeePinReset";
import { EscalationRequestDialog } from "@/employee-app/components/EscalationRequestDialog";
import { DocumentActions } from "@/employee-app/components/DocumentActions";
import { EmployeeSquarePaymentDialog } from "@/employee-app/components/EmployeeSquarePaymentDialog";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";
import { KYCRequestDialog } from "@/employee-app/components/KYCRequestDialog";
import { useClientProfile, addOperationalNote } from "@/shared-ops";
import { AccountDocumentsDialog } from "@/shared-ops/components/AccountDocumentsDialog";
import { supabase } from "@/integrations/supabase/client";
import { CustomerTimeline } from "@/components/employee/CustomerTimeline";

// Sub-components
import { ClientHeader } from "@/employee-app/components/client360/ClientHeader";
import { AlertBanner } from "@/employee-app/components/client360/AlertBanner";
import { NextBestAction } from "@/employee-app/components/client360/NextBestAction";
import { QuickActions } from "@/employee-app/components/client360/QuickActions";
import { Section } from "@/employee-app/components/client360/Section";

export default function EmployeeClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  if (!clientId) {
    return (
      <div className="py-20 text-center">
        <User className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,30%)]" />
        <p className="text-sm text-[hsl(220,10%,40%)]">Client introuvable</p>
      </div>
    );
  }
  return (
    <CustomerPinGate customerId={clientId}>
      <ClientDetailContent clientId={clientId} />
    </CustomerPinGate>
  );
}

function ClientDetailContent({ clientId }: { clientId: string }) {
  const { data, isLoading } = useClientProfile(clientId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // UI state
  const [noteText, setNoteText] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showEscalation, setShowEscalation] = useState(false);
  const [showPinReset, setShowPinReset] = useState(false);
  const [escalationPreset, setEscalationPreset] = useState<{ category: string; subject: string; desc: string } | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
  const [showKycRequest, setShowKycRequest] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);

  // Realtime: keep client 360 in sync with Core changes
  usePortalRealtime(
    ["orders", "accounts", "support_tickets", "kyc_verifications", "appointments"],
    [
      ["employee-client-360-extras", clientId],
      ["shared-client-profile", clientId],
    ],
  );

  // Extra data: tickets, notes, appointments, locations
  const { data: extras } = useQuery({
    queryKey: ["employee-client-360-extras", clientId],
    enabled: !!data?.profile,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const accountId = data?.account?.id;
      const orderIds = data?.orders?.map((o: any) => o.id) ?? [];

      const [ticketsRes, notesRes, locationsRes, appointmentsRes, auditRes] = await Promise.all([
        supabase.from("support_tickets")
          .select("id, ticket_number, subject, status, priority, created_at, category")
          .eq("user_id", clientId)
          .order("created_at", { ascending: false }).limit(10),
        supabase.from("activity_logs")
          .select("action, created_at, actor_name, actor_role, entity_type, details")
          .or(`entity_id.eq.${clientId},user_id.eq.${clientId}`)
          .order("created_at", { ascending: false }).limit(25),
        accountId
          ? supabase.from("service_addresses").select("id, account_id, label, is_active, created_at, service_address:address_line, service_city:city, service_province:province, service_postal_code:postal_code, deleted_at").eq("account_id", accountId).eq("is_active", true).is("deleted_at", null)
          : Promise.resolve({ data: [] }),
        orderIds.length > 0
          ? supabase.from("appointments")
              .select("id, appointment_number, title, scheduled_at, status, service_address, service_city, service_type, technician_id")
              .in("order_id", orderIds)
              .order("scheduled_at", { ascending: false }).limit(10)
          : supabase.from("appointments")
              .select("id, appointment_number, title, scheduled_at, status, service_address, service_city, service_type, technician_id")
              .eq("client_id", clientId)
              .order("scheduled_at", { ascending: false }).limit(10),
        supabase.from("internal_audit_log" as any)
          .select("action, created_at")
          .eq("target_id", clientId)
          .order("created_at", { ascending: false }).limit(5),
      ]);

      return {
        tickets: ticketsRes.data ?? [],
        notes: notesRes.data ?? [],
        locations: locationsRes.data ?? [],
        appointments: appointmentsRes.data ?? [],
        recentAudit: auditRes.data ?? [],
      };
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (note: string) =>
      addOperationalNote({ entityId: clientId, entityType: "client", note, portal: "employee" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-client-360-extras", clientId] });
      setNoteText("");
      setShowNoteInput(false);
      toast.success("Note ajoutée");
    },
    onError: (err: any) => toast.error(`Erreur: ${err.message}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-[hsl(220,10%,40%)]">Client introuvable.</p>
        <Link to={employeePath("/clients")} className="text-blue-400 text-xs mt-2 inline-block hover:underline">← Retour</Link>
      </div>
    );
  }

  const { profile, account, orders, invoices, payments, subscriptions, equipment, billingCustomer } = data;
  const tickets = extras?.tickets ?? [];
  const notes = extras?.notes ?? [];
  const locations = extras?.locations ?? [];
  const appointments = extras?.appointments ?? [];
  const recentAudit = extras?.recentAudit ?? [];

  const fmtMoney = (v: number | null | undefined) => v != null ? `${v.toFixed(2)} $` : "—";
  const unpaidInvoices = invoices.filter((inv: any) => (inv.balance_due ?? 0) > 0 && inv.status !== "paid" && inv.status !== "void");
  const totalBalance = unpaidInvoices.reduce((sum: number, i: any) => sum + (i.balance_due ?? i.total ?? 0), 0);
  const primaryAddress = locations[0] ? `${locations[0].service_address}, ${locations[0].service_city ?? ""}` : account?.primary_service_address ?? undefined;
  const openTickets = tickets.filter((t: any) => t.status !== "resolved" && t.status !== "closed");

  const handleEscalationPreset = (category: string, subject: string, desc: string) => {
    setEscalationPreset({ category, subject, desc });
    setShowEscalation(true);
  };

  return (
    <div className="space-y-3 max-w-[1400px]">
      {/* Back */}
      <Link to={employeePath("/clients")} className="inline-flex items-center gap-1.5 text-[11px] text-[hsl(220,10%,45%)] hover:text-white transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Clients
      </Link>

      {/* 1. Client header */}
      <ClientHeader profile={profile} account={account} subscriptions={subscriptions} address={primaryAddress} />

      {/* 2. Alert banner */}
      <AlertBanner
        invoices={invoices} subscriptions={subscriptions} appointments={appointments}
        tickets={tickets} orders={orders} recentAudit={recentAudit}
      />

      {/* 3. Next Best Action */}
      <NextBestAction
        invoices={invoices} subscriptions={subscriptions} orders={orders} appointments={appointments}
        onRecordPayment={() => unpaidInvoices[0] && setPaymentInvoice(unpaidInvoices[0])}
      />

      {/* 4. Quick Actions bar */}
      <QuickActions
        clientId={clientId} clientEmail={profile?.email} clientName={profile?.full_name ?? undefined}
        account={account} orders={orders} invoices={invoices}
        subscriptions={subscriptions} appointments={appointments} tickets={tickets}
        unpaidCount={unpaidInvoices.length}
        onAddNote={() => setShowNoteInput(!showNoteInput)}
        onCreateTicket={() => setShowCreateTicket(true)}
        onEscalation={() => { setEscalationPreset(null); setShowEscalation(true); }}
        onRecordPayment={() => unpaidInvoices[0] && setPaymentInvoice(unpaidInvoices[0])}
        onPinReset={() => setShowPinReset(!showPinReset)}
        onEscalationPreset={handleEscalationPreset}
      />
      <div className="flex justify-end">
        <button
          onClick={() => setShowKycRequest(true)}
          className="min-h-[44px] rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 text-xs font-medium text-blue-300 hover:bg-blue-500/20 transition-colors"
        >
          Demander vérification KYC
        </button>
      </div>

      {/* Dialogs */}
      {showCreateTicket && (
        <CreateTicketDialog clientId={clientId} clientName={profile.full_name ?? undefined} clientEmail={profile.email ?? undefined} onClose={() => setShowCreateTicket(false)} />
      )}
      <KYCRequestDialog open={showKycRequest} onOpenChange={setShowKycRequest} clientId={clientId} accountId={account?.id} clientName={profile.full_name} clientEmail={profile.email} />
      {showEscalation && (
        <EscalationRequestDialog
          clientId={clientId} clientName={profile.full_name ?? undefined} accountNumber={account?.account_number}
          initialCategory={escalationPreset?.category} initialSubject={escalationPreset?.subject} initialDescription={escalationPreset?.desc}
          onClose={() => { setShowEscalation(false); setEscalationPreset(null); }}
        />
      )}
      {paymentInvoice && (
        <EmployeeSquarePaymentDialog
          open={!!paymentInvoice}
          onOpenChange={(o) => { if (!o) setPaymentInvoice(null); }}
          invoice={{ ...paymentInvoice, customer_id: paymentInvoice.customer_id ?? billingCustomer?.id ?? "" }}
          clientEmail={profile.email ?? undefined}
          clientName={profile.full_name ?? undefined}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["shared-client-profile", clientId] })}
        />
      )}

      {/* Note input */}
      {showNoteInput && (
        <div className="flex gap-2">
          <input
            type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)}
            placeholder="Écrire une note interne…"
            className="flex-1 px-3 py-2 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-sm text-white placeholder:text-[hsl(220,10%,30%)] focus:outline-none focus:border-blue-500/50"
            onKeyDown={(e) => e.key === "Enter" && noteText.trim() && addNoteMutation.mutate(noteText.trim())}
          />
          <button
            onClick={() => noteText.trim() && addNoteMutation.mutate(noteText.trim())}
            disabled={addNoteMutation.isPending || !noteText.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-xs text-white font-medium hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            {addNoteMutation.isPending ? "…" : "Envoyer"}
          </button>
        </div>
      )}

      {/* PIN Reset */}
      {showPinReset && (
        <EmployeePinReset customerId={clientId} customerName={profile.full_name ?? undefined} />
      )}

      {/* Main grid: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* LEFT COLUMN: Primary operational sections */}
        <div className="lg:col-span-2 space-y-3">

          {/* 5. Billing section */}
          <Section
            title="Facturation" icon={<CreditCard className="h-4 w-4" />}
            badge={totalBalance > 0 ? `${totalBalance.toFixed(2)} $ dû` : undefined}
            badgeColor={totalBalance > 0 ? "text-red-400 bg-red-500/10" : undefined}
          >
            {invoices.length === 0 ? (
              <p className="text-xs text-[hsl(220,10%,30%)]">Aucune facture.</p>
            ) : (
              <div className="space-y-1">
                {/* Latest payment */}
                {payments.length > 0 && (
                  <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-[hsl(220,20%,6%)] mb-2">
                    <span className="text-[10px] text-[hsl(220,10%,40%)]">Dernier paiement</span>
                    <span className="text-xs text-emerald-400 font-mono">{fmtMoney(payments[0].amount)} · {payments[0].method}</span>
                  </div>
                )}
                {invoices.slice(0, 5).map((inv: any) => (
                  <Link
                    key={inv.id} to={employeePath(`/invoices/${inv.id}`)}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[hsl(220,15%,10%)] transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono text-[11px]">{inv.invoice_number}</span>
                      <span className="text-[hsl(220,10%,35%)]">{inv.due_date ? format(new Date(inv.due_date), "dd MMM yyyy", { locale: fr }) : ""}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-[hsl(220,10%,50%)]">{fmtMoney(inv.total)}</span>
                      <StatusBadge status={inv.status} />
                      {(inv.balance_due ?? 0) > 0 && inv.status !== "paid" && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPaymentInvoice(inv); }}
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                        >
                          PAYER
                        </button>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* 6. Services section */}
          <Section
            title="Services" icon={<Zap className="h-4 w-4" />}
            badge={subscriptions.length || undefined}
          >
            {subscriptions.length === 0 ? (
              <p className="text-xs text-[hsl(220,10%,30%)]">Aucun service.</p>
            ) : (
              <div className="space-y-1.5">
                {subscriptions.map((s: any) => (
                  <Link
                    key={s.id} to={employeePath(`/subscriptions/${s.id}`)}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[hsl(220,20%,6%)] border border-[hsl(220,15%,10%)] hover:border-blue-500/20 transition-colors"
                  >
                    <div>
                      <p className="text-xs text-white font-medium">{s.plan_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[hsl(220,10%,40%)]">{fmtMoney(s.plan_price)}/mois</span>
                        {s.cycle_start_date && (
                          <span className="text-[10px] text-[hsl(220,10%,30%)]">
                            Cycle: {format(new Date(s.cycle_start_date), "dd MMM", { locale: fr })} — {s.cycle_end_date ? format(new Date(s.cycle_end_date), "dd MMM", { locale: fr }) : ""}
                          </span>
                        )}
                        {s.next_renewal_at && (
                          <span className="text-[10px] text-blue-400/50">Renouvellement: {format(new Date(s.next_renewal_at), "dd MMM yyyy", { locale: fr })}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={s.status} />
                      <ChevronRight className="h-3 w-3 text-[hsl(220,10%,20%)]" />
                    </div>
                  </Link>
                ))}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => handleEscalationPreset("add_service", "Ajout de service", `Client: ${profile.full_name}`)}
                    className="text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors"
                  >
                    + Ajout de service
                  </button>
                  <button
                    onClick={() => handleEscalationPreset("service_change", "Modification de service", `Client: ${profile.full_name}`)}
                    className="text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors"
                  >
                    ✎ Modifier un service
                  </button>
                  <button
                    onClick={() => handleEscalationPreset("tv_channel_change", "Changement de chaînes TV", `Client: ${profile.full_name}`)}
                    className="text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors"
                  >
                    📺 Chaînes TV
                  </button>
                  <Link
                    to={employeePath(`/orders/new?clientId=${clientId}`)}
                    className="text-[10px] text-blue-400/60 hover:text-blue-400 transition-colors"
                  >
                    + Nouvelle commande
                  </Link>
                </div>
              </div>
            )}
          </Section>

          {/* 7. Orders section */}
          <Section title="Commandes" icon={<ShoppingCart className="h-4 w-4" />} badge={orders.length || undefined}>
            {orders.length === 0 ? (
              <p className="text-xs text-[hsl(220,10%,30%)]">Aucune commande.</p>
            ) : (
              <div className="space-y-1">
                {orders.slice(0, 8).map((o: any) => (
                  <Link
                    key={o.id} to={employeePath(`/orders/${o.order_number ?? o.id}`)}
                    className="flex items-center justify-between py-2 px-2 rounded hover:bg-[hsl(220,15%,10%)] transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-white font-mono text-[11px]">{o.order_number ?? "—"}</span>
                      <span className="text-[hsl(220,10%,35%)]">{o.service_type ?? ""}</span>
                      <span className="text-[hsl(220,10%,25%)] text-[10px]">
                        {format(new Date(o.created_at), "dd MMM yyyy", { locale: fr })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[hsl(220,10%,40%)]">{fmtMoney(o.total_amount)}</span>
                      <StatusBadge status={o.status} />
                      <ChevronRight className="h-3 w-3 text-[hsl(220,10%,20%)]" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* 8. Support section */}
          <Section
            title="Support" icon={<MessageSquare className="h-4 w-4" />}
            badge={openTickets.length > 0 ? `${openTickets.length} ouvert${openTickets.length > 1 ? "s" : ""}` : undefined}
            badgeColor={openTickets.length > 0 ? "text-amber-400 bg-amber-500/10" : undefined}
          >
            {tickets.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-[hsl(220,10%,30%)]">Aucun ticket.</p>
                <button onClick={() => setShowCreateTicket(true)} className="text-[10px] text-blue-400 hover:underline">
                  + Créer un ticket
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {tickets.map((t: any) => (
                  <Link
                    key={t.id} to={employeePath(`/support/${t.id}`)}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[hsl(220,20%,6%)] border border-[hsl(220,15%,10%)] hover:border-blue-500/20 transition-colors"
                  >
                    <div>
                      <p className="text-xs text-white font-medium">{t.subject ?? t.ticket_number}</p>
                      <p className="text-[10px] text-[hsl(220,10%,35%)] mt-0.5">
                        {t.category && <span className="capitalize">{t.category} · </span>}
                        {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={t.status} />
                      {t.priority === "urgent" && (
                        <span className="text-[9px] font-bold text-red-400">URGENT</span>
                      )}
                    </div>
                  </Link>
                ))}
                <button onClick={() => setShowCreateTicket(true)} className="text-[10px] text-blue-400 hover:underline">
                  + Créer un ticket
                </button>
              </div>
            )}
          </Section>
        </div>

        {/* RIGHT COLUMN: Contextual info */}
        <div className="space-y-3">

          {/* 9. Appointments section */}
          <Section title="Rendez-vous" icon={<Calendar className="h-4 w-4" />} badge={appointments.length || undefined}>
            {appointments.length === 0 ? (
              <p className="text-xs text-[hsl(220,10%,30%)]">Aucun rendez-vous.</p>
            ) : (
              <div className="space-y-1.5">
                {appointments.slice(0, 5).map((a: any) => (
                  <Link
                    key={a.id} to={employeePath(`/appointments/${a.id}`)}
                    className="block p-2.5 rounded-lg bg-[hsl(220,20%,6%)] border border-[hsl(220,15%,10%)] hover:border-blue-500/20 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-white font-medium truncate">{a.title}</p>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="text-[10px] text-[hsl(220,10%,40%)] mt-0.5">
                      {format(new Date(a.scheduled_at), "dd MMM yyyy HH:mm", { locale: fr })}
                    </p>
                    {a.service_address && (
                      <p className="text-[10px] text-[hsl(220,10%,30%)] mt-0.5 truncate">{a.service_address}</p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* 10. Documents section */}
          <Section title="Documents" icon={<FileText className="h-4 w-4" />}>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowDocuments(true)}
                className="w-full text-left px-3 py-2 rounded-lg bg-[hsl(220,20%,6%)] border border-[hsl(220,15%,10%)] hover:border-violet-500/40 transition-colors flex items-center justify-between"
              >
                <span className="text-xs text-white">Voir tous les documents (contrats, factures, reçus, KYC…)</span>
                <ChevronRight className="h-4 w-4 text-[hsl(220,10%,40%)]" />
              </button>
              {orders.length > 0 && (
                <DocumentActions
                  orderId={orders[0].id}
                  invoiceId={invoices[0]?.id}
                  clientEmail={profile.email ?? undefined}
                  clientName={profile.full_name ?? undefined}
                  orderNumber={orders[0].order_number}
                  invoiceNumber={invoices[0]?.invoice_number}
                />
              )}
            </div>
          </Section>

          {/* 11. Equipment section */}
          <Section title="Équipement" icon={<Cpu className="h-4 w-4" />} badge={equipment.length || undefined}>
            {equipment.length === 0 ? (
              <p className="text-xs text-[hsl(220,10%,30%)]">Aucun équipement assigné.</p>
            ) : (
              <div className="space-y-1.5">
                {equipment.map((eq: any) => (
                  <div key={eq.id} className="p-2.5 rounded-lg bg-[hsl(220,20%,6%)] border border-[hsl(220,15%,10%)]">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-white font-medium">{eq.catalog_name ?? eq.category ?? "Équipement"}</p>
                      <StatusBadge status={eq.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {eq.serial_number && (
                        <span className="text-[10px] text-[hsl(220,10%,40%)] font-mono">S/N: {eq.serial_number}</span>
                      )}
                      {eq.mac_address && (
                        <span className="text-[10px] text-[hsl(220,10%,40%)] font-mono">MAC: {eq.mac_address}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* 12. Timeline section — unified across 6 sources via v_customer_timeline.
              Previously read from activity_logs only; now also surfaces billing
              subscription changes, payments, support tickets, cancellation runs
              and referral events in one chronological feed. */}
          <Section title="Chronologie du client" icon={<Clock className="h-4 w-4" />} defaultOpen={true}>
            <div className="max-h-[600px] overflow-y-auto pr-1">
              <CustomerTimeline clientId={clientId} limit={50} />
            </div>
          </Section>
        </div>
      </div>

      <AccountDocumentsDialog
        open={showDocuments}
        onClose={() => setShowDocuments(false)}
        clientUserId={clientId}
        clientName={profile.full_name || profile.email || "Client"}
        accountId={account?.id ?? null}
        initialData={data}
        isAdmin={false}
        isStaff={true}
      />
    </div>
  );
}
