/**
 * EmployeeClientDetail — Phase 4: Full customer-service workspace.
 * Uses shared-ops + CreateTicketDialog + EmployeePinReset + EscalationRequestDialog + DocumentActions.
 */
import { useParams, Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Loader2, User, ShoppingCart, FileText, CreditCard,
  MapPin, Zap, MessageSquare, Shield, Clock, ChevronRight,
  Phone, Mail, Hash, Plus, AlertTriangle, Key,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { CustomerPinGate } from "@/employee-app/components/CustomerPinGate";
import { CreateTicketDialog } from "@/employee-app/components/CreateTicketDialog";
import { EmployeePinReset } from "@/employee-app/components/EmployeePinReset";
import { EscalationRequestDialog } from "@/employee-app/components/EscalationRequestDialog";
import { DocumentActions } from "@/employee-app/components/DocumentActions";
import { useClientProfile, addOperationalNote } from "@/shared-ops";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

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
  const [noteText, setNoteText] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [showEscalation, setShowEscalation] = useState(false);

  // Employee-specific: tickets + notes + locations (not in shared-ops since they're portal-specific)
  const { data: extras } = useQuery({
    queryKey: ["employee-client-extras", clientId],
    enabled: !!data?.profile,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const accountId = data?.account?.id;
      const [ticketsRes, notesRes, locationsRes] = await Promise.all([
        supabase.from("support_tickets")
          .select("id, ticket_number, subject, status, priority, created_at")
          .eq("user_id", clientId)
          .order("created_at", { ascending: false }).limit(10),
        supabase.from("activity_logs")
          .select("action, created_at, actor_name, actor_role")
          .eq("entity_id", clientId).eq("entity_type", "client")
          .order("created_at", { ascending: false }).limit(10),
        accountId
          ? supabase.from("account_service_locations").select("*").eq("account_id", accountId).eq("is_active", true)
          : Promise.resolve({ data: [] }),
      ]);
      return {
        tickets: ticketsRes.data ?? [],
        notes: notesRes.data ?? [],
        locations: locationsRes.data ?? [],
      };
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (note: string) =>
      addOperationalNote({ entityId: clientId, entityType: "client", note, portal: "employee" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-client-extras", clientId] });
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

  const { profile, account, orders, invoices, subscriptions } = data;
  const tickets = extras?.tickets ?? [];
  const notes = extras?.notes ?? [];
  const locations = extras?.locations ?? [];
  const fmtMoney = (v: number | null | undefined) => v != null ? `${v.toFixed(2)} $` : "—";

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      active: "text-emerald-400 bg-emerald-500/10",
      pending: "text-amber-400 bg-amber-500/10",
      suspended: "text-red-400 bg-red-500/10",
      completed: "text-emerald-400 bg-emerald-500/10",
      cancelled: "text-[hsl(220,10%,40%)] bg-[hsl(220,15%,13%)]",
      open: "text-blue-400 bg-blue-500/10",
      in_progress: "text-indigo-400 bg-indigo-500/10",
      paid: "text-emerald-400 bg-emerald-500/10",
    };
    return (
      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", colors[s] ?? "text-[hsl(220,10%,50%)] bg-[hsl(220,15%,13%)]")}>
        {s}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <Link to={employeePath("/clients")} className="inline-flex items-center gap-1.5 text-[11px] text-[hsl(220,10%,45%)] hover:text-white transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Clients
      </Link>

      {/* Client header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-blue-600/10 flex items-center justify-center border border-blue-500/20">
            <User className="h-7 w-7 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{profile.full_name ?? "Client"}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {profile.email && (
                <span className="flex items-center gap-1 text-xs text-[hsl(220,10%,50%)]">
                  <Mail className="h-3 w-3" /> {profile.email}
                </span>
              )}
              {profile.phone && (
                <span className="flex items-center gap-1 text-xs text-[hsl(220,10%,50%)]">
                  <Phone className="h-3 w-3" /> {profile.phone}
                </span>
              )}
              {account?.account_number && (
                <span className="flex items-center gap-1 text-xs font-mono text-[hsl(220,10%,50%)]">
                  <Hash className="h-3 w-3" /> {account.account_number}
                </span>
              )}
            </div>
          </div>
        </div>
        {account?.status && statusBadge(account.status)}
      </div>

      {/* Customer 360 Quick Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowNoteInput(!showNoteInput)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-xs text-[hsl(220,10%,55%)] hover:text-white hover:border-blue-500/30 transition-colors"
        >
          <MessageSquare className="h-3 w-3" /> Ajouter note
        </button>
        {orders.length > 0 && (
          <button
            onClick={() => navigate(employeePath(`/orders/${orders[0].order_number ?? orders[0].id}`))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-xs text-[hsl(220,10%,55%)] hover:text-white hover:border-blue-500/30 transition-colors"
          >
            <ShoppingCart className="h-3 w-3" /> Dernière commande
          </button>
        )}
        {invoices.length > 0 && (
          <button
            onClick={() => navigate(employeePath(`/invoices/${invoices[0].id}`))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-xs text-[hsl(220,10%,55%)] hover:text-white hover:border-blue-500/30 transition-colors"
          >
            <FileText className="h-3 w-3" /> Dernière facture
          </button>
        )}
        {subscriptions.length > 0 && (
          <button
            onClick={() => navigate(employeePath(`/subscriptions/${subscriptions[0].id}`))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-xs text-[hsl(220,10%,55%)] hover:text-white hover:border-blue-500/30 transition-colors"
          >
            <Zap className="h-3 w-3" /> Abonnement actif
          </button>
        )}
        <button
          onClick={() => setShowCreateTicket(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-xs text-[hsl(220,10%,55%)] hover:text-white hover:border-blue-500/30 transition-colors"
        >
          <Plus className="h-3 w-3" /> Créer ticket
        </button>
        <button
          onClick={() => setShowEscalation(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-xs text-amber-400/70 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
        >
          <AlertTriangle className="h-3 w-3" /> Escalation Core
        </button>
      </div>

      {/* Dialogs */}
      {showCreateTicket && (
        <CreateTicketDialog
          clientId={clientId}
          clientName={profile.full_name ?? undefined}
          clientEmail={profile.email ?? undefined}
          onClose={() => setShowCreateTicket(false)}
        />
      )}
      {showEscalation && (
        <EscalationRequestDialog
          clientId={clientId}
          clientName={profile.full_name ?? undefined}
          accountNumber={account?.account_number}
          onClose={() => setShowEscalation(false)}
        />
      )}

      {/* Note input */}
      {showNoteInput && (
        <div className="flex gap-2">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
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

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: Services + Billing + Orders */}
        <div className="lg:col-span-2 space-y-4">
          {/* Active subscriptions */}
          <Section title="Services actifs" icon={<Zap className="h-4 w-4" />}>
            {subscriptions.length === 0 ? (
              <p className="text-xs text-[hsl(220,10%,30%)]">Aucun service actif.</p>
            ) : (
              <div className="space-y-2">
                {subscriptions.map((s: any) => (
                  <Link
                    key={s.id}
                    to={employeePath(`/subscriptions/${s.id}`)}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,11%)] hover:border-blue-500/30 transition-colors"
                  >
                    <div>
                      <p className="text-xs text-white font-medium">{s.plan_name}</p>
                      <p className="text-[10px] text-[hsl(220,10%,40%)]">{fmtMoney(s.plan_price)}/mois</p>
                    </div>
                    {statusBadge(s.status ?? "active")}
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* Billing summary — READ ONLY with invoice links */}
          <Section title="Facturation (lecture seule)" icon={<CreditCard className="h-4 w-4" />} locked>
            {invoices.length === 0 ? (
              <p className="text-xs text-[hsl(220,10%,30%)]">Aucune facture.</p>
            ) : (
              <div className="space-y-1.5">
                {invoices.map((inv: any) => (
                  <Link
                    key={inv.id}
                    to={employeePath(`/invoices/${inv.id}`)}
                    className="flex items-center justify-between py-1.5 text-xs border-b border-[hsl(220,15%,10%)] last:border-0 hover:text-blue-400 transition-colors"
                  >
                    <span className="text-white font-mono">{inv.invoice_number}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[hsl(220,10%,50%)]">{fmtMoney(inv.total)}</span>
                      {statusBadge(inv.status ?? "draft")}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* Orders */}
          <Section title="Commandes" icon={<ShoppingCart className="h-4 w-4" />}>
            {orders.length === 0 ? (
              <p className="text-xs text-[hsl(220,10%,30%)]">Aucune commande.</p>
            ) : (
              <div className="space-y-1.5">
                {orders.map((o: any) => (
                  <Link
                    key={o.id}
                    to={employeePath(`/orders/${o.order_number ?? o.id}`)}
                    className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-[hsl(220,15%,10%)] transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-white font-mono">{o.order_number ?? "—"}</span>
                      <span className="text-[hsl(220,10%,40%)]">{o.service_type ?? ""}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(o.status)}
                      <ChevronRight className="h-3 w-3 text-[hsl(220,10%,25%)]" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* Service locations */}
          {locations.length > 0 && (
            <Section title="Adresses de service" icon={<MapPin className="h-4 w-4" />}>
              {locations.map((loc: any) => (
                <div key={loc.id} className="flex items-start gap-2 py-1.5 text-xs border-b border-[hsl(220,15%,10%)] last:border-0">
                  <MapPin className="h-3 w-3 text-[hsl(220,10%,30%)] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-white">{loc.service_address}</p>
                    <p className="text-[hsl(220,10%,40%)]">{[loc.service_city, loc.service_province, loc.service_postal_code].filter(Boolean).join(", ")}</p>
                  </div>
                </div>
              ))}
            </Section>
          )}
        </div>

        {/* RIGHT: Tickets + Activity + PIN + Documents */}
        <div className="space-y-4">
          {/* Documents */}
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

          {/* PIN Reset */}
          <EmployeePinReset customerId={clientId} customerName={profile.full_name ?? undefined} />

          {/* Tickets */}
          <Section title="Tickets" icon={<FileText className="h-4 w-4" />}>
            {tickets.length === 0 ? (
              <p className="text-xs text-[hsl(220,10%,30%)]">Aucun ticket.</p>
            ) : (
              <div className="space-y-2">
                {tickets.map((t: any) => (
                  <Link key={t.id} to={employeePath(`/support/${t.id}`)}
                    className="block p-2.5 rounded-lg bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,11%)] hover:border-blue-500/20 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-white font-medium">{t.subject ?? t.ticket_number}</p>
                        <p className="text-[10px] text-[hsl(220,10%,35%)] mt-0.5">
                          {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                      {statusBadge(t.status ?? "open")}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* Activity */}
          <Section title="Activité" icon={<Clock className="h-4 w-4" />}>
            {notes.length === 0 ? (
              <p className="text-xs text-[hsl(220,10%,30%)]">Aucune activité enregistrée.</p>
            ) : (
              <div className="space-y-0 max-h-[400px] overflow-y-auto pr-1">
                {notes.map((n: any, i: number) => {
                  const isNote = n.action?.startsWith("Note:");
                  return (
                    <div key={i} className="relative pl-4 pb-3 last:pb-0">
                      {i < notes.length - 1 && (
                        <div className="absolute left-[5px] top-[10px] bottom-0 w-px bg-[hsl(220,15%,12%)]" />
                      )}
                      <div className={cn(
                        "absolute left-0 top-[5px] h-[10px] w-[10px] rounded-full border-2",
                        isNote ? "bg-blue-500/20 border-blue-500/50" : "bg-[hsl(220,15%,12%)] border-[hsl(220,15%,17%)]"
                      )} />
                      <div>
                        <p className={cn("text-xs font-medium", isNote ? "text-blue-300" : "text-white")}>
                          {isNote ? n.action.replace("Note: ", "") : n.action}
                        </p>
                        <p className="text-[10px] text-[hsl(220,10%,32%)] mt-0.5">
                          {n.actor_name ?? "Système"} · {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children, locked }: { title: string; icon: React.ReactNode; children: React.ReactNode; locked?: boolean }) {
  return (
    <div className="rounded-xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,8%)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[hsl(220,10%,38%)]">{icon}</span>
        <h3 className="text-xs font-semibold text-[hsl(220,10%,55%)] uppercase tracking-wider">{title}</h3>
        {locked && (
          <span className="ml-auto text-[9px] text-[hsl(220,10%,28%)] bg-[hsl(220,15%,11%)] px-1.5 py-0.5 rounded font-mono">
            LECTURE SEULE
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
