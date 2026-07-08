/**
 * ContractDocumentsStep — Step 8: Contract & Documents
 * All buttons are fully functional: View, Send, Regenerate, Sign.
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Send, RefreshCw, PenTool, Eye, Loader2, Download } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { generateOrderDocuments } from "@/lib/pdf";
import { generateDeliverySlipPDF } from "@/lib/pdf/deliverySlipTemplate";
import PDFViewerDialog from "@/components/PDFViewerDialog";
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

  useEffect(() => {
    if (!order?.order_number) return;
    supabase
      .from("client_auto_documents")
      .select("storage_path, created_at, doc_number, metadata")
      .eq("idempotency_key", `order_${order.order_number}_order_shipping_slip`)
      .maybeSingle()
      .then(({ data }) => setShippingSlip(data));
  }, [order?.order_number]);

  const documents = [
    { type: "Contrat", key: "contract", available: contracts.length > 0, data: contracts[0] },
    { type: "Facture", key: "invoice", available: !!invoice, data: invoice },
    { type: "Sommaire de commande", key: "summary", available: true, data: order },
    { type: "Reçu", key: "receipt", available: !!invoice?.paid_at, data: invoice },
    { type: "Bordereau de livraison", key: "shipping_slip", available: true, data: shippingSlip || order },
    { type: "Conditions de service", key: "terms", available: true, data: null },
  ];

  const handleViewOrDownload = async (doc: typeof documents[0], download = false) => {
    const loadKey = download ? `dl-${doc.key}` : doc.key;
    setLoading(loadKey);
    try {
      if (doc.key === "shipping_slip") {
        let blob: Blob | null = null;
        let filename = `Bon_Livraison_${order.order_number || order.id?.slice(0, 8) || "commande"}.pdf`;

        if (shippingSlip?.storage_path) {
          const { data: signed, error } = await supabase.storage
            .from("client-documents")
            .createSignedUrl(shippingSlip.storage_path, 900);
          if (!error && signed?.signedUrl) {
            const response = await fetch(signed.signedUrl);
            blob = await response.blob();
            filename = `Bon_Livraison_${shippingSlip.doc_number || order.order_number || "commande"}.pdf`;
          }
        }

        if (!blob) {
          const equipmentItems = (proc.items || [])
            .filter((item: any) => {
              const text = `${item.product_name || item.plan_name || item.name || ""} ${item.description || ""}`.toLowerCase();
              return !text.includes("mensuel") && !text.includes("forfait") && !text.includes("plan internet") && !text.includes("plan tv") && !text.includes("plan mobile");
            })
            .map((item: any) => ({
              description: item.product_name || item.plan_name || item.name || item.description || "Équipement",
              serial_number: item.serial_number || undefined,
              quantity: Math.max(1, Number(item.quantity || item.qty || 1)),
            }));
          const snapshotItems = Array.isArray(order?.equipment_details)
            ? order.equipment_details.map((item: any) => ({
                description: item.label || item.name || item.type || "Équipement",
                serial_number: item.serial_number || undefined,
                quantity: Math.max(1, Number(item.quantity || item.qty || 1)),
              }))
            : [];
          const meta = shippingSlip?.metadata || {};
          const result = generateDeliverySlipPDF({
            slip_number: shippingSlip?.doc_number || `BL-${order.order_number || order.id?.slice(0, 8) || "commande"}`,
            issue_date: order.shipped_at || order.created_at || new Date().toISOString(),
            client_name: [order.client_first_name, order.client_last_name].filter(Boolean).join(" ") || proc.profile?.full_name || "Client Nivra",
            client_email: order.client_email || proc.profile?.email || "",
            client_phone: order.client_phone || proc.profile?.phone || "",
            account_number: proc.account?.account_number || order.account_number || "",
            delivery_address: order.shipping_address || order.client_full_address || proc.account?.primary_service_address || "",
            delivery_city: order.shipping_city || proc.account?.primary_service_city || "",
            delivery_province: order.shipping_province || proc.account?.primary_service_province || "QC",
            delivery_postal: order.shipping_postal_code || proc.account?.primary_service_postal_code || "",
            order_number: String(order.order_number || ""),
            carrier: meta.carrier || order.carrier || "En préparation",
            tracking_number: meta.tracking_number || order.tracking_number || "—",
            items: equipmentItems.length ? equipmentItems : snapshotItems.length ? snapshotItems : [{ description: "Équipement à expédier", quantity: 1 }],
          });
          if (result.success && result.blob) blob = result.blob;
        }

        if (!blob) { toast.error("Bordereau non disponible"); return; }

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
          setPdfTitle("Bordereau de livraison");
          setPdfFilename(filename);
          setPdfViewerOpen(true);
        }
        return;
      }

      const result = await generateOrderDocuments(order.id);
      if (!result) {
        toast.error("Données de document introuvables");
        return;
      }

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
          blob = result.invoice.blob || null;
          title = "Reçu";
          filename = result.invoice.filename
            ? result.invoice.filename.replace("Facture", "Recu de paiement")
            : `Nivra Telecom - Recu de paiement - ${order.order_number || ""}.pdf`;
          break;
        case "terms":
          blob = result.terms.blob || null;
          filename = result.terms.filename || filename;
          break;
      }

      if (blob) {
        if (download) {
          // Direct download
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
    } finally {
      setLoading(null);
    }
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
    } finally {
      setLoading(null);
    }
  };

  const handleRegenerate = async () => {
    setLoading("regenerate");
    try {
      const result = await generateOrderDocuments(order.id);
      if (!result) {
        toast.error("Données introuvables");
        return;
      }
      toast.success("Documents régénérés avec succès");
      proc.refetch();
    } catch (err) {
      console.error("[Documents] Regenerate error:", err);
      toast.error("Erreur lors de la régénération");
    } finally {
      setLoading(null);
    }
  };

  const handleSignContract = async () => {
    if (contracts.length === 0) {
      toast.error("Aucun contrat à signer");
      return;
    }
    setLoading("sign");
    try {
      await proc.signContract(contracts[0].id);
    } catch (err) {
      console.error("[Documents] Sign error:", err);
      toast.error("Erreur lors de la signature");
    } finally {
      setLoading(null);
    }
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
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Contrat & Documents</h3>

      <div className="space-y-3">
        {documents.map((doc, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">{doc.type}</p>
                {doc.available && doc.data?.created_at && (
                  <p className="text-xs text-gray-500">
                    {format(new Date(doc.data.created_at), "d MMM yyyy", { locale: fr })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {doc.available ? (
                <>
                  <span className="text-xs text-emerald-600 font-medium mr-2">Disponible</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewOrDownload(doc, false)}
                    disabled={loading === doc.key}
                    className="text-xs h-7 border-gray-300 text-gray-700"
                  >
                    {loading === doc.key ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                    Voir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewOrDownload(doc, true)}
                    disabled={loading === `dl-${doc.key}`}
                    className="text-xs h-7 border-gray-300 text-gray-700"
                  >
                    {loading === `dl-${doc.key}` ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
                    Télécharger
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSend(doc)}
                    disabled={loading === `send-${doc.key}`}
                    className="text-xs h-7 border-gray-300 text-gray-700"
                  >
                    {loading === `send-${doc.key}` ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                    Envoyer
                  </Button>
                </>
              ) : (
                <span className="text-xs text-gray-400">Non généré</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Contract details */}
      {contracts.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Dernier contrat</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-gray-500">Statut:</span> <span className="font-medium text-gray-900">{contracts[0].status || "—"}</span></div>
            <div><span className="text-gray-500">Version:</span> <span className="font-medium text-gray-900">v{contracts[0].version || 1}</span></div>
            <div><span className="text-gray-500">Signé client:</span> <span className="font-medium text-gray-900">{contracts[0].client_signed_at ? "Oui" : "Non"}</span></div>
            <div><span className="text-gray-500">Signé admin:</span> <span className="font-medium text-gray-900">{contracts[0].admin_signed_at ? "Oui" : "Non"}</span></div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-gray-100">
        <Button
          size="sm"
          variant="outline"
          onClick={handleRegenerate}
          disabled={loading === "regenerate"}
          className="text-xs h-8 border-gray-300 text-gray-700"
        >
          {loading === "regenerate" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Régénérer documents
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSignContract}
          disabled={loading === "sign" || contracts.length === 0}
          className="text-xs h-8 border-gray-300 text-gray-700"
        >
          {loading === "sign" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <PenTool className="w-3 h-3 mr-1" />}
          Signer contrat
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSendAll}
          disabled={loading === "sendAll"}
          className="text-xs h-8 border-gray-300 text-gray-700"
        >
          {loading === "sendAll" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
          Envoyer tous au client
        </Button>
      </div>

      {/* PDF Viewer Dialog */}
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
