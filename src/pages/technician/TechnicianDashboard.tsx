import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Wrench,
  Calendar,
  MapPin,
  Phone,
  Mail,
  LogOut,
  RefreshCw,
  Clock,
  CheckCircle,
  Package,
  Eye,
  XCircle,
  Truck,
  AlertTriangle,
  Wifi,
  Monitor,
  FileText,
  Play,
  History,
  User,
  Hash,
  ClipboardCheck,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isFuture, isPast, addHours, isAfter } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

// Work order status configuration
const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
  assigned: { color: "bg-blue-500/20 text-blue-500", label: "Assigné", icon: Clock },
  scheduled: { color: "bg-cyan-500/20 text-cyan-500", label: "Planifié", icon: Calendar },
  in_progress: { color: "bg-amber-500/20 text-amber-500", label: "En cours", icon: Play },
  completed: { color: "bg-emerald-500/20 text-emerald-500", label: "Terminé", icon: CheckCircle },
  cancelled: { color: "bg-red-500/20 text-red-500", label: "Annulé", icon: XCircle },
};

// Work order type configuration
const typeConfig: Record<string, { label: string; icon: any }> = {
  installation: { label: "Installation", icon: Wifi },
  service_call: { label: "Appel de service", icon: Wrench },
  replacement: { label: "Remplacement", icon: Package },
  maintenance: { label: "Maintenance", icon: Wrench },
};

// Default checklist items for installations
const defaultChecklist = [
  { id: "arrival", label: "Arrivée chez le client", completed: false },
  { id: "equipment_unpacked", label: "Équipement déballé et vérifié", completed: false },
  { id: "router_installed", label: "Routeur installé et configuré", completed: false },
  { id: "signal_test", label: "Test du signal effectué", completed: false },
  { id: "tv_channels_test", label: "Test des chaînes TV (si applicable)", completed: false },
  { id: "speed_test", label: "Test de vitesse Internet", completed: false },
  { id: "customer_trained", label: "Client formé sur l'utilisation", completed: false },
  { id: "customer_confirmed", label: "Client confirme satisfaction", completed: false },
];

const TechnicianDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [technicianSession, setTechnicianSession] = useState<any>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; data?: any } | null>(null);
  const [activeTab, setActiveTab] = useState("assignments");
  const [workNotes, setWorkNotes] = useState("");
  const [checklist, setChecklist] = useState<typeof defaultChecklist>([]);

  // Session validation
  useEffect(() => {
    const storedSession = localStorage.getItem("nivra_technician_session");
    if (!storedSession) {
      navigate("/technician/auth");
      return;
    }

    try {
      const session = JSON.parse(storedSession);
      const authenticatedAt = new Date(session.authenticated_at);
      const hoursElapsed = (Date.now() - authenticatedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursElapsed > 8) {
        localStorage.removeItem("nivra_technician_session");
        toast({ title: "Session expirée", description: "Veuillez vous reconnecter.", variant: "destructive" });
        navigate("/technician/auth");
        return;
      }

      setTechnicianSession(session);
    } catch {
      localStorage.removeItem("nivra_technician_session");
      navigate("/technician/auth");
    }
  }, [navigate, toast]);

  // Fetch work orders for this technician
  const { data: workOrders, isLoading, refetch } = useQuery({
    queryKey: ["technician-work-orders", technicianSession?.id],
    enabled: !!technicianSession?.id,
    refetchInterval: 30000, // Poll every 30 seconds
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("*")
        .eq("assigned_technician_id", technicianSession.id)
        .order("scheduled_start", { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch work order updates/history for selected work order
  const { data: workOrderUpdates } = useQuery({
    queryKey: ["work-order-updates", selectedWorkOrder?.id],
    enabled: !!selectedWorkOrder?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_order_updates")
        .select("*")
        .eq("work_order_id", selectedWorkOrder.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Realtime subscription for work orders
  useEffect(() => {
    if (!technicianSession?.id) return;

    const channel = supabase
      .channel(`technician-work-orders-${technicianSession.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "work_orders",
          filter: `assigned_technician_id=eq.${technicianSession.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["technician-work-orders"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [technicianSession?.id, queryClient]);

  // Update work order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ workOrderId, newStatus, note }: { workOrderId: string; newStatus: string; note?: string }) => {
      const now = new Date().toISOString();
      const workOrder = workOrders?.find((wo: any) => wo.id === workOrderId);
      
      const updateData: any = {
        status: newStatus,
        updated_at: now,
      };

      if (newStatus === "in_progress") {
        updateData.started_at = now;
      } else if (newStatus === "completed") {
        updateData.completed_at = now;
        updateData.checklist = checklist;
      }

      const { error } = await supabase
        .from("work_orders")
        .update(updateData)
        .eq("id", workOrderId);

      if (error) throw error;

      // Log the status change
      await supabase.from("work_order_updates").insert({
        work_order_id: workOrderId,
        actor_id: technicianSession?.user_id,
        actor_role: "technician",
        actor_name: technicianSession?.full_name,
        old_status: workOrder?.status,
        new_status: newStatus,
        action: "status_change",
        note: note || workNotes,
      });

      // Also update linked order if exists
      if (workOrder?.linked_order_id) {
        const orderStatus = newStatus === "completed" ? "completed_installation" : 
                          newStatus === "in_progress" ? "processing" : workOrder?.status;
        
        await supabase
          .from("orders")
          .update({ 
            status: orderStatus,
            updated_at: now,
          })
          .eq("id", workOrder.linked_order_id);
      }

      // Also update linked appointment if exists
      if (workOrder?.linked_appointment_id) {
        await supabase
          .from("appointments")
          .update({ 
            status: newStatus === "completed" ? "completed" : 
                   newStatus === "in_progress" ? "in_progress" : "technician_assigned",
            updated_at: now,
          })
          .eq("id", workOrder.linked_appointment_id);
      }
    },
    onSuccess: () => {
      toast({ title: "Statut mis à jour", description: "Le bon de travail a été modifié" });
      queryClient.invalidateQueries({ queryKey: ["technician-work-orders"] });
      setDetailsOpen(false);
      setConfirmAction(null);
      setWorkNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async ({ workOrderId, note }: { workOrderId: string; note: string }) => {
      await supabase.from("work_order_updates").insert({
        work_order_id: workOrderId,
        actor_id: technicianSession?.user_id,
        actor_role: "technician",
        actor_name: technicianSession?.full_name,
        action: "note_added",
        note,
      });

      await supabase
        .from("work_orders")
        .update({ 
          notes: note,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workOrderId);
    },
    onSuccess: () => {
      toast({ title: "Note ajoutée" });
      queryClient.invalidateQueries({ queryKey: ["technician-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["work-order-updates"] });
      setWorkNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleSignOut = () => {
    localStorage.removeItem("nivra_technician_session");
    navigate("/technician/auth");
  };

  // Filter work orders by view
  const activeWorkOrders = workOrders?.filter((wo: any) => 
    ["assigned", "scheduled", "in_progress"].includes(wo.status)
  ) || [];

  const historyWorkOrders = workOrders?.filter((wo: any) => 
    ["completed", "cancelled"].includes(wo.status)
  ) || [];

  const todayWorkOrders = activeWorkOrders.filter((wo: any) => 
    wo.scheduled_start && isToday(new Date(wo.scheduled_start))
  );

  const upcomingWorkOrders = activeWorkOrders.filter((wo: any) => 
    wo.scheduled_start && isFuture(new Date(wo.scheduled_start)) && !isToday(new Date(wo.scheduled_start))
  );

  const openWorkOrderDetails = (workOrder: any) => {
    setSelectedWorkOrder(workOrder);
    setChecklist(Array.isArray(workOrder.checklist) && workOrder.checklist.length > 0 
      ? workOrder.checklist 
      : defaultChecklist.map(item => ({ ...item })));
    setDetailsOpen(true);
  };

  const handleChecklistChange = (itemId: string, checked: boolean) => {
    setChecklist(prev => prev.map(item => 
      item.id === itemId ? { ...item, completed: checked } : item
    ));
  };

  const allChecklistCompleted = checklist.every(item => item.completed);

  const getStatusIcon = (status: string) => {
    const Icon = statusConfig[status]?.icon || Clock;
    return <Icon className="w-4 h-4" />;
  };

  const getTypeIcon = (type: string) => {
    const Icon = typeConfig[type]?.icon || Wrench;
    return <Icon className="w-4 h-4" />;
  };

  const WorkOrderCard = ({ workOrder, showDate = true }: { workOrder: any; showDate?: boolean }) => (
    <Card 
      className="cursor-pointer hover:border-cyan-500/50 transition-colors"
      onClick={() => openWorkOrderDetails(workOrder)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {getTypeIcon(workOrder.type)}
            <span className="text-sm font-medium">{workOrder.work_order_number}</span>
          </div>
          <Badge className={statusConfig[workOrder.status]?.color || "bg-gray-500/20"}>
            {getStatusIcon(workOrder.status)}
            <span className="ml-1">{statusConfig[workOrder.status]?.label || workOrder.status}</span>
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="w-4 h-4" />
            <span>{workOrder.client_name || "Client non spécifié"}</span>
          </div>

          {workOrder.service_address && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 mt-0.5" />
              <span className="text-xs">
                {workOrder.service_address}
                {workOrder.service_city && `, ${workOrder.service_city}`}
                {workOrder.service_postal_code && ` ${workOrder.service_postal_code}`}
              </span>
            </div>
          )}

          {showDate && workOrder.scheduled_start && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>
                {format(new Date(workOrder.scheduled_start), "d MMM yyyy 'à' HH:mm", { locale: fr })}
              </span>
            </div>
          )}

          {workOrder.service_type && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {workOrder.service_type}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (!technicianSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-navy-900" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg">Technicien – Nivra</h1>
                <p className="text-xs text-muted-foreground">
                  {technicianSession?.full_name || technicianSession?.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cyan-500">{activeWorkOrders.length}</div>
              <div className="text-xs text-muted-foreground">Assignés</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-500">{todayWorkOrders.length}</div>
              <div className="text-xs text-muted-foreground">Aujourd'hui</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-500">{upcomingWorkOrders.length}</div>
              <div className="text-xs text-muted-foreground">À venir</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-500">{historyWorkOrders.length}</div>
              <div className="text-xs text-muted-foreground">Terminés</div>
            </CardContent>
          </Card>
        </div>

        {/* Today's Work Orders - Highlighted */}
        {todayWorkOrders.length > 0 && (
          <Card className="border-cyan-500/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-cyan-500" />
                Aujourd'hui
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {todayWorkOrders.map((wo: any) => (
                  <WorkOrderCard key={wo.id} workOrder={wo} showDate={true} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="assignments" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Mes assignations ({activeWorkOrders.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Historique ({historyWorkOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assignments" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
              </div>
            ) : activeWorkOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Aucun bon de travail assigné</p>
                  <p className="text-sm text-muted-foreground mt-2">Appuyez sur Actualiser pour vérifier</p>
                  <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualiser
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {activeWorkOrders.map((wo: any) => (
                  <WorkOrderCard key={wo.id} workOrder={wo} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {historyWorkOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <History className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Aucun historique</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {historyWorkOrders.map((wo: any) => (
                  <WorkOrderCard key={wo.id} workOrder={wo} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Work Order Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedWorkOrder && getTypeIcon(selectedWorkOrder.type)}
              {selectedWorkOrder?.work_order_number}
            </DialogTitle>
            <DialogDescription>
              {selectedWorkOrder && typeConfig[selectedWorkOrder.type]?.label}
              {selectedWorkOrder?.service_type && ` - ${selectedWorkOrder.service_type}`}
            </DialogDescription>
          </DialogHeader>

          {selectedWorkOrder && (
            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">Détails</TabsTrigger>
                <TabsTrigger value="checklist">Checklist</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Statut</span>
                  <Badge className={statusConfig[selectedWorkOrder.status]?.color}>
                    {getStatusIcon(selectedWorkOrder.status)}
                    <span className="ml-1">{statusConfig[selectedWorkOrder.status]?.label}</span>
                  </Badge>
                </div>

                <Separator />

                {/* Client Info */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Client
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">{selectedWorkOrder.client_name || "Non spécifié"}</p>
                    {selectedWorkOrder.client_email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${selectedWorkOrder.client_email}`} className="hover:underline">
                          {selectedWorkOrder.client_email}
                        </a>
                      </div>
                    )}
                    {selectedWorkOrder.client_phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <a href={`tel:${selectedWorkOrder.client_phone}`} className="hover:underline">
                          {selectedWorkOrder.client_phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Address */}
                {selectedWorkOrder.service_address && (
                  <>
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Adresse de service
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedWorkOrder.service_address}
                        {selectedWorkOrder.service_city && <><br />{selectedWorkOrder.service_city}</>}
                        {selectedWorkOrder.service_province && `, ${selectedWorkOrder.service_province}`}
                        {selectedWorkOrder.service_postal_code && ` ${selectedWorkOrder.service_postal_code}`}
                      </p>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Schedule */}
                {selectedWorkOrder.scheduled_start && (
                  <>
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Rendez-vous
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(selectedWorkOrder.scheduled_start), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Equipment */}
                {Array.isArray(selectedWorkOrder.equipment_details) && selectedWorkOrder.equipment_details.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Équipement
                    </h4>
                    <div className="space-y-2">
                      {selectedWorkOrder.equipment_details.map((eq: any, idx: number) => (
                        <div key={idx} className="text-sm bg-muted/50 p-2 rounded">
                          <p className="font-medium">{eq.name || eq.type}</p>
                          {eq.serial && <p className="text-muted-foreground">S/N: {eq.serial}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="checklist" className="space-y-4 mt-4">
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4" />
                    Checklist d'installation
                  </h4>
                  <div className="space-y-2">
                    {checklist.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-2 rounded bg-muted/30">
                        <Checkbox
                          id={item.id}
                          checked={item.completed}
                          onCheckedChange={(checked) => handleChecklistChange(item.id, !!checked)}
                          disabled={selectedWorkOrder.status === "completed" || selectedWorkOrder.status === "cancelled"}
                        />
                        <Label 
                          htmlFor={item.id} 
                          className={`text-sm ${item.completed ? "line-through text-muted-foreground" : ""}`}
                        >
                          {item.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedWorkOrder.status !== "completed" && selectedWorkOrder.status !== "cancelled" && (
                    <p className="text-xs text-muted-foreground">
                      {checklist.filter(i => i.completed).length}/{checklist.length} étapes complétées
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="notes" className="space-y-4 mt-4">
                {/* Existing Notes */}
                {selectedWorkOrder.notes && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Notes actuelles</h4>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                      {selectedWorkOrder.notes}
                    </p>
                  </div>
                )}

                {/* Add Note */}
                {selectedWorkOrder.status !== "completed" && selectedWorkOrder.status !== "cancelled" && (
                  <div className="space-y-3">
                    <Label>Ajouter une note</Label>
                    <Textarea
                      placeholder="Notes sur le travail effectué..."
                      value={workNotes}
                      onChange={(e) => setWorkNotes(e.target.value)}
                      rows={3}
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => addNoteMutation.mutate({ 
                        workOrderId: selectedWorkOrder.id, 
                        note: workNotes 
                      })}
                      disabled={!workNotes.trim() || addNoteMutation.isPending}
                    >
                      Enregistrer la note
                    </Button>
                  </div>
                )}

                {/* History */}
                {workOrderUpdates && workOrderUpdates.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Historique
                    </h4>
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {workOrderUpdates.map((update: any) => (
                          <div key={update.id} className="text-sm border-l-2 border-cyan-500/50 pl-3 py-1">
                            <p className="font-medium">{update.action === "status_change" ? "Changement de statut" : "Note ajoutée"}</p>
                            {update.old_status && update.new_status && (
                              <p className="text-muted-foreground">
                                {statusConfig[update.old_status]?.label} → {statusConfig[update.new_status]?.label}
                              </p>
                            )}
                            {update.note && <p className="text-muted-foreground">{update.note}</p>}
                            <p className="text-xs text-muted-foreground mt-1">
                              {update.actor_name} • {format(new Date(update.created_at), "d MMM HH:mm", { locale: fr })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="actions" className="space-y-4 mt-4">
                {selectedWorkOrder.status === "assigned" || selectedWorkOrder.status === "scheduled" ? (
                  <Button 
                    className="w-full bg-amber-500 hover:bg-amber-600"
                    onClick={() => setConfirmAction({ type: "start" })}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Commencer le travail
                  </Button>
                ) : selectedWorkOrder.status === "in_progress" ? (
                  <div className="space-y-3">
                    <Button 
                      className="w-full bg-emerald-500 hover:bg-emerald-600"
                      onClick={() => setConfirmAction({ type: "complete" })}
                      disabled={!allChecklistCompleted}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Terminer le travail
                    </Button>
                    {!allChecklistCompleted && (
                      <p className="text-xs text-muted-foreground text-center">
                        Complétez toutes les étapes de la checklist pour terminer
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Badge className={statusConfig[selectedWorkOrder.status]?.color}>
                      {statusConfig[selectedWorkOrder.status]?.label}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-2">
                      Ce bon de travail est {selectedWorkOrder.status === "completed" ? "terminé" : "annulé"}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "start" && "Commencer le travail?"}
              {confirmAction?.type === "complete" && "Terminer le travail?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "start" && "Le statut passera à 'En cours' et l'heure de début sera enregistrée."}
              {confirmAction?.type === "complete" && "Le statut passera à 'Terminé' et l'heure de fin sera enregistrée."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction?.type === "start") {
                  updateStatusMutation.mutate({
                    workOrderId: selectedWorkOrder.id,
                    newStatus: "in_progress",
                  });
                } else if (confirmAction?.type === "complete") {
                  updateStatusMutation.mutate({
                    workOrderId: selectedWorkOrder.id,
                    newStatus: "completed",
                  });
                }
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TechnicianDashboard;
