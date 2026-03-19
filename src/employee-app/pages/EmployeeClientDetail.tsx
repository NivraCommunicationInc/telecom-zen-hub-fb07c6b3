/**
 * EmployeeClientDetail — Phase 2: Enhanced 360° client profile.
 * Better account/service info, billing summary (read-only), notes, linked activity.
 */
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Loader2, User, ShoppingCart, FileText, CreditCard,
  MapPin, Zap, MessageSquare, Shield, Clock, ChevronRight,
  Phone, Mail, Hash,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { CustomerPinGate } from "@/employee-app/components/CustomerPinGate";

function useClientDetail(clientId: string) {
  return useQuery({
    queryKey: ["employee-client-360", clientId],
    queryFn: async () => {
      const [profileRes, accountRes, ordersRes, ticketsRes, invoicesRes, subscriptionsRes, notesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", clientId).maybeSingle(),
        supabase.from("accounts").select("*").eq("client_id", clientId).maybeSingle(),
        supabase.from("orders")
          .select("id, order_number, status, service_type, payment_status, created_at, total_amount")
          .eq("user_id", clientId).eq("environment", "live")
          .order("created_at", { ascending: false }).limit(10),
        supabase.from("support_tickets")
          .select("id, ticket_number, subject, status, priority, created_at")
          .eq("user_id", clientId)
          .order("created_at", { ascending: false }).limit(10),
        supabase.from("billing_invoices")
          .select("id, invoice_number, total, status, due_date, paid_at, balance_due")
          .eq("environment", "live")
          .order("created_at", { ascending: false }).limit(5),
        supabase.from("billing_subscriptions")
          .select("id, plan_name, plan_price, status, cycle_start_date, cycle_end_date")
          .eq("environment", "live")
          .in("status", ["active", "pending", "past_due"])
          .limit(5),
        supabase.from("activity_logs")
          .select("action, created_at, actor_name, actor_role")
          .eq("entity_id", clientId).eq("entity_type", "client")
          .order("created_at", { ascending: false }).limit(10),
      ]);

      // Get service locations if account exists
      const accountId = accountRes.data?.id;
      const locationsRes = accountId
        ? await supabase.from("account_service_locations").select("*").eq("account_id", accountId).eq("is_active", true)
        : { data: [] };

      return {
        profile: profileRes.data,
        account: accountRes.data,
        orders: ordersRes.data ?? [],
        tickets: ticketsRes.data ?? [],
        invoices: invoicesRes.data ?? [],
        subscriptions: subscriptionsRes.data ?? [],
        notes: notesRes.data ?? [],
        locations: locationsRes.data ?? [],
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

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

  return <ClientDetailContent clientId={clientId} />;
}

function ClientDetailContent({ clientId }: { clientId: string }) {
  const { data, isLoading } = useClientDetail(clientId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Non authentifié");
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", session.user.id).maybeSingle();
      await supabase.from("activity_logs").insert({
        user_id: session.user.id,
        entity_id: clientId,
        entity_type: "client",
        action: `Note: ${note}`,
        actor_name: profile?.full_name ?? session.user.email ?? "Employé",
        actor_role: "employee",
      });
      await logInternalAudit({ action: "add_note", category: "operations", portal: "employee", targetType: "client", targetId: clientId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-client-360", clientId] });
      setNoteText("");
      setShowNoteInput(false);
    },
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

  const { profile, account, orders, tickets, invoices, subscriptions, notes, locations } = data;
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

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowNoteInput(!showNoteInput)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-xs text-[hsl(220,10%,55%)] hover:text-white hover:border-blue-500/30 transition-colors"
        >
          <MessageSquare className="h-3 w-3" /> Ajouter note
        </button>
        <button
          onClick={() => navigate(employeePath("/orders"))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-xs text-[hsl(220,10%,55%)] hover:text-white hover:border-blue-500/30 transition-colors"
        >
          <ShoppingCart className="h-3 w-3" /> Nouvelle commande
        </button>
        <button
          onClick={() => navigate(employeePath("/support"))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-xs text-[hsl(220,10%,55%)] hover:text-white hover:border-blue-500/30 transition-colors"
        >
          <FileText className="h-3 w-3" /> Créer ticket
        </button>
      </div>

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
                {subscriptions.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,11%)]">
                    <div>
                      <p className="text-xs text-white font-medium">{s.plan_name}</p>
                      <p className="text-[10px] text-[hsl(220,10%,40%)]">{fmtMoney(s.plan_price)}/mois</p>
                    </div>
                    {statusBadge(s.status ?? "active")}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Billing summary — READ ONLY */}
          <Section title="Facturation (lecture seule)" icon={<CreditCard className="h-4 w-4" />} locked>
            {invoices.length === 0 ? (
              <p className="text-xs text-[hsl(220,10%,30%)]">Aucune facture.</p>
            ) : (
              <div className="space-y-1.5">
                {invoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between py-1.5 text-xs border-b border-[hsl(220,15%,10%)] last:border-0">
                    <span className="text-white font-mono">{inv.invoice_number}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[hsl(220,10%,50%)]">{fmtMoney(inv.total)}</span>
                      {statusBadge(inv.status ?? "draft")}
                    </div>
                  </div>
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
                {orders.map(o => (
                  <Link
                    key={o.id}
                    to={employeePath(`/orders/${o.id}`)}
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
              {locations.map(loc => (
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

        {/* RIGHT: Tickets + Activity */}
        <div className="space-y-4">
          {/* Tickets */}
          <Section title="Tickets" icon={<FileText className="h-4 w-4" />}>
            {tickets.length === 0 ? (
              <p className="text-xs text-[hsl(220,10%,30%)]">Aucun ticket.</p>
            ) : (
              <div className="space-y-2">
                {tickets.map(t => (
                  <div key={t.id} className="p-2.5 rounded-lg bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,11%)]">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-white font-medium">{t.subject ?? t.ticket_number}</p>
                        <p className="text-[10px] text-[hsl(220,10%,35%)] mt-0.5">
                          {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                      {statusBadge(t.status ?? "open")}
                    </div>
                  </div>
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
                {notes.map((n, i) => {
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
