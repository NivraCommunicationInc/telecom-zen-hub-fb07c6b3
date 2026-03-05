/**
 * WorkbenchKYCTab - KYC session status, documents, decisions
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import { canPerformAction } from "@/lib/workbenchRoles";

interface Props {
  order: any;
  kycSession: any;
  role: string | null;
  onAction: (action: string) => void;
}

const KYC_STATUS: Record<string, { color: string; label: string; icon: any }> = {
  created: { color: "bg-muted text-muted-foreground", label: "Créé", icon: Clock },
  submitted: { color: "bg-blue-500/20 text-blue-400", label: "Soumis", icon: FileText },
  in_review: { color: "bg-purple-500/20 text-purple-400", label: "En révision", icon: Shield },
  pending_docs: { color: "bg-amber-500/20 text-amber-400", label: "Documents manquants", icon: Clock },
  approved: { color: "bg-emerald-500/20 text-emerald-400", label: "Approuvé", icon: CheckCircle },
  rejected: { color: "bg-red-500/20 text-red-400", label: "Rejeté", icon: XCircle },
};

export function WorkbenchKYCTab({ order, kycSession, role, onAction }: Props) {
  const idStatus = order?.id_verification_status || "pending";

  return (
    <div className="space-y-4">
      {/* ID Verification Status on Order */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Vérification d'identité (commande)</p>
              <p className="text-white mt-1">{idStatus}</p>
            </div>
            <Badge className={
              idStatus === "verified" ? "bg-emerald-500/20 text-emerald-400" :
              idStatus === "rejected" ? "bg-red-500/20 text-red-400" :
              "bg-amber-500/20 text-amber-400"
            }>
              {idStatus === "verified" ? "Vérifié" : idStatus === "rejected" ? "Rejeté" : "En attente"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* KYC Session */}
      {kycSession ? (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Session KYC</p>
                <p className="font-mono text-sm text-white mt-1">{kycSession.case_number || kycSession.id?.slice(0, 8)}</p>
              </div>
              {(() => {
                const cfg = KYC_STATUS[kycSession.status] || KYC_STATUS.created;
                return <Badge className={cfg.color}>{cfg.label}</Badge>;
              })()}
            </div>

            {kycSession.ocr_result && (
              <div className="mt-3 p-3 rounded bg-slate-700/30 text-xs">
                <p className="text-muted-foreground mb-1">Résultat OCR</p>
                <p className="text-white">{typeof kycSession.ocr_result === "string" ? kycSession.ocr_result : JSON.stringify(kycSession.ocr_result)}</p>
              </div>
            )}

            {/* KYC Actions */}
            {(kycSession.status === "submitted" || kycSession.status === "in_review") && (
              <div className="mt-4 flex gap-2 justify-end">
                {canPerformAction(role, "approve_kyc") && (
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onAction("approve_kyc")}>
                    <CheckCircle className="h-3 w-3 mr-1" /> Approuver
                  </Button>
                )}
                {canPerformAction(role, "reject_kyc") && (
                  <Button size="sm" variant="destructive" onClick={() => onAction("reject_kyc")}>
                    <XCircle className="h-3 w-3 mr-1" /> Rejeter
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="py-6 text-center text-muted-foreground text-sm">
            Aucune session KYC liée à ce client.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
