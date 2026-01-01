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
  Users,
  LogOut,
  RefreshCw,
  Search,
  ArrowLeft,
  Eye,
  Mail,
  Phone,
  MapPin,
  Clock,
  CreditCard,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: "Actif", color: "bg-emerald-500/20 text-emerald-600" },
  suspended: { label: "Suspendu", color: "bg-red-500/20 text-red-600" },
  pending: { label: "En attente", color: "bg-yellow-500/20 text-yellow-600" },
  inactive: { label: "Inactif", color: "bg-gray-500/20 text-gray-600" },
};

const EmployeeClients = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    full_name: "",
    phone: "",
    service_address: "",
    service_city: "",
    service_postal_code: "",
  });
  
  // ID Verification
  const [idData, setIdData] = useState({
    id_type: "",
    id_number: "",
    id_province: "QC",
    id_expiration: "",
  });
  
  // Status change
  const [statusNote, setStatusNote] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("nivra_employee_session");
    if (!stored) {
      navigate("/employee/login");
      return;
    }
    try {
      const s = JSON.parse(stored);
      if (!s.permissions?.can_view_clients) {
        toast({ title: "Accès refusé", variant: "destructive" });
        navigate("/employee");
        return;
      }
      setSession(s);
    } catch {
      navigate("/employee/login");
    }
  }, [navigate, toast]);

  const fetchClients = async () => {
    if (!session?.token) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "get_clients", params: { limit: 200 } },
      });
      if (error) throw error;
      setClients(data?.clients || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.token) fetchClients();
  }, [session?.token]);

  const handleLogout = () => {
    localStorage.removeItem("nivra_employee_session");
    navigate("/employee/login");
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = !search ||
      client.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      client.email?.toLowerCase().includes(search.toLowerCase()) ||
      client.client_number?.toLowerCase().includes(search.toLowerCase()) ||
      client.phone?.includes(search);
    const matchesStatus = statusFilter === "all" || client.account_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSelectClient = (client: any) => {
    setSelectedClient(client);
    setEditData({
      full_name: client.full_name || "",
      phone: client.phone || "",
      service_address: client.service_address || "",
      service_city: client.service_city || "",
      service_postal_code: client.service_postal_code || "",
    });
    setIdData({
      id_type: client.id_type || "",
      id_number: client.id_number || "",
      id_province: client.id_province || "QC",
      id_expiration: client.id_expiration || "",
    });
    setIsEditing(false);
    setStatusNote("");
  };

  const handleUpdateClient = async () => {
    if (!session?.permissions?.can_edit_clients || !selectedClient) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { 
          action: "update_client", 
          params: { 
            clientId: selectedClient.id,
            updates: editData
          } 
        },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: "Client mis à jour" });
      setIsEditing(false);
      fetchClients();
      setSelectedClient({ ...selectedClient, ...editData });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!session?.permissions?.can_edit_clients || !selectedClient) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { 
          action: "update_client_status", 
          params: { 
            clientId: selectedClient.id,
            status: newStatus,
            existing_notes: selectedClient.internal_notes,
            append_note: statusNote ? `Statut changé à ${newStatus} par ${session.name}: ${statusNote}` : `Statut changé à ${newStatus} par ${session.name}`
          } 
        },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: newStatus === "active" ? "Compte réactivé" : "Statut mis à jour" });
      setStatusNote("");
      fetchClients();
      setSelectedClient({ ...selectedClient, account_status: newStatus });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyIdentity = async () => {
    if (!session?.permissions?.can_edit_clients || !selectedClient) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { 
          action: "verify_client_identity", 
          params: { 
            clientId: selectedClient.id,
            ...idData
          } 
        },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: "Identité enregistrée" });
      fetchClients();
      setSelectedClient({ ...selectedClient, ...idData });
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
              <Users className="w-6 h-6 text-emerald-500" />
              <h1 className="font-display font-bold text-lg">Clients</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                <Clock className="w-3 h-3 inline mr-1" />
                {format(lastRefresh, "HH:mm")}
              </span>
              <Button variant="outline" size="sm" onClick={fetchClients} disabled={isLoading}>
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
              placeholder="Rechercher par nom, email ou téléphone..."
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
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Aucun client trouvé
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client #</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Solde</TableHead>
                    <TableHead>Inscrit le</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.client_number || "N/A"}</TableCell>
                      <TableCell>{client.full_name || "N/A"}</TableCell>
                      <TableCell>{client.email || "N/A"}</TableCell>
                      <TableCell>{client.phone || "N/A"}</TableCell>
                      <TableCell>
                        <Badge className={statusLabels[client.account_status]?.color || "bg-emerald-500/20 text-emerald-600"}>
                          {statusLabels[client.account_status]?.label || "Actif"}
                        </Badge>
                      </TableCell>
                      <TableCell className={client.balance > 0 ? "text-red-500 font-medium" : ""}>
                        ${Math.abs(client.balance || 0).toFixed(2)}
                        {client.balance > 0 && " dû"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(client.created_at), "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleSelectClient(client)}>
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

      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {selectedClient?.full_name || "Client"}
            </DialogTitle>
          </DialogHeader>

          {selectedClient && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Informations</TabsTrigger>
                <TabsTrigger value="identity">Identité</TabsTrigger>
                <TabsTrigger value="account">Compte</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <Badge className={statusLabels[selectedClient.account_status]?.color || "bg-emerald-500/20 text-emerald-600"}>
                    {statusLabels[selectedClient.account_status]?.label || "Actif"}
                  </Badge>
                  {session?.permissions?.can_edit_clients && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
                      <Edit className="w-4 h-4 mr-2" />
                      {isEditing ? "Annuler" : "Modifier"}
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Nom complet</Label>
                      <Input 
                        value={editData.full_name}
                        onChange={(e) => setEditData({...editData, full_name: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Téléphone</Label>
                      <Input 
                        value={editData.phone}
                        onChange={(e) => setEditData({...editData, phone: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Adresse de service</Label>
                      <Input 
                        value={editData.service_address}
                        onChange={(e) => setEditData({...editData, service_address: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Ville</Label>
                        <Input 
                          value={editData.service_city}
                          onChange={(e) => setEditData({...editData, service_city: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label>Code postal</Label>
                        <Input 
                          value={editData.service_postal_code}
                          onChange={(e) => setEditData({...editData, service_postal_code: e.target.value})}
                        />
                      </div>
                    </div>
                    <Button onClick={handleUpdateClient} disabled={isSubmitting}>
                      Enregistrer les modifications
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-24">Client #:</span>
                      <span className="font-medium">{selectedClient.client_number || "N/A"}</span>
                    </div>
                    
                    {selectedClient.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <a href={`mailto:${selectedClient.email}`} className="hover:underline">
                          {selectedClient.email}
                        </a>
                      </div>
                    )}
                    
                    {selectedClient.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <a href={`tel:${selectedClient.phone}`} className="hover:underline">
                          {selectedClient.phone}
                        </a>
                      </div>
                    )}
                    
                    {selectedClient.service_address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p>{selectedClient.service_address}</p>
                          <p className="text-muted-foreground">
                            {selectedClient.service_city}, {selectedClient.service_province || "QC"} {selectedClient.service_postal_code}
                          </p>
                        </div>
                      </div>
                    )}

                    {(selectedClient.balance !== null && selectedClient.balance !== undefined) && (
                      <div className="border-t pt-4 mt-4">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-muted-foreground" />
                            Solde
                          </span>
                          <span className={`font-bold ${selectedClient.balance > 0 ? "text-red-500" : "text-emerald-500"}`}>
                            ${Math.abs(selectedClient.balance || 0).toFixed(2)}
                            {selectedClient.balance > 0 ? " dû" : ""}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="identity" className="space-y-4 mt-4">
                {selectedClient.id_type ? (
                  <div className="bg-emerald-500/10 p-4 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="font-medium">Identité vérifiée</span>
                    </div>
                    <p className="text-sm"><strong>Type:</strong> {selectedClient.id_type}</p>
                    <p className="text-sm"><strong>Numéro:</strong> {selectedClient.id_number}</p>
                    <p className="text-sm"><strong>Province:</strong> {selectedClient.id_province}</p>
                    {selectedClient.id_expiration && (
                      <p className="text-sm"><strong>Expiration:</strong> {format(new Date(selectedClient.id_expiration), "d MMMM yyyy", { locale: fr })}</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-yellow-500/10 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-600">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">Identité non vérifiée</span>
                    </div>
                  </div>
                )}

                {session?.permissions?.can_edit_clients && (
                  <div className="border-t pt-4 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Enregistrer l'identité
                    </h4>
                    
                    <div className="grid gap-4">
                      <div>
                        <Label>Type de pièce</Label>
                        <Select value={idData.id_type} onValueChange={(v) => setIdData({...idData, id_type: v})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="drivers_license">Permis de conduire</SelectItem>
                            <SelectItem value="passport">Passeport</SelectItem>
                            <SelectItem value="health_card">Carte d'assurance maladie</SelectItem>
                            <SelectItem value="other">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Numéro</Label>
                        <Input 
                          value={idData.id_number}
                          onChange={(e) => setIdData({...idData, id_number: e.target.value})}
                          placeholder="Numéro de la pièce"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Province</Label>
                          <Select value={idData.id_province} onValueChange={(v) => setIdData({...idData, id_province: v})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="QC">Québec</SelectItem>
                              <SelectItem value="ON">Ontario</SelectItem>
                              <SelectItem value="BC">Colombie-Britannique</SelectItem>
                              <SelectItem value="AB">Alberta</SelectItem>
                              <SelectItem value="MB">Manitoba</SelectItem>
                              <SelectItem value="SK">Saskatchewan</SelectItem>
                              <SelectItem value="NS">Nouvelle-Écosse</SelectItem>
                              <SelectItem value="NB">Nouveau-Brunswick</SelectItem>
                              <SelectItem value="NL">Terre-Neuve</SelectItem>
                              <SelectItem value="PE">Île-du-Prince-Édouard</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Expiration</Label>
                          <Input 
                            type="date"
                            value={idData.id_expiration}
                            onChange={(e) => setIdData({...idData, id_expiration: e.target.value})}
                          />
                        </div>
                      </div>
                      
                      <Button onClick={handleVerifyIdentity} disabled={!idData.id_type || !idData.id_number || isSubmitting}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Enregistrer l'identité
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="account" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Statut actuel</span>
                  <Badge className={statusLabels[selectedClient.account_status]?.color || "bg-emerald-500/20 text-emerald-600"}>
                    {statusLabels[selectedClient.account_status]?.label || "Actif"}
                  </Badge>
                </div>

                {selectedClient.internal_notes && (
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium mb-2">Notes internes:</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedClient.internal_notes}</p>
                  </div>
                )}

                {session?.permissions?.can_edit_clients && (
                  <div className="border-t pt-4 space-y-4">
                    <h4 className="font-medium">Changer le statut du compte</h4>
                    
                    <div>
                      <Label>Note (optionnel)</Label>
                      <Textarea 
                        placeholder="Raison du changement..."
                        value={statusNote}
                        onChange={(e) => setStatusNote(e.target.value)}
                        rows={2}
                      />
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {selectedClient.account_status === "suspended" ? (
                        <Button 
                          onClick={() => handleUpdateStatus("active")} 
                          disabled={isSubmitting}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Réactiver le compte
                        </Button>
                      ) : (
                        <>
                          <Button 
                            variant="destructive"
                            onClick={() => handleUpdateStatus("suspended")} 
                            disabled={isSubmitting}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Suspendre
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => handleUpdateStatus("inactive")} 
                            disabled={isSubmitting}
                          >
                            Marquer inactif
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 text-xs text-muted-foreground">
                  Inscrit le {format(new Date(selectedClient.created_at), "d MMMM yyyy", { locale: fr })}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeClients;
