/**
 * EditOrderDialog — Modify order details (address, service type, notes, status) from Core.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ShoppingCart } from "lucide-react";

const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50";
const btnPrimary = "rounded-md bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity";
const btnSecondary = "rounded-md border border-border px-4 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40 transition-colors";

interface Props {
  order: any;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function EditOrderDialog({ order, open, onClose, onRefresh }: Props) {
  const o = order;
  const [serviceType, setServiceType] = useState(o?.service_type || "");
  const [orderType, setOrderType] = useState(o?.order_type || "");
  const [status, setStatus] = useState(o?.status || "");
  const [clientEmail, setClientEmail] = useState(o?.client_email || "");
  const [clientPhone, setClientPhone] = useState(o?.client_phone || "");
  const [serviceAddress, setServiceAddress] = useState(o?.service_address || "");
  const [serviceCity, setServiceCity] = useState(o?.service_city || "");
  const [servicePostalCode, setServicePostalCode] = useState(o?.service_postal_code || "");
  const [internalNotes, setInternalNotes] = useState(o?.internal_notes || "");
  const [loading, setLoading] = useState(false);

  if (!o) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      const updates: any = {
        service_type: serviceType || null,
        order_type: orderType || null,
        status,
        client_email: clientEmail || null,
        client_phone: clientPhone || null,
        service_address: serviceAddress || null,
        service_city: serviceCity || null,
        service_postal_code: servicePostalCode || null,
        internal_notes: internalNotes || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("orders").update(updates).eq("id", o.id);
      if (error) throw error;

      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("activity_logs").insert({
        user_id: user?.id || "system",
        entity_type: "order",
        entity_id: o.id,
        action: "order_modified",
        details: { source: "core", status, service_type: serviceType },
      });

      toast.success("Commande modifiée");
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" /> Modifier la commande
            <span className="text-muted-foreground font-mono text-xs ml-1">{o.order_number || o.id.slice(0, 8)}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Statut</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                <option value="pending">En attente</option>
                <option value="submitted">Soumise</option>
                <option value="processing">En traitement</option>
                <option value="shipped">Expédiée</option>
                <option value="delivered">Livrée</option>
                <option value="installed">Installée</option>
                <option value="activated">Activée</option>
                <option value="completed">Complétée</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Type de service</label>
              <select value={serviceType} onChange={e => setServiceType(e.target.value)} className={inputCls}>
                <option value="">—</option>
                <option value="internet">Internet</option>
                <option value="tv">Télévision</option>
                <option value="mobile">Mobile</option>
                <option value="combo">Combo</option>
                <option value="streaming">Streaming</option>
                <option value="security">Sécurité</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Type commande</label>
              <select value={orderType} onChange={e => setOrderType(e.target.value)} className={inputCls}>
                <option value="">—</option>
                <option value="new">Nouveau</option>
                <option value="upgrade">Changement</option>
                <option value="renewal">Renouvellement</option>
                <option value="replacement">Remplacement</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Email client</label>
              <input value={clientEmail} onChange={e => setClientEmail(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Téléphone</label>
              <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Adresse de service</label>
            <input value={serviceAddress} onChange={e => setServiceAddress(e.target.value)} placeholder="123 rue Exemple" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Ville</label>
              <input value={serviceCity} onChange={e => setServiceCity(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Code postal</label>
              <input value={servicePostalCode} onChange={e => setServicePostalCode(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Notes internes</label>
            <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} placeholder="Notes opérationnelles..." className={`${inputCls} resize-none`} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleSave} disabled={loading} className={btnPrimary}>{loading ? "…" : "Enregistrer"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
