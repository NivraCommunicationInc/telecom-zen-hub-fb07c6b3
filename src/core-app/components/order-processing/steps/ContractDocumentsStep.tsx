/**
 * ContractDocumentsStep — Step 8: Contract & Documents
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Send, RefreshCw, PenTool, Eye, Loader2, Download, Truck } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { generateOrderDocuments } from "@/lib/pdf";
import PDFViewerDialog from "@/components/PDFViewerDialog";
import { SignatureStatusBlock } from "./SignatureStatusBlock";
import { StepCompletionCard } from "../StepCompletionCard";
import { supabase } from "@/integrations/supabase/client";

interface Props { proc: any; }

export function ContractDocumentsStep({ proc }: Props) {
  const { order, contracts, invoice } = proc;
  const [loading, setLoading] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFilename, setPdfFilename] = useState("");
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [shippingSlip, setShippingSlip] = useState<any>(null);

  // Fetch shipping slip PDF (order_shipping_slip) from client_auto_documents
  useEffect(() => {
    if (!order?.order_number) return;
    const idempKey = `order_${order.order_number}_order_shipping_slip`;
    supabase
      .from("client_auto_documents")
      .select("storage_path, created_at, doc_number, metadata")
      .eq("idempotency_key", idempKey)
      .maybeSingle()
      .then(({ data }) => setShippingSlip(data));
  }, [order?.order_number]);

  const documents = [
    { type: "Contrat", key: "contract", available: contracts.length > 0, data: contracts[0] },
    { type: "Facture", key: "invoice", available: !!invoice, data: invoice },
    { type: "Sommaire de commande", key: "summary", available: true, data: order },
    { type: "Reçu", key: "receipt", available: !!invoice?.paid_at, data: invoice },
    { type: "Bordereau de livraison", key: "shipping_slip", available: !!shippingSlip, data: shippingSlip },
    { type: "Conditions de service", key: "terms", available: true, data: null },
  ];

  const handleViewOrDownload = async (doc: typeof documents[0], download = false) => {
    const loadKey = download ? `dl-${doc.key}` : doc.key;
    setLoading(loadKey);
    try {
      // Shipping slip lives in storage (client-documents bucket) — fetch signed URL
      if (doc.key === "shipping_slip") {
        if (!shippingSlip?.storage_path) { toast.error("Bordereau non disponible"); return; }
        const { data: signed, error: sErr } = await supabase.storage
          .from("client-documents")
          .createSignedUrl(shippingSlip.storage_path, 900);
        if (sErr || !signed?.signedUrl) { toast.error("Erreur d'accès au bordereau"); return; }
        const resp = await fetch(signed.signedUrl);
        const blob = await resp.blob();
        const filename = `Bon_Livraison_${shippingSlip.doc_number || order.order_number}.pdf`;
        if (download) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url; link.download = filename;
          document.body.appendChild(link); link.click(); document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          toast.success("Téléchargement démarré");
        } else {
          setPdfBlob(blob); setPdfTitle("Bordereau de livraison"); setPdfFilename(filename); setPdfViewerOpen(true);
        }
        return;
      }

      const result = await generateOrderDocuments(order.id);
      if (!result) { toast.error("Données de document introuvables"); return; }

      let blob: Blob | null = null;
      let title = doc.type;
      let filename = `${doc.type}.pdf`;

      switch (doc.key) {
        case "contract":
          blob = result.contract.blob || null;
          filename = result.contract.filename || filename;
          break;
        case "invoice":
          blob = result.invoice.blob || null;
          filename = result.invoice.filename || filename;
          break;
        case "summary":
          blob = result.orderSummary.blob || null;
          filename = result.orderSummary.filename || filename;
          break;
        case "receipt":
          blob = result.receipt.blob || null;
          title = "Reçu de paiement";
          filename = result.receipt.filename || `Nivra Telecom - Recu de paiement - ${order.order_number || ""}.pdf`;
          break;
        case "terms":
          blob = result.terms.blob || null;
          filename = result.terms.filename || filename;
          break;
      }

      if (blob) {
        if (download) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          toast.success("Téléchargement démarré");
        } else {
          setPdfBlob(blob);
          setPdfTitle(title);
          setPdfFilename(filename);
          setPdfViewerOpen(true);
        }
      } else {
        toast.error("Erreur lors de la génération du document");
      }
    } catch (err) {
      console.error("[Documents] View/Download error:", err);
      toast.error("Erreur lors de l'ouverture du document");
    } finally { setLoading(null); }
  };

  const handleSend = async (doc: typeof documents[0]) => {
    setLoading(`send-${doc.key}`);
    try {
      await proc.sendClientNotification(
        `document_${doc.key}_sent`,
        `Document disponible: ${doc.type} — Nivra`,
        { document_type: doc.type, order_number: order.order_number || "" }
      );
      toast.success(`${doc.type} envoyé au client`);
    } catch (err) {
      console.error("[Documents] Send error:", err);
      toast.error("Erreur lors de l'envoi");
    } finally { setLoading(null); }
  };

  const handleRegenerate = async () => {
    setLoading("regenerate");
    try {
      const result = await generateOrderDocuments(order.id);
      if (!result) { toast.error("Données introuvables"); return; }
      toast.success("Documents régénérés avec succès");
      proc.refetch();
    } catch (err) {
      console.error("[Documents] Regenerate error:", err);
      toast.error("Erreur lors de la régénération");
    } finally { setLoading(null); }
  };

  const handleSignContract = async () => {
    if (contracts.length === 0) { toast.error("Aucun contrat à signer"); return; }
    setLoading("sign");
    try {
      const contractId = contracts[0].id;
      await proc.signContract(contractId);

      // Queue contract_sign_request email to client now that Nivra has signed.
      try {
        const { data: freshContract } = await supabase
          .from("contracts")
          .select("id, signature_token, signature_token_expires_at, admin_signed_at")
          .eq("id", contractId)
          .maybeSingle();

        const clientEmail =
          proc?.profile?.email ||
          order?.client_email ||
          order?.email ||
          null;
        const signature_token = freshContract?.signature_token;

        if (clientEmail && signature_token) {
          const services =
            order?.services_summary ||
            order?.plan_name ||
            (Array.isArray(order?.items)
              ? order.items.map((i: any) => i.name || i.plan_name).filter(Boolean).join(", ")
              : null) ||
            "Vos services Nivra";

          const agentName =
            order?.agent_name ||
            proc?.agent?.name ||
            order?.created_by_name ||
            "Votre conseiller Nivra";
          const agentNumber =
            order?.agent_number ||
            proc?.agent?.agent_number ||
            "";

          const sign_url = `https://nivra-telecom.ca/signer/${signature_token}`;

          const { error: qErr } = await supabase.from("email_queue").insert({
            event_key: `contract_sign_request_${contractId}`,
            to_email: clientEmail,
            template_key: "contract_sign_request",
            template_vars: {
              client_first_name: order?.client_first_name || proc?.profile?.first_name || "",
              client_last_name: order?.client_last_name || proc?.profile?.last_name || "",
              client_name:
                [order?.client_first_name || proc?.profile?.first_name, order?.client_last_name || proc?.profile?.last_name]
                  .filter(Boolean).join(" ") || "Client",
              order_number: order?.order_number || "",
              services,
              agent_name: agentName,
              agent_number: agentNumber,
              token_expires_at: freshContract?.signature_token_expires_at || null,
              sign_url,
              signature_url: sign_url,
            },
            status: "queued",
          });
          if (qErr) {
            console.error("[ContractSignRequest] enqueue error:", qErr);
          } else {
            toast.success("Contrat signé par Nivra ✓ — Email envoyé au client pour signature");
          }
        }
      } catch (mailErr) {
        console.error("[ContractSignRequest] unexpected error:", mailErr);
      }
    }
    catch (err) {
      console.error("[Documents] Sign error:", err);
      toast.error("Erreur lors de la signature");
    } finally { setLoading(null); }
  };

  const handleSendAll = async () => {
    setLoading("sendAll");
    try {
      await proc.sendClientNotification(
        "all_documents_sent",
        "Vos documents sont disponibles — Nivra",
        {
          document_types: documents.filter(d => d.available).map(d => d.type).join(", "),
          order_number: order.order_number || "",
        }
      );
      toast.success("Tous les documents envoyés au client");
    } catch (err) {
      console.error("[Documents] Send all error:", err);
      toast.error("Erreur lors de l'envoi");
    } finally { setLoading(null); }
  };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Contrat & Documents</div>

      {contracts.length > 0 && (contracts[0].client_signed_at || contracts[0].admin_signed_at) && (
        <StepCompletionCard
          title="Contrat généré et signé"
          at={contracts[0].client_signed_at || contracts[0].admin_signed_at}
          details={[
            { label: "Statut", value: contracts[0].status },
            { label: "Version", value: contracts[0].version ? `v${contracts[0].version}` : null },
            { label: "Signé client", value: contracts[0].client_signed_at ? "Oui" : "Non" },
            { label: "Signé admin", value: contracts[0].admin_signed_at ? "Oui" : "Non" },
          ]}
        />
      )}

      <div className="space-y-2 mb-4">
        {documents.map((doc, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-[#111827] rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-100">{doc.type}</p>
                {doc.available && doc.data?.created_at && (
                  <p className="text-xs text-slate-500">{format(new Date(doc.data.created_at), "d MMM yyyy", { locale: fr })}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {doc.available ? (
                <>
                  <span className="bg-green-900/50 text-green-300 text-[10px] font-medium px-2 py-1 rounded-full mr-2">Disponible</span>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => handleViewOrDownload(doc, false)}
                    disabled={loading === doc.key}
                    className="text-xs h-7 bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    {loading === doc.key ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Eye className="w-3 h-3 mr-1" />} Voir
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => handleViewOrDownload(doc, true)}
                    disabled={loading === `dl-${doc.key}`}
                    className="text-xs h-7 bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    {loading === `dl-${doc.key}` ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />} Télécharger
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => handleSend(doc)}
                    disabled={loading === `send-${doc.key}`}
                    className="text-xs h-7 bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    {loading === `send-${doc.key}` ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />} Envoyer
                  </Button>
                </>
              ) : (
                <span className="bg-slate-800 text-slate-400 text-[10px] font-medium px-2 py-1 rounded-full">Non généré</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Signature status */}
      {contracts.length > 0 && <SignatureStatusBlock contract={contracts[0]} order={order} onRefresh={proc.refetch} />}

      {/* Contract details */}
      {contracts.length > 0 && (
        <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
          <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
            <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Dernier contrat</h4>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-slate-500">Statut:</span> <span className="font-medium text-slate-100 ml-1">{contracts[0].status || "—"}</span></div>
            <div><span className="text-slate-500">Version:</span> <span className="font-medium text-slate-100 ml-1">v{contracts[0].version || 1}</span></div>
            <div><span className="text-slate-500">Signé client:</span>
              {contracts[0].client_signed_at
                ? <span className="bg-blue-900/50 text-blue-300 text-[10px] font-medium px-2 py-1 rounded-full ml-2">Signé</span>
                : <span className="text-slate-100 ml-1">Non</span>}
            </div>
            <div><span className="text-slate-500">Signé admin:</span>
              {contracts[0].admin_signed_at
                ? <span className="bg-blue-900/50 text-blue-300 text-[10px] font-medium px-2 py-1 rounded-full ml-2">Signé</span>
                : <span className="text-slate-100 ml-1">Non</span>}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-700/50">
        <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={loading === "regenerate"} className="text-sm bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800">
          {loading === "regenerate" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Régénérer documents
        </Button>
        <Button size="sm" onClick={handleSignContract} disabled={loading === "sign" || contracts.length === 0} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
          {loading === "sign" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <PenTool className="w-3 h-3 mr-1" />}
          Signer contrat
        </Button>
        <Button size="sm" onClick={handleSendAll} disabled={loading === "sendAll"} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
          {loading === "sendAll" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
          Envoyer tous au client
        </Button>
      </div>

      <PDFViewerDialog
        open={pdfViewerOpen}
        onOpenChange={setPdfViewerOpen}
        pdfBlob={pdfBlob}
        title={pdfTitle}
        filename={pdfFilename}
      />
    </div>
  );
}
