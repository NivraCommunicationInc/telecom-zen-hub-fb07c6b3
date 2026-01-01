import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  Wrench,
  Radio,
  Eye,
  EyeOff,
  Lock,
  Users,
  Briefcase,
  HardHat,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";

const statusTypeConfig: Record<string, { label: string; icon: any; color: string }> = {
  maintenance: { label: "Maintenance", icon: Wrench, color: "bg-amber-500" },
  incident: { label: "Incident", icon: AlertTriangle, color: "bg-red-500" },
  info: { label: "Information", icon: Info, color: "bg-blue-500" },
  resolved: { label: "Résolu", icon: CheckCircle, color: "bg-green-500" },
  scheduled: { label: "Planifié", icon: Clock, color: "bg-purple-500" },
};

const severityConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  critical: { label: "Critique", variant: "destructive", color: "border-red-500 bg-red-50 text-red-800" },
  warning: { label: "Attention", variant: "secondary", color: "border-amber-500 bg-amber-50 text-amber-800" },
  info: { label: "Info", variant: "outline", color: "border-blue-500 bg-blue-50 text-blue-800" },
  success: { label: "Succès", variant: "default", color: "border-green-500 bg-green-50 text-green-800" },
};

const servicesList = [
  { id: "internet", label: "Internet" },
  { id: "tv", label: "Télévision" },
  { id: "streaming", label: "Streaming+" },
  { id: "mobile", label: "Mobile" },
  { id: "portal", label: "Portail client" },
  { id: "billing", label: "Facturation" },
];

