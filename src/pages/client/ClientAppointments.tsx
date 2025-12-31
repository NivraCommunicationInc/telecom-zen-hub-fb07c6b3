import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
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
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Plus, Eye, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { format, isPast, isFuture, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const ClientAppointments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["client-appointments-all", user?.id, user?.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const cancelAppointmentMutation = useMutation({
    mutationFn: async (aptId: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", aptId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-appointments-all"] });
      toast({ title: "Rendez-vous annulé" });
      setCancelDialogOpen(false);
      setDetailsOpen(false);
      setSelectedAppointment(null);
    },
    onError: () => {
      toast({ title: "Erreur lors de l'annulation", variant: "destructive" });
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

  // Separate appointments into upcoming and past
  const upcomingAppointments = appointments?.filter((apt: any) => 
    isFuture(new Date(apt.scheduled_at)) || isToday(new Date(apt.scheduled_at))
  ) || [];
  const pastAppointments = appointments?.filter((apt: any) => 
    isPast(new Date(apt.scheduled_at)) && !isToday(new Date(apt.scheduled_at))
  ) || [];

  const handleViewDetails = (apt: any) => {
    setSelectedAppointment(apt);
    setDetailsOpen(true);
  };

  const handleCancelClick = () => {
    setCancelDialogOpen(true);
  };

  const canCancel = (apt: any) => {
    return apt.status === "scheduled" && isFuture(new Date(apt.scheduled_at));
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Mes rendez-vous</h1>
            <p className="text-muted-foreground mt-1">Gérez vos rendez-vous avec Nivra</p>
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
                <Clock className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{upcomingAppointments.length}</p>
                <p className="text-xs text-muted-foreground">À venir</p>
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
                <p className="text-xs text-muted-foreground">Complétés</p>
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

        {/* Upcoming Appointments */}
        {upcomingAppointments.length > 0 && (
          <Card className="bg-card border-border border-l-4 border-l-cyan-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                Rendez-vous à venir
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingAppointments.map((apt: any) => {
                  const StatusIcon = statusIcons[apt.status] || Clock;
                  const aptDate = new Date(apt.scheduled_at);
                  return (
                    <div
                      key={apt.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-accent/50 rounded-lg border border-cyan-500/20"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex flex-col items-center justify-center">
                          <span className="text-lg font-bold text-cyan-500">{format(aptDate, "d")}</span>
                          <span className="text-xs text-cyan-400 uppercase">{format(aptDate, "MMM", { locale: fr })}</span>
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">{apt.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {format(aptDate, "EEEE 'à' HH:mm", { locale: fr })}
                          </p>
                          {apt.description && (
                            <p className="text-sm text-muted-foreground mt-1">{apt.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[apt.status] || "bg-muted"}>
                          {statusLabels[apt.status] || apt.status}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => handleViewDetails(apt)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Appointments History */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-400" />
              Historique des rendez-vous
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : appointments && appointments.length > 0 ? (
              <div className="space-y-4">
                {appointments.map((apt: any) => {
                  const StatusIcon = statusIcons[apt.status] || Clock;
                  return (
                    <div
                      key={apt.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-accent/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            apt.status === "completed" ? "bg-emerald-500/20" :
                            apt.status === "cancelled" ? "bg-red-500/20" :
                            apt.status === "scheduled" ? "bg-cyan-500/20" : "bg-amber-500/20"
                          }`}>
                            <StatusIcon className={`w-4 h-4 ${
                              apt.status === "completed" ? "text-emerald-500" :
                              apt.status === "cancelled" ? "text-red-500" :
                              apt.status === "scheduled" ? "text-cyan-500" : "text-amber-500"
                            }`} />
                          </div>
                          <h3 className="font-medium text-foreground">{apt.title}</h3>
                          <Badge className={statusColors[apt.status] || "bg-muted"}>
                            {statusLabels[apt.status] || apt.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(apt.scheduled_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                        {apt.description && (
                          <p className="text-sm text-muted-foreground mt-1">{apt.description}</p>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleViewDetails(apt)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Détails
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Vous n'avez pas encore de rendez-vous</p>
                <Link to="/portal/new-order">
                  <Button variant="hero">Passer une commande</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Appointment Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détails du rendez-vous</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Titre</span>
                <span className="text-foreground font-medium">{selectedAppointment.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Date & Heure</span>
                <span className="text-foreground">
                  {format(new Date(selectedAppointment.scheduled_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Statut</span>
                <Badge className={statusColors[selectedAppointment.status] || "bg-muted"}>
                  {statusLabels[selectedAppointment.status] || selectedAppointment.status}
                </Badge>
              </div>
              {selectedAppointment.description && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-2">Description</p>
                  <p className="text-foreground">{selectedAppointment.description}</p>
                </div>
              )}
              
              {canCancel(selectedAppointment) && (
                <div className="pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    className="w-full text-red-500 hover:text-red-600"
                    onClick={handleCancelClick}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Annuler ce rendez-vous
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Annuler le rendez-vous
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir annuler ce rendez-vous ? Cette action ne peut pas être annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conserver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedAppointment && cancelAppointmentMutation.mutate(selectedAppointment.id)}
              className="bg-red-500 hover:bg-red-600"
            >
              Annuler le rendez-vous
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ClientLayout>
  );
};

export default ClientAppointments;