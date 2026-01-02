import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Search,
  Plus,
  Edit,
  Trash2,
  Film,
  Music,
  Play,
  Eye,
  EyeOff,
  Pause,
  History,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useStreamingCatalogFull,
  useStreamingCatalogMutations,
  useStreamingCatalogAuditLogs,
  StreamingCatalogItem,
} from "@/hooks/useStreamingCatalog";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: any }> = {
  active: { label: "Actif", variant: "default", icon: Eye },
  hold: { label: "En attente", variant: "secondary", icon: Pause },
  inactive: { label: "Inactif", variant: "destructive", icon: EyeOff },
};

const categoryConfig: Record<string, { label: string; icon: any }> = {
  video: { label: "Vidéo", icon: Film },
  music: { label: "Musique", icon: Music },
};

const AdminStreamingCatalog = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("catalog");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StreamingCatalogItem | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price_monthly: "",
    category: "video" as "video" | "music",
    features: "",
    status: "active" as "active" | "hold" | "inactive",
    sort_order: "0",
    logo_url: "",
  });

  const { data: catalog = [], isLoading } = useStreamingCatalogFull();
  const { data: auditLogs = [] } = useStreamingCatalogAuditLogs();
  const { createItem, updateItem, deleteItem, toggleStatus } = useStreamingCatalogMutations();

  const filteredCatalog = catalog.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price_monthly: "",
      category: "video",
      features: "",
      status: "active",
      sort_order: "0",
      logo_url: "",
    });
  };

  const handleCreate = async () => {
    const price = parseFloat(formData.price_monthly);
    if (!formData.name.trim()) {
      toast({ title: "Le nom est requis", variant: "destructive" });
      return;
    }
    if (isNaN(price) || price <= 0) {
      toast({ title: "Le prix doit être supérieur à 0", variant: "destructive" });
      return;
    }
    // Check unique name
    const exists = catalog.some(
      item => item.name.toLowerCase() === formData.name.trim().toLowerCase()
    );
    if (exists) {
      toast({ title: "Ce nom existe déjà", variant: "destructive" });
      return;
    }

    try {
      await createItem.mutateAsync({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price_monthly: price,
        category: formData.category,
        features: formData.features.split(",").map(f => f.trim()).filter(Boolean),
        status: formData.status,
        sort_order: parseInt(formData.sort_order) || 0,
        logo_url: formData.logo_url.trim() || null,
        currency: "CAD",
      });
      toast({ title: "Service créé" });
      setCreateDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdate = async () => {
    if (!selectedItem) return;
    const price = parseFloat(formData.price_monthly);
    if (!formData.name.trim()) {
      toast({ title: "Le nom est requis", variant: "destructive" });
      return;
    }
    if (isNaN(price) || price <= 0) {
      toast({ title: "Le prix doit être supérieur à 0", variant: "destructive" });
      return;
    }
    // Check unique name (excluding current)
    const exists = catalog.some(
      item => item.id !== selectedItem.id && item.name.toLowerCase() === formData.name.trim().toLowerCase()
    );
    if (exists) {
      toast({ title: "Ce nom existe déjà", variant: "destructive" });
      return;
    }

    try {
      await updateItem.mutateAsync({
        id: selectedItem.id,
        updates: {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          price_monthly: price,
          category: formData.category,
          features: formData.features.split(",").map(f => f.trim()).filter(Boolean),
          status: formData.status,
          sort_order: parseInt(formData.sort_order) || 0,
          logo_url: formData.logo_url.trim() || null,
        },
        oldItem: selectedItem,
      });
      toast({ title: "Service mis à jour" });
      setEditDialogOpen(false);
      setSelectedItem(null);
      resetForm();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (item: StreamingCatalogItem) => {
    if (!confirm(`Supprimer "${item.name}" ?`)) return;
    try {
      await deleteItem.mutateAsync({ id: item.id, oldItem: item });
      toast({ title: "Service supprimé" });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleStatusToggle = async (item: StreamingCatalogItem, newStatus: "active" | "hold" | "inactive") => {
    try {
      await toggleStatus.mutateAsync({ id: item.id, newStatus, oldItem: item });
      toast({ title: `Statut changé: ${statusConfig[newStatus].label}` });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const openEdit = (item: StreamingCatalogItem) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      price_monthly: item.price_monthly.toString(),
      category: item.category,
      features: item.features.join(", "),
      status: item.status,
      sort_order: item.sort_order.toString(),
      logo_url: item.logo_url || "",
    });
    setEditDialogOpen(true);
  };

  const CategoryIcon = ({ category }: { category: string }) => {
    const Icon = categoryConfig[category]?.icon || Play;
    return <Icon className="w-4 h-4" />;
  };

  const StatusIcon = ({ status }: { status: string }) => {
    const Icon = statusConfig[status]?.icon || Eye;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Play className="w-8 h-8 text-primary" />
              Streaming+ Catalog
            </h1>
            <p className="text-muted-foreground">
              Gestion du catalogue de services streaming (source unique)
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="catalog">Catalogue ({catalog.length})</TabsTrigger>
            <TabsTrigger value="audit">
              <History className="w-4 h-4 mr-2" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau service
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Chargement...</p>
                ) : filteredCatalog.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Aucun service trouvé</p>
                ) : (
                  <div className="space-y-3">
                    {filteredCatalog.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                          item.status === "active" ? "hover:bg-accent/30" : "opacity-70 bg-muted/30"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${item.status === "active" ? "bg-primary/10" : "bg-muted"}`}>
                            <CategoryIcon category={item.category} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{item.name}</span>
                              <Badge variant={statusConfig[item.status]?.variant || "default"}>
                                <StatusIcon status={item.status} />
                                <span className="ml-1">{statusConfig[item.status]?.label}</span>
                              </Badge>
                              <Badge variant="outline">{categoryConfig[item.category]?.label}</Badge>
                              <Badge variant="outline" className="text-xs">#{item.sort_order}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                            <p className="text-lg font-bold text-primary">${item.price_monthly.toFixed(2)}/mois</p>
                            {item.features.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {item.features.slice(0, 4).map((f, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                                ))}
                                {item.features.length > 4 && (
                                  <Badge variant="outline" className="text-xs">+{item.features.length - 4}</Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 items-center">
                          <Select
                            value={item.status}
                            onValueChange={(val: "active" | "hold" | "inactive") => handleStatusToggle(item, val)}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Actif</SelectItem>
                              <SelectItem value="hold">En attente</SelectItem>
                              <SelectItem value="inactive">Inactif</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Historique des modifications</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Modifié par</TableHead>
                        <TableHead>Champs modifiés</TableHead>
                        <TableHead>Ancienne valeur</TableHead>
                        <TableHead>Nouvelle valeur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Aucun historique
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs">
                              {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                            </TableCell>
                            <TableCell>
                              <Badge variant={log.action === "delete" ? "destructive" : "default"}>
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{log.actor_name || log.actor_email}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {log.changed_fields?.map((field: string, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs">{field}</Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">
                              {log.old_value ? JSON.stringify(log.old_value).slice(0, 100) : "-"}
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">
                              {log.new_value ? JSON.stringify(log.new_value).slice(0, 100) : "-"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nouveau service Streaming+</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Netflix Premium"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description du service..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prix mensuel *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.price_monthly}
                    onChange={(e) => setFormData({ ...formData, price_monthly: e.target.value })}
                    placeholder="22.99"
                  />
                </div>
                <div>
                  <Label>Catégorie</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(val: "video" | "music") => setFormData({ ...formData, category: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Vidéo</SelectItem>
                      <SelectItem value="music">Musique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Fonctionnalités (séparées par virgule)</Label>
                <Input
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  placeholder="4K Ultra HD, 4 écrans simultanés"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Statut</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val: "active" | "hold" | "inactive") => setFormData({ ...formData, status: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="hold">En attente</SelectItem>
                      <SelectItem value="inactive">Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ordre</Label>
                  <Input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                    placeholder="1"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={createItem.isPending}>
                {createItem.isPending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier le service</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prix mensuel *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.price_monthly}
                    onChange={(e) => setFormData({ ...formData, price_monthly: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Catégorie</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(val: "video" | "music") => setFormData({ ...formData, category: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Vidéo</SelectItem>
                      <SelectItem value="music">Musique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Fonctionnalités (séparées par virgule)</Label>
                <Input
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Statut</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val: "active" | "hold" | "inactive") => setFormData({ ...formData, status: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="hold">En attente</SelectItem>
                      <SelectItem value="inactive">Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ordre</Label>
                  <Input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleUpdate} disabled={updateItem.isPending}>
                {updateItem.isPending ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminStreamingCatalog;
