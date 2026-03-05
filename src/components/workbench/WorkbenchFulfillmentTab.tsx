/**
 * WorkbenchFulfillmentTab - Shipments, inventory, appointments
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Package, Calendar, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  shipments: any[];
  inventoryAssignments: any[];
  appointments: any[];
}

const SHIPMENT_STATUS: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/20 text-amber-400", label: "En préparation" },
  label_created: { color: "bg-blue-500/20 text-blue-400", label: "Étiquette créée" },
  in_transit: { color: "bg-cyan-500/20 text-cyan-400", label: "En transit" },
  delivered: { color: "bg-emerald-500/20 text-emerald-400", label: "Livré" },
  returned: { color: "bg-red-500/20 text-red-400", label: "Retourné" },
};

export function WorkbenchFulfillmentTab({ shipments, inventoryAssignments, appointments }: Props) {
  return (
    <div className="space-y-6">
      {/* Shipments */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <Truck className="h-4 w-4 text-teal-400" /> Expéditions ({shipments.length})
        </h3>
        {shipments.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="py-4 text-center text-muted-foreground text-sm">Aucune expédition</CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {shipments.map((s: any) => {
              const cfg = SHIPMENT_STATUS[s.status] || SHIPMENT_STATUS.pending;
              return (
                <Card key={s.id} className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono text-sm text-white">{s.shipment_number}</p>
                        <p className="text-xs text-muted-foreground">{s.carrier || "—"}</p>
                      </div>
                      <Badge className={cfg.color}>{cfg.label}</Badge>
                    </div>
                    {s.tracking_number && (
                      <div className="mt-2 flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground">Tracking:</span>
                        {s.tracking_url ? (
                          <a href={s.tracking_url} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline flex items-center gap-1">
                            {s.tracking_number} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-white font-mono">{s.tracking_number}</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Inventory */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-teal-400" /> Équipement assigné ({inventoryAssignments.length})
        </h3>
        {inventoryAssignments.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="py-4 text-center text-muted-foreground text-sm">Aucun équipement assigné</CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {inventoryAssignments.map((a: any) => (
              <Card key={a.id} className="bg-slate-800/50 border-slate-700/50">
                <CardContent className="pt-4 pb-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm text-white">{a.inventory_stock?.device_type || "Appareil"}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {a.inventory_stock?.serial_number && `S/N: ${a.inventory_stock.serial_number}`}
                        {a.inventory_stock?.mac_address && ` | MAC: ${a.inventory_stock.mac_address}`}
                        {a.inventory_stock?.iccid && ` | ICCID: ${a.inventory_stock.iccid}`}
                      </p>
                    </div>
                    <Badge variant="outline">{a.status || "assigned"}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Appointments */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-teal-400" /> Rendez-vous ({appointments.length})
        </h3>
        {appointments.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="py-4 text-center text-muted-foreground text-sm">Aucun rendez-vous</CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {appointments.map((apt: any) => (
              <Card key={apt.id} className="bg-slate-800/50 border-slate-700/50">
                <CardContent className="pt-4 pb-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm text-white">{apt.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(apt.scheduled_at), "EEEE dd MMMM yyyy à HH:mm", { locale: fr })}
                      </p>
                      {apt.technicians && (
                        <p className="text-xs text-teal-400 mt-1">Tech: {apt.technicians.full_name}</p>
                      )}
                    </div>
                    <Badge variant="outline">{apt.status || "scheduled"}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
