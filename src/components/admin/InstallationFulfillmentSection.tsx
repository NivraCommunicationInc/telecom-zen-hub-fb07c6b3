/**
 * Installation Fulfillment Section - Admin component for Internet/TV installation
 * Technician assignment, scheduling, and installation status tracking
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Wrench, User, Calendar, Truck, CheckCircle, Clock, 
  AlertCircle, Loader2, MapPin, Router, Tv, Save
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { createAuditNote } from "@/lib/clientAuditNotes";
import { buildInstallationEmailPayload, logEmailPayload } from "@/lib/serviceEmailPayloadBuilder";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface InstallationFulfillmentSectionProps {
  orderId: string;
  orderNumber: string;
  userId: string;
  clientEmail?: string;
  clientName?: string;
  clientFirstName?: string;
  locale?: 'fr' | 'en';
  portalBaseUrl?: string;
  serviceAddress?: string;
  currentStatus?: string;
  appointmentDate?: string;
  currentTechnicianId?: string;
  equipmentDetails?: any;
  onUpdate?: () => void;
}

const installationStatusConfig: Record<string, { color: string; label: string; icon: any }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "En attente", icon: Clock },
  installation_scheduled: { color: "bg-blue-500/20 text-blue-500", label: "Planifiée", icon: Calendar },
  technician_en_route: { color: "bg-cyan-500/20 text-cyan-500", label: "Technicien en route", icon: Truck },
  installation_in_progress: { color: "bg-amber-500/20 text-amber-500", label: "En cours", icon: Wrench },
  installation_completed: { color: "bg-emerald-500/20 text-emerald-500", label: "Terminée", icon: CheckCircle },
  completed: { color: "bg-emerald-500/20 text-emerald-500", label: "Complétée", icon: CheckCircle },
  failed: { color: "bg-red-500/20 text-red-500", label: "Échouée", icon: AlertCircle },
};

export const InstallationFulfillmentSection = ({
  orderId,
  orderNumber,
  userId,
  clientEmail,
  clientName,
  clientFirstName,
  locale = 'fr',
  portalBaseUrl = '/portal',
  serviceAddress,
  currentStatus = "pending",
  appointmentDate,
  currentTechnicianId,
  equipmentDetails,
  onUpdate,
}: InstallationFulfillmentSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [selectedTechnicianId, setSelectedTechnicianId] = useState(currentTechnicianId || "");
  const [scheduledDate, setScheduledDate] = useState(appointmentDate?.split('T')[0] || "");
  const [scheduledTime, setScheduledTime] = useState(appointmentDate?.split('T')[1]?.slice(0, 5) || "09:00");
  const [installationNotes, setInstallationNotes] = useState("");
  
  // Equipment state
  const [routerSerial, setRouterSerial] = useState(equipmentDetails?.router_serial_number || "");
  const [terminalSerials, setTerminalSerials] = useState<string[]>(equipmentDetails?.terminal_serial_numbers || [""]);
  const [equipmentSaved, setEquipmentSaved] = useState(!!(equipmentDetails?.router_serial_number || equipmentDetails?.terminal_serial_numbers?.length));

  // Fetch technicians
  const { data: technicians } = useQuery({
    queryKey: ["admin-technicians"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("*")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Assign technician and schedule installation
  const assignTechnicianMutation = useMutation({
    mutationFn: async () => {
      const technician = technicians?.find(t => t.id === selectedTechnicianId);
      const scheduledAt = scheduledDate && scheduledTime 
        ? `${scheduledDate}T${scheduledTime}:00`
        : null;
      
      // Update order
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          technician_id: selectedTechnicianId,
          appointment_date: scheduledAt,
          status: "installation_scheduled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      
      if (orderError) throw orderError;

      // Create audit note
      await createAuditNote({
        clientId: userId,
        eventType: 'technician_assigned',
        message: `Technicien ${technician?.full_name} assigné pour installation${scheduledAt ? ` le ${format(new Date(scheduledAt), "d MMMM yyyy à HH:mm", { locale: fr })}` : ''}`,
        metadata: { 
          order_id: orderId,
          order_number: orderNumber,
          technician_id: selectedTechnicianId,
          technician_name: technician?.full_name,
          scheduled_at: scheduledAt,
        },
        actorId: user?.id,
        actorRole: 'admin',
      });

      // Send email notification
      if (clientEmail) {
        const payload = buildInstallationEmailPayload(
          { id: orderId, order_number: orderNumber, user_id: userId },
          { id: userId, email: clientEmail, full_name: clientName, first_name: clientFirstName },
          'installation_scheduled',
          {
            technician_name: technician?.full_name,
            scheduled_date_time: scheduledAt 
              ? format(new Date(scheduledAt), "d MMMM yyyy à HH:mm", { locale: fr })
              : undefined,
            service_address: serviceAddress,
            old_status: currentStatus,
          }
        );

        logEmailPayload(payload, 'send-installation-status-email');

        const { error: emailError } = await supabase.functions.invoke("send-installation-status-email", {
          body: {
            order_id: payload.order_id,
            client_id: payload.client_id,
            client_email: payload.client_email,
            client_first_name: payload.client_first_name,
            order_number: payload.order_number,
            new_status: payload.status,
            old_status: payload.old_status,
            technician_name: payload.technician_name,
            scheduled_date_time: payload.scheduled_date_time,
            service_address: payload.service_address,
          },
        });

        if (emailError) {
          console.error("Email send failed:", emailError);
          // Create failure note but don't block
          await createAuditNote({
            clientId: userId,
            eventType: 'status_changed',
            message: `[EMAIL_FAILED] Échec de l'envoi de l'email d'installation planifiée`,
            metadata: { order_id: orderId, error: emailError.message },
            actorId: 'system',
            actorRole: 'system',
          });
        }
      }

      return { technicianName: technician?.full_name };
    },
    onSuccess: (data) => {
      toast({ title: "Technicien assigné", description: data.technicianName });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      onUpdate?.();
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Update installation status
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const technician = technicians?.find(t => t.id === (currentTechnicianId || selectedTechnicianId));
      
      // Update order status
      const { error } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;

      // Create audit note
      await createAuditNote({
        clientId: userId,
        eventType: 'status_changed',
        message: `Statut installation changé: ${installationStatusConfig[currentStatus]?.label || currentStatus} → ${installationStatusConfig[newStatus]?.label || newStatus}`,
        metadata: { 
          order_id: orderId,
          order_number: orderNumber,
          old_status: currentStatus,
          new_status: newStatus,
        },
        actorId: user?.id,
        actorRole: 'admin',
      });

      // Send email for major status changes
      if (clientEmail && ['technician_en_route', 'installation_in_progress', 'installation_completed'].includes(newStatus)) {
        const payload = buildInstallationEmailPayload(
          { id: orderId, order_number: orderNumber, user_id: userId },
          { id: userId, email: clientEmail, full_name: clientName, first_name: clientFirstName },
          newStatus as any,
          {
            technician_name: technician?.full_name,
            service_address: serviceAddress,
            old_status: currentStatus,
          }
        );

        logEmailPayload(payload, 'send-installation-status-email');

        await supabase.functions.invoke("send-installation-status-email", {
          body: {
            order_id: payload.order_id,
            client_id: payload.client_id,
            client_email: payload.client_email,
            client_first_name: payload.client_first_name,
            order_number: payload.order_number,
            new_status: payload.status,
            old_status: payload.old_status,
            technician_name: payload.technician_name,
            service_address: payload.service_address,
          },
        });
      }

      return { newStatus };
    },
    onSuccess: (data) => {
      toast({ 
        title: "Statut mis à jour", 
        description: installationStatusConfig[data.newStatus]?.label || data.newStatus 
      });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      onUpdate?.();
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Equipment assignment mutation
  const saveEquipmentMutation = useMutation({
    mutationFn: async () => {
      if (!routerSerial.trim() && terminalSerials.every(s => !s.trim())) {
        throw new Error("Veuillez entrer au moins un numéro de série (routeur ou terminal)");
      }

      // Fetch current equipment_details
      const { data: orderData } = await supabase
        .from("orders")
        .select("equipment_details")
        .eq("id", orderId)
        .single();

      const currentEquipment = orderData?.equipment_details || {};
      
      const updatedEquipment = {
        ...currentEquipment,
        router_serial_number: routerSerial.trim() || currentEquipment.router_serial_number,
        terminal_serial_numbers: terminalSerials.filter(s => s.trim()),
        equipment_assigned_at: new Date().toISOString(),
        equipment_assigned_by: user?.id,
      };

      // Update order with equipment details
      const { error } = await supabase
        .from("orders")
        .update({
          equipment_details: updatedEquipment,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;

      // Create audit note [EQUIPMENT_ASSIGNED]
      const assignedItems = [];
      if (routerSerial.trim()) assignedItems.push(`Routeur: ${routerSerial}`);
      terminalSerials.filter(s => s.trim()).forEach((s, i) => {
        assignedItems.push(`Terminal ${i + 1}: ${s}`);
      });

      await createAuditNote({
        clientId: userId,
        eventType: 'equipment_assigned',
        message: `[EQUIPMENT_ASSIGNED] Équipement assigné: ${assignedItems.join(', ')}`,
        metadata: {
          order_id: orderId,
          order_number: orderNumber,
          router_serial: routerSerial.trim() || null,
          terminal_serials: terminalSerials.filter(s => s.trim()),
        },
        actorId: user?.id,
        actorRole: 'admin',
      });

      return updatedEquipment;
    },
    onSuccess: () => {
      toast({ title: "Équipement sauvegardé", description: "Les numéros de série ont été enregistrés" });
      setEquipmentSaved(true);
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      onUpdate?.();
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const currentTechnician = technicians?.find(t => t.id === currentTechnicianId);
  const statusInfo = installationStatusConfig[currentStatus] || installationStatusConfig.pending;
  const StatusIcon = statusInfo.icon;

  return (
    <Card className="border-orange-500/30 bg-orange-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wrench className="w-5 h-5 text-orange-500" />
          Installation Internet/TV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <StatusIcon className="w-5 h-5" />
            <span className="font-medium">Statut actuel:</span>
          </div>
          <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
        </div>

        {/* Service Address */}
        {serviceAddress && (
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Adresse d'installation</p>
              <p className="text-sm text-muted-foreground">{serviceAddress}</p>
            </div>
          </div>
        )}

        {/* Technician Assignment */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Technicien
          </Label>
          
          {currentTechnician ? (
            <div className="p-3 bg-emerald-500/10 rounded-lg flex items-center justify-between">
              <div>
                <p className="font-medium text-emerald-600">{currentTechnician.full_name}</p>
                <p className="text-xs text-muted-foreground">{currentTechnician.phone}</p>
              </div>
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
          ) : (
            <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un technicien" />
              </SelectTrigger>
              <SelectContent>
                {technicians?.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.full_name} - {tech.region || "Toutes régions"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Scheduling */}
        {!currentTechnicianId && (
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Planifier l'installation
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <Label className="text-xs">Heure</Label>
                <Select value={scheduledTime} onValueChange={setScheduledTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'].map((time) => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={() => assignTechnicianMutation.mutate()}
              disabled={!selectedTechnicianId || !scheduledDate || assignTechnicianMutation.isPending}
              className="w-full"
            >
              {assignTechnicianMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <User className="w-4 h-4 mr-2" />
              )}
              Assigner et planifier
            </Button>
          </div>
        )}

        {/* Scheduled Info */}
        {appointmentDate && (
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-600">Installation planifiée</span>
            </div>
            <p className="text-sm">
              {format(new Date(appointmentDate), "EEEE d MMMM yyyy à HH:mm", { locale: fr })}
            </p>
          </div>
        )}

        {/* Status Actions */}
        {currentTechnicianId && currentStatus !== 'installation_completed' && currentStatus !== 'completed' && (
          <div className="space-y-3 pt-4 border-t border-border">
            <Label>Mettre à jour le statut</Label>
            <div className="grid grid-cols-2 gap-2">
              {currentStatus === 'installation_scheduled' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateStatusMutation.mutate('technician_en_route')}
                  disabled={updateStatusMutation.isPending}
                >
                  <Truck className="w-4 h-4 mr-1" />
                  En route
                </Button>
              )}
              {(currentStatus === 'installation_scheduled' || currentStatus === 'technician_en_route') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateStatusMutation.mutate('installation_in_progress')}
                  disabled={updateStatusMutation.isPending}
                >
                  <Wrench className="w-4 h-4 mr-1" />
                  En cours
                </Button>
              )}
              {(currentStatus === 'technician_en_route' || currentStatus === 'installation_in_progress') && (
                <Button
                  size="sm"
                  onClick={() => updateStatusMutation.mutate('installation_completed')}
                  disabled={updateStatusMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Terminée
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Equipment Assignment Section */}
        <div className="space-y-3 pt-4 border-t border-border">
          <Label className="flex items-center gap-2">
            <Router className="w-4 h-4" />
            Attribution équipement
          </Label>
          
          {equipmentSaved ? (
            <div className="p-3 bg-emerald-500/10 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-600">Équipement assigné</span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                {routerSerial && <p>Routeur WiFi: <span className="font-mono">{routerSerial}</span></p>}
                {terminalSerials.filter(s => s.trim()).map((s, i) => (
                  <p key={i}>Terminal {i + 1}: <span className="font-mono">{s}</span></p>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setEquipmentSaved(false)}
              >
                Modifier
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Numéro de série Routeur WiFi</Label>
                <Input
                  placeholder="Ex: NVR-2024-XXXXX"
                  value={routerSerial}
                  onChange={(e) => setRouterSerial(e.target.value)}
                />
              </div>
              
              <div>
                <Label className="text-xs flex items-center gap-2">
                  <Tv className="w-3 h-3" />
                  Numéros de série Terminal(s)
                </Label>
                {terminalSerials.map((serial, idx) => (
                  <div key={idx} className="flex gap-2 mt-1">
                    <Input
                      placeholder={`Terminal ${idx + 1}`}
                      value={serial}
                      onChange={(e) => {
                        const updated = [...terminalSerials];
                        updated[idx] = e.target.value;
                        setTerminalSerials(updated);
                      }}
                    />
                    {idx === terminalSerials.length - 1 && terminalSerials.length < 4 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTerminalSerials([...terminalSerials, ""])}
                      >
                        +
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              
              <Button
                onClick={() => saveEquipmentMutation.mutate()}
                disabled={saveEquipmentMutation.isPending || (!routerSerial.trim() && terminalSerials.every(s => !s.trim()))}
                className="w-full"
              >
                {saveEquipmentMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Sauvegarder équipement
              </Button>
            </div>
          )}
        </div>

        {/* Completed Status */}
        {(currentStatus === 'installation_completed' || currentStatus === 'completed') && (
          <div className="p-4 bg-emerald-500/10 rounded-lg text-center">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="font-medium text-emerald-600">Installation terminée</p>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notes d'installation</Label>
          <Textarea
            placeholder="Notes pour le technicien..."
            value={installationNotes}
            onChange={(e) => setInstallationNotes(e.target.value)}
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default InstallationFulfillmentSection;
