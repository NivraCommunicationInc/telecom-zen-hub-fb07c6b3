import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  LogOut,
  RefreshCw,
  Search,
  ArrowLeft,
  Eye,
  User,
  MapPin,
  Phone,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const statusLabels: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Planifié", color: "bg-blue-500/20 text-blue-600" },
  technician_assigned: { label: "Tech. assigné", color: "bg-cyan-500/20 text-cyan-600" },
  in_progress: { label: "En cours", color: "bg-amber-500/20 text-amber-600" },
  completed: { label: "Terminé", color: "bg-emerald-500/20 text-emerald-600" },
  cancelled: { label: "Annulé", color: "bg-red-500/20 text-red-600" },
};

const EmployeeAppointments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    const stored = localStorage.getItem("nivra_employee_session");
    if (!stored) {
      navigate("/employee/login");
      return;
    }
    try {
      const s = JSON.parse(stored);
      if (!s.permissions?.can_view_appointments) {
        toast({ title: "Accès refusé", variant: "destructive" });
        navigate("/employee");
        return;
      }
      setSession(s);
    } catch {
      navigate("/employee/login");
    }
  }, [navigate, toast]);

  const fetchAppointments = async () => {
    if (!session?.token) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "get_appointments", params: { limit: 200 } },
      });
      if (error) throw error;
      setAppointments(data?.appointments || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.token) fetchAppointments();
  }, [session?.token]);

  const handleLogout = () => {
    localStorage.removeItem("nivra_employee_session");
    navigate("/employee/login");
  };

  const filteredAppointments = appointments.filter(apt => {
    if (!search) return true;
    return apt.appointment_number?.toLowerCase().includes(search.toLowerCase()) ||
      apt.client_email?.toLowerCase().includes(search.toLowerCase()) ||
      apt.title?.toLowerCase().includes(search.toLowerCase());
  });

  const handleUpdateStatus = async (appointmentId: string, status: string) => {
    if (!session?.permissions?.can_manage_appointments) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "update_appointment", params: { appointmentId, updates: { status } } },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: "Statut mis à jour" });
      fetchAppointments();
      setSelectedAppointment(null);
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/employee">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Button>
              </Link>
              <Calendar className="w-6 h-6 text-cyan-500" />
              <h1 className="font-display font-bold text-lg">Rendez-vous</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                <Clock className="w-3 h-3 inline mr-1" />
                {format(lastRefresh, "HH:mm")}
              </span>
              <Button variant="outline" size="sm" onClick={fetchAppointments} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Aucun rendez-vous trouvé
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell className="font-medium">{apt.appointment_number || "N/A"}</TableCell>
                      <TableCell>{apt.title || "N/A"}</TableCell>
                      <TableCell>{apt.client_email || "N/A"}</TableCell>
                      <TableCell>
                        {apt.scheduled_at ? format(new Date(apt.scheduled_at), "d MMM yyyy HH:mm", { locale: fr }) : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusLabels[apt.status]?.color || "bg-gray-500/20"}>
                          {statusLabels[apt.status]?.label || apt.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedAppointment(apt)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {selectedAppointment?.appointment_number || "Rendez-vous"}
            </DialogTitle>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-4">
              <h3 className="font-medium">{selectedAppointment.title}</h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedAppointment.client_email || "N/A"}</span>
                </div>
                {selectedAppointment.client_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedAppointment.client_phone}</span>
                  </div>
                )}
                {selectedAppointment.service_address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedAppointment.service_address}, {selectedAppointment.service_city}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {selectedAppointment.scheduled_at 
                      ? format(new Date(selectedAppointment.scheduled_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })
                      : "N/A"}
                  </span>
                </div>
              </div>

              <Badge className={statusLabels[selectedAppointment.status]?.color}>
                {statusLabels[selectedAppointment.status]?.label || selectedAppointment.status}
              </Badge>

              {session?.permissions?.can_manage_appointments && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Changer le statut</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(statusLabels).map(([key, { label }]) => (
                      <Button
                        key={key}
                        variant={selectedAppointment.status === key ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleUpdateStatus(selectedAppointment.id, key)}
                        disabled={selectedAppointment.status === key}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeAppointments;
