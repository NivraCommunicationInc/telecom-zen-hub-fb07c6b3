import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Phone, Check, Clock, User, Wrench, AlertTriangle, Edit, X, MessageSquare, History, UserCheck, Package, RefreshCw, Eye, ChevronDown, ChevronUp, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, isFuture, isToday, differenceInHours, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useAuth } from "@/hooks/useAuth";

// Status configuration
const STATUS_CONFIG = {
  scheduled: { label: "Planifié", color: "bg-cyan-500/20 text-cyan-500 border-cyan-500/30", icon: Clock },
  modified: { label: "Modifié", color: "bg-purple-500/20 text-purple-500 border-purple-500/30", icon: Edit },
  cancelled: { label: "Annulé", color: "bg-red-500/20 text-red-500 border-red-500/30", icon: X },
  completed: { label: "Terminé", color: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30", icon: Check },
  technician_assigned: { label: "Technicien assigné", color: "bg-blue-500/20 text-blue-500 border-blue-500/30", icon: UserCheck },
  pending_verification: { label: "Vérification en attente", color: "bg-amber-500/20 text-amber-500 border-amber-500/30", icon: AlertTriangle },
  pending_payment: { label: "Paiement en attente", color: "bg-orange-500/20 text-orange-500 border-orange-500/30", icon: Package },
};

const TIME_SLOTS = [
  "08h00 - 10h00",
  "10h00 - 12h00",
  "12h00 - 14h00",
  "14h00 - 16h00",
  "16h00 - 18h00",
];

const AdminAppointments = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, isEmployee, isTechnician, permissions } = useRoleAccess();
  
  // State
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [assignTechDialogOpen, setAssignTechDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(null);
  
  // Form state
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [selectedTechnician, setSelectedTechnician] = useState("");
  const [internalNote, setInternalNote] = useState("");

  // Fetch appointments with profiles and technicians
  const { data: appointments, isLoading } = useQuery({
    queryKey: ["admin-appointments-full"],
    queryFn: async () => {
      const { data: appointmentsData, error } = await supabase
        .from("appointments")
        .select("*")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      
      if (appointmentsData && appointmentsData.length > 0) {
        const clientIds = [...new Set(appointmentsData.filter(a => a.client_id).map(a => a.client_id))];
        
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, email, full_name, phone, client_number, service_address, service_city")
          .in("user_id", clientIds);
        
        // Fetch linked orders
        const { data: ordersData } = await supabase
          .from("orders")
          .select("id, order_number, service_type, status, user_id, technician_id, appointment_date")
          .in("user_id", clientIds);
        
        return appointmentsData.map(apt => ({
          ...apt,
          profiles: profilesData?.find(p => p.user_id === apt.client_id) || 
                   (apt.client_email ? { email: apt.client_email, full_name: apt.client_email.split('@')[0] } : null),
          linkedOrder: ordersData?.find(o => o.user_id === apt.client_id && 
            (o.appointment_date === apt.scheduled_at || o.service_type?.toLowerCase().includes('internet') || o.service_type?.toLowerCase().includes('tv')))
        }));
      }
      
      return appointmentsData || [];
    },
  });

  // Fetch technicians
  const { data: technicians } = useQuery({
    queryKey: ["technicians-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("*")
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("admin-appointments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, updates, reason }: { id: string; updates: any; reason?: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update(updates)
        .eq("id", id);
      if (error) throw error;

      // Log activity
      if (user?.id && reason) {
        await supabase.from("activity_logs").insert({
          user_id: user.id,
          entity_type: "appointment",
          entity_id: id,
          action: "update",
          changed_field: Object.keys(updates).join(", "),
          old_value: JSON.stringify(selectedAppointment),
          new_value: JSON.stringify(updates),
          reason: reason,
          actor_email: user.email,
          actor_role: isAdmin ? "admin" : isEmployee ? "employee" : "technician",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
      toast.success("Rendez-vous mis à jour");
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  // Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, newScheduledAt }: { id: string; newScheduledAt: Date }) => {
      const oldDate = selectedAppointment?.scheduled_at;
      
      const { error } = await supabase
        .from("appointments")
        .update({ 
          scheduled_at: newScheduledAt.toISOString(),
          status: "modified",
        })
        .eq("id", id);
      if (error) throw error;

      // Log activity
      if (user?.id) {
        await supabase.from("activity_logs").insert({
          user_id: user.id,
          entity_type: "appointment",
          entity_id: id,
          action: "reschedule",
          changed_field: "scheduled_at",
          old_value: oldDate,
          new_value: newScheduledAt.toISOString(),
          reason: "Date modifiée par l'administrateur",
          actor_email: user.email,
          actor_role: isAdmin ? "admin" : "employee",
        });
      }

      // Send notification
      if (selectedAppointment?.client_email || selectedAppointment?.profiles?.email) {
        try {
          await supabase.functions.invoke("send-appointment-notification", {
            body: {
              email: selectedAppointment.client_email || selectedAppointment.profiles?.email,
              name: selectedAppointment.profiles?.full_name || "Client",
              appointmentTitle: selectedAppointment.title,
              appointmentDate: newScheduledAt.toISOString(),
              status: "rescheduled",
            },
          });
        } catch (e) {
          console.error("Notification error:", e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
      toast.success("Rendez-vous reprogrammé");
      setRescheduleDialogOpen(false);
      setNewDate("");
      setNewTime("");
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ 
          status: "cancelled",
          description: `${selectedAppointment?.description || ""}\n\n[ANNULÉ] Raison: ${reason}`,
        })
        .eq("id", id);
      if (error) throw error;

      // Log activity
      if (user?.id) {
        await supabase.from("activity_logs").insert({
          user_id: user.id,
          entity_type: "appointment",
          entity_id: id,
          action: "cancel",
          changed_field: "status",
          old_value: selectedAppointment?.status,
          new_value: "cancelled",
          reason: reason,
          actor_email: user.email,
          actor_role: isAdmin ? "admin" : "employee",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
      toast.success("Rendez-vous annulé");
      setCancelDialogOpen(false);
      setCancelReason("");
    },
  });

  // Assign technician mutation
  const assignTechMutation = useMutation({
    mutationFn: async ({ appointmentId, technicianId, orderId }: { appointmentId: string; technicianId: string; orderId?: string }) => {
      // Update appointment status
      const { error: aptError } = await supabase
        .from("appointments")
        .update({ status: "technician_assigned" })
        .eq("id", appointmentId);
      if (aptError) throw aptError;

      // Update linked order if exists
      if (orderId) {
        const { error: orderError } = await supabase
          .from("orders")
          .update({ technician_id: technicianId })
          .eq("id", orderId);
        if (orderError) throw orderError;
      }

      // Log activity
      if (user?.id) {
        const tech = technicians?.find(t => t.id === technicianId);
        await supabase.from("activity_logs").insert({
          user_id: user.id,
          entity_type: "appointment",
          entity_id: appointmentId,
          action: "assign_technician",
          changed_field: "technician",
          new_value: tech?.full_name || technicianId,
          reason: "Technicien assigné",
          actor_email: user.email,
          actor_role: "admin",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
      toast.success("Technicien assigné");
      setAssignTechDialogOpen(false);
      setSelectedTechnician("");
    },
  });

  // Add internal note mutation
  const addNoteMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const currentDesc = selectedAppointment?.description || "";
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm");
      const newDesc = `${currentDesc}\n\n[NOTE INTERNE - ${timestamp}] ${note}`;
      
      const { error } = await supabase
        .from("appointments")
        .update({ description: newDesc })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
      toast.success("Note ajoutée");
      setNotesDialogOpen(false);
      setInternalNote("");
    },
  });

  // Filter appointments
  const filteredAppointments = appointments?.filter((apt: any) => {
    const matchesSearch = !searchQuery || 
      apt.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.profiles?.client_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || apt.status === statusFilter;
    
    // Technicians only see their assigned appointments
    if (isTechnician) {
      const techRecord = technicians?.find(t => t.user_id === user?.id);
      if (techRecord && apt.linkedOrder?.technician_id !== techRecord.id) {
        return false;
      }
    }
    
    return matchesSearch && matchesStatus;
  }) || [];

  // Group appointments
  const upcomingAppointments = filteredAppointments.filter((apt: any) => 
    (isFuture(new Date(apt.scheduled_at)) || isToday(new Date(apt.scheduled_at))) && apt.status !== "cancelled"
  );
  const pastAppointments = filteredAppointments.filter((apt: any) => 
    isPast(new Date(apt.scheduled_at)) && !isToday(new Date(apt.scheduled_at))
  );
  const cancelledAppointments = filteredAppointments.filter((apt: any) => apt.status === "cancelled");

  // Stats
  const stats = {
    total: appointments?.length || 0,
    upcoming: upcomingAppointments.length,
    completed: appointments?.filter((a: any) => a.status === "completed").length || 0,
    pending: appointments?.filter((a: any) => ["scheduled", "pending_verification", "pending_payment"].includes(a.status)).length || 0,
    withTechnician: appointments?.filter((a: any) => a.status === "technician_assigned").length || 0,
  };

  // Available dates for rescheduling
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= 30; i++) {
      const date = addDays(today, i);
      dates.push({
        value: format(date, "yyyy-MM-dd"),
        label: format(date, "EEEE d MMMM", { locale: fr }),
      });
    }
    return dates;
  };

  const handleRescheduleSubmit = () => {
    if (!newDate || !newTime || !selectedAppointment) {
      toast.error("Veuillez sélectionner une date et une heure");
      return;
    }
    const [startTime] = newTime.split(' - ');
    const [hours] = startTime.replace('h', ':').split(':');
    const scheduledDate = new Date(newDate);
    scheduledDate.setHours(parseInt(hours), 0, 0, 0);
    rescheduleMutation.mutate({ id: selectedAppointment.id, newScheduledAt: scheduledDate });
  };

  const canManageAppointment = (apt: any) => {
    if (isAdmin) return true;
    if (isEmployee) return apt.status !== "completed";
    if (isTechnician) return apt.status === "technician_assigned";
    return false;
  };

  const renderAppointmentCard = (apt: any, showActions: boolean = true) => {
    const status = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.scheduled;
    const StatusIcon = status.icon;
    const isExpanded = expandedAppointment === apt.id;
    const hoursUntil = differenceInHours(new Date(apt.scheduled_at), new Date());

    return (
      <div key={apt.id} className="border border-border rounded-lg overflow-hidden bg-card hover:border-cyan-500/50 transition-colors">
        {/* Main Row */}
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Date Box */}
            <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex flex-col items-center justify-center flex-shrink-0 border border-cyan-500/30">
              <span className="text-lg font-bold text-cyan-500">{format(new Date(apt.scheduled_at), "d")}</span>
              <span className="text-[10px] text-cyan-400 uppercase">{format(new Date(apt.scheduled_at), "MMM", { locale: fr })}</span>
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-foreground truncate">{apt.title}</h3>
                <Badge className={`${status.color} text-[10px] px-2 py-0.5`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {status.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {apt.profiles?.full_name || apt.client_email || "Client"} 
                {apt.profiles?.client_number && <span className="text-cyan-500 ml-1">#{apt.profiles.client_number}</span>}
              </p>
              <p className="text-xs text-cyan-400">
                {format(new Date(apt.scheduled_at), "EEEE 'à' HH:mm", { locale: fr })}
                {hoursUntil > 0 && hoursUntil < 48 && (
                  <span className="text-amber-500 ml-2">({hoursUntil}h)</span>
                )}
              </p>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {apt.linkedOrder?.order_number && (
              <Badge variant="outline" className="text-[10px] hidden sm:flex">
                {apt.linkedOrder.order_number}
              </Badge>
            )}
            
            <Button size="sm" variant="ghost" onClick={() => setExpandedAppointment(isExpanded ? null : apt.id)}>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            
            {apt.profiles?.phone && (
              <Button size="sm" variant="outline" onClick={() => window.open(`tel:${apt.profiles.phone}`)}>
                <Phone className="w-4 h-4" />
              </Button>
            )}
            
            {showActions && canManageAppointment(apt) && apt.status !== "completed" && apt.status !== "cancelled" && (
              <>
                {(isAdmin || isEmployee) && (
                  <Button size="sm" variant="outline" onClick={() => { setSelectedAppointment(apt); setRescheduleDialogOpen(true); }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                )}
                {isAdmin && apt.status !== "technician_assigned" && (
                  <Button size="sm" variant="outline" className="text-blue-500" onClick={() => { setSelectedAppointment(apt); setAssignTechDialogOpen(true); }}>
                    <UserCheck className="w-4 h-4" />
                  </Button>
                )}
                {(isAdmin || isTechnician) && (
                  <Button size="sm" variant="hero" onClick={() => updateAppointmentMutation.mutate({ id: apt.id, updates: { status: "completed" }, reason: "Installation terminée" })}>
                    <Check className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Expanded Details */}
        {isExpanded && (
          <div className="border-t border-border bg-muted/30 p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Client Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase">Client</h4>
                <p className="text-sm">{apt.profiles?.full_name || "N/A"}</p>
                <p className="text-xs text-muted-foreground">{apt.profiles?.email || apt.client_email}</p>
                <p className="text-xs text-muted-foreground">{apt.profiles?.phone || "—"}</p>
                {apt.profiles?.service_address && (
                  <p className="text-xs text-cyan-500">{apt.profiles.service_address}, {apt.profiles.service_city}</p>
                )}
              </div>
              
              {/* Appointment Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase">Rendez-vous</h4>
                <p className="text-sm">ID: {apt.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-xs text-muted-foreground">Créé: {format(new Date(apt.created_at), "dd/MM/yyyy HH:mm")}</p>
                {apt.linkedOrder && (
                  <p className="text-xs text-cyan-500">Commande: {apt.linkedOrder.order_number}</p>
                )}
              </div>
              
              {/* Actions */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase">Actions</h4>
                <div className="flex flex-wrap gap-2">
                  {(isAdmin || isEmployee) && (
                    <Button size="sm" variant="outline" onClick={() => { setSelectedAppointment(apt); setNotesDialogOpen(true); }}>
                      <MessageSquare className="w-3 h-3 mr-1" />
                      Note
                    </Button>
                  )}
                  {(isAdmin || isEmployee) && apt.status !== "cancelled" && apt.status !== "completed" && (
                    <Button size="sm" variant="outline" className="text-red-500" onClick={() => { setSelectedAppointment(apt); setCancelDialogOpen(true); }}>
                      <X className="w-3 h-3 mr-1" />
                      Annuler
                    </Button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Description / Notes */}
            {apt.description && (
              <div className="border-t border-border pt-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Notes</h4>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-background p-2 rounded">{apt.description}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Rendez-vous</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin ? "Gestion complète des rendez-vous" : 
               isEmployee ? "Gestion des rendez-vous clients" : 
               "Vos rendez-vous assignés"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] })}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="tel:+14385442233">
                <Phone className="w-4 h-4 mr-2" />
                Appeler Nivra
              </a>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.upcoming}</p>
                <p className="text-xs text-muted-foreground">À venir</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Terminés</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">En attente</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.withTechnician}</p>
                <p className="text-xs text-muted-foreground">Avec technicien</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher par nom, email, numéro client..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Appointments Tabs */}
        <Tabs defaultValue="upcoming" className="space-y-4">
          <TabsList>
            <TabsTrigger value="upcoming" className="gap-2">
              <Clock className="w-4 h-4" />
              À venir ({upcomingAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-2">
              <History className="w-4 h-4" />
              Passés ({pastAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="gap-2">
              <X className="w-4 h-4" />
              Annulés ({cancelledAppointments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  Rendez-vous à venir
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
                  </div>
                ) : upcomingAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingAppointments.map((apt: any) => renderAppointmentCard(apt))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucun rendez-vous à venir</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="past">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-muted-foreground" />
                  Rendez-vous passés
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pastAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {pastAppointments.map((apt: any) => renderAppointmentCard(apt, false))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucun historique</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cancelled">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <X className="w-5 h-5 text-red-500" />
                  Rendez-vous annulés
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cancelledAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {cancelledAppointments.map((apt: any) => renderAppointmentCard(apt, false))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <X className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucune annulation</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Reschedule Dialog */}
        <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reprogrammer le rendez-vous</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nouvelle date</Label>
                <Select value={newDate} onValueChange={setNewDate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une date" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableDates().map(date => (
                      <SelectItem key={date.value} value={date.value}>{date.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Créneau horaire</Label>
                <Select value={newTime} onValueChange={setNewTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un créneau" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(slot => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleRescheduleSubmit} disabled={rescheduleMutation.isPending}>
                Confirmer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Dialog */}
        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Annuler ce rendez-vous?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action notifiera le client de l'annulation.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label>Raison de l'annulation</Label>
              <Textarea 
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Indiquez la raison..."
                className="mt-2"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Retour</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => selectedAppointment && cancelMutation.mutate({ id: selectedAppointment.id, reason: cancelReason })}
                className="bg-red-500 hover:bg-red-600"
              >
                Confirmer l'annulation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Assign Technician Dialog */}
        <Dialog open={assignTechDialogOpen} onOpenChange={setAssignTechDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assigner un technicien</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Technicien</Label>
                <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un technicien" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians?.map(tech => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.full_name} — {tech.specializations?.join(", ") || "Général"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedAppointment?.linkedOrder && (
                <p className="text-sm text-muted-foreground">
                  Cette assignation sera aussi appliquée à la commande {selectedAppointment.linkedOrder.order_number}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignTechDialogOpen(false)}>Annuler</Button>
              <Button 
                onClick={() => selectedAppointment && assignTechMutation.mutate({ 
                  appointmentId: selectedAppointment.id, 
                  technicianId: selectedTechnician,
                  orderId: selectedAppointment.linkedOrder?.id 
                })}
                disabled={!selectedTechnician || assignTechMutation.isPending}
              >
                Assigner
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Note Dialog */}
        <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une note interne</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea 
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Note visible uniquement par les administrateurs..."
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>Annuler</Button>
              <Button 
                onClick={() => selectedAppointment && addNoteMutation.mutate({ id: selectedAppointment.id, note: internalNote })}
                disabled={!internalNote.trim() || addNoteMutation.isPending}
              >
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminAppointments;
