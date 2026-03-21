/**
 * Equipment management visible action bar for Account 360.
 * All actions are direct and operational.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingCart, RefreshCw, Package, Trash2, ArrowRightLeft, DollarSign, Link2, ToggleLeft } from "lucide-react";
import { corePath } from "@/core-app/lib/corePaths";

const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50";
const btnPrimary = "rounded-md bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity";
const btnSecondary = "rounded-md border border-border px-4 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40 transition-colors";

const actionBtn = "flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[10px] font-semibold transition-all whitespace-nowrap disabled:opacity-30";
const actionDefault = `${actionBtn} text-foreground/80 hover:text-foreground hover:border-primary/30`;
const actionAccent = `${actionBtn} text-primary hover:text-primary hover:border-primary/40`;
const actionWarning = `${actionBtn} text-amber-500 hover:text-amber-400 hover:border-amber-500/40`;
const actionDanger = `${actionBtn} text-red-500 hover:text-red-400 hover:border-red-500/40`;

interface Props {
  equipment: any[];
  accountId: string | undefined;
  clientId: string | undefined;
  orders: any[];
  subscriptions?: any[];
  onRefresh: () => void;
}

type ModalType = null | "addEquipment" | "assignEquipment" | "removeEquipment" | "replaceEquipment" | "exchangeEquipment" | "changeStatus" | "chargeReplacement";

export function EquipmentActionMenu({ equipment, clientId, orders, subscriptions = [], onRefresh }: Props) {
  const [modal, setModal] = useState<ModalType>(null);
  const navigate = useNavigate();

  const targetOrders = useMemo(() => {
    const merged = [...orders, ...subscriptions.filter((s: any) => s.order_id).map((s: any) => ({ id: s.order_id, status: s.status || "linked_subscription" }))];
    const unique = new Map(merged.map((o: any) => [o.id, o]));
    return Array.from(unique.values());
  }, [orders, subscriptions]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setModal("addEquipment")} className={actionAccent}>
          <Package className="h-3 w-3" /> Ajouter équipement
        </button>
        <button onClick={() => setModal("assignEquipment")} disabled={equipment.length === 0} className={actionDefault}>
          <Link2 className="h-3 w-3" /> Assigner
        </button>
        <button onClick={() => setModal("replaceEquipment")} disabled={equipment.length === 0} className={actionDefault}>
          <RefreshCw className="h-3 w-3" /> Remplacer
        </button>
        <button onClick={() => setModal("exchangeEquipment")} disabled={equipment.length === 0} className={actionDefault}>
          <ArrowRightLeft className="h-3 w-3" /> Échanger
        </button>
        <button onClick={() => setModal("changeStatus")} disabled={equipment.length === 0} className={actionDefault}>
          <ToggleLeft className="h-3 w-3" /> Changer statut
        </button>
        <button onClick={() => setModal("chargeReplacement")} disabled={equipment.length === 0} className={actionWarning}>
          <DollarSign className="h-3 w-3" /> Frais remplacement
        </button>
        <button onClick={() => navigate(corePath("/pos"))} className={actionDefault}>
          <ShoppingCart className="h-3 w-3" /> Ouvrir POS
        </button>
        <button onClick={() => setModal("removeEquipment")} disabled={equipment.length === 0} className={actionDanger}>
          <Trash2 className="h-3 w-3" /> Retirer
        </button>
      </div>

      {modal === "addEquipment" && <AddEquipmentModal orders={targetOrders} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "assignEquipment" && <AssignEquipmentModal equipment={equipment} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "removeEquipment" && <RemoveEquipmentModal equipment={equipment} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "replaceEquipment" && <ReplaceEquipmentModal equipment={equipment} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "exchangeEquipment" && <ExchangeEquipmentModal equipment={equipment} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "changeStatus" && <ChangeStatusModal equipment={equipment} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "chargeReplacement" && <ChargeReplacementModal equipment={equipment} clientId={clientId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
    </>
  );
}

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
      toast.error("Sélectionnez une commande liée au compte puis saisissez un article");
      return;
    }
    setLoading(true);
    try {
      const qty = Number.parseInt(quantity || "1", 10) || 1;
      const price = Number.parseFloat(unitPrice || "0") || 0;
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
      toast.success(`Équipement « ${itemName} » ajouté`);
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
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Ajouter un équipement</DialogTitle>
        </DialogHeader>
        {orders.length === 0 ? (
          <p className="text-[11px] text-muted-foreground py-4">Aucune commande liée au compte / abonnements. Créez d'abord une commande.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Commande liée</label>
              <select value={orderId} onChange={e => setOrderId(e.target.value)} className={inputCls}>
                {orders.map((o: any) => (
                  <option key={o.id} value={o.id}>{o.order_number || o.id.slice(0, 8)} — {o.status || "linked"}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Article</label>
                <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Ex: Router" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">SKU</label>
                <input value={itemSku} onChange={e => setItemSku(e.target.value)} placeholder="SKU" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Prix unitaire</label>
                <input type="number" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Quantité</label>
                <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">S/N (optionnel)</label>
              <input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="S/N, MAC, IMEI..." className={inputCls} />
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

function AssignEquipmentModal({ equipment, onClose, onRefresh }: { equipment: any[]; onClose: () => void; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState(equipment[0]?.id || "");
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);

  // Load available inventory items (in_stock only)
  useState(() => {
    supabase
      .from("equipment_inventory")
      .select("id, catalog_name, serial_number, imei, mac_address, sku, status")
      .eq("status", "in_stock")
      .order("catalog_name")
      .then(({ data }) => {
        setInventoryItems(data || []);
        setInventoryLoading(false);
      });
  });

  const selectedItem = inventoryItems.find(i => i.id === selectedInventoryId);
  const serialDisplay = selectedItem
    ? (selectedItem.serial_number || selectedItem.imei || selectedItem.mac_address || selectedItem.sku || "—")
    : "";

  const handleAssign = async () => {
    if (!selectedId || !selectedInventoryId) {
      toast.error("Sélectionnez un équipement de l'inventaire");
      return;
    }
    setLoading(true);
    try {
      // Update order line with serial from inventory
      const { error } = await supabase
        .from("equipment_order_lines")
        .update({ serial_numbers: [serialDisplay] })
        .eq("id", selectedId);
      if (error) throw error;

      // Update inventory status to deployed
      await supabase
        .from("equipment_inventory")
        .update({ status: "deployed" } as any)
        .eq("id", selectedInventoryId);

      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("activity_logs").insert({
        user_id: user?.id || "system",
        entity_type: "equipment",
        entity_id: selectedId,
        action: "equipment_assigned",
        reason: note || null,
        details: {
          serial_number: serialDisplay,
          inventory_id: selectedInventoryId,
          catalog_name: selectedItem?.catalog_name,
          source: "account_360_inventory",
        },
      });

      toast.success("Équipement assigné depuis l'inventaire");
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
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader><DialogTitle className="text-sm font-bold flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /> Assigner un équipement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Ligne de commande</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
              {equipment.map((eq: any) => (<option key={eq.id} value={eq.id}>{eq.item_name} — {eq.item_sku || "N/A"}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Sélectionner depuis l'inventaire</label>
            {inventoryLoading ? (
              <p className="text-[10px] text-muted-foreground py-2">Chargement de l'inventaire...</p>
            ) : inventoryItems.length === 0 ? (
              <p className="text-[10px] text-amber-500 py-2">Aucun équipement en stock disponible</p>
            ) : (
              <select value={selectedInventoryId} onChange={e => setSelectedInventoryId(e.target.value)} className={inputCls}>
                <option value="">— Sélectionner —</option>
                {inventoryItems.map((item: any) => (
                  <option key={item.id} value={item.id}>
                    {item.catalog_name} — S/N: {item.serial_number || item.imei || item.mac_address || item.sku || "N/A"}
                  </option>
                ))}
              </select>
            )}
          </div>
          {selectedItem && (
            <div className="p-2 rounded-md bg-muted/50 text-[10px] space-y-1">
              <p><span className="font-semibold">Article:</span> {selectedItem.catalog_name}</p>
              <p><span className="font-semibold">S/N:</span> {selectedItem.serial_number || "—"}</p>
              {selectedItem.imei && <p><span className="font-semibold">IMEI:</span> {selectedItem.imei}</p>}
              {selectedItem.mac_address && <p><span className="font-semibold">MAC:</span> {selectedItem.mac_address}</p>}
            </div>
          )}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Note interne</label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="text-[11px]" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleAssign} disabled={loading || !selectedInventoryId} className={btnPrimary}>{loading ? "…" : "Assigner"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader><DialogTitle className="text-sm font-bold flex items-center gap-2 text-red-500"><Trash2 className="h-4 w-4" /> Retirer un équipement</DialogTitle></DialogHeader>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Équipement</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
            {equipment.map((eq: any) => (<option key={eq.id} value={eq.id}>{eq.item_name} — {eq.item_sku || "N/A"}</option>))}
          </select>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleRemove} disabled={loading} className="rounded-md bg-red-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-40">{loading ? "…" : "Retirer"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReplaceEquipmentModal({ equipment, onClose, onRefresh }: { equipment: any[]; onClose: () => void; onRefresh: () => void }) {
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
      const { error } = await supabase
        .from("equipment_order_lines")
        .update({ serial_numbers: newSerial ? [newSerial] : eq.serial_numbers })
        .eq("id", selectedId);
      if (error) throw error;

      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("activity_logs").insert({
        user_id: user?.id || "system",
        entity_type: "equipment",
        entity_id: selectedId,
        action: "equipment_replaced",
        reason,
        details: { old_serial: eq.serial_numbers, new_serial: newSerial || null, notes, source: "account_360" },
      });

      toast.success(`Équipement « ${eq.item_name} » remplacé`);
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
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader><DialogTitle className="text-sm font-bold flex items-center gap-2"><RefreshCw className="h-4 w-4 text-amber-500" /> Remplacer un équipement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Équipement</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
              {equipment.map((it: any) => (<option key={it.id} value={it.id}>{it.item_name} — {it.item_sku || "N/A"}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Raison</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className={inputCls}>
              <option value="lost">Perdu</option>
              <option value="damaged">Endommagé</option>
              <option value="defective">Défectueux</option>
              <option value="upgrade">Mise à niveau</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Nouveau S/N</label>
            <input value={newSerial} onChange={e => setNewSerial(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Notes</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-[11px]" />
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

function ExchangeEquipmentModal({ equipment, onClose, onRefresh }: { equipment: any[]; onClose: () => void; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState(equipment[0]?.id || "");
  const [newItemName, setNewItemName] = useState("");
  const [newItemSku, setNewItemSku] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [loading, setLoading] = useState(false);
  const eq = equipment.find((e: any) => e.id === selectedId);

  const handleExchange = async () => {
    if (!eq || !newItemName.trim()) {
      toast.error("Le nom du nouvel article est requis");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("equipment_order_lines")
        .update({
          item_name: newItemName.trim(),
          item_sku: newItemSku || eq.item_sku,
          serial_numbers: newSerial ? [newSerial] : null,
        })
        .eq("id", selectedId);
      if (error) throw error;

      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("activity_logs").insert({
        user_id: user?.id || "system",
        entity_type: "equipment",
        entity_id: selectedId,
        action: "equipment_exchanged",
        details: { old_item: eq.item_name, new_item: newItemName, source: "account_360" },
      });

      toast.success(`Équipement échangé: ${eq.item_name} → ${newItemName}`);
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
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader><DialogTitle className="text-sm font-bold flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-primary" /> Échanger un équipement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Équipement actuel</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
              {equipment.map((it: any) => (<option key={it.id} value={it.id}>{it.item_name} — {it.item_sku || "N/A"}</option>))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Nouvel article</label>
              <input value={newItemName} onChange={e => setNewItemName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">SKU</label>
              <input value={newItemSku} onChange={e => setNewItemSku(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Nouveau S/N</label>
            <input value={newSerial} onChange={e => setNewSerial(e.target.value)} className={inputCls} />
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

function ChangeStatusModal({ equipment, onClose, onRefresh }: { equipment: any[]; onClose: () => void; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState(equipment[0]?.id || "");
  const [status, setStatus] = useState("active");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const current = equipment.find((e: any) => e.id === selectedId);

  const handleChange = async () => {
    if (!current) return;
    setLoading(true);
    try {
      if (current.inventory_item_id) {
        const { error } = await supabase
          .from("inventory_items")
          .update({ status })
          .eq("id", current.inventory_item_id);
        if (error) throw error;
      }

      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("activity_logs").insert({
        user_id: user?.id || "system",
        entity_type: "equipment",
        entity_id: selectedId,
        action: "equipment_status_changed",
        reason: note || null,
        details: { status, inventory_item_id: current.inventory_item_id || null, source: "account_360" },
      });

      toast.success(`Statut équipement changé: ${status}`);
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
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader><DialogTitle className="text-sm font-bold flex items-center gap-2"><ToggleLeft className="h-4 w-4 text-primary" /> Changer le statut</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Équipement</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
              {equipment.map((it: any) => (<option key={it.id} value={it.id}>{it.item_name} — {it.item_sku || "N/A"}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Nouveau statut</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
              <option value="active">Actif</option>
              <option value="suspended">Suspendu</option>
              <option value="lost">Perdu</option>
              <option value="damaged">Endommagé</option>
              <option value="retired">Retiré</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Note</label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="text-[11px]" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleChange} disabled={loading} className={btnPrimary}>{loading ? "…" : "Appliquer"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChargeReplacementModal({ equipment, clientId, onClose, onRefresh }: { equipment: any[]; clientId?: string; onClose: () => void; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState(equipment[0]?.id || "");
  const [fee, setFee] = useState("50.00");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const eq = equipment.find((e: any) => e.id === selectedId);

  const handleCharge = async () => {
    const parsedFee = Number.parseFloat(fee);
    if (!parsedFee || parsedFee <= 0 || !eq) {
      toast.error("Montant invalide");
      return;
    }

    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("activity_logs").insert({
        user_id: user?.id || "system",
        entity_type: "equipment",
        entity_id: selectedId,
        action: "replacement_fee_charged",
        details: { item_name: eq.item_name, fee: parsedFee, reason, client_id: clientId || null, source: "account_360" },
      });
      toast.success(`Frais de remplacement ${parsedFee.toFixed(2)} $ enregistré`);
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
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader><DialogTitle className="text-sm font-bold flex items-center gap-2"><DollarSign className="h-4 w-4 text-amber-500" /> Facturer un remplacement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Équipement</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
              {equipment.map((it: any) => (<option key={it.id} value={it.id}>{it.item_name} — {it.item_sku || "N/A"}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Montant ($)</label>
            <input type="number" step="0.01" value={fee} onChange={e => setFee(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Raison</label>
            <input value={reason} onChange={e => setReason(e.target.value)} className={inputCls} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleCharge} disabled={loading} className="rounded-md bg-amber-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-500 disabled:opacity-40">{loading ? "…" : "Facturer"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
