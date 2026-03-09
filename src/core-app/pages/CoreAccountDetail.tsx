/**
 * Nivra Core — Customer 360 Detail (ops-grade)
 * Reuses useAccountProfile hook — zero duplicated business logic.
 */
import { useParams, Link } from "react-router-dom";
import { useAccountProfile } from "@/components/admin/account-profile";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { Loader2, ArrowLeft, RefreshCw, User, FileText, CreditCard, Repeat, ShoppingCart, Mail, Phone, MapPin } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const fmtCAD = (n: number | null | undefined) => (n != null ? `${n.toFixed(2)} $` : "—");
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};

const SectionHeader = ({ icon: Icon, title, count }: { icon: any; title: string; count?: number }) => (
  <div className="flex items-center gap-2 mb-2">
    <Icon className="h-4 w-4 text-emerald-400" />
    <h2 className="text-xs font-semibold text-white">{title}</h2>
    {count != null && <span className="text-[11px] text-[hsl(220,10%,45%)] bg-[hsl(220,15%,14%)] px-1.5 py-0.5 rounded-full tabular-nums font-medium">{count}</span>}
  </div>
);

const MiniTable = ({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty?: boolean }) => (
  <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-[hsl(220,15%,16%)]">
          {headers.map(h => (
            <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {empty ? (
          <tr><td colSpan={headers.length} className="text-center py-8 text-[hsl(220,10%,30%)] text-xs">Aucune donnée</td></tr>
        ) : children}
      </tbody>
    </table>
  </div>
);

const CoreAccountDetail = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const data = useAccountProfile(accountId);

  if (data.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(220,10%,40%)]" />
      </div>
    );
  }

  if (!data.account) {
    return (
      <div className="py-20 text-center">
        <User className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,30%)]" />
        <p className="text-[hsl(220,10%,40%)] text-xs">Compte introuvable</p>
        <Link to="/core/accounts" className="text-blue-400 text-xs mt-2 inline-block hover:underline">← Retour aux comptes</Link>
      </div>
    );
  }

  const acct = data.account;
  const prof = data.profile;
  const totalDue = data.invoices.reduce((sum, inv: any) => sum + (inv.balance_due ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Back + Refresh */}
      <div className="flex items-center justify-between">
        <Link to="/core/accounts" className="flex items-center gap-1.5 text-[12px] text-[hsl(220,10%,50%)] hover:text-white transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Comptes
        </Link>
        <button onClick={() => data.refetch()} className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </button>
      </div>

      {/* Header Card */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-[hsl(220,15%,16%)] flex items-center justify-center">
              <User className="h-5 w-5 text-[hsl(220,10%,45%)]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                {prof ? `${prof.first_name || ""} ${prof.last_name || ""}`.trim() : "Client"}
              </h1>
              <p className="font-mono text-[hsl(220,10%,50%)] text-xs mt-0.5">Compte {acct.account_number}</p>
              <div className="flex items-center gap-4 mt-2 text-[11px] text-[hsl(220,10%,45%)]">
                {prof?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{prof.email}</span>}
                {prof?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{prof.phone}</span>}
                {acct.primary_service_city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{acct.primary_service_city}</span>}
              </div>
            </div>
          </div>
          <StatusBadge label={acct.status || "actif"} variant={statusToVariant(acct.status || "active")} size="sm" />
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-5 gap-3 mt-4">
          {[
            { label: "Commandes", value: data.orders.length, color: "text-white" },
            { label: "Factures", value: data.invoices.length, color: "text-white" },
            { label: "Paiements", value: data.payments.length, color: "text-white" },
            { label: "Abonnements", value: data.subscriptions.length, color: "text-white" },
            { label: "Solde dû", value: fmtCAD(totalDue), color: totalDue > 0 ? "text-red-400" : "text-emerald-400" },
          ].map(s => (
            <div key={s.label} className="rounded-lg bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,14%)] p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium">{s.label}</p>
              <p className={`text-sm font-bold mt-1 tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Orders */}
      <div>
        <SectionHeader icon={ShoppingCart} title="Commandes" count={data.orders.length} />
        <MiniTable headers={["#", "Service", "Statut", "Total", "Paiement", "Date"]} empty={data.orders.length === 0}>
          {data.orders.slice(0, 20).map((o: any) => (
            <tr key={o.id} className="border-b border-[hsl(220,15%,13%)] last:border-0 hover:bg-[hsl(220,20%,12%)]">
              <td className="px-3 py-2"><span className="font-mono text-white">{o.order_number || "—"}</span></td>
              <td className="px-3 py-2"><span className="text-[hsl(220,10%,55%)]">{o.service_category || o.service_type || "—"}</span></td>
              <td className="px-3 py-2"><StatusBadge label={o.status || "—"} variant={statusToVariant(o.status || "")} size="sm" /></td>
              <td className="px-3 py-2"><span className="tabular-nums text-white">{fmtCAD(o.total_today ?? o.order_total)}</span></td>
              <td className="px-3 py-2"><span className="text-[hsl(220,10%,45%)]">{o.payment_status || "—"}</span></td>
              <td className="px-3 py-2 whitespace-nowrap"><span className="text-[hsl(220,10%,40%)]">{fmtDate(o.created_at)}</span></td>
            </tr>
          ))}
        </MiniTable>
      </div>

      {/* Invoices */}
      <div>
        <SectionHeader icon={FileText} title="Factures" count={data.invoices.length} />
        <MiniTable headers={["Facture", "Type", "Total", "Payé", "Solde", "Statut", "Échéance"]} empty={data.invoices.length === 0}>
          {data.invoices.slice(0, 20).map((inv: any) => (
            <tr key={inv.id} className="border-b border-[hsl(220,15%,13%)] last:border-0 hover:bg-[hsl(220,20%,12%)]">
              <td className="px-3 py-2">
                <Link to={`/core/invoices/${inv.id}`} className="font-mono text-white hover:text-blue-400">{inv.invoice_number}</Link>
              </td>
              <td className="px-3 py-2"><span className="text-[hsl(220,10%,50%)] capitalize">{inv.type}</span></td>
              <td className="px-3 py-2"><span className="tabular-nums text-white">{fmtCAD(inv.total)}</span></td>
              <td className="px-3 py-2"><span className="tabular-nums text-emerald-400">{fmtCAD(inv.amount_paid)}</span></td>
              <td className="px-3 py-2">
                <span className={`tabular-nums font-medium ${(inv.balance_due ?? 0) > 0 ? "text-red-400" : "text-[hsl(220,10%,40%)]"}`}>{fmtCAD(inv.balance_due)}</span>
              </td>
              <td className="px-3 py-2"><StatusBadge label={inv.status || "—"} variant={statusToVariant(inv.status || "")} size="sm" /></td>
              <td className="px-3 py-2 whitespace-nowrap"><span className="text-[hsl(220,10%,40%)]">{fmtDate(inv.due_date)}</span></td>
            </tr>
          ))}
        </MiniTable>
      </div>

      {/* Payments */}
      <div>
        <SectionHeader icon={CreditCard} title="Paiements" count={data.payments.length} />
        <MiniTable headers={["#", "Montant", "Méthode", "Statut", "Référence", "Reçu le"]} empty={data.payments.length === 0}>
          {data.payments.slice(0, 20).map((p: any) => (
            <tr key={p.id} className="border-b border-[hsl(220,15%,13%)] last:border-0 hover:bg-[hsl(220,20%,12%)]">
              <td className="px-3 py-2"><span className="font-mono text-white">{p.payment_number || "—"}</span></td>
              <td className="px-3 py-2"><span className="tabular-nums text-emerald-400 font-medium">{fmtCAD(p.amount)}</span></td>
              <td className="px-3 py-2"><span className="text-[hsl(220,10%,55%)] capitalize">{p.method}</span></td>
              <td className="px-3 py-2"><StatusBadge label={p.status || "—"} variant={statusToVariant(p.status || "")} size="sm" /></td>
              <td className="px-3 py-2"><span className="font-mono text-[hsl(220,10%,40%)] text-[11px]">{p.reference || "—"}</span></td>
              <td className="px-3 py-2 whitespace-nowrap"><span className="text-[hsl(220,10%,40%)]">{fmtDate(p.received_at)}</span></td>
            </tr>
          ))}
        </MiniTable>
      </div>

      {/* Subscriptions */}
      <div>
        <SectionHeader icon={Repeat} title="Abonnements" count={data.subscriptions.length} />
        <MiniTable headers={["Plan", "Catégorie", "Prix/mois", "Statut", "Cycle début", "Cycle fin"]} empty={data.subscriptions.length === 0}>
          {data.subscriptions.map((s: any) => (
            <tr key={s.id} className="border-b border-[hsl(220,15%,13%)] last:border-0 hover:bg-[hsl(220,20%,12%)]">
              <td className="px-3 py-2">
                <p className="text-white font-medium">{s.plan_name}</p>
                <p className="text-[hsl(220,10%,38%)] text-[11px] font-mono">{s.plan_code}</p>
              </td>
              <td className="px-3 py-2"><span className="text-[hsl(220,10%,55%)]">{s.service_category || "—"}</span></td>
              <td className="px-3 py-2"><span className="tabular-nums text-emerald-400 font-medium">{fmtCAD(s.plan_price)}</span></td>
              <td className="px-3 py-2"><StatusBadge label={s.status || "—"} variant={statusToVariant(s.status || "")} size="sm" /></td>
              <td className="px-3 py-2 whitespace-nowrap"><span className="text-[hsl(220,10%,40%)]">{fmtDate(s.cycle_start_date)}</span></td>
              <td className="px-3 py-2 whitespace-nowrap"><span className="text-[hsl(220,10%,40%)]">{fmtDate(s.cycle_end_date)}</span></td>
            </tr>
          ))}
        </MiniTable>
      </div>
    </div>
  );
};

export default CoreAccountDetail;
