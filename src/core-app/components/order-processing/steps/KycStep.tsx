/**
 * KycStep — KYC verification panel reading from identity_verification_sessions
 * Documents (front/back/selfie) are stored as paths on the session itself.
 * OCR data comes from extracted_fields, checkout_fields, and match_result.
 */
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, FileSearch, RefreshCw, Eye, ShieldCheck, ShieldAlert, FileText, Percent, Camera, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props { proc: any; }

const DOC_BUCKET = "id-documents";

export function KycStep({ proc }: Props) {
  const { order, kycSession } = proc;
  const [note, setNote] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState("");
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

  const kycStatus = kycSession?.status || order.id_verification_status || order._kycSessionStatus || "none";
  const sessionId = kycSession?.id;

  // Document paths from session
  const frontPath = kycSession?.document_front_path;
  const backPath = kycSession?.document_back_path;
  const selfiePath = kycSession?.selfie_path;
  const hasDocuments = !!(frontPath || backPath || selfiePath);

  // OCR / checkout data
  const checkoutFields = kycSession?.checkout_fields as Record<string, any> | null;
  const extractedFields = kycSession?.extracted_fields as Record<string, any> | null;
  const matchResult = kycSession?.match_result as Record<string, any> | null;
  const idType = kycSession?.id_type || checkoutFields?.document_type;
  const caseNumber = kycSession?.case_number;
  const submittedAt = kycSession?.submitted_at;

  // Compute match score from match_result if available
  const matchScore = matchResult?.overall_score ?? matchResult?.match_score ?? null;

  const handlePreview = async (path: string, label: string) => {
    if (!path) return;
    setLoadingPreview(label);
    try {
      const { data, error } = await supabase.storage
        .from(DOC_BUCKET)
        .createSignedUrl(path, 300);
      if (error) throw error;
      if (data?.signedUrl) {
        setPreviewUrl(data.signedUrl);
        setPreviewLabel(label);
      }
    } catch {
      toast.error("Impossible de charger l'aperçu");
    } finally {
      setLoadingPreview(null);
    }
  };

  const handleApprove = async () => {
    // Update session status if we have one
    if (sessionId) {
      await supabase
        .from("identity_verification_sessions")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", sessionId);
    }
    await proc.updateOrder({
      id_verification_status: "approved",
      id_verified_at: new Date().toISOString(),
      id_verification_notes: note || undefined,
    });
    toast.success("KYC approuvé");
  };

  const handleReject = async () => {
    if (sessionId) {
      await supabase
        .from("identity_verification_sessions")
        .update({ status: "rejected", reviewed_at: new Date().toISOString(), review_reason: note || "Rejeté par l'administrateur" })
        .eq("id", sessionId);
    }
    await proc.updateOrder({
      id_verification_status: "rejected",
      id_verification_notes: note || "Rejeté par l'administrateur",
    });
    toast.warning("KYC rejeté");
  };

  const handleRequestResubmission = async () => {
    if (sessionId) {
      await supabase
        .from("identity_verification_sessions")
        .update({ status: "pending_docs", review_reason: note || "Documents additionnels requis" })
        .eq("id", sessionId);
    }
    await proc.updateOrder({
      id_verification_status: "pending_docs",
      id_verification_notes: note || "Documents additionnels requis",
    });
    toast.info("Resoumission demandée");
  };

  const statusConfig: Record<string, { color: string; bg: string; border: string; icon: any; label: string }> = {
    approved:        { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: ShieldCheck, label: "Approuvé" },
    rejected:        { color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     icon: XCircle,     label: "Rejeté" },
    in_review:       { color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    icon: FileSearch,  label: "En revue" },
    manual_review:   { color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    icon: FileSearch,  label: "Revue manuelle" },
    pending:         { color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   icon: ShieldAlert, label: "En attente" },
    submitted:       { color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   icon: ShieldAlert, label: "Soumis" },
    pending_docs:    { color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   icon: ShieldAlert, label: "Docs requis" },
    none:            { color: "text-gray-500",    bg: "bg-gray-50",    border: "border-gray-200",    icon: ShieldAlert, label: "Non soumis" },
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
              {caseNumber && `Case ${caseNumber}`}
              {submittedAt && ` · Soumis le ${new Date(submittedAt).toLocaleDateString("fr-CA")}`}
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
        <DetailCard label="Type de document" value={formatDocType(idType)} icon={FileText} />
        <DetailCard label="Politique KYC" value={order.kyc_policy || "—"} icon={ShieldCheck} />
        <DetailCard
          label="Score OCR"
          value={matchScore != null ? `${Math.round(Number(matchScore))}%` : "N/A"}
          icon={Percent}
          accent={matchScore != null ? (Number(matchScore) >= 80 ? "text-emerald-600" : Number(matchScore) >= 50 ? "text-amber-600" : "text-red-600") : undefined}
        />
        <DetailCard label="Vérifié le" value={order.id_verified_at ? new Date(order.id_verified_at).toLocaleDateString("fr-CA") : "—"} icon={CheckCircle2} />
      </div>

      {/* Customer-declared fields (checkout_fields) */}
      {checkoutFields && Object.keys(checkoutFields).length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Données déclarées par le client
          </h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            {checkoutFields.first_name && (
              <FieldRow label="Prénom" value={checkoutFields.first_name} />
            )}
            {checkoutFields.last_name && (
              <FieldRow label="Nom" value={checkoutFields.last_name} />
            )}
            {checkoutFields.date_of_birth && (
              <FieldRow label="Date de naissance" value={checkoutFields.date_of_birth} />
            )}
            {checkoutFields.document_number && (
              <FieldRow label="N° document" value={checkoutFields.document_number} />
            )}
            {checkoutFields.expiry_date && (
              <FieldRow label="Expiration" value={checkoutFields.expiry_date} />
            )}
            {checkoutFields.issuing_region && (
              <FieldRow label="Province" value={checkoutFields.issuing_region} />
            )}
          </div>
        </div>
      )}

      {/* OCR extracted data */}
      {extractedFields && Object.keys(extractedFields).length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
          <h4 className="text-xs font-semibold text-blue-700 uppercase mb-2 flex items-center gap-1.5">
            <FileSearch className="w-3.5 h-3.5" /> Données extraites (OCR)
          </h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            {Object.entries(extractedFields)
              .filter(([, val]) => val != null && val !== "")
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

      {/* Document images */}
      {hasDocuments && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Documents soumis</h4>
          <div className="grid grid-cols-3 gap-2">
            {frontPath && (
              <DocCard
                label="Recto"
                icon={FileText}
                loading={loadingPreview === "front"}
                onPreview={() => handlePreview(frontPath, "front")}
              />
            )}
            {backPath && (
              <DocCard
                label="Verso"
                icon={FileText}
                loading={loadingPreview === "back"}
                onPreview={() => handlePreview(backPath, "back")}
              />
            )}
            {selfiePath && (
              <DocCard
                label="Selfie"
                icon={Camera}
                loading={loadingPreview === "selfie"}
                onPreview={() => handlePreview(selfiePath, "selfie")}
              />
            )}
          </div>
        </div>
      )}

      {!hasDocuments && kycStatus === "none" && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 text-center">
          <ShieldAlert className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Aucun document de vérification soumis</p>
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

function DocCard({ label, icon: Icon, loading, onPreview }: { label: string; icon: any; loading: boolean; onPreview: () => void }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
      <Icon className="h-6 w-6 text-gray-400 mx-auto mb-1.5" />
      <p className="text-[11px] font-medium text-gray-700 mb-2">{label}</p>
      <button
        onClick={onPreview}
        disabled={loading}
        className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto disabled:opacity-50"
      >
        <Eye className="h-3 w-3" /> {loading ? "Chargement…" : "Aperçu"}
      </button>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
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
