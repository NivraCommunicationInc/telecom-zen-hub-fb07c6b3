/**
 * Equipment management actions for Account 360.
 * POS-style sell, replace, assign operations.
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
import { ChevronDown, ShoppingCart, RefreshCw, Package, Trash2 } from "lucide-react";
import { corePath } from "@/core-app/lib/corePaths";

const inputCls = "w-full rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] px-2.5 py-1.5 text-[11px] text-white placeholder:text-[hsl(220,10%,30%)] outline-none focus:border-emerald-500/50";
const btnPrimary = "rounded-md bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors";
const btnSecondary = "rounded-md border border-[hsl(220,15%,16%)] px-4 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white transition-colors";

interface Props {
  equipment: any[];
  accountId: string | undefined;
  clientId: string | undefined;
  orders: any[];
  onRefresh: () => void;
}

type ModalType = null | "addEquipment" | "removeEquipment";

export function EquipmentActionMenu({ equipment, accountId, clientId, orders, onRefresh }: Props) {
  const [modal, setModal] = useState<ModalType>(null);
  const navigate = useNavigate();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,13%)] px-2 py-1 text-[10px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors">
            Actions <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white">
          <DropdownMenuLabel className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider">Équipement</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => navigate(corePath("/pos"))} className="text-[11px] gap-2 focus:bg-emerald-500/10 focus:text-emerald-400">
            <ShoppingCart className="h-3.5 w-3.5" /> Ouvrir le POS (vente)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setModal("addEquipment")} className="text-[11px] gap-2 focus:bg-emerald-500/10 focus:text-emerald-400">
            <Package className="h-3.5 w-3.5" /> Ajouter un équipement
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[hsl(220,15%,16%)]" />
          <DropdownMenuItem onClick={() => setModal("removeEquipment")} disabled={equipment.length === 0} className="text-[11px] gap-2 text-amber-400 focus:bg-amber-500/10 focus:text-amber-300">
            <Trash2 className="h-3.5 w-3.5" /> Retirer un équipement
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {modal === "addEquipment" && <AddEquipmentModal orders={orders} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "removeEquipment" && <RemoveEquipmentModal equipment={equipment} onClose={() => setModal(null)} onRefresh={onRefresh} />}
    </>
  );
}

/* ── Add Equipment ── */
function AddEquipmentModal({ orders, onClose, onRefresh }: { orders: any[]; onClose: () => void; onRefresh: () => void }) {
  const [orderId, setOrderId] = useState(orders[0]?.id || "");
  const [itemName, setItemName] = useState("");
  const [itemSku, setItemSku] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [serialNumber, setSerialNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!orderId || !itemName.trim()) {
      toast.error("Veuillez remplir le nom de l'article et sélectionner une commande");
      return;
    }
    setLoading(true);
    try {
      const qty = parseInt(quantity) || 1;
      const price = parseFloat(unitPrice) || 0;
      const { error } = await supabase.from("equipment_order_lines").insert({
        order_id: orderId,
        item_name: itemName.trim(),
        item_sku: itemSku || null,
        unit_price: price,
        quantity: qty,
        line_total: price * qty,
        serial_numbers: serialNumber ? [serialNumber] : null,
      });
      if (error) throw error;
      toast.success(`Équipement "${itemName}" ajouté`);
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
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><Package className="h-4 w-4 text-emerald-400" /> Ajouter un équipement</DialogTitle>
        </DialogHeader>
        {orders.length === 0 ? (
          <p className="text-[11px] text-[hsl(220,10%,45%)] py-4">Aucune commande associée au compte.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Commande</label>
              <select value={orderId} onChange={e => setOrderId(e.target.value)} className={inputCls}>
                {orders.map((o: any) => (
                  <option key={o.id} value={o.id}>{o.order_number || o.id.slice(0, 8)} — {o.status}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Nom de l'article</label>
                <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Ex: Router HG8245Q2" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">SKU</label>
                <input value={itemSku} onChange={e => setItemSku(e.target.value)} placeholder="SKU" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Prix unitaire ($)</label>
                <input type="number" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Quantité</label>
                <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Numéro de série (optionnel)</label>
              <input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="S/N, MAC, IMEI…" className={inputCls} />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          {orders.length > 0 && <button onClick={handleAdd} disabled={loading} className={btnPrimary}>{loading ? "…" : "Ajouter"}</button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Remove Equipment ── */
function RemoveEquipmentModal({ equipment, onClose, onRefresh }: { equipment: any[]; onClose: () => void; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState(equipment[0]?.id || "");
  const [loading, setLoading] = useState(false);

  const handleRemove = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("equipment_order_lines").delete().eq("id", selectedId);
      if (error) throw error;
      toast.success("Équipement retiré");
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
          <DialogTitle className="text-sm font-bold flex items-center gap-2 text-amber-400"><Trash2 className="h-4 w-4" /> Retirer un équipement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Équipement</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
              {equipment.map((eq: any) => (
                <option key={eq.id} value={eq.id}>{eq.item_name} — {eq.item_sku || "N/A"}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleRemove} disabled={loading} className={`${btnPrimary} !bg-amber-600 hover:!bg-amber-500`}>{loading ? "…" : "Retirer"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
