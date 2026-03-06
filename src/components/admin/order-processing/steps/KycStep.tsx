/**
 * KycStep — Step 4: KYC verification (optional)
 */
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, FileSearch, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props { proc: any; }

export function KycStep({ proc }: Props) {
  const { order, kycSession } = proc;
  const [note, setNote] = useState("");
  // Canonical KYC status: session is the source of truth, order field is fallback
  const kycStatus = kycSession?.status || order.id_verification_status || order._kycSessionStatus || "none";

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

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Vérification KYC</h3>

      {/* Current status */}
      <div className="bg-gray-50 rounded-lg border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Statut:</span>{" "}
            <span className={`font-semibold ${kycStatus === "approved" ? "text-emerald-700" : kycStatus === "rejected" ? "text-red-600" : "text-amber-600"}`}>
              {kycStatus}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Politique:</span>{" "}
            <span className="font-medium text-gray-900">{order.kyc_policy}</span>
          </div>
          {kycSession && (
            <>
              <div><span className="text-gray-500">Session:</span> <span className="font-mono text-xs text-gray-700">{kycSession.case_number || kycSession.id?.slice(0, 8)}</span></div>
              <div><span className="text-gray-500">Créée:</span> <span className="text-gray-700">{kycSession.created_at?.slice(0, 10)}</span></div>
            </>
          )}
          {order.id_verified_at && (
            <div><span className="text-gray-500">Vérifié le:</span> <span className="text-gray-700">{order.id_verified_at.slice(0, 10)}</span></div>
          )}
        </div>
      </div>

      {/* KYC documents would show here — linked to identity_verification_sessions */}
      {kycSession && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <FileSearch className="w-4 h-4" />
            <span>Documents soumis dans la session KYC. Utilisez le Centre KYC pour la revue détaillée.</span>
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
