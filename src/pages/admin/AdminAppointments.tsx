import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Phone, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import CalendlyWidget from "@/components/CalendlyWidget";

const AdminAppointments = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["admin-appointments"],
    queryFn: async () => {
      const { data: appointmentsData, error } = await supabase
        .from("appointments")
        .select("*")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      
      // Fetch profiles separately to avoid foreign key issues
      if (appointmentsData && appointmentsData.length > 0) {
        const clientIds = [...new Set(appointmentsData.filter(a => a.client_id).map(a => a.client_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, email, full_name, phone")
          .in("user_id", clientIds);
        
        return appointmentsData.map(apt => ({
          ...apt,
          profiles: profilesData?.find(p => p.user_id === apt.client_id) || 
                   (apt.client_email ? { email: apt.client_email, full_name: apt.client_email.split('@')[0] } : null)
        }));
      }
      
      return appointmentsData || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      toast({ title: "Rendez-vous mis à jour" });
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Rendez-vous</h1>
            <p className="text-muted-foreground mt-1">Gérer les consultations planifiées</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="https://calendly.com/nivratelecom" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Ouvrir Calendly
            </a>
          </Button>
        </div>

        <Tabs defaultValue="list" className="space-y-6">
          <TabsList>
            <TabsTrigger value="list">Liste des rendez-vous</TabsTrigger>
            <TabsTrigger value="book">Réserver pour un client</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  Rendez-vous à venir
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
                ) : appointments && appointments.length > 0 ? (
                  <div className="space-y-3">
                    {appointments.map((apt: any) => (
                      <div key={apt.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div>
                          <p className="font-medium text-foreground">{apt.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {apt.profiles?.full_name || apt.client_email || "Client"} 
                            {apt.profiles?.phone && ` • ${apt.profiles.phone}`}
                          </p>
                          <p className="text-xs text-muted-foreground">{apt.profiles?.email || apt.client_email}</p>
                          <p className="text-xs text-cyan-400">{format(new Date(apt.scheduled_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={apt.status === "completed" ? "bg-emerald-500/20 text-emerald-500" : "bg-cyan-500/20 text-cyan-400"}>
                            {apt.status === "completed" ? "Terminé" : "Planifié"}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => window.open(`tel:${apt.profiles?.phone}`)}>
                            <Phone className="w-4 h-4" />
                          </Button>
                          {apt.status !== "completed" && (
                            <Button size="sm" variant="hero" onClick={() => updateMutation.mutate({ id: apt.id, status: "completed" })}>
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucun rendez-vous</p>
                    <p className="text-sm text-muted-foreground mt-2">Les rendez-vous pris via Calendly apparaîtront ici</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="book">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  Réserver un rendez-vous pour un client
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CalendlyWidget
                  url="https://calendly.com/nivratelecom/30min"
                  minHeight="700px"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminAppointments;
