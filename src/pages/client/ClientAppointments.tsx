import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Plus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ClientAppointments = () => {
  const { user } = useAuth();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["client-appointments-all", user?.id, user?.email],
    queryFn: async () => {
      // RLS handles filtering - appointments are visible if:
      // - client_id matches user's id, OR
      // - client_email matches user's email in their profile
      // We fetch all and RLS will filter automatically
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .or(`client_id.eq.${user?.id},client_email.ilike.${user?.email}`)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!user?.email,
  });

  const statusColors: Record<string, string> = {
    scheduled: "bg-cyan-500/20 text-cyan-500",
    completed: "bg-emerald-500/20 text-emerald-500",
    cancelled: "bg-red-500/20 text-red-500",
  };

  const statusLabels: Record<string, string> = {
    scheduled: "Planifié",
    completed: "Terminé",
    cancelled: "Annulé",
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Mes rendez-vous</h1>
            <p className="text-muted-foreground mt-1">Gérez vos rendez-vous avec Nivra</p>
          </div>
          <Link to="/book">
            <Button variant="hero">
              <Plus className="w-4 h-4 mr-2" />
              Prendre rendez-vous
            </Button>
          </Link>
        </div>

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
                {appointments.map((apt: any) => (
                  <div
                    key={apt.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-accent/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Vous n'avez pas encore de rendez-vous</p>
                <Link to="/book">
                  <Button variant="hero">Prendre rendez-vous</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ClientAppointments;