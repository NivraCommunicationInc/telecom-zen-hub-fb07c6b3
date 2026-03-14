/**
 * Order management visible action bar for Account 360.
 * NO DROPDOWNS — all actions are visible buttons.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, ExternalLink, XCircle, AlertTriangle, Copy } from "lucide-react";
import { corePath } from "@/core-app/lib/corePaths";

const inputCls = "w-full rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] px-2.5 py-1.5 text-[11px] text-white placeholder:text-[hsl(220,10%,30%)] outline-none focus:border-emerald-500/50";
const btnPrimary = "rounded-md bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors";
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

type ModalType = null | "cancelOrder";

export function OrderActionMenu({ orders, accountId, clientId, clientEmail, clientName, onRefresh }: Props) {
  const [modal, setModal] = useState<ModalType>(null);
  const navigate = useNavigate();

  const activeOrders = orders.filter((o: any) => !["cancelled", "completed", "activated"].includes(o.status));

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
        <button onClick={() => setModal("cancelOrder")} disabled={activeOrders.length === 0} className={actionDanger}>
          <XCircle className="h-3 w-3" /> Annuler
        </button>
      </div>

      {modal === "cancelOrder" && (
        <CancelOrderModal orders={activeOrders} onClose={() => setModal(null)} onRefresh={onRefresh} />
      )}
    </>
  );
}

function CancelOrderModal({ orders, onClose, onRefresh }: { orders: any[]; onClose: () => void; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState(orders[0]?.id || "");
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    if (!selectedId || confirmText !== "ANNULER") return;
    setLoading(true);
    try {
      const { error } = await supabase.from("orders").update({
        status: "cancelled", updated_at: new Date().toISOString(),
      }).eq("id", selectedId);
      if (error) throw error;

      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("activity_logs").insert({
        user_id: user?.id || "system", entity_type: "order", entity_id: selectedId,
        action: "order_cancelled", reason: reason || null,
        details: { source: "account_360" },
      });

      toast.success("Commande annulée");
      onRefresh(); onClose();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2 text-red-400">
            <XCircle className="h-4 w-4" /> Annuler une commande
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-300">Cette action est irréversible.</p>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Commande</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
              {orders.map((o: any) => (
                <option key={o.id} value={o.id}>{o.order_number || o.id.slice(0, 8)} — {o.status}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Raison</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Raison de l'annulation" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Tapez ANNULER pour confirmer</label>
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="ANNULER" className={inputCls} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Retour</button>
          <button onClick={handleCancel} disabled={loading || confirmText !== "ANNULER"} className={btnDanger}>
            {loading ? "…" : "Annuler la commande"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
