/**
 * WorkbenchFulfillmentTab V2 — Operational shipment + equipment + appointment management
 * Full CRUD: update shipment, assign equipment, manage appointments
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Truck, Package, Calendar, Edit, CheckCircle, XCircle, Plus, Loader2, Wrench } from "lucide-react";
import { canPerformAction } from "@/lib/workbenchRoles";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { adminClient as supabase } from "@/integrations/backend";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  shipments: any[];
  inventoryAssignments: any[];
  appointments: any[];
  orderId: string;
  role: string | null;
  onUpdateShipment: (shipmentId: string, data: any) => Promise<void>;
  onAssignEquipment: (stockItemId: string, orderItemId?: string, shipmentId?: string) => Promise<void>;
  onUpdateAppointment: (appointmentId: string, data: any) => Promise<void>;
}

const SHIPMENT_STATUS: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/20 text-amber-400", label: "En préparation" },
  label_created: { color: "bg-blue-500/20 text-blue-400", label: "Étiquette créée" },
  shipped: { color: "bg-cyan-500/20 text-cyan-400", label: "Expédié" },
  in_transit: { color: "bg-cyan-500/20 text-cyan-400", label: "En transit" },
  delivered: { color: "bg-emerald-500/20 text-emerald-400", label: "Livré" },
  returned: { color: "bg-red-500/20 text-red-400", label: "Retourné" },
};

const APT_STATUS: Record<string, { color: string; label: string }> = {
  scheduled: { color: "bg-blue-500/20 text-blue-400", label: "Planifié" },
  confirmed: { color: "bg-emerald-500/20 text-emerald-400", label: "Confirmé" },
  in_progress: { color: "bg-cyan-500/20 text-cyan-400", label: "En cours" },
  completed: { color: "bg-emerald-500/20 text-emerald-400", label: "Terminé" },
  cancelled: { color: "bg-red-500/20 text-red-400", label: "Annulé" },
  no_show: { color: "bg-red-500/20 text-red-400", label: "Absent" },
};

export function WorkbenchFulfillmentTab({ shipments, inventoryAssignments, appointments, orderId, role, onUpdateShipment, onAssignEquipment, onUpdateAppointment }: Props) {
  const [editShipment, setEditShipment] = useState<any>(null);
  const [editApt, setEditApt] = useState<any>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [shipForm, setShipForm] = useState({ carrier: "", tracking_number: "", tracking_url: "", status: "", notes: "" });
  const [aptForm, setAptForm] = useState({ status: "", internal_notes: "", cancellation_reason: "" });
  const [selectedStockId, setSelectedStockId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Load available stock for assignment
  const { data: availableStock = [] } = useQuery({
    queryKey: ["available-stock"],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_stock").select("*").eq("status", "available").order("item_type").limit(50);
      return data || [];
    },
    enabled: showAssignDialog,
  });

  const openShipmentEdit = (s: any) => {
    setShipForm({ carrier: s.carrier || "", tracking_number: s.tracking_number || "", tracking_url: s.tracking_url || "", status: s.status || "pending", notes: s.notes || "" });
    setEditShipment(s);
  };

  const handleShipmentSave = async () => {
    setIsProcessing(true);
    try {
      await onUpdateShipment(editShipment.id, shipForm);
      setEditShipment(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const openAptEdit = (apt: any) => {
    setAptForm({ status: apt.status || "scheduled", internal_notes: apt.internal_notes || "", cancellation_reason: "" });
    setEditApt(apt);
  };

  const handleAptSave = async () => {
    setIsProcessing(true);
    try {
      await onUpdateAppointment(editApt.id, aptForm);
      setEditApt(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedStockId) return;
    setIsProcessing(true);
    try {
      await onAssignEquipment(selectedStockId, undefined, shipments[0]?.id);
      setShowAssignDialog(false);
      setSelectedStockId("");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── SHIPMENTS ────────────────────────────────────────────── */}
      <div className="border border-border rounded-lg bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" /> Expéditions ({shipments.length})
        </h3>
        {shipments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune expédition</p>
        ) : (
          <div className="space-y-2">
            {shipments.map((s: any) => {
              const cfg = SHIPMENT_STATUS[s.status] || SHIPMENT_STATUS.pending;
              return (
                <div key={s.id} className="p-3 rounded bg-muted/50 border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm text-foreground">{s.shipment_number}</p>
                      <p className="text-xs text-muted-foreground">{s.carrier || "Transporteur non défini"}</p>
                      {s.tracking_number && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Tracking: <span className="font-mono text-foreground">{s.tracking_number}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cfg.color}>{cfg.label}</Badge>
                      {canPerformAction(role, "manage_shipment") && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openShipmentEdit(s)}>
                          <Edit className="h-3 w-3 mr-1" /> Modifier
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── EQUIPMENT ────────────────────────────────────────────── */}
      <div className="border border-border rounded-lg bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Équipement ({inventoryAssignments.length})
          </h3>
          {canPerformAction(role, "assign_inventory") && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAssignDialog(true)}>
              <Plus className="h-3 w-3 mr-1" /> Assigner
            </Button>
          )}
        </div>
        {inventoryAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun équipement assigné</p>
        ) : (
          <div className="space-y-2">
            {inventoryAssignments.map((a: any) => (
              <div key={a.id} className="p-3 rounded bg-muted/50 border border-border">
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm text-foreground">{a.inventory_stock?.item_type || a.inventory_stock?.device_type || "Appareil"} — {a.inventory_stock?.brand} {a.inventory_stock?.model}</p>
                    <div className="text-xs text-muted-foreground font-mono mt-1 space-x-3">
                      {a.inventory_stock?.serial_number && <span>S/N: {a.inventory_stock.serial_number}</span>}
                      {a.inventory_stock?.mac_address && <span>MAC: {a.inventory_stock.mac_address}</span>}
                      {a.inventory_stock?.iccid && <span>ICCID: {a.inventory_stock.iccid}</span>}
                      {a.inventory_stock?.imei && <span>IMEI: {a.inventory_stock.imei}</span>}
                    </div>
                  </div>
                  <Badge variant="outline">{a.status || "assigned"}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── APPOINTMENTS ─────────────────────────────────────────── */}
      <div className="border border-border rounded-lg bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" /> Rendez-vous ({appointments.length})
        </h3>
        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun rendez-vous</p>
        ) : (
          <div className="space-y-2">
            {appointments.map((apt: any) => {
              const cfg = APT_STATUS[apt.status] || APT_STATUS.scheduled;
              return (
                <div key={apt.id} className="p-3 rounded bg-muted/50 border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">{apt.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(apt.scheduled_at), "EEEE dd MMMM yyyy à HH:mm", { locale: fr })}
                      </p>
                      {apt.technicians?.full_name && (
                        <p className="text-xs text-primary mt-1 flex items-center gap-1">
                          <Wrench className="h-3 w-3" /> {apt.technicians.full_name}
                        </p>
                      )}
                      {apt.appointment_number && (
                        <p className="text-xs text-muted-foreground font-mono">#{apt.appointment_number}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cfg.color}>{cfg.label}</Badge>
                      {canPerformAction(role, "manage_shipment") && apt.status !== "completed" && apt.status !== "cancelled" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openAptEdit(apt)}>
                          <Edit className="h-3 w-3 mr-1" /> Gérer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SHIPMENT EDIT DIALOG ─────────────────────────────────── */}
      <Dialog open={!!editShipment} onOpenChange={() => setEditShipment(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier l'expédition {editShipment?.shipment_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Transporteur</label>
              <Input value={shipForm.carrier} onChange={e => setShipForm(f => ({ ...f, carrier: e.target.value }))} placeholder="Purolator, Postes Canada…" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Numéro de suivi</label>
              <Input value={shipForm.tracking_number} onChange={e => setShipForm(f => ({ ...f, tracking_number: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">URL de suivi</label>
              <Input value={shipForm.tracking_url} onChange={e => setShipForm(f => ({ ...f, tracking_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Statut</label>
              <Select value={shipForm.status} onValueChange={v => setShipForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SHIPMENT_STATUS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea value={shipForm.notes} onChange={e => setShipForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditShipment(null)}>Annuler</Button>
            <Button onClick={handleShipmentSave} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── APPOINTMENT EDIT DIALOG ──────────────────────────────── */}
      <Dialog open={!!editApt} onOpenChange={() => setEditApt(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gérer le rendez-vous</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Statut</label>
              <Select value={aptForm.status} onValueChange={v => setAptForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(APT_STATUS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {aptForm.status === "cancelled" && (
              <div>
                <label className="text-xs text-muted-foreground">Raison d'annulation</label>
                <Textarea value={aptForm.cancellation_reason} onChange={e => setAptForm(f => ({ ...f, cancellation_reason: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Notes internes</label>
              <Textarea value={aptForm.internal_notes} onChange={e => setAptForm(f => ({ ...f, internal_notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditApt(null)}>Annuler</Button>
            <Button onClick={handleAptSave} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ASSIGN EQUIPMENT DIALOG ──────────────────────────────── */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Assigner un équipement</DialogTitle></DialogHeader>
          {availableStock.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucun équipement disponible en stock</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableStock.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedStockId(item.id)}
                  className={`p-3 rounded border cursor-pointer transition-colors ${selectedStockId === item.id ? "border-primary bg-primary/10" : "border-border bg-muted/50 hover:bg-muted"}`}
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm text-foreground">{item.item_type} — {item.brand} {item.model}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {item.serial_number && `S/N: ${item.serial_number}`}
                        {item.mac_address && ` | MAC: ${item.mac_address}`}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.sku}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Annuler</Button>
            <Button onClick={handleAssign} disabled={!selectedStockId || isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Assigner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
