/**
 * EmployeeAccounts — Operational account list with balance, overdue, services, and inline actions.
 * Uses canonical data + shared-ops components.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";
import {
  Search, Loader2, Building2, ChevronRight, DollarSign,
  AlertTriangle, FileText, Headphones, User,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CreateTicketDialog } from "@/employee-app/components/CreateTicketDialog";
import { RecordPaymentDialog } from "@/shared-ops/components/RecordPaymentDialog";

interface AccountRow {
  id: string;
  account_number: string;
  status: string | null;
  client_id: string;
  created_at: string;
  primary_service_address: string | null;
  primary_service_city: string | null;
  credit_class: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  // Enriched fields
  balance_due: number;
  overdue_count: number;
  service_count: number;
  latest_invoice_id: string | null;
  latest_invoice_number: string | null;
  latest_customer_id: string | null;
}

const STATUS_FILTERS = [
  { label: "Tous", value: "" },
  { label: "Actif", value: "active" },
  { label: "Suspendu", value: "suspended" },
  { label: "Bloqué", value: "blocked" },
];

export default function EmployeeAccounts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ticketTarget, setTicketTarget] = useState<AccountRow | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<AccountRow | null>(null);

  const { data: accounts, isLoading, refetch } = useQuery<AccountRow[]>({
    queryKey: ["employee-accounts-enriched"],
    queryFn: async () => {
      // 1. Accounts
      const { data: accts, error } = await supabase
        .from("accounts")
        .select("id, account_number, status, client_id, created_at, primary_service_address, primary_service_city, credit_class")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!accts?.length) return [];

      const clientIds = [...new Set(accts.map(a => a.client_id))];

      // 2. Profiles, billing customers, invoices, subscriptions in parallel
      const [profilesRes, customersRes, invoicesRes, subsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, email, phone").in("user_id", clientIds),
        supabase.from("billing_customers").select("id, user_id, email").in("user_id", clientIds),
        supabase.from("billing_invoices")
          .select("id, invoice_number, customer_id, balance_due, status, environment")
          .in("environment", ["live", "production"]),
        supabase.from("billing_subscriptions")
          .select("id, customer_id, status, environment")
          .in("environment", ["live", "production"])
          .in("status", ["active", "suspended", "pending"]),
      ]);

      const profileMap = new Map((profilesRes.data ?? []).map(p => [p.user_id, p]));
      const customerByUser = new Map((customersRes.data ?? []).map(c => [c.user_id, c]));

      // Build customer → client_id mapping
      const clientByCustomer = new Map<string, string>();
      for (const acct of accts) {
        const cust = customerByUser.get(acct.client_id);
        if (cust) clientByCustomer.set(cust.id, acct.client_id);
      }

      // Aggregate invoices per client
      const balanceByClient = new Map<string, { balance: number; overdue: number; latestInvId: string | null; latestInvNum: string | null; custId: string | null }>();
      for (const inv of (invoicesRes.data ?? [])) {
        const cid = clientByCustomer.get(inv.customer_id);
        if (!cid) continue;
        const existing = balanceByClient.get(cid) ?? { balance: 0, overdue: 0, latestInvId: null, latestInvNum: null, custId: inv.customer_id };
        existing.balance += (inv.balance_due ?? 0);
        if (inv.status === "overdue") existing.overdue += 1;
        if (!existing.latestInvId) {
          existing.latestInvId = inv.id;
          existing.latestInvNum = inv.invoice_number;
          existing.custId = inv.customer_id;
        }
        balanceByClient.set(cid, existing);
      }

      // Service count per client
      const serviceByClient = new Map<string, number>();
      for (const sub of (subsRes.data ?? [])) {
        const cid = clientByCustomer.get(sub.customer_id);
        if (!cid) continue;
        serviceByClient.set(cid, (serviceByClient.get(cid) ?? 0) + 1);
      }

      return accts.map(a => {
        const p = profileMap.get(a.client_id);
        const agg = balanceByClient.get(a.client_id);
        return {
          ...a,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
          phone: p?.phone ?? null,
          balance_due: agg?.balance ?? 0,
          overdue_count: agg?.overdue ?? 0,
          service_count: serviceByClient.get(a.client_id) ?? 0,
          latest_invoice_id: agg?.latestInvId ?? null,
          latest_invoice_number: agg?.latestInvNum ?? null,
          latest_customer_id: agg?.custId ?? null,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    let list = accounts ?? [];
    if (statusFilter) list = list.filter(a => a.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.account_number?.toLowerCase().includes(q) ||
        a.full_name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.phone?.includes(q) ||
        a.primary_service_city?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [accounts, statusFilter, search]);

  const statusBadge = (s: string | null) => {
    const colors: Record<string, string> = {
      active: "text-emerald-400 bg-emerald-500/10",
      suspended: "text-red-400 bg-red-500/10",
      blocked: "text-red-400 bg-red-500/10",
      pending: "text-amber-400 bg-amber-500/10",
    };
    return (
      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", colors[s ?? ""] ?? "text-muted-foreground bg-muted")}>
        {s ?? "—"}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" /> Comptes
        </h1>
        <span className="text-xs text-muted-foreground">{filtered.length} compte{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par numéro, nom, email, téléphone…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aucun compte trouvé</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-card border-b border-border">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Numéro</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ville</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Solde</th>
                  <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Services</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Créé</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(a => (
                  <tr
                    key={a.id}
                    onClick={() => navigate(employeePath(`/accounts/${a.id}`))}
                    className="hover:bg-secondary/30 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-foreground">{a.account_number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-xs text-foreground">{a.full_name ?? "—"}</p>
                        <p className="text-[10px] text-muted-foreground">{a.email ?? ""}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.primary_service_city ?? "—"}</td>
                    <td className="px-4 py-3">{statusBadge(a.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {a.overdue_count > 0 && (
                          <AlertTriangle className="h-3 w-3 text-red-400" title={`${a.overdue_count} facture(s) en retard`} />
                        )}
                        <span className={cn(
                          "text-xs font-mono",
                          a.balance_due > 0 ? "text-amber-400" : "text-emerald-400"
                        )}>
                          {a.balance_due.toFixed(2)} $
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-muted-foreground">{a.service_count}</span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground">
                      {format(new Date(a.created_at), "d MMM yyyy", { locale: fr })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(employeePath(`/clients/${a.client_id}`))}
                          title="Client 360"
                          className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <User className="h-3.5 w-3.5" />
                        </button>
                        {a.latest_invoice_id && a.latest_customer_id && (
                          <button
                            onClick={() => setPaymentTarget(a)}
                            title="Enregistrer paiement"
                            className="p-1.5 rounded-md hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400 transition-colors"
                          >
                            <DollarSign className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {a.latest_invoice_id && (
                          <button
                            onClick={() => navigate(employeePath(`/invoices/${a.latest_invoice_id}`))}
                            title="Voir facture"
                            className="p-1.5 rounded-md hover:bg-blue-500/10 text-muted-foreground hover:text-blue-400 transition-colors"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setTicketTarget(a)}
                          title="Créer ticket"
                          className="p-1.5 rounded-md hover:bg-cyan-500/10 text-muted-foreground hover:text-cyan-400 transition-colors"
                        >
                          <Headphones className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => navigate(employeePath(`/accounts/${a.id}`))}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ticket dialog */}
      {ticketTarget && (
        <CreateTicketDialog
          clientId={ticketTarget.client_id}
          clientName={ticketTarget.full_name ?? undefined}
          clientEmail={ticketTarget.email ?? undefined}
          onClose={() => setTicketTarget(null)}
        />
      )}

      {/* Payment dialog */}
      {paymentTarget?.latest_invoice_id && paymentTarget?.latest_customer_id && (
        <RecordPaymentDialog
          open={!!paymentTarget}
          onOpenChange={(o) => { if (!o) setPaymentTarget(null); }}
          invoiceId={paymentTarget.latest_invoice_id}
          customerId={paymentTarget.latest_customer_id}
          invoiceNumber={paymentTarget.latest_invoice_number ?? undefined}
          balanceDue={paymentTarget.balance_due}
          portal="employee"
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
