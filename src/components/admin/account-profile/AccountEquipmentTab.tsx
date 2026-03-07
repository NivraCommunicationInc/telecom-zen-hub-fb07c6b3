/**
 * AccountEquipmentTab — Equipment with assign/unassign/link operations
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { Router, Tv, Smartphone, HardDrive, Loader2, PlusCircle, MoreHorizontal, Link2, Unlink, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface AccountEquipmentTabProps {
  accountId: string;
  clientId: string;
}

const equipmentIcons: Record<string, any> = {
  router: Router, modem: Router, tv_box: Tv, sim: Smartphone, device: HardDrive,
};

export function AccountEquipmentTab({ accountId, clientId }: AccountEquipmentTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [eqName, setEqName] = useState("");
  const [eqType, setEqType] = useState("router");
  const [eqSerial, setEqSerial] = useState("");
  const [eqMac, setEqMac] = useState("");
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

  const { data: equipmentLines } = useQuery({
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

  // Fetch locations for linking
  const { data: locations } = useQuery({
    queryKey: ["account-locations-for-eq", accountId],
    queryFn: async () => {
      const { data } = await supabase.from("account_service_locations").select("id, label, service_address").eq("account_id", accountId);
      return data || [];
    },
    enabled: !!accountId,
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const allEquipment: any[] = [];
  orders?.forEach((order: any) => {
    if (order.equipment_line_details && Array.isArray(order.equipment_line_details)) {
      order.equipment_line_details.forEach((eq: any) => {
        allEquipment.push({ ...eq, order_number: order.order_number, order_id: order.id, service_type: order.service_type });
      });
    } else if (order.equipment_details && typeof order.equipment_details === "object") {
      allEquipment.push({
        ...order.equipment_details,
        order_number: order.order_number,
        order_id: order.id,
        service_type: order.service_type,
        equipment_id: order.equipment_id,
      });
    }
  });
  equipmentLines?.forEach((line: any) => {
    const matchedOrder = orders?.find((o: any) => o.id === line.order_id);
    allEquipment.push({
      id: line.id,
      name: line.equipment_name || line.sku || "Équipement",
      serial_number: line.serial_number,
      quantity: line.quantity,
      order_number: matchedOrder?.order_number,
      order_id: line.order_id,
      service_type: matchedOrder?.service_type,
      _isLine: true,
    });
  });

  const handleAssign = async () => {
    if (!eqName.trim()) return;
    setSaving(true);
    try {
      // Find the most recent order to link equipment to
      const targetOrder = orders?.[0];
      if (!targetOrder) {
        toast.error("Aucune commande disponible pour lier l'équipement");
        setSaving(false);
        return;
      }
      const { error } = await supabase.from("equipment_order_lines").insert({
        order_id: targetOrder.id,
        equipment_name: eqName.trim(),
        serial_number: eqSerial || null,
        quantity: 1,
        unit_price: 0,
        line_total: 0,
      });
      if (error) throw error;

      await supabase.from("client_activity_logs").insert({
        client_id: clientId,
        actor_user_id: user?.id || "",
        actor_role: "admin",
        action_type: "equipment_assigned",
        summary: `Équipement "${eqName}" assigné (S/N: ${eqSerial || "N/A"})`,
      });

      toast.success("Équipement assigné");
      setAssignOpen(false);
      setEqName(""); setEqSerial(""); setEqMac("");
      queryClient.invalidateQueries({ queryKey: ["account-equipment"] });
      queryClient.invalidateQueries({ queryKey: ["account-equipment-lines"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (eq: any) => {
    if (!eq._isLine || !eq.id) {
      toast.info("Cet équipement est lié à la commande d'origine et ne peut pas être retiré ici.");
      return;
    }
    try {
      const { error } = await supabase.from("equipment_order_lines").delete().eq("id", eq.id);
      if (error) throw error;
      toast.success("Équipement retiré");
      queryClient.invalidateQueries({ queryKey: ["account-equipment-lines"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Équipements assignés ({allEquipment.length})</h3>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setAssignOpen(true)}>
          <PlusCircle className="h-3.5 w-3.5" />
          Assigner
        </Button>
      </div>

      {allEquipment.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucun équipement assigné</p>
      ) : (
        <div className="space-y-2">
          {allEquipment.map((eq: any, i: number) => {
            const Icon = equipmentIcons[eq.type] || HardDrive;
            return (
              <div key={eq.id || i} className="flex items-center justify-between p-3 rounded-md border">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{eq.name || eq.model || "Équipement"}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                      <DropdownMenuItem onClick={() => handleUnassign(eq)} className="text-destructive">
                        <Unlink className="h-3.5 w-3.5 mr-2" /> Retirer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Equipment Dialog */}
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
                  <SelectItem value="device">Appareil</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Numéro de série</Label>
              <Input value={eqSerial} onChange={e => setEqSerial(e.target.value)} placeholder="S/N..." />
            </div>
            <div>
              <Label>Adresse MAC (optionnel)</Label>
              <Input value={eqMac} onChange={e => setEqMac(e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Annuler</Button>
            <Button onClick={handleAssign} disabled={saving || !eqName.trim()}>
              {saving ? "Assignation..." : "Assigner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
