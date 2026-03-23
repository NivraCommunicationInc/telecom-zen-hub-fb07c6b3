/**
 * KycStep — Step 4: KYC verification with approve/reject/reset workflow
 * Uses orders.kyc_status as source of truth
 * Audit trail logged to activity_logs
 */
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, FileSearch, RefreshCw, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";

interface Props { proc: any; }

export function KycStep({ proc }: Props) {
  const { order, kycSession } = proc;
  const [note, setNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  // Source of truth: orders.kyc_status
  const kycStatus = (order as any).kyc_status || "not_required";
  const legacyKycStatus = kycSession?.status || order.id_verification_status || "none";

  const handleApproveKyc = async () => {
    try {
      await supabase
        .from("orders")
        .update({ kyc_status: "approved" } as any)
        .eq("id", order.id);

      // Also update legacy field for backward compat
      await proc.updateOrder({
        id_verification_status: "approved",
        id_verified_at: new Date().toISOString(),
      });

      // Audit trail
      await logInternalAudit({
        action: "kyc_approved",
        category: "operations",
        targetType: "order",
        targetId: order.id,
        details: {
          previous_status: kycStatus,
          new_status: "approved",
          note: note || null,
          order_number: order.order_number,
        },
      });

      toast.success("KYC approuvé — la commande peut maintenant progresser");
      proc.refetch();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'approbation KYC");
    }
  };

  const handleRejectKyc = async () => {
    if (rejectReason.length < 10) {
      toast.error("Le motif de rejet doit contenir au moins 10 caractères");
      return;
    }

    try {
      await supabase
        .from("orders")
        .update({ kyc_status: "rejected" } as any)
        .eq("id", order.id);

      await proc.updateOrder({
        id_verification_status: "rejected",
        id_verification_notes: rejectReason,
      });

      await logInternalAudit({
        action: "kyc_rejected",
        category: "operations",
        targetType: "order",
        targetId: order.id,
        details: {
          previous_status: kycStatus,
          new_status: "rejected",
          reason: rejectReason,
          order_number: order.order_number,
        },
      });

      toast.warning("KYC rejeté");
      setShowRejectDialog(false);
      setRejectReason("");
      proc.refetch();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors du rejet KYC");
    }
  };

  const handleResetKyc = async () => {
    try {
      await supabase
        .from("orders")
        .update({ kyc_status: "pending" } as any)
        .eq("id", order.id);

      await proc.updateOrder({
        id_verification_status: "pending_docs",
        id_verification_notes: note || "KYC réinitialisé pour resoumission",
      });

      await logInternalAudit({
        action: "kyc_reset",
        category: "operations",
        targetType: "order",
        targetId: order.id,
        details: {
          previous_status: kycStatus,
          new_status: "pending",
          note: note || "Reset for resubmission",
          order_number: order.order_number,
        },
      });

      toast.info("KYC réinitialisé — en attente de nouveaux documents");
      proc.refetch();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la réinitialisation KYC");
    }
  };

  const statusColorClass = kycStatus === "approved"
    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    : kycStatus === "rejected"
      ? "text-red-400 bg-red-500/10 border-red-500/20"
      : kycStatus === "pending"
        ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
        : "text-[hsl(220,10%,50%)] bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]";

  const statusLabel = kycStatus === "approved" ? "Approuvé"
    : kycStatus === "rejected" ? "Rejeté"
      : kycStatus === "pending" ? "En attente"
        : "Non requis";

  return (
    <div>
      <h3 className="text-base font-bold text-foreground mb-4">Vérification KYC</h3>

      {/* Status banner */}
      <div className={`rounded-lg border p-4 mb-4 ${statusColorClass}`}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          {kycStatus === "approved" && <CheckCircle2 className="w-4 h-4" />}
          {kycStatus === "rejected" && <XCircle className="w-4 h-4" />}
          {kycStatus === "pending" && <AlertTriangle className="w-4 h-4" />}
          Statut KYC : {statusLabel}
        </div>
        {kycStatus === "pending" && (
          <p className="text-xs mt-1 opacity-80">
            Les transitions vers installé / activé / complété sont bloquées tant que le KYC n'est pas approuvé.
          </p>
        )}
      </div>

      {/* Details */}
      <div className="bg-muted/30 rounded-lg border border-border p-4 mb-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Statut DB:</span>{" "}
            <span className="font-semibold text-foreground">{kycStatus}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Legacy:</span>{" "}
            <span className="font-medium text-muted-foreground">{legacyKycStatus}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Politique:</span>{" "}
            <span className="font-medium text-foreground">{order.kyc_policy || "—"}</span>
          </div>
          {kycSession && (
            <>
              <div><span className="text-muted-foreground">Session:</span> <span className="font-mono text-xs">{kycSession.case_number || kycSession.id?.slice(0, 8)}</span></div>
              <div><span className="text-muted-foreground">Créée:</span> <span>{kycSession.created_at?.slice(0, 10)}</span></div>
            </>
          )}
          {order.id_verified_at && (
            <div><span className="text-muted-foreground">Vérifié le:</span> <span>{order.id_verified_at.slice(0, 10)}</span></div>
          )}
        </div>
      </div>

      {/* KYC documents link */}
      {kycSession && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <FileSearch className="w-4 h-4" />
            <span>Documents soumis dans la session KYC. Utilisez le Centre KYC pour la revue détaillée.</span>
          </div>
        </div>
      )}

      {/* Existing notes */}
      {order.id_verification_notes && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
          <h4 className="text-xs font-semibold text-amber-400 uppercase mb-1">Notes KYC</h4>
          <p className="text-sm text-foreground">{order.id_verification_notes}</p>
        </div>
      )}

      {/* Reject dialog */}
      {showRejectDialog && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-red-400 mb-2">Motif de rejet (obligatoire, min. 10 car.)</h4>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Raison du rejet — ex: Document expiré, photo illisible..."
            className="min-h-[60px] text-sm mb-3"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={handleRejectKyc} disabled={proc.isUpdating || rejectReason.length < 10} className="text-xs h-8">
              Confirmer le rejet
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowRejectDialog(false); setRejectReason(""); }} className="text-xs h-8">
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* Internal note */}
      {!showRejectDialog && (
        <div className="mb-4">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note interne (optionnel)…"
            className="min-h-[60px] text-sm"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
        <Button
          size="sm"
          onClick={handleApproveKyc}
          disabled={proc.isUpdating || kycStatus === "approved" || kycStatus === "not_required"}
          className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <CheckCircle2 className="w-3 h-3 mr-1" /> Approuver KYC
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowRejectDialog(true)}
          disabled={proc.isUpdating || kycStatus === "rejected" || kycStatus === "not_required" || showRejectDialog}
          className="text-xs h-8 border-red-500/30 text-red-400 hover:bg-red-500/10"
        >
          <XCircle className="w-3 h-3 mr-1" /> Rejeter KYC
        </Button>
        {kycStatus === "rejected" && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleResetKyc}
            disabled={proc.isUpdating}
            className="text-xs h-8"
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Réinitialiser KYC
          </Button>
        )}
      </div>
    </div>
  );
}
