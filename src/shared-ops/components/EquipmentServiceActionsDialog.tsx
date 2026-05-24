/**
 * EquipmentServiceActionsDialog — Assign / return / mark defective.
 *
 * STRICT RULE: catalog data comes ONLY from public.services (category='Équipement').
 * Prices and names are NEVER editable by staff — they are resolved server-side
 * inside equipment-account-actions. Anything the staff sees is informational.
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Package, Plus, RotateCcw, AlertTriangle, Hash } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServicePlans } from "@/shared-ops/hooks/useServiceCatalog";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName?: string;
  accountId?: string | null;
  initialItems?: InventoryRow[];
}

interface InventoryRow {
  id: string;
  source?: "inventory" | "order_line" | "order_snapshot";
  catalog_name: string | null;
  item_name?: string | null;
  sku?: string | null;
  item_sku?: string | null;
  category: string | null;
  status: string;
  serial_number: string | null;
  serial_numbers?: string[] | null;
  imei: string | null;
  mac_address: string | null;
  price_client: number | null;
  unit_price?: number | null;
  assigned_at: string | null;
  created_at?: string | null;
  condition: string | null;
  order_id?: string | null;
  quantity?: number | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);

export function EquipmentServiceActionsDialog({
  open, onClose, clientUserId, clientName, accountId, initialItems = [],
}: Props) {
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"active" | "assign" | "return">("active");
  const { plans: catalog, loading: loadingCatalog } = useServicePlans("Équipement", open);

  const [items, setItems] = useState<InventoryRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // assign
  const [pickedCatalog, setPickedCatalog] = useState("");
  const [assignNotes, setAssignNotes] = useState("");

  // return / serial
  const [selectedId, setSelectedId] = useState("");
  const [returnCondition, setReturnCondition] = useState("good");
  const [returnReason, setReturnReason] = useState("");
  const [serial, setSerial] = useState("");
  const [imei, setImei] = useState("");
  const [mac, setMac] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab("active");
    setPickedCatalog("");
    setAssignNotes("");
    setSelectedId("");
    setReturnCondition("good");
    setReturnReason("");
    setSerial(""); setImei(""); setMac("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initialItems.length > 0) setItems(initialItems);
    setLoadingItems(initialItems.length === 0);
    supabase.functions.invoke("equipment-account-actions", {
      body: {
        action: "list_active",
        client_user_id: clientUserId,
        account_id: accountId ?? null,
      },
    }).then(({ data, error }) => {
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setItems(((data as any)?.items ?? []) as InventoryRow[]);
    }).catch((e) => {
      toast.error("Erreur chargement équipements", { description: (e as Error).message });
      setItems([]);
    }).finally(() => setLoadingItems(false));
  }, [open, accountId, clientUserId, busy]);

  const invoke = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("equipment-account-actions", {
        body: {
          client_user_id: clientUserId,
          account_id: accountId ?? null,
          ...body,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data;
    } finally {
      setBusy(false);
    }
  };

  const doAssign = async () => {
    if (!pickedCatalog) { toast.error("Choisissez un équipement du catalogue"); return; }
    try {
      const res = await invoke({
        action: "assign_from_catalog",
        catalog_item_id: pickedCatalog,
        notes: assignNotes || undefined,
      });
      toast.success(`Équipement assigné — ${(res as any)?.name || ""}`);
      setPickedCatalog(""); setAssignNotes("");
      setTab("active");
    } catch (e) { toast.error((e as Error).message); }
  };

  const doReturn = async () => {
    if (!selectedId) { toast.error("Sélectionnez un équipement"); return; }
    try {
      await invoke({
        action: "mark_returned",
        inventory_id: selectedId,
        condition: returnCondition,
        reason: returnReason || undefined,
      });
      toast.success("Retour enregistré");
      setSelectedId(""); setReturnReason("");
    } catch (e) { toast.error((e as Error).message); }
  };

  const doDefective = async (id: string) => {
    const reason = prompt("Raison (défectuosité) ?");
    if (reason === null) return;
    try {
      await invoke({ action: "mark_defective", inventory_id: id, reason });
      toast.success("Équipement marqué défectueux");
    } catch (e) { toast.error((e as Error).message); }
  };

  const doUpdateSerial = async () => {
    if (!selectedId) { toast.error("Sélectionnez un équipement"); return; }
    if (!serial && !imei && !mac) { toast.error("Aucun identifiant à enregistrer"); return; }
    try {
      await invoke({
        action: "update_serial",
        inventory_id: selectedId,
        serial_number: serial || undefined,
        imei: imei || undefined,
        mac_address: mac || undefined,
      });
      toast.success("Identifiants mis à jour");
      setSerial(""); setImei(""); setMac("");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Gestion équipement
          </DialogTitle>
          <DialogDescription>
            {clientName ? `Client : ${clientName}` : "Équipements assignés"}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded border border-violet-500/30 bg-violet-500/5 p-2 text-[11px] text-violet-200">
          Les noms et tarifs sont issus du catalogue Nivra (table <code>services</code>). Le serveur applique automatiquement le bon prix — aucune saisie manuelle de tarif n'est permise.
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active"><Package className="h-4 w-4 mr-1" />Actifs</TabsTrigger>
            <TabsTrigger value="assign"><Plus className="h-4 w-4 mr-1" />Assigner</TabsTrigger>
            <TabsTrigger value="return"><RotateCcw className="h-4 w-4 mr-1" />Retour / Identifiants</TabsTrigger>
          </TabsList>

          {/* ============ ACTIFS ============ */}
          <TabsContent value="active" className="space-y-3 pt-4">
            {loadingItems ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">
                Aucun équipement actif sur ce compte.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((it) => {
                  const isInventory = (it.source ?? "inventory") === "inventory";
                  const name = it.catalog_name || it.item_name || "Équipement";
                  const serials = it.serial_number || (Array.isArray(it.serial_numbers) ? it.serial_numbers.join(", ") : "");
                  return (
                  <li key={it.id} className="flex items-start justify-between gap-2 p-2 rounded border bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{name}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{it.status}</Badge>
                        {it.source && it.source !== "inventory" && <Badge variant="secondary" className="text-[10px]">commande</Badge>}
                        {(it.price_client ?? it.unit_price) !== null && <span>{fmt(Number(it.price_client ?? it.unit_price))}</span>}
                        {it.quantity && Number(it.quantity) > 1 && <span>Qté: {it.quantity}</span>}
                        {serials && <span>S/N: {serials}</span>}
                        {it.imei && <span>IMEI: {it.imei}</span>}
                        {it.mac_address && <span>MAC: {it.mac_address}</span>}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost"
                      onClick={() => doDefective(it.id)}
                      disabled={busy || !isInventory}
                      title="Marquer défectueux">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    </Button>
                  </li>
                );})}
              </ul>
            )}
          </TabsContent>

          {/* ============ ASSIGN ============ */}
          <TabsContent value="assign" className="space-y-3 pt-4">
            <div>
              <Label>Équipement du catalogue</Label>
              <Select value={pickedCatalog} onValueChange={setPickedCatalog} disabled={busy || loadingCatalog}>
                <SelectTrigger><SelectValue placeholder={loadingCatalog ? "Chargement…" : "Sélectionner…"} /></SelectTrigger>
                <SelectContent>
                  {catalog.length === 0 && !loadingCatalog && (
                    <SelectItem value="__none" disabled>Aucun équipement actif au catalogue</SelectItem>
                  )}
                  {catalog.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {fmt(c.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="assign-notes">Note (optionnel)</Label>
              <Textarea id="assign-notes" rows={2} value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)} disabled={busy} />
            </div>
            <Button onClick={doAssign} disabled={busy || !pickedCatalog} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Assigner l'équipement
            </Button>
          </TabsContent>

          {/* ============ RETURN / SERIAL ============ */}
          <TabsContent value="return" className="space-y-4 pt-4">
            <div>
              <Label>Équipement concerné</Label>
              <Select value={selectedId} onValueChange={setSelectedId} disabled={busy}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un équipement actif…" /></SelectTrigger>
                <SelectContent>
                  {items.filter((it) => (it.source ?? "inventory") === "inventory").length === 0 && <SelectItem value="__none" disabled>Aucun équipement actif modifiable</SelectItem>}
                  {items.filter((it) => (it.source ?? "inventory") === "inventory").map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.catalog_name || "Équipement"} {it.serial_number ? `· ${it.serial_number}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div>
              <Label className="text-xs uppercase text-muted-foreground">Retour</Label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div>
                  <Label htmlFor="ret-cond">État</Label>
                  <Select value={returnCondition} onValueChange={setReturnCondition} disabled={busy}>
                    <SelectTrigger id="ret-cond"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Neuf</SelectItem>
                      <SelectItem value="good">Bon</SelectItem>
                      <SelectItem value="damaged">Endommagé</SelectItem>
                      <SelectItem value="lost">Perdu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ret-reason">Note</Label>
                  <Input id="ret-reason" value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)} disabled={busy} />
                </div>
              </div>
              <Button onClick={doReturn} disabled={busy || !selectedId} className="w-full mt-2" variant="secondary">
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                Enregistrer le retour
              </Button>
            </div>

            <Separator />

            <div>
              <Label className="text-xs uppercase text-muted-foreground">Identifiants matériels</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
                <div>
                  <Label htmlFor="serial">S/N ou ICCID</Label>
                  <Input id="serial" value={serial} onChange={(e) => setSerial(e.target.value)} disabled={busy} />
                </div>
                <div>
                  <Label htmlFor="imei">IMEI</Label>
                  <Input id="imei" value={imei} onChange={(e) => setImei(e.target.value)} disabled={busy} />
                </div>
                <div>
                  <Label htmlFor="mac">MAC</Label>
                  <Input id="mac" value={mac} onChange={(e) => setMac(e.target.value)} disabled={busy} />
                </div>
              </div>
              <Button onClick={doUpdateSerial} disabled={busy || !selectedId} className="w-full mt-2" variant="outline">
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Hash className="h-4 w-4 mr-2" />}
                Enregistrer les identifiants
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
