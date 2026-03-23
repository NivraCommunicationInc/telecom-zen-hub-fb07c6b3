/**
 * EmployeeAccountDetail — Account 360 view for customer-service agents.
 * Read-only account data with links to client, orders, invoices, subscriptions.
 * Uses canonical data from accounts + billing tables.
 */
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { employeePath } from "@/employee-app/lib/employeePaths";
import {
  ArrowLeft, Loader2, Building2, User, MapPin, CreditCard,
  ShoppingCart, FileText, Zap, Package, Calendar, ChevronRight, Hash,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function EmployeeAccountDetail() {
  const { accountId } = useParams<{ accountId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["employee-account-detail", accountId],
    enabled: !!accountId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      if (!accountId) throw new Error("ID manquant");

      const { data: account, error: acctErr } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", accountId)
        .single();
      if (acctErr) throw acctErr;

      const [profileRes, ordersRes, invoicesRes, subscriptionsRes, equipmentRes, appointmentsRes, locationsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, first_name, last_name, email, phone").eq("user_id", account.client_id).maybeSingle(),
        supabase.from("orders").select("id, order_number, status, service_type, created_at, payment_status").eq("user_id", account.client_id).eq("environment", "live").order("created_at", { ascending: false }).limit(20),
        supabase.from("billing_invoices").select("id, invoice_number, status, total, balance_due, due_date, created_at, type").eq("environment", "live").order("created_at", { ascending: false }).limit(50),
        supabase.from("billing_subscriptions").select("id, plan_name, plan_price, status, cycle_start_date, cycle_end_date, next_renewal_at").eq("environment", "live").order("created_at", { ascending: false }).limit(20),
        supabase.from("equipment_inventory").select("id, serial_number, mac_address, equipment_type, category, status").eq("assigned_to_user_id", account.client_id).limit(20),
        supabase.from("appointments").select("id, appointment_number, title, status, scheduled_at, service_type").eq("client_id", account.client_id).eq("environment", "live").order("scheduled_at", { ascending: false }).limit(10),
        supabase.from("account_service_locations").select("*").eq("account_id", accountId).eq("is_active", true),
      ]);

      // Filter invoices/subscriptions by customer_id resolution
      let customerIds: string[] = [];
      const { data: customers } = await supabase.from("billing_customers").select("id").eq("user_id", account.client_id);
      if (customers?.length) customerIds = customers.map(c => c.id);

      const filteredInvoices = (invoicesRes.data ?? []).filter((inv: any) => customerIds.includes(inv.customer_id));
      const filteredSubs = (subscriptionsRes.data ?? []).filter((sub: any) => customerIds.includes(sub.customer_id));

      return {
        account,
        profile: profileRes.data,
        orders: ordersRes.data ?? [],
        invoices: filteredInvoices,
        subscriptions: filteredSubs,
        equipment: equipmentRes.data ?? [],
        appointments: appointmentsRes.data ?? [],
        locations: locationsRes.data ?? [],
      };
    },
  });

  if (!accountId) return <div className="py-20 text-center"><p className="text-sm text-muted-foreground">Compte introuvable</p></div>;
  if (isLoading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error || !data?.account) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
        <p className="text-destructive text-sm">Erreur de chargement</p>
        <Link to={employeePath("/accounts")} className="text-primary text-xs mt-2 inline-block hover:underline">← Comptes</Link>
      </div>
    );
  }

  const { account, profile, orders, invoices, subscriptions, equipment, appointments, locations } = data;
  const fmtMoney = (v: number | null | undefined) => v != null ? `${v.toFixed(2)} $` : "—";

  const statusBadge = (s: string | null) => {
    const colors: Record<string, string> = {
      active: "text-emerald-400 bg-emerald-500/10",
      suspended: "text-red-400 bg-red-500/10",
      blocked: "text-red-400 bg-red-500/10",
      pending: "text-amber-400 bg-amber-500/10",
      paid: "text-emerald-400 bg-emerald-500/10",
      overdue: "text-red-400 bg-red-500/10",
      completed: "text-emerald-400 bg-emerald-500/10",
      processing: "text-blue-400 bg-blue-500/10",
    };
    return <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", colors[s ?? ""] ?? "text-muted-foreground bg-muted")}>{s ?? "—"}</span>;
  };

  const unpaidCount = invoices.filter((i: any) => i.status !== "paid" && i.status !== "void" && (i.balance_due ?? 0) > 0).length;
  const activeSubs = subscriptions.filter((s: any) => s.status === "active").length;

  return (
    <div className="space-y-4">
      <Link to={employeePath("/accounts")} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Comptes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight font-mono">{account.account_number}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {profile && (
                <Link to={employeePath(`/clients/${account.client_id}`)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <User className="h-3 w-3" /> {profile.full_name ?? "Client"}
                </Link>
              )}
              {account.primary_service_city && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {account.primary_service_city}
                </span>
              )}
            </div>
          </div>
        </div>
        {statusBadge(account.status)}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Services actifs" value={String(activeSubs)} icon={<Zap className="h-3.5 w-3.5" />} />
        <KPI label="Commandes" value={String(orders.length)} icon={<ShoppingCart className="h-3.5 w-3.5" />} />
        <KPI label="Factures impayées" value={String(unpaidCount)} icon={<FileText className="h-3.5 w-3.5" />} highlight={unpaidCount > 0} />
        <KPI label="Équipements" value={String(equipment.length)} icon={<Package className="h-3.5 w-3.5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: Account info + billing address */}
        <div className="lg:col-span-2 space-y-4">
          {/* Account info */}
          <Section title="Informations du compte" icon={<Building2 className="h-4 w-4" />}>
            <InfoRow label="Numéro de compte" value={account.account_number} />
            <InfoRow label="Statut" value={account.status ?? "—"} />
            <InfoRow label="Nom du compte" value={account.account_name ?? "—"} />
            <InfoRow label="Crédit" value={account.credit_class ?? "—"} />
            <InfoRow label="Créé le" value={format(new Date(account.created_at), "d MMM yyyy", { locale: fr })} />
            {account.billing_address && (
              <>
                <div className="border-t border-border pt-1 mt-1" />
                <InfoRow label="Adresse facturation" value={[account.billing_address, account.billing_city, account.billing_province, account.billing_postal_code].filter(Boolean).join(", ")} />
              </>
            )}
          </Section>

          {/* Subscriptions */}
          <Section title={`Services actifs (${subscriptions.length})`} icon={<Zap className="h-4 w-4" />}>
            {subscriptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun service.</p>
            ) : (
              <div className="space-y-1.5">
                {subscriptions.map((s: any) => (
                  <Link key={s.id} to={employeePath(`/subscriptions/${s.id}`)} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-secondary/50 transition-colors text-xs">
                    <div>
                      <p className="text-foreground font-medium">{s.plan_name}</p>
                      <p className="text-[10px] text-muted-foreground">{fmtMoney(s.plan_price)}/mois</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(s.status)}
                      <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* Orders */}
          <Section title={`Commandes (${orders.length})`} icon={<ShoppingCart className="h-4 w-4" />}>
            {orders.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune commande.</p>
            ) : (
              <div className="space-y-1.5">
                {orders.slice(0, 10).map((o: any) => (
                  <Link key={o.id} to={employeePath(`/orders/${o.order_number ?? o.id}`)} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-secondary/50 transition-colors text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-foreground">{o.order_number ?? "—"}</span>
                      <span className="text-muted-foreground">{o.service_type ?? ""}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(o.status)}
                      <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* Invoices */}
          <Section title={`Factures (${invoices.length})`} icon={<FileText className="h-4 w-4" />}>
            {invoices.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune facture.</p>
            ) : (
              <div className="space-y-1">
                {invoices.slice(0, 10).map((inv: any) => (
                  <Link key={inv.id} to={employeePath(`/invoices/${inv.id}`)} className="flex items-center justify-between py-1.5 text-xs hover:text-primary transition-colors">
                    <span className="font-mono text-foreground">{inv.invoice_number}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{fmtMoney(inv.total)}</span>
                      {statusBadge(inv.status)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* RIGHT: Equipment, Appointments, Locations */}
        <div className="space-y-4">
          {/* Equipment */}
          <Section title={`Équipements (${equipment.length})`} icon={<Package className="h-4 w-4" />}>
            {equipment.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun équipement assigné.</p>
            ) : (
              <div className="space-y-2">
                {equipment.map((eq: any) => (
                  <div key={eq.id} className="p-2 rounded-lg bg-secondary/30 text-xs space-y-0.5">
                    <p className="text-foreground font-medium">{eq.equipment_type ?? eq.category ?? "Équipement"}</p>
                    {eq.serial_number && <p className="text-[10px] text-muted-foreground font-mono">S/N: {eq.serial_number}</p>}
                    {eq.mac_address && <p className="text-[10px] text-muted-foreground font-mono">MAC: {eq.mac_address}</p>}
                    {statusBadge(eq.status)}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Appointments */}
          <Section title={`Rendez-vous (${appointments.length})`} icon={<Calendar className="h-4 w-4" />}>
            {appointments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun rendez-vous.</p>
            ) : (
              <div className="space-y-2">
                {appointments.slice(0, 5).map((appt: any) => (
                  <Link key={appt.id} to={employeePath(`/appointments/${appt.id}`)} className="block p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <p className="text-xs text-foreground font-medium">{appt.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(appt.scheduled_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </p>
                    {statusBadge(appt.status)}
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* Service locations */}
          {locations.length > 0 && (
            <Section title="Adresses de service" icon={<MapPin className="h-4 w-4" />}>
              {locations.map((loc: any) => (
                <div key={loc.id} className="flex items-start gap-2 py-1.5 text-xs border-b border-border/50 last:border-0">
                  <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-foreground">{loc.service_address}</p>
                    <p className="text-muted-foreground">{[loc.service_city, loc.service_province, loc.service_postal_code].filter(Boolean).join(", ")}</p>
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Traceability */}
          <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground font-mono">
            <span>acct: {account.id.slice(0, 8)}</span>
            <span>· client: {account.client_id.slice(0, 8)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, icon, highlight }: { label: string; value: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", highlight ? "border-red-500/20 bg-red-500/5" : "border-border bg-card")}>
      <div className="flex items-center gap-2 mb-1">
        <span className={cn("text-muted-foreground", highlight && "text-red-400")}>{icon}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn("text-xl font-bold", highlight ? "text-red-400" : "text-foreground")}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-xs py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
