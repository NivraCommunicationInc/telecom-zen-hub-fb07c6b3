import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Settings, Plus, Pencil, Trash2, Power } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";
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

const categories = ["Mobile", "Internet", "TV", "Streaming", "Sécurité", "Affaires", "Résidentiel", "Extras"];

const AdminServices = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    is_active: true,
  });

  const { data: services, isLoading } = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("category", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: newService, error } = await supabase.from("services").insert({
        name: data.name,
        description: data.description,
        category: data.category,
        price: data.price ? parseFloat(data.price) : null,
        is_active: data.is_active,
      }).select().single();
      if (error) throw error;
      return newService;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      logActivity("create", "service", data.id, { name: data.name });
      toast({ title: "Service créé avec succès" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("services")
        .update({
          name: data.name,
          description: data.description,
          category: data.category,
          price: data.price ? parseFloat(data.price) : null,
          is_active: data.is_active,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      logActivity("update", "service", editingService?.id);
      toast({ title: "Service mis à jour" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("services")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      toast({ title: variables.is_active ? "Service activé" : "Service désactivé" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      toast({ title: "Service supprimé" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", category: "", price: "", is_active: true });
    setEditingService(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (service: any) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      category: service.category,
      price: service.price?.toString() || "",
      is_active: service.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Group services by category
  const groupedServices = services?.reduce((acc: Record<string, any[]>, service: any) => {
    const cat = service.category || "Autre";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(service);
    return acc;
  }, {});

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Services</h1>
            <p className="text-muted-foreground mt-1">Gérer le catalogue de services et offres</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" onClick={() => resetForm()}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un service
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>
                  {editingService ? "Modifier le service" : "Nouveau service"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom du service</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Forfait Mobile Illimité"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Catégorie</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description du service..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Prix (CAD)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Service actif</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Annuler
                  </Button>
                  <Button type="submit" variant="hero">
                    {editingService ? "Mettre à jour" : "Créer"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total services</p>
              <p className="text-2xl font-bold text-foreground">{services?.length || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Services actifs</p>
              <p className="text-2xl font-bold text-emerald-400">
                {services?.filter((s: any) => s.is_active).length || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Services inactifs</p>
              <p className="text-2xl font-bold text-muted-foreground">
                {services?.filter((s: any) => !s.is_active).length || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Catégories</p>
              <p className="text-2xl font-bold text-foreground">
                {Object.keys(groupedServices || {}).length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-cyan-400" />
              Catalogue de services
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : services && services.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nom</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Catégorie</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Prix</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Activer</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((service: any) => (
                      <tr key={service.id} className="border-b border-border/50 hover:bg-accent/50">
                        <td className="py-3 px-4">
                          <p className="text-sm text-foreground font-medium">{service.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{service.description}</p>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">{service.category}</Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">
                          {service.price
                            ? Number(service.price).toLocaleString("fr-CA", {
                                style: "currency",
                                currency: "CAD",
                              })
                            : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              service.is_active
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {service.is_active ? "Actif" : "Inactif"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Switch
                            checked={service.is_active}
                            onCheckedChange={(checked) =>
                              toggleActiveMutation.mutate({ id: service.id, is_active: checked })
                            }
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(service)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Supprimer ce service ?")) {
                                  deleteMutation.mutate(service.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun service configuré</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Créez votre premier service en cliquant sur "Ajouter un service"
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminServices;
