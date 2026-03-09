/**
 * Nivra Core — Order Detail (ops-grade)
 * Reuses the same data queries as OrderOverview + enriched with billing data.
 * Document actions use canonical PDF services.
 * Zero duplicated business logic.
 */
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { Loader2, ArrowLeft, RefreshCw, ShoppingCart, User, Mail, Phone, MapPin, Hash, FileText, CreditCard, Repeat, Wrench, Package, Eye, Download, AlertTriangle, FileBadge, ScrollText } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { generateOrderDocuments } from "@/lib/pdf";
import { generateCanonicalInvoicePDF, generateCanonicalContractPDF } from "@/lib/pdf/canonicalDocumentService";
import PDFViewerDialog from "@/components/PDFViewerDialog";
import { toast } from "sonner";

const fmtCAD = (n: number | null | undefined) => (n != null ? `${n.toFixed(2)} $` : "—");
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};
const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy HH:mm", { locale: fr }); } catch { return "—"; }
};

const InfoRow = ({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) => (
  <div className="flex justify-between py-1.5 border-b border-[hsl(220,15%,13%)] last:border-0">
    <span className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider font-medium">{label}</span>
    <span className={`text-xs ${color || "text-white"} ${mono ? "font-mono" : ""}`}>{value}</span>
  </div>
);

function useOrderDetail(orderId: string | undefined) {
  return useQuery({
    queryKey: ["core-order-detail", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId!)
        .single();
      if (error) throw error;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", order.user_id)
        .maybeSingle();

      const { data: account } = await supabase
        .from("accounts")
        .select("*")
        .eq("client_id", order.user_id)
        .maybeSingle();

      const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId!);

      const { data: invoices } = await supabase
        .from("billing_invoices")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: false });

      const { data: payments } = invoices && invoices.length > 0
        ? await supabase
            .from("billing_payments")
            .select("*")
            .in("invoice_id", invoices.map((i: any) => i.id))
            .order("created_at", { ascending: false })
        : { data: [] as any[] };

      const { data: subscriptions } = await supabase
        .from("billing_subscriptions")
        .select("*")
        .eq("order_id", orderId!);

      const { data: appointment } = await supabase
        .from("appointments")
        .select("*")
        .eq("order_id", orderId!)
        .maybeSingle();

      const { data: activityLogs } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("entity_type", "order")
        .eq("entity_id", orderId!)
        .order("created_at", { ascending: false })
        .limit(20);

      const { data: contract } = await supabase
        .from("contracts")
        .select("id, contract_number, status, is_signed, created_at, client_signed_at, admin_signed_at")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        order,
        profile,
        account,
        items: items || [],
        invoices: invoices || [],
        payments: payments || [],
        subscriptions: subscriptions || [],
        appointment,
        activityLogs: activityLogs || [],
        contract,
      };
    },
  });
}

const CoreOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { data, isLoading, refetch } = useOrderDetail(orderId);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFilename, setPdfFilename] = useState("");
  const [docLoading, setDocLoading] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  const openPdf = (blob: Blob, title: string, filename: string) => {
    setPdfBlob(blob);
    setPdfTitle(title);
    setPdfFilename(filename);
    setPdfOpen(true);
  };

  const handleViewInvoicePDF = async (invoiceId: string, invoiceNumber: string) => {
    setDocLoading("invoice");
    setDocError(null);
    try {
      const result = await generateCanonicalInvoicePDF(supabase, invoiceId);
      if (result.success && result.blob) {
        openPdf(result.blob, `Facture ${invoiceNumber}`, `Facture_${invoiceNumber}.pdf`);
      } else {
        setDocError(result.error || "Erreur de génération de la facture");
        toast.error(result.error || "Erreur de génération");
      }
    } catch (err: any) {
      setDocError(err.message);
      toast.error("Erreur lors de la génération de la facture");
    } finally {
      setDocLoading(null);
    }
  };

  const handleViewContractPDF = async (contractId: string, contractNumber: string) => {
    setDocLoading("contract");
    setDocError(null);
    try {
      const result = await generateCanonicalContractPDF(supabase, contractId);
      if (result.success && result.blob) {
        openPdf(result.blob, `Contrat ${contractNumber}`, `Contrat_${contractNumber}.pdf`);
      } else {
        setDocError(result.error || "Erreur de génération du contrat");
        toast.error(result.error || "Erreur de génération");
      }
    } catch (err: any) {
      setDocError(err.message);
      toast.error("Erreur lors de la génération du contrat");
    } finally {
      setDocLoading(null);
    }
  };

  const handleViewAllDocs = async () => {
    if (!orderId) return;
    setDocLoading("all");
    setDocError(null);
    try {
      const result = await generateOrderDocuments(orderId);
      if (result?.invoice?.blob) {
        openPdf(result.invoice.blob, "Facture", `Facture_${data?.order?.order_number || ""}.pdf`);
      } else {
        setDocError("Impossible de générer les documents");
        toast.error("Erreur lors de la génération des documents");
      }
    } catch (err: any) {
      setDocError(err.message);
      toast.error("Erreur lors de la génération");
    } finally {
      setDocLoading(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[hsl(220,10%,40%)]" /></div>;
  }

  if (!data?.order) {
    return (
      <div className="py-20 text-center">
        <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,30%)]" />
        <p className="text-[hsl(220,10%,40%)] text-xs">Commande introuvable</p>
        <Link to="/core/orders" className="text-blue-400 text-xs mt-2 inline-block hover:underline">← Retour aux commandes</Link>
      </div>
    );
  }

  const { order, profile, account, items, invoices, payments, subscriptions, appointment, activityLogs, contract } = data;
  const clientName = profile?.full_name
    || [order.client_first_name, order.client_last_name].filter(Boolean).join(" ")
    || "—";
  const invoice = invoices[0];
  const totalDue = invoices.reduce((sum: number, inv: any) => sum + (inv.balance_due ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <Link to="/core/orders" className="flex items-center gap-1.5 text-[12px] text-[hsl(220,10%,50%)] hover:text-white transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Commandes
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to={`/admin/orders/${orderId}`}
            className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[11px] font-medium text-amber-400 hover:text-amber-300 hover:border-amber-500/30 transition-colors"
          >
            <Wrench className="h-3.5 w-3.5" /> Traiter (Admin)
          </Link>
          <button onClick={() => refetch()} className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </button>
        </div>
      </div>

      {/* Header Card */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-[hsl(220,15%,16%)] flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-[hsl(220,10%,45%)]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight font-mono">{order.order_number || `#${order.id.slice(0, 8)}`}</h1>
              <p className="text-[hsl(220,10%,50%)] text-xs mt-0.5">{order.service_type || "—"} · {order.service_category || ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {order.payment_status && <StatusBadge label={order.payment_status} variant={statusToVariant(order.payment_status)} size="sm" />}
            <StatusBadge label={order.status} variant={statusToVariant(order.status)} size="sm" />
          </div>
        </div>

        {/* Client + Order Meta */}
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium mb-2">Client</p>
            <p className="text-white text-xs flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-[hsl(220,10%,40%)]" />{clientName}</p>
            {(order.client_email || profile?.email) && <p className="text-[hsl(220,10%,45%)] text-[11px] flex items-center gap-1.5"><Mail className="h-3 w-3" />{order.client_email || profile?.email}</p>}
            {(order.client_phone || profile?.phone) && <p className="text-[hsl(220,10%,45%)] text-[11px] flex items-center gap-1.5"><Phone className="h-3 w-3" />{order.client_phone || profile?.phone}</p>}
            {order.client_full_address && <p className="text-[hsl(220,10%,45%)] text-[11px] flex items-center gap-1.5"><MapPin className="h-3 w-3" />{order.client_full_address}</p>}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium mb-2">Références</p>
            {account && (
              <Link to={`/core/accounts/${account.id}`} className="text-blue-400 text-[11px] flex items-center gap-1.5 hover:underline">
                <Hash className="h-3 w-3" />Compte {account.account_number}
              </Link>
            )}
            <p className="text-[hsl(220,10%,45%)] text-[11px]">Créée le {fmtDateTime(order.created_at)}</p>
            <p className="text-[hsl(220,10%,45%)] text-[11px]">Fulfillment: {order.fulfillment_type || "Non assigné"}</p>
            {order.installation_type && <p className="text-[hsl(220,10%,45%)] text-[11px]">Installation: {order.installation_type}</p>}
            {order.payment_method && <p className="text-[hsl(220,10%,45%)] text-[11px]">Méthode paiement: {order.payment_method}</p>}
          </div>
        </div>
      </div>

      {/* Financial Summary + Balance */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium mb-3">Sommaire financier</p>
          <InfoRow label="Sous-total" value={fmtCAD(invoice?.subtotal ?? order.subtotal)} mono />
          {(order.activation_fee ?? 0) > 0 && <InfoRow label="Frais d'activation" value={fmtCAD(order.activation_fee)} mono />}
          {(order.delivery_fee ?? 0) > 0 && <InfoRow label="Frais de livraison" value={fmtCAD(order.delivery_fee)} mono />}
          {(order.installation_fee ?? 0) > 0 && <InfoRow label="Frais d'installation" value={fmtCAD(order.installation_fee)} mono />}
          <InfoRow label="TPS (5%)" value={fmtCAD(invoice?.tps_amount ?? order.tps_amount)} mono />
          <InfoRow label="TVQ (9.975%)" value={fmtCAD(invoice?.tvq_amount ?? order.tvq_amount)} mono />
          <div className="flex justify-between py-2 mt-1 border-t border-[hsl(220,15%,18%)]">
            <span className="text-xs font-semibold text-white">Total</span>
            <span className="text-sm font-bold text-white font-mono">{fmtCAD(invoice?.total ?? order.total_amount)}</span>
          </div>
          {order.monthly_total != null && (
            <div className="flex justify-between py-1.5 mt-1 border-t border-[hsl(220,15%,14%)]">
              <span className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider font-medium">Mensuel récurrent</span>
              <span className="text-xs text-emerald-400 font-mono font-medium">{fmtCAD(order.monthly_total)}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium">Payé</p>
            <p className="text-lg font-bold text-emerald-400 font-mono mt-1">{fmtCAD(invoice?.amount_paid ?? 0)}</p>
          </div>
          <div className={`rounded-lg border p-4 text-center ${totalDue > 0 ? "border-red-500/30 bg-red-500/5" : "border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)]"}`}>
            <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium">Solde dû</p>
            <p className={`text-lg font-bold font-mono mt-1 ${totalDue > 0 ? "text-red-400" : "text-emerald-400"}`}>{fmtCAD(totalDue)}</p>
          </div>
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium">Statut paiement</p>
            <p className="mt-1"><StatusBadge label={order.payment_status || "pending"} variant={statusToVariant(order.payment_status || "pending")} size="sm" /></p>
          </div>
        </div>
      </div>

      {/* Order Items */}
      {items.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium mb-2">Articles ({items.length})</p>
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[hsl(220,15%,16%)]">
                  {["Article", "Qté", "Prix unit.", "Total"].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-[hsl(220,15%,13%)] last:border-0">
                    <td className="px-3 py-2 text-white">{item.product_name || item.plan_name || `Item ${i + 1}`}</td>
                    <td className="px-3 py-2 tabular-nums text-[hsl(220,10%,50%)]">{item.quantity || 1}</td>
                    <td className="px-3 py-2 tabular-nums text-[hsl(220,10%,50%)] font-mono">{fmtCAD(item.unit_price)}</td>
                    <td className="px-3 py-2 tabular-nums text-white font-mono font-medium">{fmtCAD(item.line_total || item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Linked Invoices */}
      {invoices.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-emerald-400" />
            <p className="text-xs font-semibold text-white">Factures liées</p>
            <span className="text-[11px] text-[hsl(220,10%,45%)] bg-[hsl(220,15%,14%)] px-1.5 py-0.5 rounded-full tabular-nums font-medium">{invoices.length}</span>
          </div>
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[hsl(220,15%,16%)]">
                  {["Facture", "Type", "Total", "Payé", "Solde", "Statut", "Échéance"].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-[hsl(220,15%,13%)] last:border-0 hover:bg-[hsl(220,20%,12%)]">
                    <td className="px-3 py-2">
                      <Link to={`/core/invoices/${inv.id}`} className="font-mono text-white hover:text-blue-400">{inv.invoice_number}</Link>
                    </td>
                    <td className="px-3 py-2 text-[hsl(220,10%,50%)] capitalize">{inv.type}</td>
                    <td className="px-3 py-2 tabular-nums text-white font-mono">{fmtCAD(inv.total)}</td>
                    <td className="px-3 py-2 tabular-nums text-emerald-400 font-mono">{fmtCAD(inv.amount_paid)}</td>
                    <td className="px-3 py-2">
                      <span className={`tabular-nums font-medium font-mono ${(inv.balance_due ?? 0) > 0 ? "text-red-400" : "text-[hsl(220,10%,40%)]"}`}>{fmtCAD(inv.balance_due)}</span>
                    </td>
                    <td className="px-3 py-2"><StatusBadge label={inv.status || "—"} variant={statusToVariant(inv.status || "")} size="sm" /></td>
                    <td className="px-3 py-2 text-[hsl(220,10%,40%)] whitespace-nowrap">{fmtDate(inv.due_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Linked Payments */}
      {payments.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-emerald-400" />
            <p className="text-xs font-semibold text-white">Paiements</p>
            <span className="text-[11px] text-[hsl(220,10%,45%)] bg-[hsl(220,15%,14%)] px-1.5 py-0.5 rounded-full tabular-nums font-medium">{payments.length}</span>
          </div>
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[hsl(220,15%,16%)]">
                  {["#", "Montant", "Méthode", "Statut", "Référence", "Reçu le"].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} className="border-b border-[hsl(220,15%,13%)] last:border-0">
                    <td className="px-3 py-2 font-mono text-white">{p.payment_number}</td>
                    <td className="px-3 py-2 tabular-nums text-emerald-400 font-medium font-mono">{fmtCAD(p.amount)}</td>
                    <td className="px-3 py-2 text-[hsl(220,10%,55%)] capitalize">{p.method}</td>
                    <td className="px-3 py-2"><StatusBadge label={p.status || "—"} variant={statusToVariant(p.status || "")} size="sm" /></td>
                    <td className="px-3 py-2 font-mono text-[hsl(220,10%,40%)] text-[11px]">{p.reference || "—"}</td>
                    <td className="px-3 py-2 text-[hsl(220,10%,40%)] whitespace-nowrap">{fmtDate(p.received_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Linked Subscriptions */}
      {subscriptions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Repeat className="h-4 w-4 text-emerald-400" />
            <p className="text-xs font-semibold text-white">Abonnements liés</p>
            <span className="text-[11px] text-[hsl(220,10%,45%)] bg-[hsl(220,15%,14%)] px-1.5 py-0.5 rounded-full tabular-nums font-medium">{subscriptions.length}</span>
          </div>
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[hsl(220,15%,16%)]">
                  {["Plan", "Prix/mois", "Statut", "Cycle début", "Cycle fin"].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s: any) => (
                  <tr key={s.id} className="border-b border-[hsl(220,15%,13%)] last:border-0">
                    <td className="px-3 py-2">
                      <p className="text-white font-medium">{s.plan_name}</p>
                      <p className="text-[hsl(220,10%,38%)] text-[11px] font-mono">{s.plan_code}</p>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-emerald-400 font-medium font-mono">{fmtCAD(s.plan_price)}</td>
                    <td className="px-3 py-2"><StatusBadge label={s.status || "—"} variant={statusToVariant(s.status || "")} size="sm" /></td>
                    <td className="px-3 py-2 text-[hsl(220,10%,40%)] whitespace-nowrap">{fmtDate(s.cycle_start_date)}</td>
                    <td className="px-3 py-2 text-[hsl(220,10%,40%)] whitespace-nowrap">{fmtDate(s.cycle_end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents Panel */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <ScrollText className="h-4 w-4 text-emerald-400" />
          <p className="text-xs font-semibold text-white">Documents</p>
        </div>

        {docError && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
            <p className="text-[11px] text-amber-300">{docError}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {/* Invoice PDF */}
          {invoice ? (
            <button
              onClick={() => handleViewInvoicePDF(invoice.id, invoice.invoice_number)}
              disabled={docLoading === "invoice"}
              className="flex items-center gap-2 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] p-3 text-left hover:border-blue-500/30 transition-colors disabled:opacity-50"
            >
              <FileText className="h-5 w-5 text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-white truncate">Facture</p>
                <p className="text-[10px] text-[hsl(220,10%,40%)] font-mono truncate">{invoice.invoice_number}</p>
                <p className="text-[10px] text-emerald-400">{docLoading === "invoice" ? "Génération…" : "Disponible"}</p>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-[hsl(220,15%,14%)] bg-[hsl(220,20%,10%)] p-3 opacity-50">
              <FileText className="h-5 w-5 text-[hsl(220,10%,30%)] flex-shrink-0" />
              <div>
                <p className="text-[11px] font-medium text-[hsl(220,10%,35%)]">Facture</p>
                <p className="text-[10px] text-[hsl(220,10%,25%)]">Non disponible</p>
              </div>
            </div>
          )}

          {/* Contract PDF */}
          {contract ? (
            <button
              onClick={() => handleViewContractPDF(contract.id, contract.contract_number || "")}
              disabled={docLoading === "contract"}
              className="flex items-center gap-2 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] p-3 text-left hover:border-blue-500/30 transition-colors disabled:opacity-50"
            >
              <FileBadge className="h-5 w-5 text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-white truncate">Contrat</p>
                <p className="text-[10px] text-[hsl(220,10%,40%)] font-mono truncate">{contract.contract_number || "—"}</p>
                <p className="text-[10px]">
                  {docLoading === "contract" ? (
                    <span className="text-amber-400">Génération…</span>
                  ) : contract.is_signed || contract.status === "fully_signed" ? (
                    <span className="text-emerald-400">Signé</span>
                  ) : (
                    <span className="text-amber-400">{contract.status || "En attente"}</span>
                  )}
                </p>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-[hsl(220,15%,14%)] bg-[hsl(220,20%,10%)] p-3 opacity-50">
              <FileBadge className="h-5 w-5 text-[hsl(220,10%,30%)] flex-shrink-0" />
              <div>
                <p className="text-[11px] font-medium text-[hsl(220,10%,35%)]">Contrat</p>
                <p className="text-[10px] text-[hsl(220,10%,25%)]">Non disponible</p>
              </div>
            </div>
          )}

          {/* Order Summary via generateOrderDocuments */}
          <button
            onClick={handleViewAllDocs}
            disabled={!!docLoading}
            className="flex items-center gap-2 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] p-3 text-left hover:border-blue-500/30 transition-colors disabled:opacity-50"
          >
            <Package className="h-5 w-5 text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-[11px] font-medium text-white">Sommaire</p>
              <p className="text-[10px] text-[hsl(220,10%,40%)]">Tous les documents</p>
              <p className="text-[10px] text-emerald-400">{docLoading === "all" ? "Génération…" : "Générer"}</p>
            </div>
          </button>
        </div>
      </div>

      {/* Appointment */}
      {appointment && (
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium mb-3">Rendez-vous</p>
          <div className="grid grid-cols-2 gap-4 text-[11px]">
            <InfoRow label="Date" value={fmtDateTime(appointment.scheduled_at)} />
            <InfoRow label="Statut" value={appointment.status || "—"} />
            {appointment.service_address && <InfoRow label="Adresse" value={appointment.service_address} />}
            {appointment.installation_method && <InfoRow label="Méthode" value={appointment.installation_method} />}
          </div>
        </div>
      )}

      {/* Internal Notes */}
      {order.internal_notes && (
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium mb-2">Notes internes</p>
          <pre className="text-xs text-[hsl(220,10%,55%)] whitespace-pre-wrap font-sans">{order.internal_notes}</pre>
        </div>
      )}

      {/* Activity Timeline */}
      {activityLogs.length > 0 && (
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
          <div className="px-3 py-2.5 border-b border-[hsl(220,15%,16%)]">
            <p className="text-xs font-semibold text-white">Historique d'activité</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {activityLogs.map((log: any) => (
              <div key={log.id} className="px-3 py-2 border-b border-[hsl(220,15%,13%)] last:border-0 flex items-start gap-3">
                <span className="text-[10px] text-[hsl(220,10%,35%)] whitespace-nowrap mt-0.5 font-mono">{fmtDateTime(log.created_at)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white">{log.action}</p>
                  {log.changed_field && (
                    <p className="text-[11px] text-[hsl(220,10%,40%)]">
                      {log.changed_field}: <span className="text-red-400 line-through">{log.old_value}</span> → <span className="text-emerald-400">{log.new_value}</span>
                    </p>
                  )}
                  {log.actor_name && <p className="text-[11px] text-[hsl(220,10%,35%)]">par {log.actor_name}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PDF Viewer Dialog */}
      <PDFViewerDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        pdfBlob={pdfBlob}
        title={pdfTitle}
        filename={pdfFilename}
      />
    </div>
  );
};

export default CoreOrderDetail;