const AdminSystemStatus = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<any>(null);
  
  const [newStatus, setNewStatus] = useState({
    title: "",
    message: "",
    status_type: "info",
    severity: "info",
    is_active: true,
    is_banner: true,
    starts_at: "",
    ends_at: "",
    affected_services: [] as string[],
    show_to_clients: true,
    show_to_employees: true,
    show_to_technicians: true,
    internal_notes: "",
  });

  // Fetch all system status
  const { data: statuses, isLoading } = useQuery({
    queryKey: ["admin-system-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_status")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create status
  const createMutation = useMutation({
    mutationFn: async (data: typeof newStatus) => {
      const { error } = await supabase.from("system_status").insert({
        title: data.title,
        message: data.message,
        status_type: data.status_type,
        severity: data.severity,
        is_active: data.is_active,
        is_banner: data.is_banner,
        starts_at: data.starts_at || null,
        ends_at: data.ends_at || null,
        affected_services: data.affected_services,
        show_to_clients: data.show_to_clients,
        show_to_employees: data.show_to_employees,
        show_to_technicians: data.show_to_technicians,
        internal_notes: data.internal_notes || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-system-status"] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
      toast({ title: "Statut créé avec succès" });
      setCreateDialogOpen(false);
      resetNewStatus();
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Update status
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("system_status")
        .update({
          title: data.title,
          message: data.message,
          status_type: data.status_type,
          severity: data.severity,
          is_active: data.is_active,
          is_banner: data.is_banner,
          starts_at: data.starts_at || null,
          ends_at: data.ends_at || null,
          affected_services: data.affected_services,
          show_to_clients: data.show_to_clients,
          show_to_employees: data.show_to_employees,
          show_to_technicians: data.show_to_technicians,
          internal_notes: data.internal_notes || null,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-system-status"] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
      toast({ title: "Statut mis à jour" });
      setEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Delete status
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("system_status").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-system-status"] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
      toast({ title: "Statut supprimé" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Toggle active
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("system_status")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-system-status"] });
      queryClient.invalidateQueries({ queryKey: ["system-status"] });
    },
  });

  const resetNewStatus = () => {
    setNewStatus({
      title: "",
      message: "",
      status_type: "info",
      severity: "info",
      is_active: true,
      is_banner: true,
      starts_at: "",
      ends_at: "",
      affected_services: [],
      show_to_clients: true,
      show_to_employees: true,
      show_to_technicians: true,
      internal_notes: "",
    });
  };

  const activeStatuses = statuses?.filter(s => s.is_active) || [];
  const inactiveStatuses = statuses?.filter(s => !s.is_active) || [];

  const StatusIcon = ({ type }: { type: string }) => {
    const config = statusTypeConfig[type];
    const Icon = config?.icon || Info;
    return <Icon className="w-4 h-4" />;
  };

  const StatusFormFields = ({ data, onChange }: { data: any; onChange: (data: any) => void }) => (
    <div className="space-y-4">
      <div>
        <Label>Titre *</Label>
        <Input
          value={data.title}
          onChange={(e) => onChange({ ...data, title: e.target.value })}
          placeholder="Maintenance planifiée"
        />
      </div>
      <div>
        <Label>Message *</Label>
        <Textarea
          value={data.message}
          onChange={(e) => onChange({ ...data, message: e.target.value })}
          placeholder="Description détaillée du statut..."
          rows={3}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Type</Label>
          <Select value={data.status_type} onValueChange={(v) => onChange({ ...data, status_type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusTypeConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <config.icon className="w-4 h-4" />
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Sévérité</Label>
          <Select value={data.severity} onValueChange={(v) => onChange({ ...data, severity: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(severityConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Date de début</Label>
          <Input
            type="datetime-local"
            value={data.starts_at}
            onChange={(e) => onChange({ ...data, starts_at: e.target.value })}
          />
        </div>
        <div>
          <Label>Date de fin</Label>
          <Input
            type="datetime-local"
            value={data.ends_at}
            onChange={(e) => onChange({ ...data, ends_at: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label className="mb-2 block">Services affectés</Label>
        <div className="flex flex-wrap gap-3">
          {servicesList.map((service) => (
            <label key={service.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={data.affected_services?.includes(service.id)}
                onCheckedChange={(checked) => {
                  const newServices = checked
                    ? [...(data.affected_services || []), service.id]
                    : (data.affected_services || []).filter((s: string) => s !== service.id);
                  onChange({ ...data, affected_services: newServices });
                }}
              />
              {service.label}
            </label>
          ))}
        </div>
      </div>
      <div className="border-t pt-4">
        <Label className="mb-2 block">Visible pour</Label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={data.show_to_clients}
              onCheckedChange={(v) => onChange({ ...data, show_to_clients: !!v })}
            />
            <Users className="w-4 h-4" /> Clients
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={data.show_to_employees}
              onCheckedChange={(v) => onChange({ ...data, show_to_employees: !!v })}
            />
            <Briefcase className="w-4 h-4" /> Employés
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={data.show_to_technicians}
              onCheckedChange={(v) => onChange({ ...data, show_to_technicians: !!v })}
            />
            <HardHat className="w-4 h-4" /> Techniciens
          </label>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2">
          <Switch
            checked={data.is_active}
            onCheckedChange={(v) => onChange({ ...data, is_active: v })}
          />
          <span className="text-sm">Actif</span>
        </label>
        <label className="flex items-center gap-2">
          <Switch
            checked={data.is_banner}
            onCheckedChange={(v) => onChange({ ...data, is_banner: v })}
          />
          <span className="text-sm">Afficher en bannière</span>
        </label>
      </div>
      <div className="border-t pt-4">
        <Label className="flex items-center gap-2 text-amber-700">
          <Lock className="w-4 h-4" />
          Notes internes (Admin uniquement)
        </Label>
        <Textarea
          value={data.internal_notes || ""}
          onChange={(e) => onChange({ ...data, internal_notes: e.target.value })}
          placeholder="Notes visibles uniquement par les administrateurs..."
          rows={2}
          className="mt-2 border-amber-200 bg-amber-50/50"
        />
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Radio className="w-8 h-8 text-primary" />
              Statut Système
            </h1>
            <p className="text-muted-foreground">Gérez les annonces et statuts système pour tous les utilisateurs</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle annonce
          </Button>
        </div>

        {/* Active Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeStatuses.filter(s => s.severity === "success").length}</p>
                  <p className="text-sm text-muted-foreground">Opérationnel</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeStatuses.filter(s => s.severity === "warning").length}</p>
                  <p className="text-sm text-muted-foreground">Avertissements</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeStatuses.filter(s => s.severity === "critical").length}</p>
                  <p className="text-sm text-muted-foreground">Critiques</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeStatuses.filter(s => s.status_type === "scheduled").length}</p>
                  <p className="text-sm text-muted-foreground">Planifiés</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Statuses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Statuts actifs ({activeStatuses.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Chargement...</p>
            ) : activeStatuses.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Aucun statut actif</p>
            ) : (
              <div className="space-y-3">
                {activeStatuses.map((status) => (
                  <div
                    key={status.id}
                    className={`p-4 border-l-4 rounded-lg ${severityConfig[status.severity]?.color || "border-gray-300 bg-gray-50"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`p-1 rounded ${statusTypeConfig[status.status_type]?.color}`}>
                            <StatusIcon type={status.status_type} />
                          </div>
                          <span className="font-medium">{status.title}</span>
                          <Badge variant={severityConfig[status.severity]?.variant}>
                            {severityConfig[status.severity]?.label}
                          </Badge>
                          {status.is_banner && <Badge variant="outline">Bannière</Badge>}
                        </div>
                        <p className="text-sm mb-2">{status.message}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {status.starts_at && (
                            <span>Début: {format(new Date(status.starts_at), "d MMM yyyy HH:mm", { locale: fr })}</span>
                          )}
                          {status.ends_at && (
                            <span>• Fin: {format(new Date(status.ends_at), "d MMM yyyy HH:mm", { locale: fr })}</span>
                          )}
                        </div>
                        {Array.isArray(status.affected_services) && status.affected_services.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {(status.affected_services as string[]).map((s) => (
                              <Badge key={s} variant="outline" className="text-xs">
                                {servicesList.find(svc => svc.id === s)?.label || s}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {status.internal_notes && (
                          <div className="mt-2 p-2 bg-amber-100 rounded text-xs text-amber-800 flex items-start gap-1">
                            <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                            {status.internal_notes}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedStatus({
                              ...status,
                              starts_at: status.starts_at ? new Date(status.starts_at).toISOString().slice(0, 16) : "",
                              ends_at: status.ends_at ? new Date(status.ends_at).toISOString().slice(0, 16) : "",
                            });
                            setEditDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleActiveMutation.mutate({ id: status.id, is_active: false })}
                        >
                          <EyeOff className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Supprimer ce statut?")) deleteMutation.mutate(status.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inactive Statuses */}
        {inactiveStatuses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-muted-foreground">
                <EyeOff className="w-5 h-5" />
                Historique ({inactiveStatuses.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Sévérité</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactiveStatuses.slice(0, 10).map((status) => (
                    <TableRow key={status.id} className="opacity-60">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusIcon type={status.status_type} />
                          {statusTypeConfig[status.status_type]?.label}
                        </div>
                      </TableCell>
                      <TableCell>{status.title}</TableCell>
                      <TableCell>
                        <Badge variant={severityConfig[status.severity]?.variant}>
                          {severityConfig[status.severity]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(status.created_at), "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleActiveMutation.mutate({ id: status.id, is_active: true })}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Supprimer?")) deleteMutation.mutate(status.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle annonce système</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="pr-4">
              <StatusFormFields data={newStatus} onChange={setNewStatus} />
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createMutation.mutate(newStatus)}
              disabled={createMutation.isPending || !newStatus.title || !newStatus.message}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le statut</DialogTitle>
          </DialogHeader>
          {selectedStatus && (
            <ScrollArea className="max-h-[70vh]">
              <div className="pr-4">
                <StatusFormFields data={selectedStatus} onChange={setSelectedStatus} />
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={() => updateMutation.mutate(selectedStatus)}
              disabled={updateMutation.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminSystemStatus;