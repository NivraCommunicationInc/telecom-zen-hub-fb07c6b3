import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isAfter, addHours } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "En attente" },
  shipped: { color: "bg-cyan-500/20 text-cyan-400", label: "Expédié" },
  completed: { color: "bg-emerald-500/20 text-emerald-500", label: "Terminé" },
};

const TechnicianDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [technicianRecord, setTechnicianRecord] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/technician/auth");
        return;
      }
      setCurrentUser(user);

      // Get technician record
      const { data: techData } = await supabase
        .from("technicians")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (techData) {
        setTechnicianRecord(techData);
      }
    };
    checkAuth();
  }, [navigate]);

  const { data: assignments, isLoading, refetch } = useQuery({
    queryKey: ["technician-assignments", technicianRecord?.id],
    enabled: !!technicianRecord?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("technician_id", technicianRecord.id)
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/technician/auth");
  };

  // Filter upcoming appointments (24h+ before)
  const upcomingAppointments = assignments?.filter((a: any) => {
    if (!a.appointment_date) return false;
    const appointmentTime = new Date(a.appointment_date);
    const now = new Date();
    return isAfter(appointmentTime, addHours(now, 24));
  });

  const todayAppointments = assignments?.filter((a: any) => {
    if (!a.appointment_date) return false;
    const appointmentTime = new Date(a.appointment_date);
    const now = new Date();
    const tomorrow = addHours(now, 24);
    return isAfter(appointmentTime, now) && !isAfter(appointmentTime, tomorrow);
  });

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
                <h1 className="font-display font-bold text-lg">Portail Technicien</h1>
                <p className="text-xs text-muted-foreground">
                  {technicianRecord?.full_name || currentUser?.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <Calendar className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{assignments?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Total affectations</p>
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
              <p className="text-2xl font-bold">{upcomingAppointments?.length || 0}</p>
              <p className="text-xs text-muted-foreground">À venir</p>
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

        {/* Today's Appointments */}
        {todayAppointments && todayAppointments.length > 0 && (
          <Card className="bg-card border-border border-l-4 border-l-amber-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Rendez-vous aujourd'hui
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {todayAppointments.map((assignment: any) => (
                <div key={assignment.id} className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{assignment.profile?.full_name || "Client"}</p>
                      <p className="text-sm font-mono text-muted-foreground">{assignment.order_number}</p>
                    </div>
                    <Badge className={statusConfig[assignment.status]?.color || "bg-muted"}>
                      {statusConfig[assignment.status]?.label || assignment.status}
                    </Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {assignment.appointment_date && 
                        format(new Date(assignment.appointment_date), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      {assignment.profile?.service_address}, {assignment.profile?.service_city}
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

        {/* All Assignments */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Toutes les affectations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : assignments && assignments.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <div className="space-y-4 pr-4">
                  {assignments.map((assignment: any) => (
                    <div key={assignment.id} className="p-4 bg-muted rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{assignment.profile?.full_name || "Client"}</p>
                          <p className="text-sm font-mono text-muted-foreground">{assignment.order_number}</p>
                        </div>
                        <Badge className={statusConfig[assignment.status]?.color || "bg-muted"}>
                          {statusConfig[assignment.status]?.label || assignment.status}
                        </Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        {assignment.appointment_date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {format(new Date(assignment.appointment_date), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          {assignment.profile?.service_address}, {assignment.profile?.service_city}, {assignment.profile?.service_province} {assignment.profile?.service_postal_code}
                        </div>
                        {assignment.profile?.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <a href={`tel:${assignment.profile.phone}`} className="text-primary hover:underline">
                              {assignment.profile.phone}
                            </a>
                          </div>
                        )}
                        {assignment.profile?.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            {assignment.profile.email}
                          </div>
                        )}
                      </div>
                      <p className="text-sm"><span className="text-muted-foreground">Service:</span> {assignment.service_type}</p>
                      {assignment.appointment_notes && (
                        <p className="text-sm"><span className="text-muted-foreground">Notes:</span> {assignment.appointment_notes}</p>
                      )}
                    </div>
                  ))}
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
    </div>
  );
};

export default TechnicianDashboard;
