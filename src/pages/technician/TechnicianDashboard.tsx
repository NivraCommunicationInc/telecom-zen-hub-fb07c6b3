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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Edit,
  Shield,
  User,
  History,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isAfter, addHours, isBefore, isPast, isToday, isFuture } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { AppointmentHistoryTimeline } from "@/components/appointments/AppointmentHistoryTimeline";

const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "En attente", icon: Clock },
  hold: { color: "bg-purple-500/20 text-purple-500", label: "Suspendu", icon: AlertTriangle },
  verification: { color: "bg-blue-500/20 text-blue-500", label: "Vérification", icon: Shield },
  back_order: { color: "bg-orange-500/20 text-orange-500", label: "Back Order", icon: Package },
  shipped: { color: "bg-cyan-500/20 text-cyan-400", label: "Expédié", icon: Truck },
  completed: { color: "bg-emerald-500/20 text-emerald-500", label: "Terminé", icon: CheckCircle },
  completed_installation: { color: "bg-green-500/20 text-green-400", label: "Installation terminée", icon: CheckCircle },
  cancelled: { color: "bg-red-500/20 text-red-500", label: "Annulé", icon: XCircle },
};

const statusOptions = [
  { value: "pending", label: "En attente" },
  { value: "hold", label: "Suspendu" },
  { value: "shipped", label: "Expédié" },
  { value: "completed", label: "Terminé" },
  { value: "completed_installation", label: "Installation terminée" },
  { value: "cancelled", label: "Annulé" },
];

const TechnicianDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [technicianSession, setTechnicianSession] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; data?: any } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("upcoming");

  // Form states
  const [updateReason, setUpdateReason] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");

  useEffect(() => {
    // Check for technician session in localStorage
    const storedSession = localStorage.getItem("nivra_technician_session");
    if (!storedSession) {
      navigate("/technician/auth");
      return;
    }

    try {
      const session = JSON.parse(storedSession);
      // Check if session is still valid (e.g., within 8 hours)
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

  const { data: assignments, isLoading, refetch } = useQuery({
    queryKey: ["technician-assignments", technicianSession?.id],
    enabled: !!technicianSession?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("technician_id", technicianSession.id)
        .order("appointment_date", { ascending: true });
      if (error) throw error;

      // Get client profiles
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((o: any) => o.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, phone, service_address, service_city, service_province, service_postal_code")
          .in("user_id", userIds);

        return data.map((order: any) => ({
          ...order,
          profile: profiles?.find((p: any) => p.user_id === order.user_id),
        }));
      }
      return data || [];
    },
  });

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status, reason }: { orderId: string; status: string; reason: string }) => {
      const now = new Date().toISOString();
      
      // Get current order for audit
      const { data: currentOrder } = await supabase
        .from("orders")
        .select("audit_timeline, status")
        .eq("id", orderId)
        .single();

      const auditTimeline = Array.isArray(currentOrder?.audit_timeline) 
        ? currentOrder.audit_timeline 
        : [];

      auditTimeline.push({
        action: "status_updated",
        from: currentOrder?.status,
        to: status,
        reason: reason,
        by: `Technicien: ${technicianSession?.full_name}`,
        at: now,
      });

      const { error } = await supabase
        .from("orders")
        .update({
          status,
          updated_at: now,
          audit_timeline: auditTimeline,
        })
        .eq("id", orderId);

      if (error) throw error;

      // Log activity (admin-visible) - use service role or skip if no user_id
      if (technicianSession?.user_id) {
        await supabase.from("activity_logs").insert({
          user_id: technicianSession.user_id,
          action: "order_status_update",
          entity_type: "order",
          entity_id: orderId,
          old_value: currentOrder?.status,
          new_value: status,
          reason: reason,
          actor_name: technicianSession?.full_name,
          actor_role: "technician",
          details: { by_technician: true, technician_id: technicianSession?.id },
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Statut mis à jour", description: "Le statut de la commande a été modifié" });
      queryClient.invalidateQueries({ queryKey: ["technician-assignments"] });
      setDetailsOpen(false);
      setConfirmAction(null);
      setUpdateReason("");
      setNewStatus("");
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Reschedule appointment mutation (only if 24h+ before)
  const rescheduleMutation = useMutation({
    mutationFn: async ({ orderId, newDate, reason }: { orderId: string; newDate: string; reason: string }) => {
      const now = new Date().toISOString();
      
      const { data: currentOrder } = await supabase
        .from("orders")
        .select("audit_timeline, appointment_date")
        .eq("id", orderId)
        .single();

      const auditTimeline = Array.isArray(currentOrder?.audit_timeline) 
        ? currentOrder.audit_timeline 
        : [];

      auditTimeline.push({
        action: "appointment_rescheduled",
        from: currentOrder?.appointment_date,
        to: newDate,
        reason: reason,
        by: `Technicien: ${technicianSession?.full_name}`,
        at: now,
      });

      const { error } = await supabase
        .from("orders")
        .update({
          appointment_date: newDate,
          updated_at: now,
          audit_timeline: auditTimeline,
          appointment_notes: `Reporté par technicien: ${reason}`,
        })
        .eq("id", orderId);

      if (error) throw error;

      // Log activity
      if (technicianSession?.user_id) {
        await supabase.from("activity_logs").insert({
          user_id: technicianSession.user_id,
          action: "appointment_rescheduled",
          entity_type: "order",
          entity_id: orderId,
          old_value: currentOrder?.appointment_date,
          new_value: newDate,
          reason: reason,
          actor_name: technicianSession?.full_name,
          actor_role: "technician",
          details: { by_technician: true, technician_id: technicianSession?.id },
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Rendez-vous reporté", description: "Le rendez-vous a été modifié" });
      queryClient.invalidateQueries({ queryKey: ["technician-assignments"] });
      setConfirmAction(null);
      setRescheduleDate("");
      setRescheduleReason("");
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Cancel appointment mutation (only if 24h+ before)
  const cancelAppointmentMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const now = new Date().toISOString();
      
      const { data: currentOrder } = await supabase
        .from("orders")
        .select("audit_timeline, appointment_date")
        .eq("id", orderId)
        .single();

      const auditTimeline = Array.isArray(currentOrder?.audit_timeline) 
        ? currentOrder.audit_timeline 
        : [];

      auditTimeline.push({
        action: "appointment_cancelled",
        previous_date: currentOrder?.appointment_date,
        reason: reason,
        by: `Technicien: ${technicianSession?.full_name}`,
        at: now,
      });

      const { error } = await supabase
        .from("orders")
        .update({
          appointment_date: null,
          technician_id: null,
          updated_at: now,
          audit_timeline: auditTimeline,
          appointment_notes: `Annulé par technicien: ${reason}`,
        })
        .eq("id", orderId);

      if (error) throw error;

      // Log activity
      if (technicianSession?.user_id) {
        await supabase.from("activity_logs").insert({
          user_id: technicianSession.user_id,
          action: "appointment_cancelled",
          entity_type: "order",
          entity_id: orderId,
          old_value: currentOrder?.appointment_date,
          new_value: null,
          reason: reason,
          actor_name: technicianSession?.full_name,
          actor_role: "technician",
          details: { by_technician: true, technician_id: technicianSession?.id },
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Rendez-vous annulé", description: "L'affectation a été retirée" });
      queryClient.invalidateQueries({ queryKey: ["technician-assignments"] });
      setDetailsOpen(false);
      setConfirmAction(null);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleSignOut = () => {
    localStorage.removeItem("nivra_technician_session");
    navigate("/technician/auth");
  };

  // Check if appointment can be modified (24h+ before)
  const canModifyAppointment = (appointmentDate: string | null) => {
    if (!appointmentDate) return false;
    const appointmentTime = new Date(appointmentDate);
    const cutoffTime = addHours(new Date(), 24);
    return isAfter(appointmentTime, cutoffTime);
  };

  // Filter assignments
  const filteredAssignments = assignments?.filter((a: any) => {
    if (statusFilter === "all") return true;
    return a.status === statusFilter;
  });

  // Filter upcoming appointments (future)
  const upcomingAssignments = assignments?.filter((a: any) => {
    if (!a.appointment_date) return false;
    return isFuture(new Date(a.appointment_date)) || isToday(new Date(a.appointment_date));
  });

  // Filter past appointments
  const pastAssignments = assignments?.filter((a: any) => {
    if (!a.appointment_date) return false;
    return isPast(new Date(a.appointment_date)) && !isToday(new Date(a.appointment_date));
  });

  const todayAppointments = assignments?.filter((a: any) => {
    if (!a.appointment_date) return false;
    const appointmentTime = new Date(a.appointment_date);
    const now = new Date();
    const tomorrow = addHours(now, 24);
    return isAfter(appointmentTime, now) && !isAfter(appointmentTime, tomorrow);
  });

  // Parse equipment details
  const parseEquipment = (order: any) => {
    const equipment: any[] = [];
    const details = Array.isArray(order?.equipment_details) ? order.equipment_details : [];
    
    // Check for router
    if (order?.installation_type === "technician" || details.some((e: any) => e.type === "router")) {
      equipment.push({
        type: "router",
        name: "Nivra Born Wifi Router",
        serial: details.find((e: any) => e.type === "router")?.serial || order?.serial_number || "Non assigné",
        warranty: "24 mois",
      });
    }
    
    // Check for terminals
    const terminalCount = order?.terminal_count || 0;
    for (let i = 0; i < terminalCount; i++) {
      const terminalDetail = details.find((e: any) => e.type === "terminal" && e.index === i);
      equipment.push({
        type: "terminal",
        name: `Nivra 4K Smart Terminal #${i + 1}`,
        serial: terminalDetail?.serial || "Non assigné",
        imei: terminalDetail?.imei || "N/A",
        warranty: "12 mois",
      });
    }

    // Check for SIM
    if (order?.sim_number) {
      equipment.push({
        type: "sim",
        name: "SIM / eSIM",
        serial: order.sim_number,
        imei: order.imei_number || "N/A",
      });
    }

    return equipment;
  };

  const openOrderDetails = (order: any) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setDetailsOpen(true);
  };

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
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <Calendar className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{assignments?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{todayAppointments?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Aujourd'hui</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <Package className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-2xl font-bold">{upcomingAssignments?.length || 0}</p>
              <p className="text-xs text-muted-foreground">À venir</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <Truck className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {assignments?.filter((a: any) => a.status === "shipped").length || 0}
              </p>
              <p className="text-xs text-muted-foreground">Expédiées</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {assignments?.filter((a: any) => a.status === "completed").length || 0}
              </p>
              <p className="text-xs text-muted-foreground">Complétées</p>
            </CardContent>
          </Card>
        </div>

        {/* Today's Appointments - Priority Section */}
        {todayAppointments && todayAppointments.length > 0 && (
          <Card className="bg-card border-border border-l-4 border-l-amber-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Interventions aujourd'hui
              </CardTitle>
              <CardDescription>Ces rendez-vous ne peuvent plus être modifiés</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {todayAppointments.map((assignment: any) => (
                <div 
                  key={assignment.id} 
                  className="p-4 bg-muted rounded-lg space-y-2 cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => openOrderDetails(assignment)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{assignment.profile?.full_name || "Client"}</p>
                      <p className="text-sm font-mono text-muted-foreground">{assignment.order_number}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusConfig[assignment.status]?.color || "bg-muted"}>
                        {statusConfig[assignment.status]?.label || assignment.status}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {assignment.appointment_date && 
                        format(new Date(assignment.appointment_date), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      {assignment.profile?.service_address}, {assignment.profile?.service_city}, {assignment.profile?.service_province}
                    </div>
                    {assignment.profile?.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <a href={`tel:${assignment.profile.phone}`} className="text-primary hover:underline">
                          {assignment.profile.phone}
                        </a>
                      </div>
                    )}
                  </div>
                  <p className="text-sm"><span className="text-muted-foreground">Service:</span> {assignment.service_type}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* All Assignments with Filters */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Commandes assignées
              </CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {statusOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredAssignments && filteredAssignments.length > 0 ? (
              <ScrollArea className="h-[500px]">
                <div className="space-y-4 pr-4">
                  {filteredAssignments.map((assignment: any) => {
                    const canModify = canModifyAppointment(assignment.appointment_date);
                    const StatusIcon = statusConfig[assignment.status]?.icon || Package;
                    
                    return (
                      <div 
                        key={assignment.id} 
                        className="p-4 bg-muted rounded-lg space-y-3 cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() => openOrderDetails(assignment)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusConfig[assignment.status]?.color || 'bg-muted'}`}>
                              <StatusIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium">{assignment.profile?.full_name || "Client"}</p>
                              <p className="text-sm font-mono text-muted-foreground">{assignment.order_number}</p>
                              <p className="text-xs text-muted-foreground">{assignment.service_type}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge className={statusConfig[assignment.status]?.color || "bg-muted"}>
                              {statusConfig[assignment.status]?.label || assignment.status}
                            </Badge>
                            {canModify && (
                              <Badge variant="outline" className="text-xs">
                                Modifiable
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {assignment.appointment_date && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              {format(new Date(assignment.appointment_date), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span className="truncate">
                              {assignment.profile?.service_city}, {assignment.profile?.service_province}
                            </span>
                          </div>
                          {assignment.profile?.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              {assignment.profile.phone}
                            </div>
                          )}
                          {assignment.tracking_number && (
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4 text-muted-foreground" />
                              <span className="font-mono text-xs">{assignment.tracking_number}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune affectation</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Order Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  {selectedOrder.order_number}
                </DialogTitle>
                <DialogDescription>
                  {selectedOrder.service_type} • {selectedOrder.profile?.full_name || "Client"}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="details" className="mt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="details">Détails</TabsTrigger>
                  <TabsTrigger value="equipment">Équipement</TabsTrigger>
                  <TabsTrigger value="client">Client</TabsTrigger>
                  <TabsTrigger value="actions">Actions</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Statut</Label>
                      <Badge className={statusConfig[selectedOrder.status]?.color || "bg-muted"}>
                        {statusConfig[selectedOrder.status]?.label || selectedOrder.status}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Date d'intervention</Label>
                      <p className="font-medium">
                        {selectedOrder.appointment_date 
                          ? format(new Date(selectedOrder.appointment_date), "d MMMM yyyy 'à' HH:mm", { locale: fr })
                          : "Non planifiée"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Type d'installation</Label>
                      <p>{selectedOrder.installation_type === "technician" ? "Par technicien" : "Auto-installation"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Créée le</Label>
                      <p>{format(new Date(selectedOrder.created_at), "d MMM yyyy", { locale: fr })}</p>
                    </div>
                  </div>

                  {selectedOrder.tracking_number && (
                    <div className="p-3 bg-muted rounded-lg">
                      <Label className="text-muted-foreground text-sm">Numéro de suivi</Label>
                      <p className="font-mono">{selectedOrder.tracking_number}</p>
                      {selectedOrder.tracking_url && (
                        <a 
                          href={selectedOrder.tracking_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary text-sm hover:underline"
                        >
                          Suivre le colis →
                        </a>
                      )}
                    </div>
                  )}

                  {selectedOrder.appointment_notes && (
                    <div className="p-3 bg-muted rounded-lg">
                      <Label className="text-muted-foreground text-sm">Notes d'intervention</Label>
                      <p className="text-sm mt-1">{selectedOrder.appointment_notes}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="equipment" className="space-y-4 mt-4">
                  {parseEquipment(selectedOrder).length > 0 ? (
                    <div className="space-y-3">
                      {parseEquipment(selectedOrder).map((equip, idx) => (
                        <div key={idx} className="p-4 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            {equip.type === "router" && <Wifi className="w-5 h-5 text-primary" />}
                            {equip.type === "terminal" && <Monitor className="w-5 h-5 text-cyan-400" />}
                            {equip.type === "sim" && <Package className="w-5 h-5 text-purple-500" />}
                            <span className="font-medium">{equip.name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">S/N:</span>
                              <span className="font-mono ml-2">{equip.serial}</span>
                            </div>
                            {equip.imei && equip.imei !== "N/A" && (
                              <div>
                                <span className="text-muted-foreground">IMEI:</span>
                                <span className="font-mono ml-2">{equip.imei}</span>
                              </div>
                            )}
                            {equip.warranty && (
                              <div>
                                <span className="text-muted-foreground">Garantie:</span>
                                <Badge variant="outline" className="ml-2">{equip.warranty}</Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>Aucun équipement assigné</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="client" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{selectedOrder.profile?.full_name || "Client"}</p>
                        <p className="text-sm text-muted-foreground">{selectedOrder.profile?.email}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="font-medium">Adresse de service</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedOrder.profile?.service_address}<br />
                            {selectedOrder.profile?.service_city}, {selectedOrder.profile?.service_province} {selectedOrder.profile?.service_postal_code}
                          </p>
                          {selectedOrder.profile?.service_province === "QC" && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Éligible intervention
                            </Badge>
                          )}
                        </div>
                      </div>

                      {selectedOrder.profile?.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <a href={`tel:${selectedOrder.profile.phone}`} className="text-primary hover:underline">
                            {selectedOrder.profile.phone}
                          </a>
                        </div>
                      )}

                      {selectedOrder.profile?.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <a href={`mailto:${selectedOrder.profile.email}`} className="text-primary hover:underline">
                            {selectedOrder.profile.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="actions" className="space-y-4 mt-4">
                  {/* Status Update */}
                  <div className="space-y-3">
                    <Label>Mettre à jour le statut</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un statut" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      placeholder="Raison du changement (obligatoire)..."
                      value={updateReason}
                      onChange={(e) => setUpdateReason(e.target.value)}
                    />
                    <Button 
                      onClick={() => setConfirmAction({ type: "status", data: { status: newStatus, reason: updateReason } })}
                      disabled={!newStatus || newStatus === selectedOrder.status || !updateReason}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Mettre à jour
                    </Button>
                  </div>

                  <Separator />

                  {/* Appointment Management - Only if 24h+ before */}
                  {canModifyAppointment(selectedOrder.appointment_date) ? (
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Gérer le rendez-vous
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Rendez-vous actuel: {selectedOrder.appointment_date 
                          ? format(new Date(selectedOrder.appointment_date), "d MMMM yyyy 'à' HH:mm", { locale: fr })
                          : "Non planifié"}
                      </p>
                      
                      <div className="space-y-2">
                        <Label className="text-sm">Reporter à:</Label>
                        <input
                          type="datetime-local"
                          value={rescheduleDate}
                          onChange={(e) => setRescheduleDate(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-input rounded-md"
                        />
                        <Textarea
                          placeholder="Raison du report..."
                          value={rescheduleReason}
                          onChange={(e) => setRescheduleReason(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button 
                            variant="outline"
                            onClick={() => setConfirmAction({ type: "reschedule", data: { date: rescheduleDate, reason: rescheduleReason } })}
                            disabled={!rescheduleDate || !rescheduleReason}
                          >
                            Reporter
                          </Button>
                          <Button 
                            variant="destructive"
                            onClick={() => setConfirmAction({ type: "cancel" })}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Annuler le RDV
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <div className="flex items-center gap-2 text-amber-500">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="font-medium">Rendez-vous non modifiable</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Le rendez-vous ne peut plus être modifié car il est prévu dans moins de 24 heures.
                      </p>
                    </div>
                  )}

                  <Separator />

                  <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Toutes les modifications sont enregistrées et visibles par l'administration.
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialogs */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "status" && "Confirmer le changement de statut"}
              {confirmAction?.type === "reschedule" && "Confirmer le report"}
              {confirmAction?.type === "cancel" && "Annuler le rendez-vous"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "status" && (
                <>Êtes-vous sûr de vouloir changer le statut vers "{statusOptions.find(o => o.value === confirmAction.data?.status)?.label}"?</>
              )}
              {confirmAction?.type === "reschedule" && (
                <>Le rendez-vous sera reporté. L'administration et le client seront notifiés.</>
              )}
              {confirmAction?.type === "cancel" && (
                <>
                  <Textarea
                    placeholder="Raison de l'annulation (obligatoire)..."
                    value={updateReason}
                    onChange={(e) => setUpdateReason(e.target.value)}
                    className="mt-2"
                  />
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction?.type === "status" && selectedOrder) {
                  updateStatusMutation.mutate({
                    orderId: selectedOrder.id,
                    status: confirmAction.data.status,
                    reason: confirmAction.data.reason,
                  });
                } else if (confirmAction?.type === "reschedule" && selectedOrder) {
                  rescheduleMutation.mutate({
                    orderId: selectedOrder.id,
                    newDate: confirmAction.data.date,
                    reason: confirmAction.data.reason,
                  });
                } else if (confirmAction?.type === "cancel" && selectedOrder) {
                  if (!updateReason) {
                    toast({ title: "Erreur", description: "Veuillez indiquer une raison", variant: "destructive" });
                    return;
                  }
                  cancelAppointmentMutation.mutate({
                    orderId: selectedOrder.id,
                    reason: updateReason,
                  });
                }
              }}
              disabled={confirmAction?.type === "cancel" && !updateReason}
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
