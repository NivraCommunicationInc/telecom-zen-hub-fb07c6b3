/**
 * AdminInvoiceDetail — Full invoice detail page
 * All amounts are authoritative DB values. No local math.
 * PDF uses canonical pipeline only.
 */
import { useParams, Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, User, Calendar, CreditCard, Package, ArrowLeft, Loader2, Download, Hash, Mail, Phone, Receipt,
} from "lucide-react";
import type { PDFGenerationResult } from "@/lib/pdf/types";
import { useAdminInvoiceDetail } from "@/hooks/admin/useAdminInvoiceDetail";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";
import { adminClient } from "@/integrations/backend";
import { generateCanonicalInvoicePDF } from "@/lib/pdf/canonicalDocumentService";

// ─── Labels ────────────────────────────────────────────────────────────────
const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", pending: "En attente", partially_paid: "Partiellement payée",
  paid: "Payée", paid_by_promo: "Payée par promo", failed: "Échouée",
  cancelled: "Annulée", refunded: "Remboursée", overdue: "En retard",
  void: "Annulée", not_renewed: "Non renouvelée",
};

const INVOICE_TYPE_LABELS: Record<string, string> = {
  initial: "Initiale", renewal: "Renouvellement", adjustment: "Ajustement",
  credit_note: "Note de crédit", manual: "Manuelle",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  interac: "Interac", paypal: "PayPal", manual: "Manuel", credit_card: "Carte de crédit",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En attente", confirmed: "Confirmé", failed: "Échoué", captured: "Capturé",
};

// ─── Formatters ────────────────────────────────────────────────────────────
const formatCAD = (n: number | null | undefined) =>
  n != null ? new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n) : "—";

const formatDate = (d: string | null | undefined) =>
  d ? format(new Date(d), "d MMMM yyyy", { locale: fr }) : "—";

const formatDateTime = (d: string | null | undefined) =>
  d ? format(new Date(d), "d MMM yyyy HH:mm", { locale: fr }) : "—";

// ─── PDF Download (canonical pipeline) ─────────────────────────────────────
async function handleDownloadPDF(invoiceId: string) {
  const result: PDFGenerationResult = await generateCanonicalInvoicePDF(adminClient, invoiceId);
  if (!result.success) {
    throw new Error(result.error || "Erreur lors de la génération du PDF");
  }
}

// ─── Page ──────────────────────────────────────────────────────────────────
const AdminInvoiceDetail = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { data: invoice, isLoading, error } = useAdminInvoiceDetail(invoiceId);
  const [pdfLoading, setPdfLoading] = useState(false);

  const onDownloadPDF = async () => {
    if (!invoice) return;
    setPdfLoading(true);
    try {
      await handleDownloadPDF(invoice.id);
      toast.success("Facture téléchargée");
    } catch (err: any) {
      console.error("[AdminInvoiceDetail] PDF error:", err);
      toast.error(err?.message || "Erreur lors de la génération du PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-4 max-w-5xl">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </AdminLayout>
    );
  }

  // ─── Error / Not found ───────────────────────────────────────────────────
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

  const isPaid = invoice.status === "paid" || invoice.status === "paid_by_promo";
  const hasBalance = (invoice.balance_due ?? 0) > 0;

  return (
    <AdminLayout>
      <div className="space-y-4 max-w-5xl">
        {/* ─── Header ─────────────────────────────────────────────────────── */}
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={onDownloadPDF}
                disabled={pdfLoading}
              >
                {pdfLoading ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                )}
                Télécharger PDF
              </Button>
              <Link to="/admin/invoices">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Retour
                </Button>
              </Link>
            </div>
          }
        />

        {/* ─── Key Figures Strip ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Total" value={formatCAD(invoice.total)} />
          <MetricCard label="Payé" value={formatCAD(invoice.amount_paid ?? 0)} variant="success" />
          <MetricCard
            label="Solde dû"
            value={formatCAD(invoice.balance_due ?? 0)}
            variant={hasBalance ? "danger" : "success"}
            highlight={hasBalance}
          />
          <MetricCard
            label="Type"
            value={INVOICE_TYPE_LABELS[invoice.type] || invoice.type}
          />
        </div>

        {/* ─── Info Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Client */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="w-4 h-4" /> Client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium text-foreground">{invoice.customer_name || "—"}</p>
              {invoice.customer_email && (
                <p className="text-muted-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {invoice.customer_email}
                </p>
              )}
              {invoice.customer_phone && (
                <p className="text-muted-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> {invoice.customer_phone}
                </p>
              )}
              {invoice.account_number && (
                <p className="font-mono text-xs text-muted-foreground flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" /> {invoice.account_number}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Dates & Details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Détails
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <DetailRow label="Méthode" value={PAYMENT_METHOD_LABELS[invoice.payment_method ?? ""] || invoice.payment_method || "—"} />
              <DetailRow label="Échéance" value={formatDate(invoice.due_date)} />
              <DetailRow label="Période" value={`${formatDate(invoice.cycle_start_date)} — ${formatDate(invoice.cycle_end_date)}`} small />
              {invoice.paid_at && <DetailRow label="Payée le" value={formatDate(invoice.paid_at)} />}
              {invoice.created_at && <DetailRow label="Créée le" value={formatDate(invoice.created_at)} />}
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

        {/* ─── Lines Breakdown ────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Détail de la facture
            </CardTitle>
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
              <TotalRow label="Sous-total" value={formatCAD(invoice.subtotal)} />
              <TotalRow label="TPS (5 %)" value={formatCAD(invoice.tps_amount)} />
              <TotalRow label="TVQ (9,975 %)" value={formatCAD(invoice.tvq_amount)} />
              {(invoice.fees ?? 0) > 0 && <TotalRow label="Frais" value={formatCAD(invoice.fees)} />}
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
                <div className={`flex justify-between font-semibold text-base ${hasBalance ? "text-red-400" : "text-emerald-400"}`}>
                  <span>Solde dû</span>
                  <span className="tabular-nums">{formatCAD(invoice.balance_due)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── Payments ───────────────────────────────────────────────────── */}
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
                      <th className="text-left py-2 px-2">Créé par</th>
                      <th className="text-left py-2 px-2">Confirmé par</th>
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
                        <td className="py-2 px-2 text-xs text-muted-foreground">{p.confirmed_by_name || "—"}</td>
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

        {/* ─── Notes ──────────────────────────────────────────────────────── */}
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

// ─── Sub-components ────────────────────────────────────────────────────────

function MetricCard({ label, value, variant, highlight }: {
  label: string; value: string;
  variant?: "success" | "danger"; highlight?: boolean;
}) {
  const colorClass = variant === "success"
    ? "text-emerald-400"
    : variant === "danger"
    ? "text-red-400"
    : "text-foreground";

  return (
    <Card className={highlight ? "border-red-500/40 bg-red-500/5" : undefined}>
      <CardContent className="py-3 px-4">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className={`text-lg font-bold tabular-nums ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={small ? "text-xs" : ""}>{value}</span>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export default AdminInvoiceDetail;
