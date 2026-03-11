/**
 * Equipment management visible action bar for Account 360.
 * NO DROPDOWNS — all actions are visible buttons.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ShoppingCart, RefreshCw, Package, Trash2, ArrowRightLeft, DollarSign } from "lucide-react";
import { corePath } from "@/core-app/lib/corePaths";

const inputCls = "w-full rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] px-2.5 py-1.5 text-[11px] text-white placeholder:text-[hsl(220,10%,30%)] outline-none focus:border-emerald-500/50";
const textareaCls = `${inputCls} resize-none`;
const btnPrimary = "rounded-md bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors";
const btnSecondary = "rounded-md border border-[hsl(220,15%,16%)] px-4 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white transition-colors";

const actionBtn = "flex items-center gap-1.5 rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,13%)] px-2.5 py-1.5 text-[10px] font-medium transition-all whitespace-nowrap disabled:opacity-30";
const actionDefault = `${actionBtn} text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30`;
const actionAccent = `${actionBtn} text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/40`;
const actionWarning = `${actionBtn} text-amber-400 hover:text-amber-300 hover:border-amber-500/40`;
const actionDanger = `${actionBtn} text-red-400 hover:text-red-300 hover:border-red-500/40`;

interface Props {
  equipment: any[];
  accountId: string | undefined;
  clientId: string | undefined;
  orders: any[];
  onRefresh: () => void;
}

type ModalType = null | "addEquipment" | "removeEquipment" | "replaceEquipment" | "exchangeEquipment" | "chargeReplacement";

export function EquipmentActionMenu({ equipment, accountId, clientId, orders, onRefresh }: Props) {
  const [modal, setModal] = useState<ModalType>(null);
  const navigate = useNavigate();

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setModal("addEquipment")} className={actionAccent}>
          <Package className="h-3 w-3" /> Ajouter
        </button>
        <button onClick={() => setModal("replaceEquipment")} disabled={equipment.length === 0} className={actionDefault}>
          <RefreshCw className="h-3 w-3" /> Remplacer
        </button>
        <button onClick={() => setModal("exchangeEquipment")} disabled={equipment.length === 0} className={actionDefault}>
          <ArrowRightLeft className="h-3 w-3" /> Échanger
        </button>
        <button onClick={() => setModal("chargeReplacement")} disabled={equipment.length === 0} className={actionWarning}>
          <DollarSign className="h-3 w-3" /> Facturer
        </button>
        <button onClick={() => navigate(corePath("/pos"))} className={actionDefault}>
          <ShoppingCart className="h-3 w-3" /> POS
        </button>
        <button onClick={() => setModal("removeEquipment")} disabled={equipment.length === 0} className={actionDanger}>
          <Trash2 className="h-3 w-3" /> Retirer
        </button>
      </div>

      {modal === "addEquipment" && <AddEquipmentModal orders={orders} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "removeEquipment" && <RemoveEquipmentModal equipment={equipment} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "replaceEquipment" && <ReplaceEquipmentModal equipment={equipment} orders={orders} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "exchangeEquipment" && <ExchangeEquipmentModal equipment={equipment} orders={orders} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "chargeReplacement" && <ChargeReplacementModal equipment={equipment} orders={orders} clientId={clientId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
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
    if (!orderId || !itemName.trim()) { toast.error("Veuillez remplir le nom et sélectionner une commande"); return; }
    setLoading(true);
    try {
      const qty = parseInt(quantity) || 1;
      const price = parseFloat(unitPrice) || 0;
      const { error } = await supabase.from("equipment_order_lines").insert({
        order_id: orderId, item_name: itemName.trim(), item_sku: itemSku || null,
        unit_price: price, quantity: qty, line_total: price * qty,
        serial_numbers: serialNumber ? [serialNumber] : null,
      });
      if (error) throw error;
      toast.success(`Équipement "${itemName}" ajouté`);
      onRefresh(); onClose();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setLoading(false); }
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
                {orders.map((o: any) => (<option key={o.id} value={o.id}>{o.order_number || o.id.slice(0, 8)} — {o.status}</option>))}
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
      onRefresh(); onClose();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2 text-red-400"><Trash2 className="h-4 w-4" /> Retirer un équipement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Équipement</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
              {equipment.map((eq: any) => (<option key={eq.id} value={eq.id}>{eq.item_name} — {eq.item_sku || "N/A"}</option>))}
            </select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleRemove} disabled={loading} className={`${btnPrimary} !bg-red-600 hover:!bg-red-500`}>{loading ? "…" : "Retirer"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Replace Equipment ── */
