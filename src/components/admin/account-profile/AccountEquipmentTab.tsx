/**
 * AccountEquipmentTab — Equipment assigned to the account
 */
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { Router, Tv, Smartphone, HardDrive, Loader2 } from "lucide-react";

interface AccountEquipmentTabProps {
  accountId: string;
  clientId: string;
}

const equipmentIcons: Record<string, any> = {
  router: Router,
  modem: Router,
  tv_box: Tv,
  sim: Smartphone,
  device: HardDrive,
};

export function AccountEquipmentTab({ accountId, clientId }: AccountEquipmentTabProps) {
  // Fetch equipment from orders (equipment_details, equipment_line_details)
  const { data: orders, isLoading } = useQuery({
    queryKey: ["account-equipment", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, equipment_details, equipment_line_details, equipment_id, service_type, status")
        .eq("account_id", accountId)
        .not("equipment_details", "is", null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  // Also fetch from equipment_order_lines if available
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

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  // Parse equipment from order details
  const allEquipment: any[] = [];
  orders?.forEach((order: any) => {
    if (order.equipment_line_details && Array.isArray(order.equipment_line_details)) {
      order.equipment_line_details.forEach((eq: any) => {
        allEquipment.push({ ...eq, order_number: order.order_number, service_type: order.service_type });
      });
    } else if (order.equipment_details && typeof order.equipment_details === "object") {
      allEquipment.push({
        ...order.equipment_details,
        order_number: order.order_number,
        service_type: order.service_type,
        equipment_id: order.equipment_id,
      });
    }
  });

  // Also add from equipment_order_lines
  equipmentLines?.forEach((line: any) => {
    const matchedOrder = orders?.find((o: any) => o.id === line.order_id);
    allEquipment.push({
      name: line.equipment_name || line.sku || "Équipement",
      serial_number: line.serial_number,
      quantity: line.quantity,
      order_number: matchedOrder?.order_number,
      service_type: matchedOrder?.service_type,
    });
  });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Équipements assignés ({allEquipment.length})</h3>
      {allEquipment.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucun équipement assigné</p>
      ) : (
        <div className="space-y-2">
          {allEquipment.map((eq: any, i: number) => {
            const Icon = equipmentIcons[eq.type] || HardDrive;
            return (
              <div key={i} className="flex items-center justify-between p-3 rounded-md border">
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
