import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Wrench,
  Plus,
  UserCog,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import AccessDeniedCard from "@/components/employee/AccessDeniedCard";

const statusLabels: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Planifié", color: "bg-blue-500/20 text-blue-600" },
  technician_assigned: { label: "Tech. assigné", color: "bg-cyan-500/20 text-cyan-600" },
  in_progress: { label: "En cours", color: "bg-amber-500/20 text-amber-600" },
  completed: { label: "Terminé", color: "bg-emerald-500/20 text-emerald-600" },
  cancelled: { label: "Annulé", color: "bg-red-500/20 text-red-600" },
};

interface Technician {
  id: string;
  full_name: string;
  email: string;
  status: string;
  specializations: string[] | null;
}

const EmployeeAppointments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessDenied, setAccessDenied] = useState<{ denied: boolean; reason?: string; neededPermission?: string; requestId?: string }>({ denied: false });
  const [lastResponse, setLastResponse] = useState<any>(null);
  
  // Create appointment dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    client_email: "",
    title: "",
    description: "",
    scheduled_at: "",
    service_type: "internet",
    service_address: "",
    service_city: "",
    service_postal_code: "",
  });

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
    setAccessDenied({ denied: false });
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "get_appointments", params: { limit: 200 } },
      });
      
      // Check for 403 / access denied
      if (data?.ok === false && data?.reason === "not_allowed") {
        setAccessDenied({ 
          denied: true, 
          reason: data.reason, 
          neededPermission: data.needed_permission,
          requestId: data.request_id 
        });
        setLastResponse(data);
        setAppointments([]);
        return;
      }
      
      if (error) throw error;
      setAppointments(data?.appointments || []);
      setLastResponse(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTechnicians = async () => {
    if (!session?.token) return;
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "get_technicians" },
      });
      if (error) throw error;
      setTechnicians(data?.technicians || []);
    } catch (error) {
      console.error("Error fetching technicians:", error);
    }
  };

  const fetchClients = async () => {
    if (!session?.token) return;
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "get_clients", params: { limit: 500 } },
      });
      if (error) throw error;
      setClients(data?.clients || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  useEffect(() => {
    if (session?.token) {
      fetchAppointments();
      fetchTechnicians();
      fetchClients();
    }
  }, [session?.token]);

  const handleLogout = () => {
    localStorage.removeItem("nivra_employee_session");
    navigate("/employee/login");
  };

  const filteredAppointments = appointments.filter(apt => {
    const matchesSearch = !search ||
      apt.appointment_number?.toLowerCase().includes(search.toLowerCase()) ||
      apt.client_email?.toLowerCase().includes(search.toLowerCase()) ||
      apt.title?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || apt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleUpdateStatus = async (appointmentId: string, status: string) => {
    if (!session?.permissions?.can_manage_appointments) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "update_appointment", params: { appointmentId, updates: { status } } },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: "Statut mis à jour" });
      fetchAppointments();
      if (selectedAppointment?.id === appointmentId) {
        setSelectedAppointment({ ...selectedAppointment, status });
      }
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignTechnician = async (technicianId: string | null) => {
    if (!session?.permissions?.can_manage_appointments || !selectedAppointment) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { 
          action: "assign_technician", 
          params: { 
            appointmentId: selectedAppointment.id,
            technician_id: technicianId || null,
            order_id: selectedAppointment.order_id,
            client_email: selectedAppointment.client_email,
            service_address: selectedAppointment.service_address
          } 
        },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: technicianId ? "Technicien assigné" : "Technicien retiré" });
      fetchAppointments();
      const tech = technicians.find(t => t.id === technicianId);
      setSelectedAppointment({ 
        ...selectedAppointment, 
        technician_id: technicianId,
        technicians: tech ? { id: tech.id, full_name: tech.full_name, email: tech.email } : null,
        status: technicianId ? "technician_assigned" : "scheduled"
      });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAppointment = async () => {
    if (!session?.permissions?.can_manage_appointments) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    const client = clients.find(c => c.email === newAppointment.client_email);
    if (!client) {
      toast({ title: "Client non trouvé", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { 
          action: "create_appointment", 
          params: {
            client_id: client.user_id,
            client_email: newAppointment.client_email,
            client_phone: client.phone,
            title: newAppointment.title,
            description: newAppointment.description,
            scheduled_at: newAppointment.scheduled_at,
            service_type: newAppointment.service_type,
            service_address: newAppointment.service_address || client.service_address,
            service_city: newAppointment.service_city || client.service_city,
            service_postal_code: newAppointment.service_postal_code || client.service_postal_code,
          }
        },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: "Rendez-vous créé", description: `Numéro: ${data.appointment?.appointment_number}` });
      setShowCreateDialog(false);
      setNewAppointment({
        client_email: "",
        title: "",
        description: "",
        scheduled_at: "",
        service_type: "internet",
        service_address: "",
        service_city: "",
        service_postal_code: "",
      });
      fetchAppointments();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
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
              {session?.permissions?.can_manage_appointments && (
                <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau
                </Button>
              )}
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
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(statusLabels).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {accessDenied.denied ? (
              <AccessDeniedCard 
                neededPermission={accessDenied.neededPermission} 
                message="Vous n'avez pas la permission de voir les rendez-vous."
                requestId={accessDenied.requestId}
              />
            ) : isLoading ? (
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
                    <TableHead>Technicien</TableHead>
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
                        {apt.technicians?.full_name || (
                          <span className="text-muted-foreground italic">Non assigné</span>
                        )}
                      </TableCell>
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

      {/* Appointment Details Dialog */}
      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {selectedAppointment?.appointment_number || "Rendez-vous"}
            </DialogTitle>
          </DialogHeader>

          {selectedAppointment && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Détails</TabsTrigger>
                <TabsTrigger value="technician">Technicien</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <h3 className="font-medium text-lg">{selectedAppointment.title}</h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${selectedAppointment.client_email}`} className="hover:underline">
                      {selectedAppointment.client_email || "N/A"}
                    </a>
                  </div>
                  {selectedAppointment.client_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a href={`tel:${selectedAppointment.client_phone}`} className="hover:underline">
                        {selectedAppointment.client_phone}
                      </a>
                    </div>
                  )}
                  {selectedAppointment.service_address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedAppointment.service_address}, {selectedAppointment.service_city} {selectedAppointment.service_postal_code}</span>
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

                {selectedAppointment.description && (
                  <div className="bg-muted/50 p-3 rounded text-sm">
                    <p className="font-medium mb-1">Description:</p>
                    <p className="text-muted-foreground">{selectedAppointment.description}</p>
                  </div>
                )}

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
                          disabled={selectedAppointment.status === key || isSubmitting}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="technician" className="space-y-4 mt-4">
                {selectedAppointment.technicians ? (
                  <div className="bg-cyan-500/10 p-4 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-cyan-600">
                      <Wrench className="w-4 h-4" />
                      <span className="font-medium">Technicien assigné</span>
                    </div>
                    <p className="text-sm"><strong>Nom:</strong> {selectedAppointment.technicians.full_name}</p>
                    <p className="text-sm"><strong>Email:</strong> {selectedAppointment.technicians.email}</p>
                  </div>
                ) : (
                  <div className="bg-yellow-500/10 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-600">
                      <UserCog className="w-4 h-4" />
                      <span className="font-medium">Aucun technicien assigné</span>
                    </div>
                  </div>
                )}

                {session?.permissions?.can_manage_appointments && (
                  <div className="border-t pt-4 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <UserCog className="w-4 h-4" />
                      Assigner un technicien
                    </h4>
                    
                    <div className="space-y-4">
                      <Select 
                        value={selectedAppointment.technician_id || "none"} 
                        onValueChange={(v) => handleAssignTechnician(v === "none" ? null : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un technicien..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun (retirer l'assignation)</SelectItem>
                          {technicians.map((tech) => (
                            <SelectItem key={tech.id} value={tech.id}>
                              {tech.full_name} ({tech.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {technicians.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Aucun technicien actif disponible
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Appointment Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Nouveau rendez-vous
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Client</Label>
              <Select 
                value={newAppointment.client_email} 
                onValueChange={(v) => {
                  const client = clients.find(c => c.email === v);
                  setNewAppointment({
                    ...newAppointment, 
                    client_email: v,
                    service_address: client?.service_address || "",
                    service_city: client?.service_city || "",
                    service_postal_code: client?.service_postal_code || "",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.email || ""}>
                      {client.full_name || client.email} ({client.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Titre</Label>
              <Input 
                placeholder="Ex: Installation Internet"
                value={newAppointment.title}
                onChange={(e) => setNewAppointment({...newAppointment, title: e.target.value})}
              />
            </div>
            
            <div>
              <Label>Date et heure</Label>
              <Input 
                type="datetime-local"
                value={newAppointment.scheduled_at}
                onChange={(e) => setNewAppointment({...newAppointment, scheduled_at: e.target.value})}
              />
            </div>
            
            <div>
              <Label>Type de service</Label>
              <Select value={newAppointment.service_type} onValueChange={(v) => setNewAppointment({...newAppointment, service_type: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internet">Internet</SelectItem>
                  <SelectItem value="tv">Télévision</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="bundle">Forfait combiné</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Adresse de service</Label>
              <Input 
                placeholder="Adresse..."
                value={newAppointment.service_address}
                onChange={(e) => setNewAppointment({...newAppointment, service_address: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ville</Label>
                <Input 
                  value={newAppointment.service_city}
                  onChange={(e) => setNewAppointment({...newAppointment, service_city: e.target.value})}
                />
              </div>
              <div>
                <Label>Code postal</Label>
                <Input 
                  value={newAppointment.service_postal_code}
                  onChange={(e) => setNewAppointment({...newAppointment, service_postal_code: e.target.value})}
                />
              </div>
            </div>
            
            <div>
              <Label>Description (optionnel)</Label>
              <Textarea 
                placeholder="Notes ou détails..."
                value={newAppointment.description}
                onChange={(e) => setNewAppointment({...newAppointment, description: e.target.value})}
              />
            </div>
            
            <Button 
              onClick={handleCreateAppointment} 
              disabled={!newAppointment.client_email || !newAppointment.title || !newAppointment.scheduled_at || isSubmitting} 
              className="w-full"
            >
              Créer le rendez-vous
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeAppointments;
