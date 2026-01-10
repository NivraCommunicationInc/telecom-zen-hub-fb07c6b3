/**
 * Mobile Fulfillment Section - Admin component for managing Mobile order volet
 * Port-in, Number assignment, SIM shipping
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
  Phone, Smartphone, Truck, CheckCircle, Clock, AlertCircle,
  Send, Package, RefreshCw, Loader2
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { createAuditNote } from "@/lib/clientAuditNotes";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface MobileFulfillmentSectionProps {
  orderId: string;
  userId: string;
  clientEmail?: string;
  clientName?: string;
  portRequest?: any;
  onUpdate?: () => void;
}

const portStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "En attente" },
  submitted: { color: "bg-blue-500/20 text-blue-500", label: "Soumis" },
  in_progress: { color: "bg-cyan-500/20 text-cyan-500", label: "En cours" },
  completed: { color: "bg-emerald-500/20 text-emerald-500", label: "Complété" },
  failed: { color: "bg-red-500/20 text-red-500", label: "Échoué" },
};

const simStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "Non expédiée" },
  shipped: { color: "bg-cyan-500/20 text-cyan-500", label: "Expédiée" },
  delivered: { color: "bg-emerald-500/20 text-emerald-500", label: "Livrée" },
};

export const MobileFulfillmentSection = ({
  orderId,
  userId,
  clientEmail,
  clientName,
  portRequest,
  onUpdate,
}: MobileFulfillmentSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Form states
  const [assignedNumber, setAssignedNumber] = useState("");
  const [portInNumber, setPortInNumber] = useState(portRequest?.phone_number || "");
  const [portInCarrier, setPortInCarrier] = useState(portRequest?.carrier || "");
  const [simIccid, setSimIccid] = useState("");
  const [simCarrier, setSimCarrier] = useState("Postes Canada");
  const [simTracking, setSimTracking] = useState("");

  // Fetch mobile fulfillment data
  const { data: fulfillment, refetch } = useQuery({
    queryKey: ["mobile-fulfillment", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mobile_fulfillment")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  // Initialize or update fulfillment record
  const upsertFulfillmentMutation = useMutation({
    mutationFn: async (updates: any) => {
      const existing = fulfillment?.id;
      
      if (existing) {
        const { error } = await supabase
          .from("mobile_fulfillment")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", existing);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("mobile_fulfillment")
          .insert({
            order_id: orderId,
            user_id: userId,
            ...updates,
          });
        if (error) throw error;
      }
      return updates;
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      onUpdate?.();
    },
  });

  // Assign number mutation
  const assignNumberMutation = useMutation({
    mutationFn: async (number: string) => {
      await upsertFulfillmentMutation.mutateAsync({
        assigned_number: number,
        number_assigned_at: new Date().toISOString(),
        number_assigned_by: user?.id,
      });

      // Create audit note
      await createAuditNote({
        clientId: userId,
        eventType: 'equipment_assigned',
        message: `Numéro mobile attribué: ${number}`,
        metadata: { order_id: orderId, assigned_number: number },
        actorId: user?.id,
        actorRole: 'admin',
      });

      // Send email notification
      if (clientEmail) {
        await supabase.functions.invoke("send-mobile-status-email", {
          body: {
            client_email: clientEmail,
            client_name: clientName,
            action: "number_assigned",
            phone_number: number,
            order_id: orderId,
          },
        });
      }

      return number;
    },
    onSuccess: (number) => {
      toast({ title: "Numéro attribué", description: number });
      setAssignedNumber("");
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Submit port-in request
  const submitPortInMutation = useMutation({
    mutationFn: async () => {
      await upsertFulfillmentMutation.mutateAsync({
        port_in_requested: true,
        port_in_number: portInNumber,
        port_in_carrier: portInCarrier,
        port_in_status: "submitted",
        port_in_submitted_at: new Date().toISOString(),
      });

      // Create audit note
      await createAuditNote({
        clientId: userId,
        eventType: 'status_changed',
        message: `Demande de portage soumise: ${portInNumber} depuis ${portInCarrier}`,
        metadata: { order_id: orderId, port_number: portInNumber, carrier: portInCarrier },
        actorId: user?.id,
        actorRole: 'admin',
      });

      // Send email
      if (clientEmail) {
        await supabase.functions.invoke("send-mobile-status-email", {
          body: {
            client_email: clientEmail,
            client_name: clientName,
            action: "port_in_submitted",
            phone_number: portInNumber,
            carrier: portInCarrier,
            order_id: orderId,
          },
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Portage soumis", description: `Demande pour ${portInNumber}` });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Ship SIM mutation
  const shipSimMutation = useMutation({
    mutationFn: async () => {
      await upsertFulfillmentMutation.mutateAsync({
        sim_iccid: simIccid,
        sim_carrier: simCarrier,
        sim_tracking_number: simTracking,
        sim_shipped_at: new Date().toISOString(),
      });

      // Create audit note
      await createAuditNote({
        clientId: userId,
        eventType: 'equipment_assigned',
        message: `SIM expédiée - ICCID: ${simIccid}, Suivi: ${simTracking}`,
        metadata: { order_id: orderId, sim_iccid: simIccid, tracking: simTracking, carrier: simCarrier },
        actorId: user?.id,
        actorRole: 'admin',
      });

      // Send email
      if (clientEmail) {
        await supabase.functions.invoke("send-mobile-status-email", {
          body: {
            client_email: clientEmail,
            client_name: clientName,
            action: "sim_shipped",
            tracking_number: simTracking,
            carrier: simCarrier,
            order_id: orderId,
          },
        });
      }
    },
    onSuccess: () => {
      toast({ title: "SIM expédiée", description: `Suivi: ${simTracking}` });
      setSimIccid("");
      setSimTracking("");
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const hasPortIn = portRequest?.port_in || fulfillment?.port_in_requested;

  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Smartphone className="w-5 h-5 text-blue-500" />
          Volet Mobile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Number Assignment */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Attribution du numéro
          </Label>
          
          {fulfillment?.assigned_number ? (
            <div className="p-3 bg-emerald-500/10 rounded-lg flex items-center justify-between">
              <div>
                <p className="font-medium text-emerald-600">{fulfillment.assigned_number}</p>
                <p className="text-xs text-muted-foreground">
                  Attribué le {format(new Date(fulfillment.number_assigned_at), "d MMM yyyy", { locale: fr })}
                </p>
              </div>
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="514-XXX-XXXX"
                value={assignedNumber}
                onChange={(e) => setAssignedNumber(e.target.value)}
              />
              <Button
                onClick={() => assignNumberMutation.mutate(assignedNumber)}
                disabled={!assignedNumber || assignNumberMutation.isPending}
              >
                {assignNumberMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Attribuer"}
              </Button>
            </div>
          )}
        </div>

        {/* Port-In Section */}
        {hasPortIn && (
          <div className="space-y-3 pt-4 border-t border-border">
            <Label className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Transfert de numéro (Port-In)
            </Label>
            
            {fulfillment?.port_in_status && fulfillment.port_in_status !== 'pending' ? (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{fulfillment.port_in_number}</span>
                  <Badge className={portStatusConfig[fulfillment.port_in_status]?.color}>
                    {portStatusConfig[fulfillment.port_in_status]?.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Fournisseur: {fulfillment.port_in_carrier}</p>
                
                {fulfillment.port_in_status === 'submitted' && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => upsertFulfillmentMutation.mutate({ port_in_status: 'in_progress' })}
                    >
                      Marquer en cours
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => upsertFulfillmentMutation.mutate({ 
                        port_in_status: 'completed',
                        port_in_completed_at: new Date().toISOString(),
                      })}
                    >
                      Marquer complété
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Numéro à porter</Label>
                    <Input
                      placeholder="514-XXX-XXXX"
                      value={portInNumber}
                      onChange={(e) => setPortInNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Fournisseur actuel</Label>
                    <Select value={portInCarrier} onValueChange={setPortInCarrier}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bell">Bell</SelectItem>
                        <SelectItem value="Rogers">Rogers</SelectItem>
                        <SelectItem value="Telus">Telus</SelectItem>
                        <SelectItem value="Vidéotron">Vidéotron</SelectItem>
                        <SelectItem value="Fizz">Fizz</SelectItem>
                        <SelectItem value="Koodo">Koodo</SelectItem>
                        <SelectItem value="Fido">Fido</SelectItem>
                        <SelectItem value="Virgin">Virgin</SelectItem>
                        <SelectItem value="Autre">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={() => submitPortInMutation.mutate()}
                  disabled={!portInNumber || !portInCarrier || submitPortInMutation.isPending}
                  className="w-full"
                >
                  {submitPortInMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Soumettre la demande de portage
                </Button>
              </div>
            )}
          </div>
        )}

        {/* SIM Shipping */}
        <div className="space-y-3 pt-4 border-t border-border">
          <Label className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Expédition SIM
          </Label>
          
          {fulfillment?.sim_shipped_at ? (
            <div className="p-3 bg-cyan-500/10 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Badge className="bg-cyan-500/20 text-cyan-500">Expédiée</Badge>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(fulfillment.sim_shipped_at), "d MMM yyyy", { locale: fr })}
                </p>
              </div>
              <p className="text-sm">ICCID: <span className="font-mono">{fulfillment.sim_iccid}</span></p>
              <p className="text-sm">Transporteur: {fulfillment.sim_carrier}</p>
              {fulfillment.sim_tracking_number && (
                <p className="text-sm">Suivi: <span className="font-mono">{fulfillment.sim_tracking_number}</span></p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">ICCID</Label>
                  <Input
                    placeholder="89302720..."
                    value={simIccid}
                    onChange={(e) => setSimIccid(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Transporteur</Label>
                  <Select value={simCarrier} onValueChange={setSimCarrier}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Postes Canada">Postes Canada</SelectItem>
                      <SelectItem value="Purolator">Purolator</SelectItem>
                      <SelectItem value="FedEx">FedEx</SelectItem>
                      <SelectItem value="UPS">UPS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Numéro de suivi</Label>
                <Input
                  placeholder="Numéro de suivi"
                  value={simTracking}
                  onChange={(e) => setSimTracking(e.target.value)}
                />
              </div>
              <Button
                onClick={() => shipSimMutation.mutate()}
                disabled={!simIccid || !simTracking || shipSimMutation.isPending}
                className="w-full"
              >
                {shipSimMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Truck className="w-4 h-4 mr-2" />
                )}
                Marquer comme expédiée
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MobileFulfillmentSection;
