/**
 * AccountDocumentsDialog — Phase 11
 * Staff-only read of all client documents (contracts, auto-docs, uploads, order docs).
 * Pulls via the `account-documents-list` edge function which signs storage URLs.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Loader2, RefreshCw, Search, FolderOpen, FileSignature, FileCheck2, Upload, PackageCheck, Receipt, FileSpreadsheet, FileQuestion, Send, Trash2, UploadCloud, Clock, CheckCircle2, XCircle, Eye } from "lucide-react";
import PDFViewerDialog from "@/components/PDFViewerDialog";
import { usePDFViewer } from "@/hooks/usePDFViewer";
import { downloadClientDeliverySlipPDF, generateClientDeliverySlipPDF } from "@/lib/clientDeliverySlip";
import { generateCanonicalInvoicePDF } from "@/lib/pdf/canonicalDocumentService";
import { generateCanonicalReceiptPDF } from "@/lib/pdf/canonicalDocumentExtensions";
import { generateReceiptPDF } from "@/lib/pdf/receiptTemplate";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName: string;
  accountId?: string | null;
  initialData?: any;
  /** true when caller is a Nivra Core admin — enables upload/delete controls */
  isAdmin?: boolean;
  /** true when caller is any staff (agent/admin) — enables "resend signature" */
  isStaff?: boolean;
}

interface DocItem {
  id: string;
  source: "contract" | "auto" | "uploaded" | "order" | "invoice" | "receipt" | "quote";
  category: string;
  name: string;
  number?: string | null;
  created_at: string;
  url: string | null;
  signed: boolean;
  size_bytes?: number | null;
  metadata?: Record<string, any> | null;
}

const DELIVERY_SLIP_KIND = "delivery_slip";
const INVOICE_PDF_KIND = "invoice_pdf";
const RECEIPT_PDF_KIND = "receipt_pdf";

