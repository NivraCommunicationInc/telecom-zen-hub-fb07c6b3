/**
 * Account360DetailDialogs — Click-through detail dialogs for Customer 360 rows.
 * - EquipmentDetailDialog: manage status, condition, notes per item.
 * - KycDetailDialog: view photos (signed URLs), reviewer notes, decision metadata.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate, fmtDateTime } from "./Account360Helpers";

const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground outline-none focus:border-primary/50";
const btnPrimary = "rounded-md bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40";
const btnSecondary = "rounded-md border border-border px-4 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40";

const EQUIPMENT_STATUSES = [
  "in_stock", "reserved", "assigned", "shipped", "deployed",
  "returned", "defective", "lost", "retired",
];
const EQUIPMENT_CONDITIONS = ["new", "good", "used", "damaged", "defective"];

interface EquipmentDetailProps {
  item: any;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function EquipmentDetailDialog({ item, open, onClose, onRefresh }: EquipmentDetailProps) {
  const [status, setStatus] = useState<string>(item?.status || "");
  const [condition, setCondition] = useState<string>(item?.condition || "");
  const [notes, setNotes] = useState<string>(item?.notes || "");
  const [serial, setSerial] = useState<string>(item?.serial_number || "");
  const [mac, setMac] = useState<string>(item?.mac_address || "");
  const [imei, setImei] = useState<string>(item?.imei || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setStatus(item.status || "");
    setCondition(item.condition || "");
    setNotes(item.notes || "");
    setSerial(item.serial_number || "");
    setMac(item.mac_address || "");
    setImei(item.imei || "");
  }, [item]);

  if (!item) return null;
  const isInventory = !!item.catalog_name; // equipment_inventory row vs order-line snapshot

  async function save() {
    if (!isInventory) {
      toast.error("Cet équipement provient de la commande — utilisez les actions du haut pour l'ajouter à l'inventaire.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("equipment_inventory")
      .update({
        status, condition, notes,
        serial_number: serial || null,
        mac_address: mac || null,
        imei: imei || null,
      })
      .eq("id", item.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Équipement mis à jour");
    onRefresh();
    onClose();
  }

  async function markDefective() {
    if (!isInventory) return;
    setSaving(true);
    const { error } = await supabase
      .from("equipment_inventory")
      .update({ status: "defective", condition: "defective" })
      .eq("id", item.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Équipement marqué défectueux");
    onRefresh();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {item.catalog_name || item.item_name || "Équipement"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-[11px]">
          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
            <div><span className="font-semibold text-foreground">SKU:</span> {item.sku || item.item_sku || "—"}</div>
            <div><span className="font-semibold text-foreground">Catégorie:</span> {item.category || "—"}</div>
            <div><span className="font-semibold text-foreground">Prix:</span> {item.price_client ?? item.unit_price ?? "—"}</div>
            <div><span className="font-semibold text-foreground">Assigné:</span> {fmtDateTime(item.assigned_at) || "—"}</div>
          </div>

          {!isInventory && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-amber-500">
              Élément provenant de la commande (snapshot). Pour gérer le statut, ajoutez-le à l'inventaire via le menu d'actions ci-dessus.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-muted-foreground">Statut</span>
              <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)} disabled={!isInventory}>
                <option value="">—</option>
                {EQUIPMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-muted-foreground">Condition</span>
              <select className={inputCls} value={condition} onChange={(e) => setCondition(e.target.value)} disabled={!isInventory}>
                <option value="">—</option>
                {EQUIPMENT_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-muted-foreground">Numéro de série</span>
              <input className={inputCls} value={serial} onChange={(e) => setSerial(e.target.value)} disabled={!isInventory} />
            </label>
            <label className="space-y-1">
              <span className="text-muted-foreground">MAC</span>
              <input className={inputCls} value={mac} onChange={(e) => setMac(e.target.value)} disabled={!isInventory} />
            </label>
            <label className="space-y-1 col-span-2">
              <span className="text-muted-foreground">IMEI</span>
              <input className={inputCls} value={imei} onChange={(e) => setImei(e.target.value)} disabled={!isInventory} />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-muted-foreground">Notes internes</span>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={!isInventory} />
          </label>
        </div>

        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Fermer</button>
          {isInventory && (
            <>
              <button onClick={markDefective} disabled={saving} className="rounded-md border border-red-500/50 px-4 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-500/10">
                Déclarer défectueux
              </button>
              <button onClick={save} disabled={saving} className={btnPrimary}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────── KYC Detail ────────── */

interface KycDetailProps {
  session: any;
  open: boolean;
  onClose: () => void;
}

export function KycDetailDialog({ session, open, onClose }: KycDetailProps) {
  const [urls, setUrls] = useState<{ front?: string; back?: string; selfie?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session || !open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const paths: Record<string, string | null> = {
        front: session.document_front_path,
        back: session.document_back_path,
        selfie: session.selfie_path,
      };
      const result: any = {};
      for (const [k, p] of Object.entries(paths)) {
        if (!p) continue;
        const { data } = await supabase.storage.from("id-documents").createSignedUrl(p, 600);
        if (data?.signedUrl) result[k] = data.signedUrl;
      }
      if (!cancelled) { setUrls(result); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [session, open]);

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Vérification KYC — {session.case_number || session.id?.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-[11px]">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-muted-foreground">Statut:</span> <span className="font-semibold text-foreground">{session.status || "—"}</span></div>
            <div><span className="text-muted-foreground">Type de pièce:</span> {session.id_type || session.document_type || "—"}</div>
            <div><span className="text-muted-foreground">Province:</span> {session.id_province || "—"}</div>
            <div><span className="text-muted-foreground">Soumis le:</span> {fmtDateTime(session.submitted_at)}</div>
            <div><span className="text-muted-foreground">Révisé le:</span> {fmtDateTime(session.reviewed_at)}</div>
            <div><span className="text-muted-foreground">Révisé par:</span> {session.reviewed_by || "—"}</div>
          </div>

          {session.review_reason && (
            <div className="rounded-md border border-border bg-muted/40 p-2">
              <p className="text-muted-foreground font-semibold mb-1">Note de révision</p>
              <p className="text-foreground whitespace-pre-wrap">{session.review_reason}</p>
            </div>
          )}

          <div>
            <p className="text-muted-foreground font-semibold mb-2">Photos</p>
            {loading ? (
              <p className="text-muted-foreground">Chargement…</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {(["front", "back", "selfie"] as const).map((k) => (
                  <div key={k} className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p>
                    {urls[k] ? (
                      <a href={urls[k]} target="_blank" rel="noreferrer">
                        <img src={urls[k]} alt={k} className="w-full h-32 object-cover rounded-md border border-border hover:opacity-90" />
                      </a>
                    ) : (
                      <div className="w-full h-32 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground text-[10px]">
                        Aucune
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {session.result_payload && Object.keys(session.result_payload).length > 0 && (
            <details className="rounded-md border border-border p-2">
              <summary className="cursor-pointer text-muted-foreground">Données brutes</summary>
              <pre className="mt-2 text-[10px] overflow-x-auto">{JSON.stringify(session.result_payload, null, 2)}</pre>
            </details>
          )}
        </div>

        <DialogFooter>
          <button onClick={onClose} className={btnSecondary}>Fermer</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
