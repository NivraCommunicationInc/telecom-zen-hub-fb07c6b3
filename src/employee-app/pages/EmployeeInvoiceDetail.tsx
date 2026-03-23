/**
 * EmployeeInvoiceDetail — Read-only invoice detail using shared-ops.
 */
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, FileText, CreditCard, DollarSign, Calendar, Hash, ShoppingCart, Zap } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { useInvoiceDetail } from "@/shared-ops/hooks/useInvoiceDetail";

export default function EmployeeInvoiceDetail() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { data, isLoading, error } = useInvoiceDetail(invoiceId);

  if (!invoiceId) return <div className="py-20 text-center"><p className="text-sm text-muted-foreground">Facture introuvable</p></div>;
  if (isLoading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
        <p className="text-destructive text-sm">Erreur de chargement</p>
        <Link to={employeePath("/payments")} className="text-primary text-xs mt-2 inline-block hover:underline">← Retour</Link>
      </div>
    );
  }

  const { invoice: inv, lines, payments, customer, subscription, order } = data;
  const fmtMoney = (v: number | null | undefined) => v != null ? `${v.toFixed(2)} $` : "—";

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      paid: "text-emerald-400 bg-emerald-500/10", overdue: "text-red-400 bg-red-500/10",
      sent: "text-blue-400 bg-blue-500/10", draft: "text-muted-foreground bg-muted",
      void: "text-muted-foreground bg-muted",
    };
    return map[s] ?? "text-amber-400 bg-amber-500/10";
  };

  return (
    <div className="space-y-4">
      <Link to={employeePath("/payments")} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Paiements
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {inv.invoice_number}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {inv.type === "renewal" ? "Renouvellement" : inv.type === "one_time" ? "Ponctuelle" : inv.type} · {format(new Date(inv.created_at), "d MMM yyyy", { locale: fr })}
          </p>
        </div>
        <span className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold uppercase", statusColor(inv.status ?? "draft"))}>
          {inv.status ?? "draft"}
        </span>
      </div>

      {/* READ ONLY badge */}
      <div className="text-[9px] text-muted-foreground bg-muted px-2 py-1 rounded font-mono inline-block">LECTURE SEULE</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Amounts */}
        <Section title="Montants" icon={<DollarSign className="h-4 w-4" />}>
          <InfoRow label="Sous-total" value={fmtMoney(inv.subtotal)} />
          <InfoRow label="TPS" value={fmtMoney(inv.tps_amount)} />
          <InfoRow label="TVQ" value={fmtMoney(inv.tvq_amount)} />
          {inv.fees > 0 && <InfoRow label="Frais" value={fmtMoney(inv.fees)} />}
          <div className="border-t border-border pt-1 mt-1">
            <InfoRow label="Total" value={fmtMoney(inv.total)} bold />
          </div>
          <InfoRow label="Payé" value={fmtMoney(inv.amount_paid)} />
          <InfoRow label="Solde dû" value={fmtMoney(inv.balance_due)} />
        </Section>

        {/* Dates */}
        <Section title="Dates" icon={<Calendar className="h-4 w-4" />}>
          <InfoRow label="Période" value={`${format(new Date(inv.cycle_start_date), "d MMM", { locale: fr })} → ${format(new Date(inv.cycle_end_date), "d MMM yyyy", { locale: fr })}`} />
          <InfoRow label="Échéance" value={format(new Date(inv.due_date), "d MMM yyyy", { locale: fr })} />
          {inv.paid_at && <InfoRow label="Payée le" value={format(new Date(inv.paid_at), "d MMM yyyy HH:mm", { locale: fr })} />}
        </Section>

        {/* Customer */}
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

        {/* Links */}
        <Section title="Liens" icon={<ShoppingCart className="h-4 w-4" />}>
          {order && (
            <Link to={employeePath(`/orders/${order.order_number ?? order.id}`)} className="text-xs text-primary hover:underline block">
              Commande: {order.order_number} ({order.status})
            </Link>
          )}
          {subscription && (
            <Link to={employeePath(`/subscriptions/${subscription.id}`)} className="text-xs text-primary hover:underline block mt-1">
              Abonnement: {subscription.plan_name} ({subscription.status})
            </Link>
          )}
        </Section>
      </div>

      {/* Invoice lines */}
      {lines.length > 0 && (
        <Section title={`Lignes (${lines.length})`} icon={<FileText className="h-4 w-4" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Description</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Qté</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Prix unit.</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line: any) => (
                  <tr key={line.id} className="border-b border-border/50">
                    <td className="py-2 text-foreground">{line.description}</td>
                    <td className="py-2 text-right text-muted-foreground">{line.quantity ?? 1}</td>
                    <td className="py-2 text-right text-muted-foreground">{fmtMoney(line.unit_price)}</td>
                    <td className="py-2 text-right text-foreground font-medium">{fmtMoney(line.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Payments */}
      {payments.length > 0 && (
        <Section title={`Paiements (${payments.length})`} icon={<CreditCard className="h-4 w-4" />}>
          {payments.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between py-1.5 text-xs border-b border-border/50 last:border-0">
              <div>
                <span className="font-mono text-foreground">{p.payment_number}</span>
                <span className="text-muted-foreground ml-2">{p.method}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-foreground">{fmtMoney(p.amount)}</span>
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium",
                  p.status === "confirmed" ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
                )}>
                  {p.status}
                </span>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Traceability */}
      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground font-mono">
        <span>inv: {inv.id.slice(0, 8)}</span>
        {order && <span>· order: {order.order_number}</span>}
        {subscription && <span>· sub: {subscription.id.slice(0, 8)}</span>}
        {customer && <span>· cust: {customer.id.slice(0, 8)}</span>}
      </div>
    </div>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center text-xs py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-foreground text-right", bold && "font-semibold")}>{value}</span>
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
