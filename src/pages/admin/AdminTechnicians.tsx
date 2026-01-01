import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wrench,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  RefreshCw,
  Search,
  Calendar,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const statusConfig: Record<string, { color: string; label: string }> = {
  active: { color: "bg-emerald-500/20 text-emerald-500", label: "Actif" },
  inactive: { color: "bg-gray-500/20 text-gray-400", label: "Inactif" },
  on_leave: { color: "bg-amber-500/20 text-amber-500", label: "En congé" },
};

const AdminTechnicians = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingTech, setEditingTech] = useState<any>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    status: "active",
    specializations: [] as string[],
    notes: "",
    access_code: "",
  });

  const { data: technicians, isLoading, refetch } = useQuery({
    queryKey: ["admin-technicians"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: techAssignments } = useQuery({
    queryKey: ["tech-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("technician_id, id, order_number, appointment_date, status, service_type")
        .not("technician_id", "is", null)
        .order("appointment_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const filteredTechnicians = technicians?.filter(
    (tech: any) =>
      tech.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tech.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Validate access code
      if (!data.access_code || data.access_code.length !== 4 || !/^\d{4}$/.test(data.access_code)) {
        throw new Error("Le code d'accès doit contenir exactement 4 chiffres.");
      }

      const { error } = await supabase.from("technicians").insert({
        full_name: data.full_name,
        email: data.email.toLowerCase().trim(),
        phone: data.phone,
        status: data.status,
        specializations: data.specializations,
        notes: data.notes,
        access_code: data.access_code,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-technicians"] });
      toast({ title: "Technicien créé", description: "Le code d'accès a été enregistré." });
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      // Validate access code if provided
      if (data.access_code && (data.access_code.length !== 4 || !/^\d{4}$/.test(data.access_code))) {
        throw new Error("Le code d'accès doit contenir exactement 4 chiffres.");
      }

      const updateData: any = {
        full_name: data.full_name,
        email: data.email.toLowerCase().trim(),
        phone: data.phone,
        status: data.status,
        specializations: data.specializations,
        notes: data.notes,
      };

      // Only update access_code if provided
      if (data.access_code) {
        updateData.access_code = data.access_code;
      }

      const { error } = await supabase
        .from("technicians")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-technicians"] });
      toast({ title: "Technicien mis à jour" });
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("technicians").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-technicians"] });
      toast({ title: "Technicien supprimé" });
    },
  });

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      status: "active",
      specializations: [],
      notes: "",
      access_code: "",
    });
    setEditingTech(null);
  };

  const handleEdit = (tech: any) => {
    setEditingTech(tech);
    setFormData({
      full_name: tech.full_name || "",
      email: tech.email || "",
      phone: tech.phone || "",
      status: tech.status || "active",
      specializations: tech.specializations || [],
      notes: tech.notes || "",
      access_code: "", // Don't show existing code, user can set new one
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingTech) {
      updateMutation.mutate({ id: editingTech.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getAssignmentsForTech = (techId: string) => {
    return techAssignments?.filter((a: any) => a.technician_id === techId) || [];
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Techniciens</h1>
            <p className="text-muted-foreground mt-1">Gestion des techniciens Nivra</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button variant="hero">
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau technicien
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingTech ? "Modifier le technicien" : "Créer un technicien"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Nom complet *</Label>
                    <Input
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Jean Tremblay"
                    />
                  </div>
                  <div>
                    <Label>Courriel *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="jean@nivra.ca"
                    />
                  </div>
                  <div>
                    <Label>Téléphone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="514-555-0000"
                    />
                  </div>
                  <div>
                    <Label>Statut</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Actif</SelectItem>
                        <SelectItem value="inactive">Inactif</SelectItem>
                        <SelectItem value="on_leave">En congé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Code d'accès (4 chiffres) *</Label>
                    <Input
                      type="text"
                      maxLength={4}
                      value={formData.access_code}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setFormData({ ...formData, access_code: value });
                      }}
                      placeholder={editingTech ? "Laisser vide pour garder l'actuel" : "1234"}
                      className="font-mono text-center text-lg tracking-widest"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {editingTech 
                        ? "Entrez un nouveau code pour le modifier" 
                        : "Code requis pour la connexion au portail technicien"}
                    </p>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Notes internes..."
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={!formData.full_name || !formData.email || (!editingTech && formData.access_code.length !== 4)}
                  >
                    {editingTech ? "Mettre à jour" : "Créer"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou courriel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Technicians Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="h-24 bg-muted animate-pulse rounded-lg" />
                </CardContent>
              </Card>
            ))
          ) : filteredTechnicians?.length ? (
            filteredTechnicians.map((tech: any) => {
              const assignments = getAssignmentsForTech(tech.id);
              return (
                <Card key={tech.id} className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <Wrench className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{tech.full_name}</CardTitle>
                          <Badge className={statusConfig[tech.status]?.color || "bg-muted"}>
                            {statusConfig[tech.status]?.label || tech.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(tech)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(tech.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        {tech.email}
                      </div>
                      {tech.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          {tech.phone}
                        </div>
                      )}
                    </div>
                    
                    {assignments.length > 0 && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {assignments.length} affectation(s)
                        </p>
                        <div className="space-y-1">
                          {assignments.slice(0, 2).map((a: any) => (
                            <div key={a.id} className="text-xs p-2 bg-muted rounded">
                              <span className="font-mono">{a.order_number}</span>
                              {a.appointment_date && (
                                <span className="ml-2 text-muted-foreground">
                                  {format(new Date(a.appointment_date), "d MMM HH:mm", { locale: fr })}
                                </span>
                              )}
                            </div>
                          ))}
                          {assignments.length > 2 && (
                            <p className="text-xs text-muted-foreground">
                              +{assignments.length - 2} autre(s)
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Ajouté le {format(new Date(tech.created_at), "d MMM yyyy", { locale: fr })}
                    </p>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="col-span-full bg-card border-border">
              <CardContent className="text-center py-12">
                <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun technicien trouvé</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminTechnicians;
