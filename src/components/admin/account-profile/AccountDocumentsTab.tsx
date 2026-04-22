/**
 * AccountDocumentsTab — Contracts, KYC, uploaded docs with view/download/send actions
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { FileText, Shield, Loader2, Eye, Download, Send } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import PDFViewerDialog from "@/components/PDFViewerDialog";
import { generateContractPDF, type ContractData } from "@/lib/pdf";
import { safePDFDownload } from "@/lib/pdfUtils";
import { useNavigate } from "react-router-dom";

interface AccountDocumentsTabProps {
  clientId: string;
  accountId: string;
}

export function AccountDocumentsTab({ clientId, accountId }: AccountDocumentsTabProps) {
  const navigate = useNavigate();
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFilename, setPdfFilename] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  // Contracts from canonical contracts table, fallback to order snapshots
  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ["account-docs-contracts", accountId],
    queryFn: async () => {
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id")
        .eq("account_id", accountId);

      if (ordersError) throw ordersError;

      const orderIds = (orders || []).map((order) => order.id).filter(Boolean);

      if (orderIds.length > 0) {
        const { data: canonicalContracts, error: contractsError } = await supabase
          .from("contracts")
          .select("id, order_id, created_at, contract_name, contract_number, is_signed, signed_at, client_signed_at")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false })
          .limit(20);

        if (contractsError) throw contractsError;
        if (canonicalContracts?.length) return canonicalContracts;

        const { data: snapshots, error: snapshotsError } = await supabase
          .from("order_snapshots")
          .select("id, order_id, created_at, contract_summary_snapshot")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false })
          .limit(20);

        if (snapshotsError) throw snapshotsError;
        return snapshots || [];
      }

      return [];
    },
    enabled: !!accountId,
  });

  // KYC sessions
  const { data: kycSessions, isLoading: kycLoading } = useQuery({
    queryKey: ["account-docs-kyc", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("identity_verification_sessions")
        .select("id, case_number, status, created_at, document_type")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Client uploaded documents
  const { data: clientDocs } = useQuery({
    queryKey: ["account-docs-uploaded", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("*")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const isLoading = contractsLoading || kycLoading;

  const handleViewContract = async (contract: any) => {
    setPdfLoading(true);
    setPdfOpen(true);
    setPdfTitle(`Contrat — ${contract.order_id?.slice(0, 8)}`);
    setPdfFilename(`Contrat_${contract.order_id?.slice(0, 8)}.pdf`);
    try {
      const snapshot = contract.contract_summary_snapshot || {};
      const contractData: ContractData = {
        contractNumber: snapshot.contract_number || contract.order_id?.slice(0, 8) || "N/A",
        date: contract.created_at,
        customer: snapshot.customer || { full_name: "Client", email: "", phone: "", address: "" },
        services: snapshot.services || [],
        pricing: snapshot.pricing || { subtotal: 0, tps: 0, tvq: 0, total: 0 },
        terms: snapshot.terms || [],
      };
      const result = await generateContractPDF(contractData);
      if (result.success && result.blob) {
        setPdfBlob(result.blob);
      } else {
        toast.error("Erreur de génération du contrat");
        setPdfOpen(false);
      }
    } catch {
      toast.error("Erreur de génération");
      setPdfOpen(false);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadContract = async (contract: any) => {
    try {
      const snapshot = contract.contract_summary_snapshot || {};
      const contractData: ContractData = {
        contractNumber: snapshot.contract_number || contract.order_id?.slice(0, 8) || "N/A",
        date: contract.created_at,
        customer: snapshot.customer || { full_name: "Client", email: "", phone: "", address: "" },
        services: snapshot.services || [],
        pricing: snapshot.pricing || { subtotal: 0, tps: 0, tvq: 0, total: 0 },
        terms: snapshot.terms || [],
      };
      const result = await generateContractPDF(contractData);
      if (result.success && result.blob && result.filename) {
        safePDFDownload(result.blob, result.filename);
      }
    } catch {
      toast.error("Erreur téléchargement");
    }
  };

  const handleSendContract = async (contract: any) => {
    try {
      const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("user_id", clientId).maybeSingle();
      if (!profile?.email) { toast.error("Email client introuvable"); return; }

      await supabase.from("email_queue").insert({
        to_email: profile.email,
        to_name: profile.full_name || "",
        subject: `Votre contrat Nivra`,
        template_key: "contract_ready_for_signature",
        status: "pending",
        metadata: { order_id: contract.order_id, contract_id: contract.id },
      });
      toast.success("Email de contrat envoyé au client");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const handleViewOrder = (orderId: string) => {
    navigate(`/admin/orders/${orderId}`);
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Contracts */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contrats ({contracts?.length || 0})</h4>
        {!contracts?.length ? (
          <p className="text-sm text-muted-foreground">Aucun contrat</p>
        ) : (
          contracts.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-md border">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleViewOrder(c.order_id)}>
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium hover:underline">
                    {c.contract_name || c.contract_number || `Contrat — ${c.order_id?.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.created_at && format(new Date(c.created_at), "d MMM yyyy", { locale: fr })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {typeof c.is_signed === "boolean" && (
                  <Badge variant={c.is_signed || c.client_signed_at || c.signed_at ? "default" : "outline"} className="text-[10px]">
                    {c.is_signed || c.client_signed_at || c.signed_at ? "Signé" : "En attente"}
                  </Badge>
                )}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewContract(c)} title="Voir">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownloadContract(c)} title="Télécharger">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSendContract(c)} title="Envoyer au client">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* KYC */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vérification d'identité ({kycSessions?.length || 0})</h4>
        {!kycSessions?.length ? (
          <p className="text-sm text-muted-foreground">Aucune vérification</p>
        ) : (
          kycSessions.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-md border">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{s.case_number || "KYC"}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.document_type || "ID"} • {s.created_at && format(new Date(s.created_at), "d MMM yyyy", { locale: fr })}
                  </p>
                </div>
              </div>
              <Badge
                variant={s.status === "approved" ? "default" : s.status === "rejected" ? "destructive" : "outline"}
                className="text-[10px]"
              >
                {s.status}
              </Badge>
            </div>
          ))
        )}
      </div>

      {/* Uploaded Documents */}
      {(clientDocs?.length || 0) > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Documents téléversés ({clientDocs?.length})</h4>
          {clientDocs?.map((doc: any) => (
            <div key={doc.id} className="flex items-center justify-between p-3 rounded-md border">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{doc.document_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.document_type || "Document"} • {doc.created_at && format(new Date(doc.created_at), "d MMM yyyy", { locale: fr })}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(doc.document_url, "_blank")} title="Ouvrir">
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* PDF Viewer */}
      <PDFViewerDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        pdfBlob={pdfBlob}
        title={pdfTitle}
        filename={pdfFilename}
        isLoading={pdfLoading}
      />
    </div>
  );
}
