/**
 * KycStep — KYC verification panel reading from identity_verification_sessions
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

  const frontPath = kycSession?.document_front_path;
  const backPath = kycSession?.document_back_path;
  const selfiePath = kycSession?.selfie_path;
  const hasDocuments = !!(frontPath || backPath || selfiePath);

  const checkoutFields = kycSession?.checkout_fields as Record<string, any> | null;
  const extractedFields = kycSession?.extracted_fields as Record<string, any> | null;
  const matchResult = kycSession?.match_result as Record<string, any> | null;
  const idType = kycSession?.id_type || checkoutFields?.document_type;
  const caseNumber = kycSession?.case_number;
  const submittedAt = kycSession?.submitted_at;

  const matchScore = matchResult?.overall_score ?? matchResult?.match_score ?? null;

  const handlePreview = async (path: string, label: string) => {
    if (!path) return;
    setLoadingPreview(label);
    try {
      const { data, error } = await supabase.storage.from(DOC_BUCKET).createSignedUrl(path, 300);
      if (error) throw error;
      if (data?.signedUrl) {
        setPreviewUrl(data.signedUrl);
        setPreviewLabel(label);
      }
    } catch {
      toast.error("Impossible de charger l'aperçu");
    } finally { setLoadingPreview(null); }
  };

  const handleApprove = async () => {
    if (sessionId) {
      await supabase.from("identity_verification_sessions")
        .update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", sessionId);
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
      await supabase.from("identity_verification_sessions")
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
      await supabase.from("identity_verification_sessions")
        .update({ status: "pending_docs", review_reason: note || "Documents additionnels requis" })
        .eq("id", sessionId);
    }
    await proc.updateOrder({
      id_verification_status: "pending_docs",
      id_verification_notes: note || "Documents additionnels requis",
    });
    toast.info("Resoumission demandée");
  };

  // Banner config: dark variants
  const statusConfig: Record<string, { bannerClass: string; icon: any; label: string }> = {
    approved:      { bannerClass: "bg-green-950/50 border-green-700/50 text-green-300",  icon: ShieldCheck, label: "Approuvé" },
    rejected:      { bannerClass: "bg-red-950/50 border-red-700/50 text-red-300",        icon: XCircle,     label: "Rejeté" },
    in_review:     { bannerClass: "bg-blue-950/50 border-blue-700/50 text-blue-300",     icon: FileSearch,  label: "En revue" },
    manual_review: { bannerClass: "bg-blue-950/50 border-blue-700/50 text-blue-300",     icon: FileSearch,  label: "Revue manuelle" },
    pending:       { bannerClass: "bg-amber-950/50 border-amber-700/50 text-amber-300",  icon: ShieldAlert, label: "En attente" },
    submitted:     { bannerClass: "bg-amber-950/50 border-amber-700/50 text-amber-300",  icon: ShieldAlert, label: "Soumis" },
    pending_docs:  { bannerClass: "bg-amber-950/50 border-amber-700/50 text-amber-300",  icon: ShieldAlert, label: "Docs requis" },
    none:          { bannerClass: "bg-slate-800/50 border-slate-700/50 text-slate-300",  icon: ShieldAlert, label: "Non soumis" },
  };

  const sc = statusConfig[kycStatus] || statusConfig.none;
  const StatusIcon = sc.icon;
  const scoreColor = matchScore != null
    ? (Number(matchScore) >= 80 ? "text-green-300" : Number(matchScore) >= 50 ? "text-amber-300" : "text-red-300")
    : "text-slate-400";

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Vérification KYC</div>

      {/* Status banner full width */}
      <div className={`rounded-lg border ${sc.bannerClass} px-3 py-3 mb-4`}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-black/30 flex items-center justify-center shrink-0">
            <StatusIcon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">{sc.label}</p>
            <p className="text-xs opacity-70 mt-0.5">
              {caseNumber && `Case ${caseNumber}`}
              {submittedAt && ` · Soumis le ${new Date(submittedAt).toLocaleDateString("fr-CA")}`}
            </p>
          </div>
          {matchScore != null && (
            <div className="text-center">
              <div className={`relative inline-flex items-center justify-center w-14 h-14 rounded-full border-2 ${scoreColor.replace("text-", "border-")}`}>
                <span className={`text-sm font-bold ${scoreColor}`}>{Math.round(Number(matchScore))}%</span>
              </div>
              <p className="text-[9px] mt-1 uppercase tracking-wider opacity-70">Match OCR</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail grid 2x2 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <DetailCard label="Type de document" value={formatDocType(idType)} icon={FileText} />
        <DetailCard label="Politique KYC" value={order.kyc_policy || "—"} icon={ShieldCheck} />
        <DetailCard label="Score OCR" value={matchScore != null ? `${Math.round(Number(matchScore))}%` : "N/A"} icon={Percent} accent={scoreColor} />
        <DetailCard label="Vérifié le" value={order.id_verified_at ? new Date(order.id_verified_at).toLocaleDateString("fr-CA") : "—"} icon={CheckCircle2} />
      </div>

      {checkoutFields && Object.keys(checkoutFields).length > 0 && (
        <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
          <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
            <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Données déclarées par le client
            </h4>
          </div>
          <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {checkoutFields.first_name && <FieldRow label="Prénom" value={checkoutFields.first_name} />}
            {checkoutFields.last_name && <FieldRow label="Nom" value={checkoutFields.last_name} />}
            {checkoutFields.date_of_birth && <FieldRow label="Date de naissance" value={checkoutFields.date_of_birth} />}
            {checkoutFields.document_number && <FieldRow label="N° document" value={checkoutFields.document_number} />}
            {checkoutFields.expiry_date && <FieldRow label="Expiration" value={checkoutFields.expiry_date} />}
            {checkoutFields.issuing_region && <FieldRow label="Province" value={checkoutFields.issuing_region} />}
          </div>
        </div>
      )}

      {extractedFields && Object.keys(extractedFields).length > 0 && (
        <div className="bg-blue-950/50 border border-blue-700/50 rounded-lg px-3 py-3 mb-4">
          <h4 className="text-[11px] font-medium text-blue-300 uppercase mb-2 flex items-center gap-1.5">
            <FileSearch className="w-3.5 h-3.5" /> Données extraites (OCR)
          </h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {Object.entries(extractedFields)
              .filter(([, val]) => val != null && val !== "")
              .map(([key, val]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-blue-400 capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="text-blue-100 font-medium">{String(val)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {hasDocuments && (
        <div className="mb-4">
          <h4 className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Documents soumis</h4>
          <div className="grid grid-cols-3 gap-2">
            {frontPath && <DocCard label="Recto" icon={FileText} loading={loadingPreview === "front"} onPreview={() => handlePreview(frontPath, "front")} />}
            {backPath && <DocCard label="Verso" icon={FileText} loading={loadingPreview === "back"} onPreview={() => handlePreview(backPath, "back")} />}
            {selfiePath && <DocCard label="Selfie" icon={Camera} loading={loadingPreview === "selfie"} onPreview={() => handlePreview(selfiePath, "selfie")} />}
          </div>
        </div>
      )}

      {!hasDocuments && kycStatus === "none" && (
        <div className="bg-[#0d1421] border border-slate-700/50 rounded-lg p-4 mb-4 text-center">
          <ShieldAlert className="h-8 w-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucun document de vérification soumis</p>
        </div>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8" onClick={() => setPreviewUrl(null)}>
          <div className="bg-[#111827] border border-slate-700 rounded-xl p-2 max-w-2xl max-h-[80vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-3 py-2 border-b border-slate-700">
              <span className="text-sm font-semibold text-slate-100">Aperçu du document</span>
              <button onClick={() => setPreviewUrl(null)} className="text-xs text-slate-400 hover:text-slate-100">Fermer</button>
            </div>
            <img src={previewUrl} alt="Document ID" className="max-w-full rounded-lg mt-2" />
          </div>
        </div>
      )}

      {order.id_verification_notes && (
        <div className="bg-amber-950/50 border border-amber-700/50 text-amber-300 rounded-lg px-3 py-2 text-sm mb-4">
          <h4 className="text-[10px] uppercase tracking-wider mb-1">Notes KYC</h4>
          <p>{order.id_verification_notes}</p>
        </div>
      )}

      {/* Note textarea full width */}
      <div className="mb-4">
        <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Note interne</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note interne (optionnel)…"
          className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg min-h-[56px]"
        />
      </div>

      {/* 3 action buttons */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-700/50">
        <Button size="sm" onClick={handleApprove} disabled={proc.isUpdating || kycStatus === "approved"} className="text-sm bg-green-600 hover:bg-green-700 text-white">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Approuver
        </Button>
        <Button size="sm" onClick={handleReject} disabled={proc.isUpdating} className="text-sm bg-red-700 hover:bg-red-800 text-white">
          <XCircle className="w-3 h-3 mr-1" /> Rejeter
        </Button>
        <Button size="sm" variant="outline" onClick={handleRequestResubmission} disabled={proc.isUpdating} className="text-sm bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800">
          <RefreshCw className="w-3 h-3 mr-1" /> Demander resoumission
        </Button>
      </div>
    </div>
  );
}

function DetailCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent?: string }) {
  return (
    <div className="bg-[#0d1421] rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-3.5 w-3.5 ${accent || "text-slate-500"}`} />
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</span>
      </div>
      <p className={`text-sm font-medium ${accent || "text-slate-100"}`}>{value}</p>
    </div>
  );
}

function DocCard({ label, icon: Icon, loading, onPreview }: { label: string; icon: any; loading: boolean; onPreview: () => void }) {
  return (
    <div className="bg-[#0d1421] border border-slate-700/50 rounded-lg p-3 text-center">
      <Icon className="h-6 w-6 text-slate-500 mx-auto mb-1.5" />
      <p className="text-[11px] font-medium text-slate-300 mb-2">{label}</p>
      <button onClick={onPreview} disabled={loading} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 mx-auto disabled:opacity-50">
        <Eye className="h-3 w-3" /> {loading ? "Chargement…" : "Aperçu"}
      </button>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-100 font-medium">{value}</span>
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
