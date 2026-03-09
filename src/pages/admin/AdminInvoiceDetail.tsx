/**
 * AdminInvoiceDetail — Full invoice detail page
 * Shows breakdown, payments (with payment_number), customer info
 * All amounts are authoritative DB values. No local math.
 */
import { useParams, Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FileText, User, Calendar, CreditCard, Package, ArrowLeft, Loader2,
} from "lucide-react";
import { useAdminInvoiceDetail } from "@/hooks/admin/useAdminInvoiceDetail";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  pending: "En attente",
  partially_paid: "Partiellement payée",
  paid: "Payée",
  paid_by_promo: "Payée par promo",
  failed: "Échouée",
  cancelled: "Annulée",
  refunded: "Remboursée",
  overdue: "En retard",
  void: "Annulée",
  not_renewed: "Non renouvelée",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  interac: "Interac",
  paypal: "PayPal",
  manual: "Manuel",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  failed: "Échoué",
};

const formatCAD = (n: number | null | undefined) =>
  n != null ? new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n) : "—";

const formatDate = (d: string | null | undefined) =>
  d ? format(new Date(d), "d MMMM yyyy", { locale: fr }) : "—";

const formatDateTime = (d: string | null | undefined) =>
  d ? format(new Date(d), "d MMM yyyy HH:mm", { locale: fr }) : "—";

const AdminInvoiceDetail = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { data: invoice, isLoading, error } = useAdminInvoiceDetail(invoiceId);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !invoice) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileText className="w-10 h-10 mb-2" />
          <p className="text-sm">Facture introuvable</p>
          <Link to="/admin/invoices">
            <Button variant="ghost" size="sm" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" /> Retour aux factures
            </Button>
          </Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4 max-w-5xl">
        <PageHeader
          title={`Facture ${invoice.invoice_number}`}
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Factures", href: "/admin/invoices" },
            { label: invoice.invoice_number },
          ]}
          badge={
            <StatusBadge
              label={INVOICE_STATUS_LABELS[invoice.status ?? ""] || invoice.status || "—"}
              variant={statusToVariant(invoice.status ?? "")}
              size="md"
            />
          }
          actions={
            <Link to="/admin/invoices">
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Retour
              </Button>
            </Link>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Client info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="w-4 h-4" /> Client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p className="font-medium text-foreground">{invoice.customer_name || "—"}</p>
              <p className="text-muted-foreground">{invoice.customer_email || "—"}</p>
              {invoice.customer_phone && (
                <p className="text-muted-foreground">{invoice.customer_phone}</p>
              )}
              {invoice.account_number && (
                <p className="font-mono text-xs text-muted-foreground">Compte: {invoice.account_number}</p>
              )}
            </CardContent>
          </Card>

          {/* Invoice info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Détails
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="capitalize">{invoice.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Méthode</span>
                <span>{PAYMENT_METHOD_LABELS[invoice.payment_method ?? ""] || invoice.payment_method || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Échéance</span>
                <span>{formatDate(invoice.due_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Période</span>
                <span className="text-xs">
                  {formatDate(invoice.cycle_start_date)} — {formatDate(invoice.cycle_end_date)}
                </span>
              </div>
              {invoice.paid_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payée le</span>
                  <span>{formatDate(invoice.paid_at)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order link */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4" /> Commande liée
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {invoice.order_number ? (
                <Link
                  to={`/admin/orders/${invoice.order_id}`}
                  className="font-mono text-primary hover:underline"
                >
                  {invoice.order_number}
                </Link>
              ) : (
                <p className="text-muted-foreground">Aucune commande liée</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lines breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Détail de la facture</CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.lines.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="text-left py-2 px-2">Description</th>
                      <th className="text-right py-2 px-2 w-20">Qté</th>
                      <th className="text-right py-2 px-2 w-28">Prix unit.</th>
                      <th className="text-right py-2 px-2 w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lines.map((line) => (
                      <tr key={line.id} className="border-b border-border/40">
                        <td className="py-2 px-2 text-foreground">{line.description}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{line.quantity}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{formatCAD(line.unit_price)}</td>
                        <td className="py-2 px-2 text-right tabular-nums font-medium">{formatCAD(line.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune ligne de facturation</p>
            )}

            <Separator className="my-3" />

            {/* Totals — all from DB */}
            <div className="space-y-1 max-w-xs ml-auto text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sous-total</span>
                <span className="tabular-nums">{formatCAD(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TPS (5%)</span>
                <span className="tabular-nums">{formatCAD(invoice.tps_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">TVQ (9,975%)</span>
                <span className="tabular-nums">{formatCAD(invoice.tvq_amount)}</span>
              </div>
              {(invoice.fees ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frais</span>
                  <span className="tabular-nums">{formatCAD(invoice.fees)}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="tabular-nums">{formatCAD(invoice.total)}</span>
              </div>
              {invoice.amount_paid != null && (
                <div className="flex justify-between text-emerald-400">
                  <span>Payé</span>
                  <span className="tabular-nums">{formatCAD(invoice.amount_paid)}</span>
                </div>
              )}
              {invoice.balance_due != null && (
                <div className={`flex justify-between font-medium ${(invoice.balance_due ?? 0) > 0 ? "text-red-400" : "text-emerald-400"}`}>
                  <span>Solde dû</span>
                  <span className="tabular-nums">{formatCAD(invoice.balance_due)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Paiements ({invoice.payments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="text-left py-2 px-2">N° Paiement</th>
                      <th className="text-left py-2 px-2">Méthode</th>
                      <th className="text-right py-2 px-2">Montant</th>
                      <th className="text-left py-2 px-2">Statut</th>
                      <th className="text-left py-2 px-2">Référence</th>
                      <th className="text-left py-2 px-2">Date</th>
                      <th className="text-left py-2 px-2">Par</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map((p) => (
                      <tr key={p.id} className="border-b border-border/40">
                        <td className="py-2 px-2 font-mono font-medium text-foreground">{p.payment_number}</td>
                        <td className="py-2 px-2">{PAYMENT_METHOD_LABELS[p.method] || p.method}</td>
                        <td className="py-2 px-2 text-right tabular-nums font-medium">{formatCAD(p.amount)}</td>
                        <td className="py-2 px-2">
                          <StatusBadge
                            label={PAYMENT_STATUS_LABELS[p.status ?? ""] || p.status || "—"}
                            variant={statusToVariant(p.status ?? "")}
                            size="sm"
                          />
                        </td>
                        <td className="py-2 px-2 text-xs text-muted-foreground font-mono">{p.reference || "—"}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(p.received_at || p.created_at)}
                        </td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">{p.created_by_name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun paiement enregistré</p>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {invoice.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminInvoiceDetail;
