import { useState, useEffect } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Plus, Eye, Clock, CheckCircle, XCircle, AlertTriangle, Edit, Wrench, CalendarClock, Info, History, MapPin, User, Phone, Mail, Package } from "lucide-react";
import { format, isPast, isFuture, isToday, differenceInHours, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { AppointmentHistoryTimeline } from "@/components/appointments/AppointmentHistoryTimeline";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Available time slots for rescheduling
const TIME_SLOTS = [
  "08h00 - 10h00",
  "10h00 - 12h00",
  "12h00 - 14h00",
  "14h00 - 16h00",
  "16h00 - 18h00",
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  scheduled: { label: "Planifié", color: "bg-cyan-500/20 text-cyan-500", icon: Clock },
  modified: { label: "Modifié", color: "bg-purple-500/20 text-purple-500", icon: Edit },
  completed: { label: "Terminé", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle },
  cancelled: { label: "Annulé", color: "bg-red-500/20 text-red-500", icon: XCircle },
  no_show: { label: "Absent", color: "bg-amber-500/20 text-amber-500", icon: AlertTriangle },
  technician_assigned: { label: "Technicien assigné", color: "bg-blue-500/20 text-blue-500", icon: Wrench },
  pending_verification: { label: "Vérification", color: "bg-amber-500/20 text-amber-500", icon: AlertTriangle },
  in_progress: { label: "En cours", color: "bg-indigo-500/20 text-indigo-500", icon: Wrench },
};

const ClientAppointments = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [activeTab, setActiveTab] = useState("upcoming");

  // Fetch client profile
  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Get client profile ID for filtering
  const clientId = profile?.user_id || user?.id;
  const clientEmail = profile?.email || user?.email;

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["client-appointments-all", clientId, clientEmail],
    queryFn: async () => {
      if (!clientId && !clientEmail) return [];
      
      // Build query with explicit client filter (RLS + frontend filter for safety)
      let query = supabase
        .from("appointments")
        .select("*")
        .order("scheduled_at", { ascending: false });
      
      // Filter by client_id OR client_email
      if (clientId && clientEmail) {
        query = query.or(`client_id.eq.${clientId},client_email.eq.${clientEmail}`);
      } else if (clientId) {
        query = query.eq("client_id", clientId);
      } else if (clientEmail) {
        query = query.eq("client_email", clientEmail);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Appointments fetch error:", error);
        throw error;
      }
      
      // Fetch technicians for display
      if (data && data.length > 0) {
        const techIds = [...new Set(data.filter(a => a.technician_id).map(a => a.technician_id))];
        if (techIds.length > 0) {
          const { data: techs } = await supabase
            .from("technicians")
            .select("id, full_name, email, phone")
            .in("id", techIds);
          
          return data.map(apt => ({
            ...apt,
            technician: techs?.find(t => t.id === apt.technician_id)
          }));
        }
      }
      
      return data || [];
    },
    enabled: !!(clientId || clientEmail),
  });

  // Realtime subscription - invalidate on any appointment change
  useEffect(() => {
    if (!clientId && !clientEmail) return;
    
    const channel = supabase
      .channel("client-appointments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, (payload) => {
        // Only invalidate if the change is relevant to this client
        const changedClientId = (payload.new as any)?.client_id || (payload.old as any)?.client_id;
        const changedClientEmail = (payload.new as any)?.client_email || (payload.old as any)?.client_email;
        
        if (changedClientId === clientId || changedClientEmail === clientEmail) {
          queryClient.invalidateQueries({ queryKey: ["client-appointments-all"] });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, clientId, clientEmail]);

  // Cancel appointment mutation
  const cancelAppointmentMutation = useMutation({
    mutationFn: async (aptId: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", aptId);
      if (error) throw error;

      // Create notification ticket for admin
      await supabase.from("support_tickets").insert({
        user_id: user?.id,
        client_email: profile?.email || user?.email,
        subject: `Installation annulée - ${selectedAppointment?.title}`,
        description: `**Annulation de rendez-vous d'installation**\n\n**Client:** ${profile?.full_name || user?.email}\n**Date originale:** ${format(new Date(selectedAppointment?.scheduled_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}\n\nLe client a annulé son rendez-vous d'installation.`,
        priority: "high",
        status: "open",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-appointments-all"] });
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
      toast.success("Rendez-vous annulé avec succès");
      setCancelDialogOpen(false);
      setDetailsOpen(false);
      setSelectedAppointment(null);
    },
    onError: () => {
      toast.error("Erreur lors de l'annulation");
    },
  });

  // Reschedule appointment mutation
  const rescheduleAppointmentMutation = useMutation({
    mutationFn: async ({ aptId, newScheduledAt }: { aptId: string; newScheduledAt: Date }) => {
      const oldDate = selectedAppointment?.scheduled_at;
      
      const { error } = await supabase
        .from("appointments")
        .update({ 
          scheduled_at: newScheduledAt.toISOString(),
          status: "scheduled",
        })
        .eq("id", aptId);
      if (error) throw error;

      // Create notification ticket for admin
      await supabase.from("support_tickets").insert({
        user_id: user?.id,
        client_email: profile?.email || user?.email,
        subject: `Installation reprogrammée - ${selectedAppointment?.title}`,
        description: `**Reprogrammation de rendez-vous d'installation**\n\n**Client:** ${profile?.full_name || user?.email}\n**Ancienne date:** ${format(new Date(oldDate), "d MMMM yyyy 'à' HH:mm", { locale: fr })}\n**Nouvelle date:** ${format(newScheduledAt, "d MMMM yyyy 'à' HH:mm", { locale: fr })}\n\nLe client a reprogrammé son rendez-vous d'installation.`,
        priority: "high",
        status: "open",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-appointments-all"] });
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
      toast.success("Rendez-vous reprogrammé avec succès");
      setRescheduleDialogOpen(false);
      setDetailsOpen(false);
      setSelectedAppointment(null);
      setNewDate("");
      setNewTime("");
    },
    onError: () => {
      toast.error("Erreur lors de la reprogrammation");
    },
  });

  const statusColors: Record<string, string> = {
    scheduled: "bg-cyan-500/20 text-cyan-500",
    completed: "bg-emerald-500/20 text-emerald-500",
    cancelled: "bg-red-500/20 text-red-500",
    no_show: "bg-amber-500/20 text-amber-500",
  };

  const statusLabels: Record<string, string> = {
    scheduled: "Planifié",
    completed: "Terminé",
    cancelled: "Annulé",
    no_show: "Absent",
  };

  const statusIcons: Record<string, any> = {
    scheduled: Clock,
    completed: CheckCircle,
    cancelled: XCircle,
    no_show: AlertTriangle,
  };

  // Filter appointments to only show installation-related ones (hide consultation/carrier mentions)
  const filterAppointmentTitle = (title: string) => {
    // Remove carrier names and consultation text
    return title
      .replace(/consultation/gi, 'Rendez-vous')
      .replace(/Bell|Rogers|Telus|Vidéotron|Fido|Koodo|Virgin|Chatr|Freedom|Lucky|Public|Fizz/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const filterDescription = (description: string | null) => {
    if (!description) return null;
    // Remove carrier names from description
    return description
      .replace(/Bell|Rogers|Telus|Vidéotron|Fido|Koodo|Virgin|Chatr|Freedom|Lucky|Public|Fizz/gi, '')
      .replace(/consultation/gi, 'rendez-vous')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Separate appointments into upcoming and past based on date AND status
  // Upcoming: future date + not cancelled/completed
  const upcomingAppointments = appointments?.filter((apt: any) => {
    const aptDate = new Date(apt.scheduled_at);
    const isFutureOrToday = isFuture(aptDate) || isToday(aptDate);
    const isActiveStatus = !["cancelled", "completed", "no_show"].includes(apt.status?.toLowerCase());
    return isFutureOrToday && isActiveStatus;
  }) || [];
  
  // Past: past date OR cancelled/completed/no_show status
  const pastAppointments = appointments?.filter((apt: any) => {
    const aptDate = new Date(apt.scheduled_at);
    const isPastDate = isPast(aptDate) && !isToday(aptDate);
    const isInactiveStatus = ["cancelled", "completed", "no_show"].includes(apt.status?.toLowerCase());
    return isPastDate || isInactiveStatus;
  }) || [];

  const handleViewDetails = (apt: any) => {
    setSelectedAppointment(apt);
    setDetailsOpen(true);
  };

  const handleCancelClick = () => {
    setCancelDialogOpen(true);
  };

  const handleRescheduleClick = () => {
    setRescheduleDialogOpen(true);
  };

  const handleRescheduleSubmit = () => {
    if (!newDate || !newTime || !selectedAppointment) {
      toast.error("Veuillez sélectionner une date et une heure");
      return;
    }

    // Parse time slot to get start hour
    const [startTime] = newTime.split(' - ');
    const [hours] = startTime.replace('h', ':').split(':');
    
    const scheduledDate = new Date(newDate);
    scheduledDate.setHours(parseInt(hours), 0, 0, 0);

    rescheduleAppointmentMutation.mutate({
      aptId: selectedAppointment.id,
      newScheduledAt: scheduledDate,
    });
  };

  // Check if appointment can be managed (24+ hours away)
  const canManage = (apt: any) => {
    if (apt.status !== "scheduled") return false;
    const scheduledDate = new Date(apt.scheduled_at);
    const hoursUntil = differenceInHours(scheduledDate, new Date());
    return hoursUntil >= 24;
  };

  // Get hours until appointment
  const getHoursUntil = (apt: any) => {
    const scheduledDate = new Date(apt.scheduled_at);
    return differenceInHours(scheduledDate, new Date());
  };

  // Generate available dates for rescheduling (next 14 days, excluding today)
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 2; i <= 14; i++) { // Start from 2 days out to ensure 24+ hours
      const date = addDays(today, i);
      dates.push({
        value: format(date, "yyyy-MM-dd"),
        label: format(date, "EEEE d MMMM", { locale: fr }),
      });
    }
    return dates;
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Mes rendez-vous</h1>
            <p className="text-muted-foreground mt-1">Gérez vos rendez-vous d'installation Nivra</p>
          </div>
          <Link to="/portal/new-order">
            <Button variant="hero">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle commande
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{upcomingAppointments.length}</p>
                <p className="text-xs text-muted-foreground">Installations à venir</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {appointments?.filter((a: any) => a.status === "completed").length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Complétées</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{appointments?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Management Info */}
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="py-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Gestion des rendez-vous:</strong> Vous pouvez modifier ou annuler un rendez-vous 
              d'installation uniquement si celui-ci est prévu dans plus de 24 heures.
            </p>
          </CardContent>
        </Card>

        {/* Tabs for Upcoming / Past / History */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="upcoming" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">À venir</span>
              {upcomingAppointments.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {upcomingAppointments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="past" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Passés</span>
              {pastAppointments.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {pastAppointments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Historique</span>
            </TabsTrigger>
          </TabsList>

          {/* Upcoming Appointments Tab */}
          <TabsContent value="upcoming" className="mt-0">
            <Card className="bg-card border-border border-l-4 border-l-cyan-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-cyan-400" />
                  Installations à venir
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : upcomingAppointments.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingAppointments.map((apt: any) => {
                      const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled;
                      const StatusIcon = status.icon;
                      const aptDate = new Date(apt.scheduled_at);
                      const hoursUntil = getHoursUntil(apt);
                      
                      return (
                        <div
                          key={apt.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-accent/50 rounded-lg border border-cyan-500/20 cursor-pointer hover:border-cyan-500/50 transition-colors"
                          onClick={() => handleViewDetails(apt)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex flex-col items-center justify-center">
                              <span className="text-lg font-bold text-cyan-500">{format(aptDate, "d")}</span>
                              <span className="text-xs text-cyan-400 uppercase">{format(aptDate, "MMM", { locale: fr })}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-500/30">
                                  {apt.appointment_number || `#${apt.id?.slice(0, 8).toUpperCase()}`}
                                </Badge>
                              </div>
                              <h3 className="font-medium text-foreground">{filterAppointmentTitle(apt.title)}</h3>
                              <p className="text-sm text-muted-foreground">
                                {format(aptDate, "EEEE 'à' HH:mm", { locale: fr })}
                              </p>
                              {apt.technician && (
                                <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                                  <Wrench className="w-3 h-3" />
                                  Technicien: {apt.technician.full_name}
                                </p>
                              )}
                              {apt.status === "scheduled" && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {hoursUntil >= 24 
                                    ? `Modifiable (${hoursUntil}h avant)` 
                                    : `Non modifiable (moins de 24h)`}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={status.color}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {status.label}
                            </Badge>
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleViewDetails(apt); }}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">Aucune installation à venir</p>
                    <Link to="/portal/new-order">
                      <Button variant="hero">Commander une installation</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Past Appointments Tab */}
          <TabsContent value="past" className="mt-0">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  Installations passées
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : pastAppointments.length > 0 ? (
                  <div className="space-y-4">
                    {pastAppointments.map((apt: any) => {
                      const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled;
                      const StatusIcon = status.icon;
                      const aptDate = new Date(apt.scheduled_at);
                      
                      return (
                        <div
                          key={apt.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-accent/50 rounded-lg cursor-pointer hover:bg-accent transition-colors"
                          onClick={() => handleViewDetails(apt)}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                apt.status === "completed" ? "bg-emerald-500/20" :
                                apt.status === "cancelled" ? "bg-red-500/20" : "bg-muted"
                              }`}>
                                <StatusIcon className={`w-4 h-4 ${
                                  apt.status === "completed" ? "text-emerald-500" :
                                  apt.status === "cancelled" ? "text-red-500" : "text-muted-foreground"
                                }`} />
                              </div>
                              <div>
                                <Badge variant="outline" className="text-[10px] text-muted-foreground mr-2">
                                  {apt.appointment_number || `#${apt.id?.slice(0, 8).toUpperCase()}`}
                                </Badge>
                                <span className="font-medium text-foreground">{filterAppointmentTitle(apt.title)}</span>
                              </div>
                              <Badge className={status.color}>
                                {status.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground pl-11">
                              {format(aptDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleViewDetails(apt); }}>
                            <Eye className="w-4 h-4 mr-2" />
                            Détails
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucune installation passée</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Timeline Tab */}
          <TabsContent value="history" className="mt-0">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-400" />
                  Historique des installations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <AppointmentHistoryTimeline
                    appointments={appointments || []}
                    onSelectAppointment={handleViewDetails}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Appointment Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              Détails de l'installation
            </DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="space-y-4 mt-4">
                {/* Appointment ID */}
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Numéro de rendez-vous</p>
                  <p className="font-mono text-cyan-400">
                    {selectedAppointment.appointment_number || `#${selectedAppointment.id?.slice(0, 8).toUpperCase()}`}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="text-foreground font-medium">{filterAppointmentTitle(selectedAppointment.title)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Date & Heure</span>
                  <span className="text-foreground">
                    {format(new Date(selectedAppointment.scheduled_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Statut</span>
                  <Badge className={STATUS_CONFIG[selectedAppointment.status]?.color || "bg-muted"}>
                    {STATUS_CONFIG[selectedAppointment.status]?.label || selectedAppointment.status}
                  </Badge>
                </div>

                {/* Service Address */}
                {(selectedAppointment.service_address || profile?.service_address) && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Adresse d'installation
                    </p>
                    <p className="text-foreground">
                      {selectedAppointment.service_address || profile?.service_address}
                      {(selectedAppointment.service_city || profile?.service_city) && 
                        `, ${selectedAppointment.service_city || profile?.service_city}`}
                      {selectedAppointment.service_postal_code && `, ${selectedAppointment.service_postal_code}`}
                    </p>
                  </div>
                )}

                {/* Technician Info - Visible to Client */}
                {selectedAppointment.technician && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> Technicien assigné
                    </p>
                    <p className="text-foreground font-medium text-blue-400">
                      {selectedAppointment.technician.full_name}
                    </p>
                  </div>
                )}

                {/* Service Type & Method */}
                {selectedAppointment.service_type && (
                  <div className="pt-2 border-t border-border">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Type de service</p>
                        <p className="text-foreground capitalize">{selectedAppointment.service_type.replace(/_/g, ' ')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Méthode</p>
                        <p className="text-foreground">
                          {selectedAppointment.installation_method === 'auto' ? 'Auto-installation' : 'Technicien Nivra'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedAppointment.description && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-2">Description</p>
                    <p className="text-foreground">{filterDescription(selectedAppointment.description)}</p>
                  </div>
                )}
                
                {/* Management buttons with 24h restriction */}
                {selectedAppointment.status === "scheduled" && (
                  <div className="pt-4 border-t border-border space-y-3">
                    {canManage(selectedAppointment) ? (
                      <>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={handleRescheduleClick}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Reprogrammer le rendez-vous
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full text-red-500 hover:text-red-600"
                          onClick={handleCancelClick}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Annuler ce rendez-vous
                        </Button>
                      </>
                    ) : (
                      <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                        <p className="text-sm text-amber-600 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Ce rendez-vous ne peut plus être modifié car il est prévu dans moins de 24 heures.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary" />
              Reprogrammer l'installation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nouvelle date</Label>
              <Select value={newDate} onValueChange={setNewDate}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une date" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableDates().map(date => (
                    <SelectItem key={date.value} value={date.value}>
                      {date.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Nouvelle heure</Label>
              <Select value={newTime} onValueChange={setNewTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une plage horaire" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map(slot => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setRescheduleDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button
                className="flex-1"
                onClick={handleRescheduleSubmit}
                disabled={!newDate || !newTime || rescheduleAppointmentMutation.isPending}
              >
                {rescheduleAppointmentMutation.isPending ? "Enregistrement..." : "Confirmer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Annuler le rendez-vous d'installation
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir annuler ce rendez-vous d'installation ? 
              L'équipe Nivra sera informée de cette annulation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conserver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedAppointment && cancelAppointmentMutation.mutate(selectedAppointment.id)}
              className="bg-red-500 hover:bg-red-600"
              disabled={cancelAppointmentMutation.isPending}
            >
              {cancelAppointmentMutation.isPending ? "Annulation..." : "Annuler le rendez-vous"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ClientLayout>
  );
};

export default ClientAppointments;