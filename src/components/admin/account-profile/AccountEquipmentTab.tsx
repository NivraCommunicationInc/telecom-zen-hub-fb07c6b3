/**
 * AccountEquipmentTab — Full equipment + SIM/eSIM management workspace
 * Assign, replace, remove, transfer equipment. Manage SIM/eSIM references.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { writeAccountJournal } from "@/lib/writeAccountJournal";
import {
  Router, Tv, Smartphone, HardDrive, Loader2, PlusCircle, MoreHorizontal,
  Unlink, MapPin, RefreshCw, ArrowRightLeft, Edit,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface AccountEquipmentTabProps {
  accountId: string;
  clientId: string;
}

const equipmentIcons: Record<string, any> = {
  router: Router, modem: Router, tv_box: Tv, sim: Smartphone, esim: Smartphone, device: HardDrive,
};
const equipmentTypeLabels: Record<string, string> = {
  router: "Routeur", modem: "Modem", tv_box: "Boîtier TV", sim: "Carte SIM", esim: "eSIM", device: "Appareil",
};

export function AccountEquipmentTab({ accountId, clientId }: AccountEquipmentTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [editEq, setEditEq] = useState<any>(null);
  const [removeEq, setRemoveEq] = useState<any>(null);
  const [eqName, setEqName] = useState("");
  const [eqType, setEqType] = useState("router");
  const [eqSerial, setEqSerial] = useState("");
  const [eqMac, setEqMac] = useState("");
  const [eqImei, setEqImei] = useState("");
  const [eqIccid, setEqIccid] = useState("");
  const [eqOrderId, setEqOrderId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["account-equipment", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, equipment_details, equipment_line_details, equipment_id, service_type, status")
        .eq("account_id", accountId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const { data: equipmentLines, refetch: refetchLines } = useQuery({
    queryKey: ["account-equipment-lines", accountId],
    queryFn: async () => {
      if (!orders?.length) return [];
      const orderIds = orders.map((o: any) => o.id);
      const { data, error } = await supabase
        .from("equipment_order_lines")
        .select("*")
        .in("order_id", orderIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orders?.length,
  });

  const { data: locations } = useQuery({
    queryKey: ["account-locations-for-eq", accountId],
    queryFn: async () => {
      // R1 canonical read: service_addresses (aliased to legacy shape)
      const { data } = await supabase.from("service_addresses").select("id, label, service_address:address_line").eq("account_id", accountId).eq("is_active", true);
      return data || [];
    },
    enabled: !!accountId,
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  // Build unified equipment list
  const allEquipment: any[] = [];
  orders?.forEach((order: any) => {
    if (order.equipment_line_details && Array.isArray(order.equipment_line_details)) {
      order.equipment_line_details.forEach((eq: any, idx: number) => {
        allEquipment.push({ ...eq, order_number: order.order_number, order_id: order.id, service_type: order.service_type, _source: "snapshot", _idx: idx });
      });
    } else if (order.equipment_details && typeof order.equipment_details === "object") {
      allEquipment.push({
        ...order.equipment_details,
        order_number: order.order_number,
        order_id: order.id,
        service_type: order.service_type,
        equipment_id: order.equipment_id,
        _source: "snapshot",
      });
    }
  });
  equipmentLines?.forEach((line: any) => {
    const exists = allEquipment.find((e: any) => e.id === line.id);
    if (exists) return;
    const matchedOrder = orders?.find((o: any) => o.id === line.order_id);
    allEquipment.push({
      id: line.id,
      name: line.equipment_name || line.sku || "Équipement",
      type: line.equipment_type || "device",
      serial_number: line.serial_number,
      mac_address: line.mac_address,
      imei: line.imei,
      iccid: line.iccid,
      quantity: line.quantity,
      order_number: matchedOrder?.order_number,
      order_id: line.order_id,
      service_type: matchedOrder?.service_type,
      _isLine: true,
    });
  });

  const simEquipment = allEquipment.filter((eq: any) => ["sim", "esim"].includes(eq.type));
  const otherEquipment = allEquipment.filter((eq: any) => !["sim", "esim"].includes(eq.type));

  const resetForm = () => {
    setEqName(""); setEqType("router"); setEqSerial(""); setEqMac(""); setEqImei(""); setEqIccid(""); setEqOrderId("");
  };

  const handleAssign = async () => {
    if (!eqName.trim()) return;
    setSaving(true);
    try {
      const targetOrderId = eqOrderId || orders?.[0]?.id;
      if (!targetOrderId) {
        toast.error("Aucune commande disponible pour lier l'équipement");
        setSaving(false);
        return;
      }
      const { error } = await supabase.from("equipment_order_lines").insert({
        order_id: targetOrderId,
        equipment_name: eqName.trim(),
        equipment_type: eqType,
        serial_number: eqSerial || null,
        mac_address: eqMac || null,
        imei: eqImei || null,
        iccid: eqIccid || null,
        quantity: 1,
        unit_price: 0,
        line_total: 0,
      });
      if (error) throw error;

      await writeAccountJournal({
        targetTable: "client_activity_logs",
        eventKey: `equipment:${clientId}:assigned:${eqSerial || eqIccid || eqImei || eqName}:${new Date().toISOString().slice(0, 16)}`,
        visibility: "staff",
        payload: {
          client_id: clientId,
          action_type: "equipment_assigned",
          summary: `Équipement "${eqName}" (${equipmentTypeLabels[eqType] || eqType}) assigné. S/N: ${eqSerial || "N/A"}${eqIccid ? `, ICCID: ${eqIccid}` : ""}${eqImei ? `, IMEI: ${eqImei}` : ""}`,
        },
      });

      toast.success("Équipement assigné");
      setAssignOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["account-equipment-lines"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editEq?._isLine || !editEq?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("equipment_order_lines").update({
        equipment_name: eqName.trim() || editEq.name,
        serial_number: eqSerial || null,
        mac_address: eqMac || null,
        imei: eqImei || null,
        iccid: eqIccid || null,
      }).eq("id", editEq.id);
      if (error) throw error;

      await supabase.from("client_activity_logs").insert({
        client_id: clientId,
        actor_user_id: user?.id || "",
        actor_role: "admin",
        action_type: "equipment_updated",
        summary: `Équipement "${eqName || editEq.name}" modifié. S/N: ${eqSerial || "N/A"}`,
      });

      toast.success("Équipement mis à jour");
      setEditEq(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["account-equipment-lines"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!removeEq) return;
    if (!removeEq._isLine || !removeEq.id) {
      toast.info("Cet équipement est lié à la commande d'origine et ne peut pas être retiré ici.");
      setRemoveEq(null);
      return;
    }
    try {
      const { error } = await supabase.from("equipment_order_lines").delete().eq("id", removeEq.id);
      if (error) throw error;

      await supabase.from("client_activity_logs").insert({
        client_id: clientId,
        actor_user_id: user?.id || "",
        actor_role: "admin",
        action_type: "equipment_removed",
        summary: `Équipement "${removeEq.name}" retiré du compte`,
      });

      toast.success("Équipement retiré");
      setRemoveEq(null);
      queryClient.invalidateQueries({ queryKey: ["account-equipment-lines"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const renderEquipmentRow = (eq: any, i: number) => {
    const Icon = equipmentIcons[eq.type] || HardDrive;
    return (
      <div key={eq.id || `eq-${i}`} className="flex items-center justify-between p-3 rounded-md border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">{eq.name || eq.model || "Équipement"}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              {eq.type && <Badge variant="outline" className="text-[9px]">{equipmentTypeLabels[eq.type] || eq.type}</Badge>}
              {eq.serial_number && <span>S/N: {eq.serial_number}</span>}
              {eq.mac_address && <span>MAC: {eq.mac_address}</span>}
              {eq.imei && <span>IMEI: {eq.imei}</span>}
              {eq.iccid && <span>ICCID: {eq.iccid}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {eq.service_type && <Badge variant="outline" className="text-[10px]">{eq.service_type}</Badge>}
          {eq.order_number && <span className="text-xs text-muted-foreground font-mono">{eq.order_number}</span>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {eq._isLine && (
                <DropdownMenuItem onClick={() => {
                  setEditEq(eq);
                  setEqName(eq.name || "");
                  setEqSerial(eq.serial_number || "");
                  setEqMac(eq.mac_address || "");
                  setEqImei(eq.imei || "");
                  setEqIccid(eq.iccid || "");
                }}>
                  <Edit className="h-3.5 w-3.5 mr-2" /> Modifier
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => {
                setAssignOpen(true);
                setEqType(eq.type || "router");
                setEqName(`${eq.name || "Équipement"} (remplacement)`);
              }}>
                <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Remplacer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setRemoveEq(eq)} className="text-destructive">
                <Unlink className="h-3.5 w-3.5 mr-2" /> Retirer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Équipements & SIM ({allEquipment.length})</h3>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { resetForm(); setAssignOpen(true); }}>
          <PlusCircle className="h-3.5 w-3.5" />
          Assigner
        </Button>
      </div>

      <Tabs defaultValue="equipment" className="w-full">
        <TabsList className="h-8">
          <TabsTrigger value="equipment" className="text-xs">Équipements ({otherEquipment.length})</TabsTrigger>
          <TabsTrigger value="sim" className="text-xs">SIM / eSIM ({simEquipment.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="equipment">
          {otherEquipment.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun équipement assigné</p>
          ) : (
            <div className="space-y-2">{otherEquipment.map((eq, i) => renderEquipmentRow(eq, i))}</div>
          )}
        </TabsContent>

        <TabsContent value="sim">
          {simEquipment.length === 0 ? (
            <div className="text-center py-8">
              <Smartphone className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Aucune SIM / eSIM assignée</p>
              <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => { resetForm(); setEqType("sim"); setAssignOpen(true); }}>
                <PlusCircle className="h-3.5 w-3.5 mr-1" /> Assigner une SIM
              </Button>
            </div>
          ) : (
            <div className="space-y-2">{simEquipment.map((eq, i) => renderEquipmentRow(eq, i))}</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Assign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner un équipement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nom / Modèle</Label>
              <Input value={eqName} onChange={e => setEqName(e.target.value)} placeholder="Ex: Routeur Wi-Fi 6" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={eqType} onValueChange={setEqType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="router">Routeur</SelectItem>
                  <SelectItem value="modem">Modem</SelectItem>
                  <SelectItem value="tv_box">Boîtier TV</SelectItem>
                  <SelectItem value="sim">Carte SIM</SelectItem>
                  <SelectItem value="esim">eSIM</SelectItem>
                  <SelectItem value="device">Appareil</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {orders && orders.length > 1 && (
              <div>
                <Label>Commande liée</Label>
                <Select value={eqOrderId} onValueChange={setEqOrderId}>
                  <SelectTrigger><SelectValue placeholder="Dernière commande" /></SelectTrigger>
                  <SelectContent>
                    {orders.map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>{o.order_number} ({o.service_type || "—"})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Numéro de série</Label>
              <Input value={eqSerial} onChange={e => setEqSerial(e.target.value)} placeholder="S/N..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Adresse MAC</Label>
                <Input value={eqMac} onChange={e => setEqMac(e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" />
              </div>
              <div>
                <Label>IMEI</Label>
                <Input value={eqImei} onChange={e => setEqImei(e.target.value)} placeholder="IMEI..." />
              </div>
            </div>
            {["sim", "esim"].includes(eqType) && (
              <div>
                <Label>ICCID</Label>
                <Input value={eqIccid} onChange={e => setEqIccid(e.target.value)} placeholder="ICCID de la carte SIM..." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Annuler</Button>
            <Button onClick={handleAssign} disabled={saving || !eqName.trim()}>
              {saving ? "Assignation..." : "Assigner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editEq} onOpenChange={() => { setEditEq(null); resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'équipement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nom / Modèle</Label>
              <Input value={eqName} onChange={e => setEqName(e.target.value)} />
            </div>
            <div>
              <Label>Numéro de série</Label>
              <Input value={eqSerial} onChange={e => setEqSerial(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Adresse MAC</Label>
                <Input value={eqMac} onChange={e => setEqMac(e.target.value)} />
              </div>
              <div>
                <Label>IMEI</Label>
                <Input value={eqImei} onChange={e => setEqImei(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>ICCID</Label>
              <Input value={eqIccid} onChange={e => setEqIccid(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditEq(null); resetForm(); }}>Annuler</Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? "Mise à jour..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog open={!!removeEq} onOpenChange={() => setRemoveEq(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer l'équipement</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous retirer "{removeEq?.name}" du compte client? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Retirer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
