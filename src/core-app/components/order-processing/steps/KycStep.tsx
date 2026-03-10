/**
 * KycStep — Enhanced KYC verification with document type, OCR score, status, and ID preview
 */
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, FileSearch, RefreshCw, Eye, ShieldCheck, ShieldAlert, FileText, Percent } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";

interface Props { proc: any; }

export function KycStep({ proc }: Props) {
  const { order, kycSession } = proc;
  const [note, setNote] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const kycStatus = kycSession?.status || order.id_verification_status || order._kycSessionStatus || "none";
  const sessionId = kycSession?.id || order.identity_verification_session_id;

  // Fetch identity documents linked to this session
  const { data: documents } = useQuery({
    queryKey: ["kyc-documents", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data } = await supabase
        .from("identity_documents")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleApprove = async () => {
    await proc.updateOrder({
      id_verification_status: "approved",
      id_verified_at: new Date().toISOString(),
    });
    toast.success("KYC approuvé");
  };

  const handleReject = async () => {
    await proc.updateOrder({
      id_verification_status: "rejected",
      id_verification_notes: note || "Rejeté par l'administrateur",
    });
    toast.warning("KYC rejeté");
  };

  const handleRequestResubmission = async () => {
    await proc.updateOrder({
      id_verification_status: "pending_docs",
      id_verification_notes: note || "Documents additionnels requis",
    });
    toast.info("Resoumission demandée");
  };

  // Extract OCR data from session or documents
  const ocrData = kycSession?.ocr_result || kycSession?.extracted_data;
  const matchScore = kycSession?.match_score ?? ocrData?.match_score;
  const docType = kycSession?.document_type || ocrData?.document_type || documents?.[0]?.document_type;

  const statusConfig: Record<string, { color: string; bg: string; border: string; icon: any; label: string }> = {
    approved:     { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: ShieldCheck, label: "Approuvé" },
    rejected:     { color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     icon: XCircle,     label: "Rejeté" },
    in_review:    { color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    icon: FileSearch,  label: "En revue" },
    pending:      { color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   icon: ShieldAlert, label: "En attente" },
    pending_docs: { color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   icon: ShieldAlert, label: "Docs requis" },
    none:         { color: "text-gray-500",    bg: "bg-gray-50",    border: "border-gray-200",    icon: ShieldAlert, label: "Non soumis" },
  };

  const sc = statusConfig[kycStatus] || statusConfig.none;
  const StatusIcon = sc.icon;

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Vérification KYC</h3>

      {/* Status banner */}
      <div className={`rounded-lg border ${sc.border} ${sc.bg} p-4 mb-4`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full ${sc.bg} border ${sc.border} flex items-center justify-center`}>
            <StatusIcon className={`h-5 w-5 ${sc.color}`} />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-bold ${sc.color}`}>{sc.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {kycSession?.case_number && `Case ${kycSession.case_number}`}
              {kycSession?.created_at && ` · Soumis le ${kycSession.created_at.slice(0, 10)}`}
            </p>
          </div>
          {matchScore != null && (
            <div className="text-center">
              <div className={`text-lg font-bold font-mono ${Number(matchScore) >= 80 ? "text-emerald-600" : Number(matchScore) >= 50 ? "text-amber-600" : "text-red-600"}`}>
                {Math.round(Number(matchScore))}%
              </div>
              <p className="text-[10px] text-gray-400 uppercase">Match OCR</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <DetailCard label="Type de document" value={formatDocType(docType)} icon={FileText} />
        <DetailCard label="Politique KYC" value={order.kyc_policy || "—"} icon={ShieldCheck} />
        <DetailCard
          label="Score OCR"
          value={matchScore != null ? `${Math.round(Number(matchScore))}%` : "N/A"}
          icon={Percent}
          accent={matchScore != null ? (Number(matchScore) >= 80 ? "text-emerald-600" : Number(matchScore) >= 50 ? "text-amber-600" : "text-red-600") : undefined}
        />
        <DetailCard label="Vérifié le" value={order.id_verified_at?.slice(0, 10) || "—"} icon={CheckCircle2} />
      </div>

      {/* Document preview */}
      {documents && documents.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Documents soumis</h4>
          <div className="grid grid-cols-2 gap-2">
            {documents.map((doc: any) => (
              <div key={doc.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium text-gray-700">
                    {formatDocType(doc.document_type)}
                    {doc.side && ` (${doc.side})`}
                  </span>
                  {doc.storage_path && (
                    <button
                      onClick={async () => {
                        try {
                          const { data } = await supabase.storage
                            .from("identity-documents")
                            .createSignedUrl(doc.storage_path, 300);
                          if (data?.signedUrl) setPreviewUrl(data.signedUrl);
                        } catch {
                          toast.error("Impossible de charger l'aperçu");
                        }
                      }}
                      className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" /> Aperçu
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 space-y-0.5">
                  {doc.file_name && <p>Fichier: {doc.file_name}</p>}
                  {doc.mime_type && <p>Type: {doc.mime_type}</p>}
                  {doc.created_at && <p>Uploadé: {doc.created_at.slice(0, 10)}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8" onClick={() => setPreviewUrl(null)}>
          <div className="bg-white rounded-xl p-2 max-w-2xl max-h-[80vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-3 py-2 border-b">
              <span className="text-sm font-semibold text-gray-800">Aperçu du document</span>
              <button onClick={() => setPreviewUrl(null)} className="text-xs text-gray-500 hover:text-gray-800">Fermer</button>
            </div>
            <img src={previewUrl} alt="Document ID" className="max-w-full rounded-lg mt-2" />
          </div>
        </div>
      )}

      {/* OCR extracted data */}
      {ocrData && typeof ocrData === "object" && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
          <h4 className="text-xs font-semibold text-blue-700 uppercase mb-2 flex items-center gap-1.5">
            <FileSearch className="w-3.5 h-3.5" /> Données extraites (OCR)
          </h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            {Object.entries(ocrData as Record<string, any>)
              .filter(([k]) => !["match_score", "raw_text", "document_type"].includes(k))
              .map(([key, val]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-blue-600 capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="text-blue-900 font-medium">{String(val)}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Notes */}
      {order.id_verification_notes && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4">
          <h4 className="text-xs font-semibold text-amber-700 uppercase mb-1">Notes KYC</h4>
          <p className="text-sm text-amber-900">{order.id_verification_notes}</p>
        </div>
      )}

      {/* Internal note */}
      <div className="mb-4">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note interne (optionnel)…"
          className="min-h-[60px] text-sm border-gray-300 text-gray-900"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
        <Button size="sm" onClick={handleApprove} disabled={proc.isUpdating || kycStatus === "approved"} className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Approuver
        </Button>
        <Button size="sm" variant="outline" onClick={handleReject} disabled={proc.isUpdating} className="text-xs h-8 border-red-300 text-red-600 hover:bg-red-50">
          <XCircle className="w-3 h-3 mr-1" /> Rejeter
        </Button>
        <Button size="sm" variant="outline" onClick={handleRequestResubmission} disabled={proc.isUpdating} className="text-xs h-8 border-gray-300 text-gray-700">
          <RefreshCw className="w-3 h-3 mr-1" /> Demander resoumission
        </Button>
      </div>
    </div>
  );
}

function DetailCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-3.5 w-3.5 ${accent || "text-gray-400"}`} />
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{label}</span>
      </div>
      <p className={`text-sm font-semibold ${accent || "text-gray-800"}`}>{value}</p>
    </div>
  );
}

function formatDocType(type: string | null | undefined): string {
  if (!type) return "—";
  const map: Record<string, string> = {
    drivers_license: "Permis de conduire",
    passport: "Passeport",
    health_card: "Carte santé",
    national_id: "Carte d'identité",
    residence_permit: "Permis de résidence",
  };
  return map[type] || type.replace(/_/g, " ");
}
