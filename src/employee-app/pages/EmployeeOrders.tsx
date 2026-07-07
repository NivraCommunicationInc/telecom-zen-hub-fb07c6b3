/**
 * EmployeeOrders — Operational order list with inline actions.
 * Client/invoice/payment quick access, document actions, contract/summary.
 */
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ShoppingCart, Loader2, Search, ArrowUpRight, FileText,
  Eye, User, DollarSign, Receipt, Plus,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { useOrdersList } from "@/shared-ops";
import { DocumentActions } from "@/employee-app/components/DocumentActions";
import { RecordPaymentDialog } from "@/shared-ops/components/RecordPaymentDialog";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";

const STATUS_FILTERS = [
  { key: "all", label: "Toutes" },
  { key: "pending", label: "En attente" },
  { key: "submitted", label: "Soumises" },
  { key: "processing", label: "En traitement" },
  { key: "completed", label: "Complétées" },
  { key: "cancelled", label: "Annulées" },
];

export default function EmployeeOrders() {
  usePortalRealtime(["orders"], [["employee-orders"]]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [search, setSearch] = useState("");
  const [docTarget, setDocTarget] = useState<{ orderId: string; orderNumber?: string; clientEmail?: string; clientName?: string; invoiceId?: string; invoiceNumber?: string } | null>(null);
  const [payTarget, setPayTarget] = useState<{ invoiceId: string; customerId: string; invoiceNumber?: string; balanceDue: number } | null>(null);
  const { data: allOrders = [], isLoading, refetch } = useOrdersList("live");

  const statusFiltered = statusFilter === "all"
    ? allOrders
    : allOrders.filter(o => o.status === statusFilter);

  const filtered = search.trim()
    ? statusFiltered.filter(o =>
        o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
        o.client_full_name?.toLowerCase().includes(search.toLowerCase()) ||
        o.client_email?.toLowerCase().includes(search.toLowerCase()) ||
        o.account_number?.toLowerCase().includes(search.toLowerCase()) ||
        o.invoice_number?.toLowerCase().includes(search.toLowerCase())
      )
    : statusFiltered;

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: "text-amber-400 bg-amber-500/10",
      submitted: "text-blue-400 bg-blue-500/10",
      processing: "text-indigo-400 bg-indigo-500/10",
      completed: "text-emerald-400 bg-emerald-500/10",
      cancelled: "text-red-400 bg-red-500/10",
    };
    return map[s] ?? "text-muted-foreground bg-muted";
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Commandes</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} commande{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(employeePath("/orders/new"))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors min-h-[44px]"
        >
          <Plus className="h-3.5 w-3.5" /> Nouvelle commande manuelle
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par #, client, compte, facture…"
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                statusFilter === f.key
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aucune commande trouvée.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Commande</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Compte</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Service</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Facture</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Paiement</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr
                    key={o.id}
                    onClick={() => navigate(employeePath(`/orders/${o.order_number ?? o.id}`))}
                    className="border-b border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{o.order_number ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-xs text-foreground">{o.client_full_name ?? "—"}</p>
                        <p className="text-[10px] text-muted-foreground">{o.client_email ?? ""}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{o.account_number ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{o.service_type ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", statusColor(o.status))}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {o.invoice_number ? (
                        <span className={cn(
                          "text-[10px] font-mono px-1.5 py-0.5 rounded",
                          o.invoice_status === "paid" ? "text-emerald-400 bg-emerald-500/10"
                            : o.invoice_status === "overdue" ? "text-red-400 bg-red-500/10"
                            : "text-muted-foreground bg-muted"
                        )}>
                          {o.invoice_number}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-medium",
                        o.payment_status === "paid" ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
                      )}>
                        {o.payment_status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {format(new Date(o.created_at), "d MMM yyyy", { locale: fr })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
                        {/* Client 360 */}
                        <button
                          onClick={() => navigate(employeePath(`/clients/${o.user_id}`))}
                          title="Client 360"
                          className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <User className="h-3.5 w-3.5" />
                        </button>
                        {/* Invoice quick access */}
                        {o.invoice_id && (
                          <button
                            onClick={() => navigate(employeePath(`/invoices/${o.invoice_id}`))}
                            title={`Facture ${o.invoice_number ?? ""}`}
                            className="p-1.5 rounded-md hover:bg-blue-500/10 text-muted-foreground hover:text-blue-400 transition-colors"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {/* Record payment */}
                        {o.invoice_id && o.customer_id && o.payment_status !== "paid" && (
                          <button
                            onClick={() => setPayTarget({
                              invoiceId: o.invoice_id!,
                              customerId: o.customer_id!,
                              invoiceNumber: o.invoice_number ?? undefined,
                              balanceDue: o.invoice_balance_due ?? o.total_amount ?? 0,
                            })}
                            title="Enregistrer paiement"
                            className="p-1.5 rounded-md hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400 transition-colors"
                          >
                            <DollarSign className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {/* Documents (contract, summary, invoice PDF, receipt) */}
                        <button
                          onClick={() => setDocTarget({
                            orderId: o.id,
                            orderNumber: o.order_number ?? undefined,
                            clientEmail: o.client_email ?? undefined,
                            clientName: o.client_full_name ?? undefined,
                            invoiceId: o.invoice_id ?? undefined,
                            invoiceNumber: o.invoice_number ?? undefined,
                          })}
                          title="Documents / Envoyer"
                          className="p-1.5 rounded-md hover:bg-amber-500/10 text-muted-foreground hover:text-amber-400 transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                        {/* Open order detail */}
                        <button
                          onClick={() => navigate(employeePath(`/orders/${o.order_number ?? o.id}`))}
                          title="Ouvrir commande"
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
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

      {/* Document actions modal */}
      {docTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDocTarget(null)}>
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground mb-4">Documents — {docTarget.orderNumber ?? "Commande"}</h3>
            <DocumentActions
              orderId={docTarget.orderId}
              invoiceId={docTarget.invoiceId}
              orderNumber={docTarget.orderNumber}
              invoiceNumber={docTarget.invoiceNumber}
              clientEmail={docTarget.clientEmail}
              clientName={docTarget.clientName}
            />
            <button
              onClick={() => setDocTarget(null)}
              className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Payment dialog */}
      {payTarget && (
        <RecordPaymentDialog
          open={!!payTarget}
          onOpenChange={(o) => { if (!o) setPayTarget(null); }}
          invoiceId={payTarget.invoiceId}
          customerId={payTarget.customerId}
          invoiceNumber={payTarget.invoiceNumber}
          balanceDue={payTarget.balanceDue}
          portal="employee"
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
