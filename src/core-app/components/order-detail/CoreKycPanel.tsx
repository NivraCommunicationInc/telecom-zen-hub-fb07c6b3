/**
 * CoreKycPanel — Manual KYC controls for an order in Nivra Core.
 *
 * - "Demander vérification d'identité" button (when no active KYC request)
 * - Status badge for pending / completed / approved / rejected
 * - Approve / Reject buttons when KYC is completed
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Loader2, CheckCircle2, XCircle, Clock, FileSearch } from "lucide-react";

interface Props {
  order: any;
  onRefresh: () => void;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  not_required: { label: "KYC non requis", className: "border-[hsl(220,15%,20%)] bg-[hsl(220,20%,13%)] text-[hsl(220,10%,55%)]" },
  pending:      { label: "🟡 KYC demandé",  className: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  completed:    { label: "🟠 KYC complété — en attente d'approbation", className: "border-orange-500/30 bg-orange-500/10 text-orange-300" },
  approved:     { label: "✅ KYC approuvé",  className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  rejected:     { label: "❌ KYC rejeté",    className: "border-red-500/30 bg-red-500/10 text-red-300" },
};

export function CoreKycPanel({ order, onRefresh }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [notes, setNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [kycReq, setKycReq] = useState<any>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);

  const status = (order?.kyc_status as string) || "not_required";
  const meta = STATUS_LABEL[status] || STATUS_LABEL.not_required;

  useEffect(() => {
    let active = true;
    (async () => {
      if (!order?.kyc_request_id) { setKycReq(null); setDocUrl(null); return; }
      const { data } = await supabase
        .from("kyc_requests")
        .select("id, status, requested_at, completed_at, expires_at, document_path, rejection_reason, notes, client_email")
        .eq("id", order.kyc_request_id)
        .maybeSingle();
      if (!active) return;
      setKycReq(data);
      if (data?.document_path) {
        const { data: signed } = await supabase.storage.from("id-documents").createSignedUrl(data.document_path, 600);
        if (active) setDocUrl(signed?.signedUrl ?? null);
      } else {
        setDocUrl(null);
      }
    })();
    return () => { active = false; };
  }, [order?.kyc_request_id, order?.kyc_status]);

  async function handleSendRequest() {
    setLoading("request");
    try {
      const { data, error } = await supabase.functions.invoke("send-kyc-request", {
        body: { order_id: order.id, notes: notes.trim() || undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Demande de vérification envoyée au client");
      setShowRequestModal(false);
      setNotes("");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || "Échec de la demande");
    } finally {
      setLoading(null);
    }
  }

  async function handleDecision(decision: "approve" | "reject") {
    if (!kycReq?.id) return;
    if (decision === "reject" && !rejectReason.trim()) {
      toast.error("Veuillez préciser un motif de rejet");
      return;
    }
    setLoading(decision);
    try {
      const { data, error } = await supabase.functions.invoke("kyc-decision", {
        body: {
          kyc_request_id: kycReq.id,
          decision,
          rejection_reason: decision === "reject" ? rejectReason.trim() : undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(decision === "approve" ? "Vérification approuvée" : "Vérification rejetée");
      setShowRejectModal(false);
      setRejectReason("");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || "Échec de la décision");
    } finally {
      setLoading(null);
    }
  }

  const canDecide = status === "completed";
  const requestLabel =
    status === "pending" ? "Renvoyer la demande" :
    status === "rejected" ? "Nouvelle demande" :
    status === "approved" ? "Demander une nouvelle vérification" :
    status === "completed" ? "Renvoyer un nouveau lien" :
    "🔍 Demander vérification d'identité";

  return (
    <div className="rounded-lg border border-violet-500/20 bg-[hsl(220,20%,11%)] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-violet-400" />
          <span className="text-[10px] uppercase tracking-widest text-[hsl(220,10%,40%)] font-semibold">Vérification d'identité</span>
          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>{meta.label}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Always show request button so admins can trigger/resend at any time */}
          <button
            onClick={() => setShowRequestModal(true)}
            disabled={!order?.client_email}
            title={!order?.client_email ? "Aucun courriel client disponible" : undefined}
            className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {requestLabel}
          </button>
          {canDecide && (
            <>
              <button
                onClick={() => handleDecision("approve")}
                disabled={loading === "approve"}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-semibold"
              >
                {loading === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Approuver
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 px-2.5 py-1.5 text-[11px] font-semibold"
              >
                <XCircle className="h-3.5 w-3.5" /> Rejeter
              </button>
            </>
          )}
        </div>
      </div>

      {kycReq && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
          <div className="rounded-md bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,14%)] p-2">
            <div className="text-[hsl(220,10%,40%)]">Demandée</div>
            <div className="text-[hsl(220,10%,75%)] mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3" />{kycReq.requested_at ? new Date(kycReq.requested_at).toLocaleString("fr-CA") : "—"}</div>
          </div>
          <div className="rounded-md bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,14%)] p-2">
            <div className="text-[hsl(220,10%,40%)]">Expire</div>
            <div className="text-[hsl(220,10%,75%)] mt-0.5">{kycReq.expires_at ? new Date(kycReq.expires_at).toLocaleString("fr-CA") : "—"}</div>
          </div>
          <div className="rounded-md bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,14%)] p-2">
            <div className="text-[hsl(220,10%,40%)]">Document</div>
            {docUrl ? (
              <a href={docUrl} target="_blank" rel="noreferrer" className="text-violet-300 hover:underline mt-0.5 inline-flex items-center gap-1"><FileSearch className="h-3 w-3" /> Voir le document</a>
            ) : (
              <div className="text-[hsl(220,10%,55%)] mt-0.5">{kycReq.completed_at ? "Supprimé" : "En attente"}</div>
            )}
          </div>
          {kycReq.rejection_reason && (
            <div className="md:col-span-3 rounded-md bg-red-500/5 border border-red-500/20 p-2 text-red-300">
              <strong>Motif du rejet :</strong> {kycReq.rejection_reason}
            </div>
          )}
        </div>
      )}

      {/* Request modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowRequestModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-[hsl(220,20%,11%)] border border-[hsl(220,15%,18%)] p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-3">Demander une vérification d'identité</h3>
            <div className="text-[12px] text-[hsl(220,10%,65%)] space-y-1 mb-4">
              <div><strong className="text-white">Client :</strong> {order?.client_first_name || ""} {order?.client_last_name || ""}</div>
              <div><strong className="text-white">Courriel :</strong> {order?.client_email || "—"}</div>
              <div><strong className="text-white">Commande :</strong> #{order?.order_number || order?.id?.slice(0, 8)}</div>
            </div>
            <p className="text-[11px] text-[hsl(220,10%,55%)] mb-3">Un courriel sécurisé sera envoyé au client. Le lien sera valide pendant 48 heures.</p>
            <textarea
              className="w-full rounded-md bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,18%)] text-white text-[12px] p-2 mb-4"
              rows={3}
              placeholder="Notes internes optionnelles (non visibles par le client)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRequestModal(false)} className="px-3 py-1.5 text-[11px] text-[hsl(220,10%,55%)] hover:text-white">Annuler</button>
              <button
                onClick={handleSendRequest}
                disabled={loading === "request" || !order?.client_email}
                className="inline-flex items-center gap-1.5 rounded-md bg-violet-500 hover:bg-violet-400 text-white px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
              >
                {loading === "request" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Envoyer la demande →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowRejectModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-[hsl(220,20%,11%)] border border-[hsl(220,15%,18%)] p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-3">Rejeter la vérification</h3>
            <p className="text-[11px] text-[hsl(220,10%,55%)] mb-3">Le motif sera inclus dans le courriel envoyé au client.</p>
            <textarea
              className="w-full rounded-md bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,18%)] text-white text-[12px] p-2 mb-4"
              rows={3}
              placeholder="Motif du rejet (visible par le client)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRejectModal(false)} className="px-3 py-1.5 text-[11px] text-[hsl(220,10%,55%)] hover:text-white">Annuler</button>
              <button
                onClick={() => handleDecision("reject")}
                disabled={loading === "reject" || !rejectReason.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-500 hover:bg-red-400 text-white px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
              >
                {loading === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
