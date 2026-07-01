/**
 * CorePDFTemplatesPage — PDF preview and email from real invoices
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, Database, Loader2, CheckCircle, XCircle, Eye, Download } from "lucide-react";
import { toast } from "sonner";

type SendResult = { type: string; status: "ok" | "skipped" | "error"; detail?: string };
type DocType = "invoice" | "receipt" | "contract" | "summary";

const DOC_LABELS: Record<DocType, string> = {
  invoice: "Facture",
  receipt: "Reçu de paiement",
  contract: "Contrat de service V3",
  summary: "Sommaire de commande",
};

function base64ToBlob(b64: string, contentType = "application/pdf"): Blob {
  const clean = b64.replace(/\s+/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

export default function CorePDFTemplatesPage() {
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState<DocType | null>(null);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [sentOrder, setSentOrder] = useState("");

  const { data: invoices = [] } = useQuery({
    queryKey: ["core-pdf-invoices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, total, status, order_id, billing_customers(first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const selectedInv: any = invoices.find((inv: any) => inv.id === selectedInvoice);
  const currentOrderId = selectedInv?.order_id ?? undefined;
  const currentInvoiceId = selectedInv?.id ?? undefined;

  const handlePreview = async (type: DocType, mode: "open" | "download") => {
    setPreviewLoading(type);
    try {
      const body = type === "invoice" || type === "receipt"
        ? {
            type,
            ...(currentInvoiceId ? { invoiceId: currentInvoiceId } : {}),
            ...(currentOrderId ? { orderId: currentOrderId } : {}),
          }
        : {
            type,
            ...(currentOrderId ? { orderId: currentOrderId } : {}),
          };
      const { data, error } = await supabase.functions.invoke("admin-preview-pdf", {
        body,
      });
      if (error) throw new Error((data as any)?.error || error.message);
      if (!data?.base64) throw new Error(data?.error || "PDF vide");

      const blob = base64ToBlob(data.base64);
      const url = URL.createObjectURL(blob);
      if (mode === "open") {
        window.open(url, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || `${type}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast.error(`${DOC_LABELS[type]} : ${e.message}`);
    } finally {
      setPreviewLoading(null);
    }
  };

  const handleSendEmail = async () => {
    const dest = prompt("Envoyer les PDFs à :", "support@nivra-telecom.ca");
    if (!dest) return;

    setEmailLoading(true);
    setResults(null);

    try {
      const { data: json, error: fnError } = await supabase.functions.invoke("admin-test-pdf-email", {
        body: {
          to: dest,
          ...(currentInvoiceId ? { invoiceId: currentInvoiceId } : {}),
          ...(currentOrderId ? { orderId: currentOrderId } : {}),
        },
      });

      if (fnError) {
        // Try to extract detail from response
        const ctx: any = (fnError as any).context;
        let detail = fnError.message;
        try {
          if (ctx && typeof ctx.text === "function") {
            const t = await ctx.text();
            if (t) detail = t;
          }
        } catch {}
        throw new Error(detail);
      }

      setResults(json.results ?? []);
      setSentTo(json.to ?? dest);
      setSentOrder(json.order_number ?? "—");
      toast.success(`PDFs envoyés à ${dest}`);
    } catch (e: any) {
      toast.error("Erreur envoi : " + e.message);
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Templates PDF</h1>
        <p className="text-sm text-[hsl(var(--core-text-secondary))]">Aperçu, téléchargement et envoi des documents depuis les données réelles</p>
      </div>

      <div className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Source de données</h2>
        </div>
        <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
          <SelectTrigger className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]">
            <SelectValue placeholder="Sélectionner une facture (optionnel — sinon dernière commande)" />
          </SelectTrigger>
          <SelectContent>
            {invoices.map((inv: any) => (
              <SelectItem key={inv.id} value={inv.id}>
                {inv.invoice_number} — {inv.billing_customers?.first_name} {inv.billing_customers?.last_name} ({inv.total?.toFixed(2)}$)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={handleSendEmail}
          disabled={emailLoading}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white w-full"
        >
          {emailLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" />Envoi en cours…</>
            : <><Send className="w-4 h-4" />Envoyer les 4 PDFs par email</>}
        </Button>
      </div>

      {/* Preview grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.keys(DOC_LABELS) as DocType[]).map((type) => {
          const loading = previewLoading === type;
          return (
            <div key={type} className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-400" />
                  <span className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{DOC_LABELS[type]}</span>
                </div>
                <Badge className="bg-emerald-600/15 text-emerald-400 border-0 text-[10px]">Actif</Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handlePreview(type, "open")}
                  disabled={loading}
                  className="flex-1 gap-2 bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                  Aperçu
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePreview(type, "download")}
                  disabled={loading}
                  className="flex-1 gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  Télécharger
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Results */}
      {results && (
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] overflow-hidden">
          <div className="px-4 py-2 bg-[hsl(220,15%,14%)] text-[11px] text-[hsl(var(--core-text-secondary))]">
            Envoyé à <strong className="text-[hsl(var(--core-text-primary))]">{sentTo}</strong>
            {" "}— commande <strong className="text-[hsl(var(--core-text-primary))]">{sentOrder}</strong>
          </div>
          <div className="divide-y divide-[hsl(220,15%,14%)]">
            {results.map((r, i) => (
              <div key={i} className="px-4 py-2 flex items-center gap-3 text-[12px]">
                {r.status === "ok"
                  ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  : r.status === "skipped"
                  ? <XCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                <span className="text-[hsl(var(--core-text-primary))] font-medium w-24 flex-shrink-0">{r.type}</span>
                <span className="text-[hsl(var(--core-text-secondary))]">{r.detail ?? r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