const sourceMeta: Record<DocItem["source"], { label: string; icon: any; tone: string }> = {
  contract: { label: "Contrats", icon: FileSignature, tone: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  auto: { label: "Auto-générés", icon: FileCheck2, tone: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  uploaded: { label: "Téléversés", icon: Upload, tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  order: { label: "Commandes", icon: PackageCheck, tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  invoice: { label: "Factures", icon: FileSpreadsheet, tone: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  receipt: { label: "Reçus", icon: Receipt, tone: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
  quote: { label: "Soumissions", icon: FileQuestion, tone: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
};

function formatBytes(n?: number | null): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function docsFromCanonical(data: any): DocItem[] {
  if (!data) return [];
  const rows: DocItem[] = [];
  (data.contracts || []).forEach((c: any) => rows.push({
    id: `canonical-contract-${c.id}`,
    source: "contract",
    category: "Contrat",
    name: c.contract_number ? `Contrat ${c.contract_number}` : c.contract_name || "Contrat",
    number: c.contract_number,
    created_at: c.created_at,
    url: c.contract_pdf_url || c.contract_url || null,
    signed: false,
    metadata: { status: c.status, signed_at: c.client_signed_at || c.signed_at },
  }));
  (data.documents || []).forEach((d: any) => rows.push({
    id: `canonical-upload-${d.id}`,
    source: "uploaded",
    category: d.document_type || "Document",
    name: d.document_name || "Document",
    created_at: d.created_at,
    url: d.document_url || null,
    signed: false,
  }));
  (data.invoices || []).forEach((inv: any) => rows.push({
    id: `canonical-invoice-${inv.id}`,
    source: "invoice",
    category: "Facture",
    name: `Facture ${inv.invoice_number || inv.id.slice(0, 8)}`,
    number: inv.invoice_number,
    created_at: inv.created_at,
    url: inv.pdf_url || inv.invoice_pdf_url || null,
    signed: false,
    metadata: { generatedDocument: INVOICE_PDF_KIND, invoice_id: inv.id, status: inv.status, total: inv.total, balance_due: inv.balance_due },
  }));
  (data.payments || []).forEach((p: any) => rows.push({
    id: `canonical-receipt-${p.id}`,
    source: "receipt",
    category: "Reçu de paiement",
    name: `Reçu ${p.payment_number || p.reference || p.id.slice(0, 8)}`,
    number: p.payment_number || p.reference || p.id.slice(0, 8),
    created_at: p.received_at || p.created_at,
    url: p.receipt_url || null,
    signed: false,
    metadata: { generatedDocument: RECEIPT_PDF_KIND, payment: p, payment_id: p.id, invoice_id: p.invoice_id, status: p.status, amount: p.amount, method: p.method },
  }));
  (data.orders || []).forEach((o: any) => rows.push({
    id: `delivery-slip-${o.id}`,
    source: "order",
    category: "Bordereau de livraison",
    name: `Bordereau de livraison — ${o.order_number || o.id.slice(0, 8)}`,
    number: o.order_number,
    created_at: o.created_at,
    url: null,
    signed: false,
    metadata: { generatedDocument: DELIVERY_SLIP_KIND, order: o, order_id: o.id, status: o.status, total: o.total_amount },
  }));
  return rows;
}

export function AccountDocumentsDialog({ open, onClose, clientUserId, clientName, accountId, initialData, isAdmin = false, isStaff = true }: Props) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DocItem[]>([]);
  const [tab, setTab] = useState<"all" | DocItem["source"]>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfViewer = usePDFViewer();

  const documentKey = (item: DocItem) => {
    const rawId = item.id
      .replace(/^canonical-(contract|upload|invoice|receipt|order)-/, "")
      .replace(/^delivery-slip-/, "delivery-slip:");
    return `${item.source}:${rawId}`;
  };

  const mergeDocuments = (docs: DocItem[]) => {
    const merged = new Map<string, DocItem>();
    for (const doc of docs) {
      const key = documentKey(doc);
      const current = merged.get(key);
      if (!current || (!current.url && doc.url) || (!current.metadata?.generatedDocument && doc.metadata?.generatedDocument)) {
        merged.set(key, doc);
      }
    }
    return Array.from(merged.values()).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  };

  const load = async () => {
    if (!clientUserId) return;
    setLoading(true);
    try {
      const fallbackItems = docsFromCanonical(initialData);
      if (fallbackItems.length > 0) setItems(fallbackItems);
      const { data, error } = await supabase.functions.invoke("account-documents-list", {
        body: { client_user_id: clientUserId, account_id: accountId ?? null },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Erreur");
      const merged = [...fallbackItems, ...(data.items ?? [])];
      setItems(mergeDocuments(merged));
    } catch (e: any) {
      toast.error("Erreur chargement documents", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, clientUserId]);

  const counts = useMemo(() => {
    const c: Record<DocItem["source"], number> = { contract: 0, auto: 0, uploaded: 0, order: 0, invoice: 0, receipt: 0, quote: 0 };
    for (const i of items) c[i.source]++;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => tab === "all" || i.source === tab)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || (i.number ?? "").toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }, [items, tab, search]);

  const isGeneratedDeliverySlip = (it: DocItem) => it.metadata?.generatedDocument === DELIVERY_SLIP_KIND;
  const isGeneratedInvoice = (it: DocItem) => it.source === "invoice" && (!!it.metadata?.invoice_id || it.metadata?.generatedDocument === INVOICE_PDF_KIND);
  const isGeneratedReceipt = (it: DocItem) => it.source === "receipt" && (!!it.metadata?.invoice_id || !!it.metadata?.payment || it.metadata?.generatedDocument === RECEIPT_PDF_KIND);

  const fileSafeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "document";
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const resolveOrderForDeliverySlip = (it: DocItem) => {
    const orderFromMetadata = it.metadata?.order;
    if (orderFromMetadata) return orderFromMetadata;
    const orderId = it.metadata?.order_id || it.id.replace(/^delivery-slip-/, "");
    return (initialData?.orders || []).find((o: any) => o.id === orderId || o.order_number === it.number) || {
      id: orderId,
      order_number: it.number || orderId,
      created_at: it.created_at,
    };
  };

  const deliverySlipCanonicalData = (order: any) => initialData || {
    profile: { full_name: clientName },
    account: { id: accountId },
    orders: [order],
    equipment: [],
    orderItems: [],
    equipmentOrderLines: [],
    serviceAddresses: [],
  };

  const openGeneratedDeliverySlip = (it: DocItem) => {
    const order = resolveOrderForDeliverySlip(it);
    const result = generateClientDeliverySlipPDF(deliverySlipCanonicalData(order), order);
    if (!result.success || !result.blob) {
      toast.error(result.error || "Bordereau indisponible");
      return;
    }
    pdfViewer.openWithBlob(
      result.blob,
      `Bordereau de livraison — ${order.order_number || it.number || "Commande"}`,
      result.filename || `Bon_Livraison_${order.order_number || order.id || "commande"}.pdf`,
    );
  };

  const downloadGeneratedDeliverySlip = (it: DocItem) => {
    const order = resolveOrderForDeliverySlip(it);
    try {
      downloadClientDeliverySlipPDF(deliverySlipCanonicalData(order), order);
      toast.success("Bordereau téléchargé");
    } catch (e: any) {
      toast.error(e?.message || "Téléchargement impossible");
    }
  };

  const openGeneratedInvoice = (it: DocItem) => {
    const invoiceId = it.metadata?.invoice_id || it.id.replace(/^canonical-invoice-/, "");
    pdfViewer.openWithGenerator(async () => {
      const result = await generateCanonicalInvoicePDF(supabase as any, invoiceId);
      if (!result.success || !result.blob) throw new Error(result.error || "Facture indisponible");
      return result.blob;
    }, it.name, `${fileSafeName(it.name)}.pdf`);
  };

  const downloadGeneratedInvoice = async (it: DocItem) => {
    try {
      const invoiceId = it.metadata?.invoice_id || it.id.replace(/^canonical-invoice-/, "");
      const result = await generateCanonicalInvoicePDF(supabase as any, invoiceId);
      if (!result.success || !result.blob) throw new Error(result.error || "Facture indisponible");
      downloadBlob(result.blob, `${fileSafeName(it.name)}.pdf`);
      toast.success("Facture téléchargée");
    } catch (e: any) {
      toast.error(e?.message || "Téléchargement impossible");
    }
  };

  const fetchPaymentDetail = async (it: DocItem) => {
    if (it.metadata?.payment) return it.metadata.payment;
    const paymentId = it.metadata?.payment_id || it.id.replace(/^canonical-receipt-/, "");
    const { data } = await (supabase as any)
      .from("billing_payments")
      .select("id, invoice_id, payment_number, amount, method, status, reference, received_at, created_at, invoice:billing_invoices(invoice_number, total, balance_due, order_id)")
      .eq("id", paymentId)
      .maybeSingle();
    return data || null;
  };

  const openGeneratedReceipt = (it: DocItem) => {
    pdfViewer.openWithGenerator(async () => {
      const payment = await fetchPaymentDetail(it);
      const invoiceId = it.metadata?.invoice_id || payment?.invoice_id;
      if (invoiceId) {
        const canonical = await generateCanonicalReceiptPDF(supabase as any, invoiceId);
        if (canonical.success && canonical.blob) return canonical.blob;
      }

      const profile = initialData?.profile || {};
      const account = initialData?.account || {};
      const result = generateReceiptPDF({
        receipt_number: it.number || payment?.payment_number || payment?.reference || it.id.slice(-8),
        payment_date: payment?.received_at || payment?.created_at || it.created_at,
        payment_method: payment?.method || payment?.payment_method || it.metadata?.method || "Paiement",
        amount_paid: Number(payment?.amount ?? it.metadata?.amount ?? 0),
        invoice_number: payment?.invoice?.invoice_number || it.metadata?.invoice_number || "—",
        invoice_total: Number(payment?.invoice?.total ?? payment?.amount ?? it.metadata?.amount ?? 0),
        order_number: payment?.invoice?.order_id || undefined,
        client_name: profile.full_name || clientName,
        client_email: profile.email || "",
        client_phone: profile.phone || undefined,
        client_address: account.service_address || profile.service_address || undefined,
        account_number: account.account_number || "—",
        transaction_reference: payment?.reference || it.number || undefined,
        balance_remaining: Number(payment?.invoice?.balance_due ?? 0),
        payment_status: payment?.status || it.metadata?.status || "paid",
      });
      if (!result.success || !result.blob) throw new Error(result.error || "Reçu indisponible");
      return result.blob;
    }, it.name, `${fileSafeName(it.name)}.pdf`);
  };

  const buildGeneratedReceiptBlob = async (it: DocItem): Promise<Blob> => {
    const payment = await fetchPaymentDetail(it);
    const invoiceId = it.metadata?.invoice_id || payment?.invoice_id;
    if (invoiceId) {
      const canonical = await generateCanonicalReceiptPDF(supabase as any, invoiceId);
      if (canonical.success && canonical.blob) return canonical.blob;
    }

    const profile = initialData?.profile || {};
    const account = initialData?.account || {};
    const result = generateReceiptPDF({
      receipt_number: it.number || payment?.payment_number || payment?.reference || it.id.slice(-8),
      payment_date: payment?.received_at || payment?.created_at || it.created_at,
      payment_method: payment?.method || payment?.payment_method || it.metadata?.method || "Paiement",
      amount_paid: Number(payment?.amount ?? it.metadata?.amount ?? 0),
      invoice_number: payment?.invoice?.invoice_number || it.metadata?.invoice_number || "—",
      invoice_total: Number(payment?.invoice?.total ?? payment?.amount ?? it.metadata?.amount ?? 0),
      order_number: payment?.invoice?.order_id || undefined,
      client_name: profile.full_name || clientName,
      client_email: profile.email || "",
      client_phone: profile.phone || undefined,
      client_address: account.service_address || profile.service_address || undefined,
      account_number: account.account_number || "—",
      transaction_reference: payment?.reference || it.number || undefined,
      balance_remaining: Number(payment?.invoice?.balance_due ?? 0),
      payment_status: payment?.status || it.metadata?.status || "paid",
    });
    if (!result.success || !result.blob) throw new Error(result.error || "Reçu indisponible");
    return result.blob;
  };

  const downloadGeneratedReceipt = async (it: DocItem) => {
    try {
      const blob = await buildGeneratedReceiptBlob(it);
      downloadBlob(blob, `${fileSafeName(it.name)}.pdf`);
      toast.success("Reçu téléchargé");
    } catch (e: any) {
      toast.error(e?.message || "Téléchargement impossible");
    }
  };

  const openDoc = async (it: DocItem) => {
    if (isGeneratedDeliverySlip(it)) {
      openGeneratedDeliverySlip(it);
      return;
    }

    if (isGeneratedInvoice(it) && !it.url) {
      void openGeneratedInvoice(it);
      return;
    }

    if (isGeneratedReceipt(it) && !it.url) {
      void openGeneratedReceipt(it);
      return;
    }

    if (!it.url) {
      toast.warning("Aucun fichier disponible pour ce document");
      return;
    }
    try {
      const popup = window.open("about:blank", "_blank");
      const url = await resolveDocumentUrl(it.url);
      if (popup) {
        popup.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      toast.error("Impossible d'ouvrir le document", { description: e?.message });
    }
  };

  const downloadDoc = async (it: DocItem) => {
    if (isGeneratedDeliverySlip(it)) {
      downloadGeneratedDeliverySlip(it);
      return;
    }

    if (isGeneratedInvoice(it) && !it.url) {
      void downloadGeneratedInvoice(it);
      return;
    }

    if (isGeneratedReceipt(it) && !it.url) {
      void downloadGeneratedReceipt(it);
      return;
    }

    if (!it.url) {
      toast.warning("Aucun fichier disponible pour ce document");
      return;
    }

    try {
      const url = await resolveDocumentUrl(it.url);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${it.name || "document"}.pdf`;
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e: any) {
      toast.error("Impossible de télécharger le document", { description: e?.message });
    }
  };

  const resolveDocumentUrl = async (url: string): Promise<string> => {
    const value = String(url || "").trim();
    if (!value || /^https?:/i.test(value) || value.startsWith("blob:")) return value;
    const knownBuckets = ["client-documents", "contracts", "invoices", "receipts", "order-documents"];
    const parts = value.split("/");
    const bucket = knownBuckets.includes(parts[0]) ? parts[0] : "client-documents";
    const key = knownBuckets.includes(parts[0]) ? parts.slice(1).join("/") : value;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(key, 300);
    if (error || !data?.signedUrl) throw new Error(error?.message || "URL signée indisponible");
    return data.signedUrl;
  };

  const contractSignatureStatus = (m: any): { label: string; tone: string; icon: any } => {
    const status = m?.status;
    if (status === "signed_by_client" || status === "fully_signed" || m?.signed_at) {
      return { label: `Signé ${m?.signed_at ? new Date(m.signed_at).toLocaleDateString("fr-CA") : ""}`.trim(), tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: CheckCircle2 };
    }
    if (status === "expired") return { label: "Expiré", tone: "bg-red-500/15 text-red-300 border-red-500/30", icon: XCircle };
    return { label: "En attente signature", tone: "bg-amber-500/15 text-amber-300 border-amber-500/30", icon: Clock };
  };

  const extractContractId = (it: DocItem): string | null => {
    // it.id is like "canonical-contract-<uuid>" or "contract-<uuid>"
    const m = it.id.match(/contract-([0-9a-f-]{36})$/i);
    return m?.[1] || null;
  };

  const handleResend = async (it: DocItem) => {
    const contractId = extractContractId(it);
    if (!contractId) return toast.error("ID de contrat introuvable");
    setBusyId(it.id);
    try {
      const { data, error } = await supabase.functions.invoke("account-document-manage", {
        body: { action: "resend_signature", contract_id: contractId },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || "Échec");
      toast.success("Lien de signature renvoyé au client");
      await load();
    } catch (e: any) {
      toast.error("Renvoi impossible", { description: e.message });
    } finally { setBusyId(null); }
  };

  const handleUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) return toast.error("Fichier > 10 Mo");
    setBusyId("upload");
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const { data, error } = await supabase.functions.invoke("account-document-manage", {
        body: { action: "upload", client_user_id: clientUserId, file_b64: b64, filename: file.name, document_type: "manual_upload" },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || "Échec");
      toast.success("Document téléversé");
      await load();
    } catch (e: any) {
      toast.error("Upload impossible", { description: e.message });
    } finally { setBusyId(null); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleDelete = async (it: DocItem) => {
    if (!confirm(`Supprimer « ${it.name} » ? Action irréversible.`)) return;
    // it.id can be canonical-upload-<id> or uploaded-<id>
    const m = it.id.match(/([0-9a-f-]{36})$/i);
    const docId = m?.[1];
    if (!docId) return toast.error("ID introuvable");
    setBusyId(it.id);
    try {
      const { data, error } = await supabase.functions.invoke("account-document-manage", {
        body: { action: "delete", document_id: docId },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || "Échec");
      toast.success("Document supprimé");
      await load();
    } catch (e: any) {
      toast.error("Suppression impossible", { description: e.message });
    } finally { setBusyId(null); }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-violet-400" />
            Documents — {clientName}
          </DialogTitle>
          <DialogDescription>
            Contrats, factures, reçus, documents KYC et pièces de commande. Les liens vers le stockage privé expirent après 5 minutes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (numéro, nom, type…)"
              className="pl-8"
            />
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          {isAdmin && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
              />
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={busyId === "upload"}>
                {busyId === "upload" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UploadCloud className="h-4 w-4 mr-1.5" />}
                Téléverser
              </Button>
            </>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="w-full justify-start flex-wrap h-auto">
            <TabsTrigger value="all">Tout ({items.length})</TabsTrigger>
            <TabsTrigger value="contract">Contrats ({counts.contract})</TabsTrigger>
            <TabsTrigger value="invoice">Factures ({counts.invoice})</TabsTrigger>
            <TabsTrigger value="receipt">Reçus ({counts.receipt})</TabsTrigger>
            <TabsTrigger value="auto">Auto ({counts.auto})</TabsTrigger>
            <TabsTrigger value="uploaded">Téléversés ({counts.uploaded})</TabsTrigger>
            <TabsTrigger value="order">Commandes ({counts.order})</TabsTrigger>
            <TabsTrigger value="quote">Soumissions ({counts.quote})</TabsTrigger>
          </TabsList>
        </Tabs>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Aucun document trouvé.
            </div>
          ) : (
            <ul className="space-y-2 py-2">
              {filtered.map((it) => {
                const meta = sourceMeta[it.source];
                const Icon = meta.icon;
                const isContract = it.source === "contract";
                const sigStatus = isContract ? contractSignatureStatus(it.metadata) : null;
                const SigIcon = sigStatus?.icon;
                const isSigned = sigStatus?.label.startsWith("Signé");
                const isExpired = sigStatus?.label === "Expiré";
                const canResend = isContract && !isSigned && !isExpired && isStaff;
                const isUploaded = it.source === "uploaded";
                const canOpen = !!it.url || isGeneratedDeliverySlip(it) || isGeneratedInvoice(it) || isGeneratedReceipt(it);
                return (
                  <li
                    key={`${it.source}-${it.id}`}
                    className="rounded-md border border-[hsl(220,15%,20%)] bg-[hsl(220,20%,10%)] hover:border-violet-500/40 transition-colors p-3 flex items-center gap-3"
                  >
                    <div className={`shrink-0 h-10 w-10 rounded-md border flex items-center justify-center ${meta.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate text-core-text-primary">{it.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${meta.tone}`}>{meta.label}</Badge>
                        {sigStatus && SigIcon && (
                          <Badge variant="outline" className={`text-[10px] ${sigStatus.tone} flex items-center gap-1`}>
                            <SigIcon className="h-3 w-3" /> {sigStatus.label}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] border-[hsl(220,15%,22%)] text-core-text-secondary">{it.category}</Badge>
                      </div>
                      <div className="text-[11px] text-core-text-label mt-1 flex items-center gap-3 flex-wrap">
                        <span>{new Date(it.created_at).toLocaleString("fr-CA")}</span>
                        {it.number && <span>N° {it.number}</span>}
                        <span>{formatBytes(it.size_bytes)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {canResend && (
                        <Button size="sm" variant="outline" onClick={() => handleResend(it)} disabled={busyId === it.id}
                          className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10">
                          {busyId === it.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Send className="h-3.5 w-3.5 mr-1" /> Renvoyer</>}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openDoc(it)} disabled={!canOpen}>
                        <Eye className="h-3.5 w-3.5 mr-1.5" /> Voir
                      </Button>
                      {canOpen && (
                        <Button size="sm" variant="outline" onClick={() => downloadDoc(it)}>
                          <Download className="h-3.5 w-3.5 mr-1.5" /> Télécharger
                        </Button>
                      )}
                      {isAdmin && isUploaded && (
                        <Button size="sm" variant="outline" onClick={() => handleDelete(it)} disabled={busyId === it.id}
                          className="border-red-500/30 text-red-300 hover:bg-red-500/10">
                          {busyId === it.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
    <PDFViewerDialog
      open={pdfViewer.isOpen}
      onOpenChange={pdfViewer.setOpen}
      pdfBlob={pdfViewer.pdfBlob}
      title={pdfViewer.title}
      filename={pdfViewer.filename}
      isLoading={pdfViewer.isLoading}
      error={pdfViewer.error}
    />
    </>
  );
}
