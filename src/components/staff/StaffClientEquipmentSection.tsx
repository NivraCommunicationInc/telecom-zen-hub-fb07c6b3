/**
 * StaffClientEquipmentSection - Manage client equipment
 * Add, change, send equipment with full audit trail
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Router, Smartphone, Monitor, Box, Plus, Truck,
  Edit, Loader2, RefreshCw, Package, Send, History
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { createAuditNote } from "@/lib/clientAuditNotes";

interface StaffClientEquipmentSectionProps {
  clientId: string;
  staffUserId: string;
  staffUserName?: string;
}

const equipmentTypes = [
  { value: "router", label: "Borne WiFi / Router", icon: Router },
  { value: "terminal", label: "Terminal / Décodeur", icon: Monitor },
  { value: "sim", label: "Carte SIM", icon: Smartphone },
  { value: "modem", label: "Modem", icon: Box },
  { value: "other", label: "Autre", icon: Package },
];

const actionTypes = [
  { value: "assign", label: "Assigner au client" },
  { value: "ship", label: "Expédier au client" },
  { value: "replace", label: "Remplacer équipement existant" },
  { value: "return", label: "Retour client" },
];

export default function StaffClientEquipmentSection({
  clientId,
  staffUserId,
  staffUserName,
}: StaffClientEquipmentSectionProps) {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [equipmentType, setEquipmentType] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [model, setModel] = useState("");
  const [actionType, setActionType] = useState("");
  const [notes, setNotes] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  // Fetch equipment from service instances (equipment_details)
  const { data: equipment, isLoading, refetch } = useQuery({
    queryKey: ["staff-client-equipment", clientId],
    queryFn: async () => {
      // Get equipment from service_instances
      const { data: services, error } = await supabase
        .from("service_instances")
        .select("id, service_type, plan_name, equipment_details, created_at")
        .eq("user_id", clientId)
        .not("equipment_details", "is", null);

      if (error) throw error;

      // Also fetch from orders that have equipment_details
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, order_number, equipment_details, created_at")
        .eq("user_id", clientId)
        .not("equipment_details", "is", null);

      if (ordersError) console.warn("Orders equipment fetch:", ordersError);

      // Combine and normalize
      const equipmentList: any[] = [];

      // From services
      services?.forEach((svc) => {
        if (svc.equipment_details) {
          const details = svc.equipment_details as any;
          if (details.terminal_serial) {
            equipmentList.push({
              id: `${svc.id}-terminal`,
              type: "terminal",
              serial: details.terminal_serial,
              model: details.terminal_model || "Décodeur",
              source: "service",
              source_id: svc.id,
              created_at: svc.created_at,
            });
          }
          if (details.router_serial) {
            equipmentList.push({
              id: `${svc.id}-router`,
              type: "router",
              serial: details.router_serial,
              model: details.router_model || "Borne WiFi",
              source: "service",
              source_id: svc.id,
              created_at: svc.created_at,
            });
          }
        }
      });

      // From orders (equipment_details is JSONB)
      orders?.forEach((order) => {
        const eqDetails = order.equipment_details as any;
        if (!eqDetails) return;
        
        if (eqDetails.terminal_serial) {
          equipmentList.push({
            id: `${order.id}-terminal`,
            type: "terminal",
            serial: eqDetails.terminal_serial,
            model: eqDetails.terminal_model || "Décodeur",
            source: "order",
            source_ref: order.order_number,
            created_at: order.created_at,
          });
        }
        if (eqDetails.router_serial) {
          equipmentList.push({
            id: `${order.id}-router`,
            type: "router",
            serial: eqDetails.router_serial,
            model: eqDetails.router_model || "Borne WiFi",
            source: "order",
            source_ref: order.order_number,
            created_at: order.created_at,
          });
        }
      });

      // Deduplicate by serial
      const seen = new Set();
      return equipmentList.filter((eq) => {
        if (seen.has(eq.serial)) return false;
        seen.add(eq.serial);
        return true;
      });
    },
    enabled: !!clientId,
  });

  // Add equipment mutation
  const addEquipmentMutation = useMutation({
    mutationFn: async () => {
      // For now, we log equipment actions as audit notes
      // In a full implementation, this would insert into an equipment table
      const actionLabels: Record<string, string> = {
        assign: "Équipement assigné",
        ship: "Équipement expédié",
        replace: "Équipement remplacé",
        return: "Retour équipement",
      };

      const typeLabel = equipmentTypes.find((t) => t.value === equipmentType)?.label || equipmentType;

      let message = `${actionLabels[actionType] || "Action équipement"}: ${typeLabel} (S/N: ${serialNumber})`;
      if (model) message += ` - Modèle: ${model}`;
      if (trackingNumber) message += ` - Suivi: ${trackingNumber}`;
      if (notes) message += ` - Notes: ${notes}`;

      await createAuditNote({
        clientId,
        eventType: "equipment_assigned",
        message,
        metadata: {
          equipment_type: equipmentType,
          serial_number: serialNumber,
          model,
          action: actionType,
          tracking_number: trackingNumber,
          notes,
        },
        actorId: staffUserId,
        actorRole: "employee",
        actorName: staffUserName,
      });

      return { success: true };
    },
    onSuccess: () => {
      toast.success("Équipement enregistré");
      queryClient.invalidateQueries({ queryKey: ["staff-client-equipment", clientId] });
      queryClient.invalidateQueries({ queryKey: ["staff-client-internal-notes", clientId] });
      closeDialog();
    },
    onError: (error: any) => {
      toast.error("Erreur: " + (error.message || "Impossible d'enregistrer"));
    },
  });

  const closeDialog = () => {
    setShowAddDialog(false);
    setEquipmentType("");
    setSerialNumber("");
    setModel("");
    setActionType("");
    setNotes("");
    setTrackingNumber("");
  };

  const handleSubmit = () => {
    if (!equipmentType || !serialNumber || !actionType) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }
    addEquipmentMutation.mutate();
  };

  const getEquipmentIcon = (type: string) => {
    const found = equipmentTypes.find((t) => t.value === type);
    return found?.icon || Package;
  };

  return (
    <>
      <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Box className="h-5 w-5 text-teal-400" />
              Équipements ({equipment?.length || 0})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                className="text-slate-400 hover:text-white"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddDialog(true)}
                className="border-teal-500/50 text-teal-400 hover:bg-teal-500/10"
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
            </div>
          ) : !equipment?.length ? (
            <div className="text-center py-8">
              <Box className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Aucun équipement enregistré</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 border-teal-500/50 text-teal-400"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter un équipement
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-3">
                {equipment.map((item: any) => {
                  const IconComponent = getEquipmentIcon(item.type);
                  const typeLabel = equipmentTypes.find((t) => t.value === item.type)?.label || item.type;

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg border border-slate-700/50 bg-slate-800/30 flex items-center gap-3"
                    >
                      <div className="p-2 rounded-lg bg-slate-700/50">
                        <IconComponent className="h-5 w-5 text-teal-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{typeLabel}</p>
                        <p className="text-sm text-slate-400 font-mono">{item.serial}</p>
                        {item.model && (
                          <p className="text-xs text-slate-500">{item.model}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs text-slate-400">
                          {item.source === "order" ? item.source_ref : "Service"}
                        </Badge>
                        {item.created_at && (
                          <p className="text-xs text-slate-500 mt-1">
                            {format(new Date(item.created_at), "d MMM yyyy", { locale: fr })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Add Equipment Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Package className="h-5 w-5 text-teal-400" />
              Ajouter / Gérer Équipement
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Enregistrez une action sur un équipement client
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Action Type */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Action *</label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white">
                  <SelectValue placeholder="Sélectionner l'action" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {actionTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Equipment Type */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Type d'équipement *</label>
              <Select value={equipmentType} onValueChange={setEquipmentType}>
                <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white">
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {equipmentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Serial Number */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Numéro de série *</label>
              <Input
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Ex: SN-12345678"
                className="bg-slate-800/50 border-slate-600 text-white"
              />
            </div>

            {/* Model */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Modèle</label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ex: Router Pro X1"
                className="bg-slate-800/50 border-slate-600 text-white"
              />
            </div>

            {/* Tracking Number (for shipping) */}
            {actionType === "ship" && (
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Numéro de suivi</label>
                <Input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Numéro de suivi de livraison"
                  className="bg-slate-800/50 border-slate-600 text-white"
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes additionnelles..."
                className="bg-slate-800/50 border-slate-600 text-white resize-none"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} className="text-slate-400">
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!equipmentType || !serialNumber || !actionType || addEquipmentMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {addEquipmentMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
