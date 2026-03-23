/**
 * EmployeeSubscriptionDetail — Read-only subscription detail using shared-ops.
 */
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Zap, Calendar, DollarSign, FileText, ShoppingCart, Hash } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { useSubscriptionDetail } from "@/shared-ops/hooks/useSubscriptionDetail";

export default function EmployeeSubscriptionDetail() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const { data, isLoading, error } = useSubscriptionDetail(subscriptionId);

  if (!subscriptionId) return <div className="py-20 text-center"><p className="text-sm text-muted-foreground">Abonnement introuvable</p></div>;
  if (isLoading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
        <p className="text-destructive text-sm">Erreur de chargement</p>
        <Link to={employeePath("/payments")} className="text-primary text-xs mt-2 inline-block hover:underline">← Retour</Link>
      </div>
    );
  }

  const { subscription: sub, serviceLines, customer, invoices, order } = data;
  const fmtMoney = (v: number | null | undefined) => v != null ? `${v.toFixed(2)} $` : "—";

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      active: "text-emerald-400 bg-emerald-500/10", suspended: "text-red-400 bg-red-500/10",
      cancelled: "text-muted-foreground bg-muted", expired: "text-amber-400 bg-amber-500/10",
      pending_activation: "text-blue-400 bg-blue-500/10",
    };
    return map[s] ?? "text-amber-400 bg-amber-500/10";
  };

  return (
    <div className="space-y-4">
      <Link to={employeePath("/payments")} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Retour
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            {sub.plan_name}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{sub.plan_code}</p>
        </div>
        <span className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold uppercase", statusColor(sub.status ?? "active"))}>
          {sub.status ?? "active"}
        </span>
      </div>

      <div className="text-[9px] text-muted-foreground bg-muted px-2 py-1 rounded font-mono inline-block">LECTURE SEULE</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Détails" icon={<DollarSign className="h-4 w-4" />}>
          <InfoRow label="Prix mensuel" value={fmtMoney(sub.plan_price)} />
          <InfoRow label="Catégorie" value={sub.service_category ?? "—"} />
          <InfoRow label="Facturation auto" value={sub.auto_billing_enabled ? "Oui" : "Non"} />
          {sub.recurring_provider && <InfoRow label="Provider" value={sub.recurring_provider} />}
        </Section>

        <Section title="Cycle" icon={<Calendar className="h-4 w-4" />}>
          <InfoRow label="Début" value={format(new Date(sub.cycle_start_date), "d MMM yyyy", { locale: fr })} />
          <InfoRow label="Fin" value={format(new Date(sub.cycle_end_date), "d MMM yyyy", { locale: fr })} />
          {sub.next_renewal_at && <InfoRow label="Prochain renouvellement" value={format(new Date(sub.next_renewal_at), "d MMM yyyy", { locale: fr })} />}
          {sub.billing_cycle_anchor && <InfoRow label="Ancrage" value={format(new Date(sub.billing_cycle_anchor), "d MMM yyyy", { locale: fr })} />}
        </Section>

        {customer && (
          <Section title="Client" icon={<Hash className="h-4 w-4" />}>
            <InfoRow label="Nom" value={`${customer.first_name} ${customer.last_name}`} />
            <InfoRow label="Email" value={customer.email} />
            {customer.phone && <InfoRow label="Tél" value={customer.phone} />}
            {customer.user_id && (
              <Link to={employeePath(`/clients/${customer.user_id}`)} className="text-[10px] text-primary hover:underline mt-1 inline-block">
                Voir profil →
              </Link>
            )}
          </Section>
        )}

        <Section title="Liens" icon={<ShoppingCart className="h-4 w-4" />}>
          {order && (
            <Link to={employeePath(`/orders/${order.order_number ?? order.id}`)} className="text-xs text-primary hover:underline block">
              Commande: {order.order_number} ({order.status})
            </Link>
          )}
        </Section>
      </div>

      {/* Service lines */}
      {serviceLines.length > 0 && (
        <Section title={`Services (${serviceLines.length})`} icon={<Zap className="h-4 w-4" />}>
          <div className="space-y-2">
            {serviceLines.map((sl: any) => (
              <div key={sl.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50 border border-border">
                <div>
                  <p className="text-xs text-foreground font-medium">{sl.service_name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{sl.service_code} · {sl.service_type}</p>
                </div>
                <span className="text-xs text-foreground font-medium">{fmtMoney(sl.unit_price)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Invoices */}
      {invoices.length > 0 && (
        <Section title={`Factures (${invoices.length})`} icon={<FileText className="h-4 w-4" />}>
          {invoices.map((inv: any) => (
            <Link
              key={inv.id}
              to={employeePath(`/invoices/${inv.id}`)}
              className="flex items-center justify-between py-1.5 text-xs border-b border-border/50 last:border-0 hover:text-primary transition-colors"
            >
              <div>
                <span className="font-mono text-foreground">{inv.invoice_number}</span>
                <span className="text-muted-foreground ml-2">{inv.type}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-foreground">{fmtMoney(inv.total)}</span>
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium",
                  inv.status === "paid" ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
                )}>
                  {inv.status}
                </span>
              </div>
            </Link>
          ))}
        </Section>
      )}

      {/* Traceability */}
      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground font-mono">
        <span>sub: {sub.id.slice(0, 8)}</span>
        {order && <span>· order: {order.order_number}</span>}
        {customer && <span>· cust: {customer.id.slice(0, 8)}</span>}
      </div>
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
