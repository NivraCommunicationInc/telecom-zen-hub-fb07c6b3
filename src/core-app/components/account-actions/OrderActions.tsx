/**
 * Order management actions for Account 360.
 * Create order, duplicate, manage existing orders.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Plus, Copy, ExternalLink, XCircle, AlertTriangle } from "lucide-react";
import { corePath } from "@/core-app/lib/corePaths";

const inputCls = "w-full rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] px-2.5 py-1.5 text-[11px] text-white placeholder:text-[hsl(220,10%,30%)] outline-none focus:border-emerald-500/50";
const btnPrimary = "rounded-md bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors";
const btnSecondary = "rounded-md border border-[hsl(220,15%,16%)] px-4 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white transition-colors";
const btnDanger = "rounded-md bg-red-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-40 transition-colors";

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,13%)] px-2 py-1 text-[10px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors">
            Actions <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white">
          <DropdownMenuLabel className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider">Commandes</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => {
              // Navigate to orders page — in future could open a create modal
              toast.info("Utilisez le portail de vente pour créer une commande pour ce client");
            }}
            className="text-[11px] gap-2 focus:bg-emerald-500/10 focus:text-emerald-400"
          >
            <Plus className="h-3.5 w-3.5" /> Nouvelle commande
          </DropdownMenuItem>
          {orders.length > 0 && (
            <DropdownMenuItem
              onClick={() => navigate(corePath(`/orders/${orders[0].id}`))}
              className="text-[11px] gap-2 focus:bg-emerald-500/10 focus:text-emerald-400"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Ouvrir la dernière commande
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-[hsl(220,15%,16%)]" />
          <DropdownMenuItem
            onClick={() => setModal("cancelOrder")}
            disabled={activeOrders.length === 0}
            className="text-[11px] gap-2 text-red-400 focus:bg-red-500/10 focus:text-red-300"
          >
            <XCircle className="h-3.5 w-3.5" /> Annuler une commande
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
        status: "cancelled",
        updated_at: new Date().toISOString(),
      }).eq("id", selectedId);
      if (error) throw error;

      // Log activity
      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("activity_logs").insert({
        user_id: user?.id || "system",
        entity_type: "order",
        entity_id: selectedId,
        action: "order_cancelled",
        reason: reason || null,
        details: { source: "account_360" },
      });

      toast.success("Commande annulée");
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
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