function ReplaceEquipmentModal({ equipment, orders, onClose, onRefresh }: { equipment: any[]; orders: any[]; onClose: () => void; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState(equipment[0]?.id || "");
  const [newSerial, setNewSerial] = useState("");
  const [reason, setReason] = useState("lost");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const eq = equipment.find((e: any) => e.id === selectedId);

  const handleReplace = async () => {
    if (!eq) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("equipment_order_lines").update({
        serial_numbers: newSerial ? [newSerial] : eq.serial_numbers,
      }).eq("id", selectedId);
      if (error) throw error;
      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("activity_logs").insert({
        user_id: user?.id || "system", entity_type: "equipment", entity_id: selectedId,
        action: "equipment_replaced", reason,
        details: { old_serial: eq.serial_numbers, new_serial: newSerial, notes, source: "account_360" },
      });
      toast.success(`Équipement "${eq.item_name}" remplacé`);
      onRefresh(); onClose();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><RefreshCw className="h-4 w-4 text-amber-400" /> Remplacer un équipement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Équipement à remplacer</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
              {equipment.map((eq: any) => (<option key={eq.id} value={eq.id}>{eq.item_name} — {eq.item_sku || "N/A"}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Raison</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className={inputCls}>
              <option value="lost">Perdu</option>
              <option value="damaged">Endommagé</option>
              <option value="defective">Défectueux</option>
              <option value="upgrade">Mise à niveau</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Nouveau S/N (optionnel)</label>
            <input value={newSerial} onChange={e => setNewSerial(e.target.value)} placeholder="Nouveau numéro de série" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes internes…" className={textareaCls} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleReplace} disabled={loading} className={btnPrimary}>{loading ? "…" : "Remplacer"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Exchange Equipment ── */
function ExchangeEquipmentModal({ equipment, orders, onClose, onRefresh }: { equipment: any[]; orders: any[]; onClose: () => void; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState(equipment[0]?.id || "");
  const [newItemName, setNewItemName] = useState("");
  const [newItemSku, setNewItemSku] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [loading, setLoading] = useState(false);
  const eq = equipment.find((e: any) => e.id === selectedId);

  const handleExchange = async () => {
    if (!eq || !newItemName.trim()) { toast.error("Veuillez remplir le nom du nouvel article"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from("equipment_order_lines").update({
        item_name: newItemName.trim(), item_sku: newItemSku || eq.item_sku,
        serial_numbers: newSerial ? [newSerial] : null,
      }).eq("id", selectedId);
      if (error) throw error;
      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("activity_logs").insert({
        user_id: user?.id || "system", entity_type: "equipment", entity_id: selectedId,
        action: "equipment_exchanged",
        details: { old_item: eq.item_name, new_item: newItemName, source: "account_360" },
      });
      toast.success(`Équipement échangé : ${eq.item_name} → ${newItemName}`);
      onRefresh(); onClose();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-emerald-400" /> Échanger un équipement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Équipement actuel</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
              {equipment.map((eq: any) => (<option key={eq.id} value={eq.id}>{eq.item_name} — {eq.item_sku || "N/A"}</option>))}
            </select>
          </div>
          {eq && (
            <div className="rounded-md bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,16%)] p-2.5 text-[10px] text-[hsl(220,10%,45%)]">
              Actuel: <span className="text-white font-medium">{eq.item_name}</span> — S/N: {Array.isArray(eq.serial_numbers) ? eq.serial_numbers.join(", ") : "—"}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Nouvel article</label>
              <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Nom" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">SKU</label>
              <input value={newItemSku} onChange={e => setNewItemSku(e.target.value)} placeholder="SKU" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Nouveau S/N</label>
            <input value={newSerial} onChange={e => setNewSerial(e.target.value)} placeholder="S/N, MAC, IMEI…" className={inputCls} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleExchange} disabled={loading} className={btnPrimary}>{loading ? "…" : "Échanger"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Charge Replacement Fee ── */
function ChargeReplacementModal({ equipment, orders, clientId, onClose, onRefresh }: { equipment: any[]; orders: any[]; clientId?: string; onClose: () => void; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState(equipment[0]?.id || "");
  const [fee, setFee] = useState("50.00");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const eq = equipment.find((e: any) => e.id === selectedId);

  const handleCharge = async () => {
    const parsedFee = parseFloat(fee);
    if (!parsedFee || parsedFee <= 0 || !eq) { toast.error("Montant invalide"); return; }
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("activity_logs").insert({
        user_id: user?.id || "system", entity_type: "equipment", entity_id: selectedId,
        action: "replacement_fee_charged",
        details: { item_name: eq.item_name, fee: parsedFee, reason, source: "account_360" },
      });
      toast.success(`Frais de remplacement de ${parsedFee.toFixed(2)} $ enregistré pour "${eq.item_name}"`);
      onRefresh(); onClose();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><DollarSign className="h-4 w-4 text-amber-400" /> Facturer un remplacement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Équipement</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
              {equipment.map((eq: any) => (<option key={eq.id} value={eq.id}>{eq.item_name} — {eq.item_sku || "N/A"}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Montant ($)</label>
            <input type="number" step="0.01" value={fee} onChange={e => setFee(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Raison</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Perte confirmée" className={inputCls} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleCharge} disabled={loading} className={`${btnPrimary} !bg-amber-600 hover:!bg-amber-500`}>{loading ? "…" : "Facturer"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
