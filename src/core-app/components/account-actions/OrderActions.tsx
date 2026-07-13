/**
 * Order management visible action bar for Account 360.
 * Cancel flow now runs through canonical engine (cancel-order Edge Function).
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, ExternalLink, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { corePath } from "@/core-app/lib/corePaths";

const inputCls = "w-full rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] px-2.5 py-1.5 text-[11px] text-white placeholder:text-[hsl(220,10%,30%)] outline-none focus:border-emerald-500/50";
const btnSecondary = "rounded-md border border-[hsl(220,15%,16%)] px-4 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white transition-colors";
const btnDanger = "rounded-md bg-red-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-40 transition-colors";

const actionBtn = "flex items-center gap-1.5 rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,13%)] px-2.5 py-1.5 text-[10px] font-medium transition-all whitespace-nowrap disabled:opacity-30";
const actionDefault = `${actionBtn} text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30`;
const actionAccent = `${actionBtn} text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/40`;
const actionDanger = `${actionBtn} text-red-400 hover:text-red-300 hover:border-red-500/40`;

interface Props {
  orders: any[];
  accountId: string | undefined;
  clientId: string | undefined;
  clientEmail: string | undefined;
  clientName: string;
  onRefresh: () => void;
}

const REASON_CODES: Array<{ code: string; label: string }> = [
  { code: "client_changed_mind", label: "Client a changé d'avis" },
  { code: "payment_issue", label: "Problème de paiement" },
  { code: "address_not_serviceable", label: "Adresse non desservie" },
  { code: "agent_error", label: "Erreur agent / doublon d'entrée" },
  { code: "fraud", label: "Fraude / risque" },
  { code: "duplicate", label: "Commande en double" },
  { code: "other", label: "Autre (préciser dans la note)" },
];

export function OrderActionMenu({ orders, onRefresh }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const navigate = useNavigate();

  const activeOrders = orders.filter(
    (o: any) => !["cancelled", "canceled", "service_cancelled", "completed"].includes((o.status ?? "").toLowerCase()),
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => navigate(corePath("/pos"))} className={actionAccent}>
          <Plus className="h-3 w-3" /> Nouvelle commande
        </button>
        {orders.length > 0 && (
          <button onClick={() => navigate(corePath(`/orders/${orders[0].id}`))} className={actionDefault}>
            <ExternalLink className="h-3 w-3" /> Dernière commande
          </button>
        )}
        <button onClick={() => setModalOpen(true)} disabled={activeOrders.length === 0} className={actionDanger}>
          <XCircle className="h-3 w-3" /> Annuler
        </button>
      </div>

      {modalOpen && (
        <CancelOrderModal
          orders={activeOrders}
          onClose={() => setModalOpen(false)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}

function CancelOrderModal({
  orders, onClose, onRefresh,
}: { orders: any[]; onClose: () => void; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState(orders[0]?.id || "");
  const [reasonCode, setReasonCode] = useState<string>("client_changed_mind");
  const [reasonNote, setReasonNote] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [processRefund, setProcessRefund] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Aperçu de la cascade lecture seule
  useEffect(() => {
    if (!selectedId) { setPreview(null); return; }
    setPreviewLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("cancel-order", {
          body: { order_id: selectedId, reason_code: "other", reason_note: "preview____", dry_run: true },
        });
        if (!error) setPreview(data);
      } finally { setPreviewLoading(false); }
    })();
  }, [selectedId]);

  const handleCancel = async () => {
    if (!selectedId || confirmText !== "ANNULER") return;
    if (reasonNote.trim().length < 5) {
      toast.error("La note doit contenir au moins 5 caractères");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-order", {
        body: {
          order_id: selectedId,
          reason_code: reasonCode,
          reason_note: reasonNote.trim(),
          source: "core_account_360",
          idempotency_key: `cancel-${selectedId}-${Date.now()}`,
          process_refund: processRefund,
        },
      });
      if (error) throw new Error(error.message);
      if (data && data.ok === false) throw new Error(data.error || "Échec annulation");
      if (data?.report?.order_status_change_blocked) {
        toast.warning("Cascade complétée. Statut commande bloqué : remboursement requis avant transition.", { duration: 6000 });
      } else {
        toast.success(
          data?.refund_required
            ? `Commande annulée. Remboursement requis: ${Number(data.refund_amount).toFixed(2)} $`
            : "Commande annulée",
        );
      }
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'annulation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2 text-red-400">
            <XCircle className="h-4 w-4" /> Annuler une commande
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-red-300">
              Cette action déclenche la cascade complète (factures, abonnements, rendez-vous, techniciens, provisioning, contrats) et est irréversible.
            </p>
          </div>

          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Commande</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
              {orders.map((o: any) => (
                <option key={o.id} value={o.id}>
                  {o.order_number || o.id.slice(0, 8)} — {o.status}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] px-3 py-2">
            <div className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider mb-1.5">Aperçu de la cascade</div>
            {previewLoading ? (
              <div className="flex items-center gap-2 text-[11px] text-[hsl(220,10%,50%)]">
                <Loader2 className="h-3 w-3 animate-spin" /> Analyse en cours…
              </div>
            ) : preview?.ok === false ? (
              <p className="text-[11px] text-red-300">{preview.error}</p>
            ) : preview?.cascade ? (
              <ul className="space-y-1">
                {preview.cascade.map((a: any, i: number) => (
                  <li key={i} className="text-[11px] text-[hsl(220,10%,70%)] flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-emerald-500/70" />
                    {a.label}{a.count ? ` (${a.count})` : ""}{a.amount ? ` — ${Number(a.amount).toFixed(2)} $` : ""}
                  </li>
                ))}
                <li className="text-[10px] text-[hsl(220,10%,45%)] pt-1">
                  Cas identifié : <span className="text-emerald-400">{preview.case}</span>
                </li>
              </ul>
            ) : (
              <p className="text-[11px] text-[hsl(220,10%,50%)]">—</p>
            )}
          </div>

          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Motif</label>
            <select value={reasonCode} onChange={e => setReasonCode(e.target.value)} className={inputCls}>
              {REASON_CODES.map(r => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">
              Note (min. 5 caractères, journalisée)
            </label>
            <input
              value={reasonNote} onChange={e => setReasonNote(e.target.value)}
              placeholder="Détails visibles dans l'audit"
              className={inputCls}
            />
          </div>

          {preview?.has_confirmed_payment && preview?.case !== "case_4_active_service" && (
            <label className="flex items-center gap-2 text-[11px] text-[hsl(220,10%,70%)]">
              <input
                type="checkbox" checked={processRefund}
                onChange={e => setProcessRefund(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Déclencher aussi le remboursement Square ({Number(preview.confirmed_payment_total).toFixed(2)} $)
            </label>
          )}

          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">
              Tapez ANNULER pour confirmer
            </label>
            <input
              value={confirmText} onChange={e => setConfirmText(e.target.value)}
              placeholder="ANNULER" className={inputCls}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Retour</button>
          <button
            onClick={handleCancel}
            disabled={loading || confirmText !== "ANNULER" || reasonNote.trim().length < 5}
            className={btnDanger}
          >
            {loading ? "…" : "Annuler la commande"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
