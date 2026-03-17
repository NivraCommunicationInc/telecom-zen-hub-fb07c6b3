import { useEffect, useState } from "react";
import { estimateTaxes, TAX_DISPLAY, COMBINED_TAX_MULTIPLIER } from "@/lib/pricing/serverTaxEngine";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Ticket,
  Plus,
  Search,
  RefreshCw,
  Eye,
  Edit,
  Copy,
  ToggleLeft,
  ToggleRight,
  Percent,
  DollarSign,
  Calendar,
  Users,
  CheckCircle,
  AlertCircle,
  Calculator,
} from "lucide-react";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";

interface Promotion {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  discount_type: string;
  discount_value: number;
  applies_to: Record<string, boolean>;
  scope: string;
  restricted_client_ids: string[] | null;
  restricted_email_domains: string[] | null;
  min_subtotal: number | null;
  max_discount_amount: number | null;
  start_at: string | null;
  end_at: string | null;
  usage_limit_total: number | null;
  usage_limit_per_client: number | null;
  stackable: boolean;
  new_customers_only: boolean;
  duration: string | null;
  created_at: string;
  updated_at: string;
  redemption_count?: number;
  unique_users_count?: number;
}

const defaultAppliesTo: Record<string, boolean> = {
  services: true,
  one_time_fees: true,
  equipment: true,
  delivery: true,
  installation: true,
};

const AdminPromotions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Preview calculation
  const [previewSubtotal, setPreviewSubtotal] = useState<number>(100);
  
  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    status: "active",
    discount_type: "percent",
    discount_value: 10,
    applies_to: { ...defaultAppliesTo } as Record<string, boolean>,
    scope: "global",
    restricted_email_domains: "",
    min_subtotal: "",
    max_discount_amount: "",
    start_at: "",
    end_at: "",
    usage_limit_total: "",
    usage_limit_per_client: "",
    stackable: false,
    new_customers_only: false,
    duration: "ongoing",
  });

  useEffect(() => {
    if (!isAdmin) {
      navigate("/admin");
      return;
    }
    fetchPromotions();
  }, [isAdmin, navigate]);

  const fetchPromotions = async () => {
    setIsLoading(true);
    try {
      // Fetch promotions
      const { data: promos, error } = await supabase
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch redemption counts AND unique users
      const promoIds = promos?.map(p => p.id) || [];
      const { data: redemptions } = await supabase
        .from("promotion_redemptions")
        .select("promotion_id, client_id")
        .in("promotion_id", promoIds);

      const countMap: Record<string, number> = {};
      const uniqueUsersMap: Record<string, Set<string>> = {};
      
      redemptions?.forEach(r => {
        countMap[r.promotion_id] = (countMap[r.promotion_id] || 0) + 1;
        if (!uniqueUsersMap[r.promotion_id]) {
          uniqueUsersMap[r.promotion_id] = new Set();
        }
        if (r.client_id) {
          uniqueUsersMap[r.promotion_id].add(r.client_id);
        }
      });

      const promosWithCounts = promos?.map(p => ({
        ...p,
        applies_to: p.applies_to as Promotion['applies_to'],
        redemption_count: countMap[p.id] || 0,
        unique_users_count: uniqueUsersMap[p.id]?.size || 0,
      })) || [];

      setPromotions(promosWithCounts);
    } catch (error) {
      console.error("Error fetching promotions:", error);
      toast({ title: "Erreur", description: "Impossible de charger les promotions", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPromotions = promotions.filter(promo => {
    const matchesSearch = !search ||
      promo.code.toLowerCase().includes(search.toLowerCase()) ||
      promo.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || promo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      status: "active",
      discount_type: "percent",
      discount_value: 10,
      applies_to: { ...defaultAppliesTo },
      scope: "global",
      restricted_email_domains: "",
      min_subtotal: "",
      max_discount_amount: "",
      start_at: "",
      end_at: "",
      usage_limit_total: "",
      usage_limit_per_client: "",
      stackable: false,
      new_customers_only: false,
      duration: "ongoing",
    });
  };

  const handleCreateOrUpdate = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast({ title: "Erreur", description: "Code et nom sont requis", variant: "destructive" });
      return;
    }

    if (formData.discount_value <= 0) {
      toast({ title: "Erreur", description: "La valeur de réduction doit être positive", variant: "destructive" });
      return;
    }

    if (formData.discount_type === "percent" && formData.discount_value > 100) {
      toast({ title: "Erreur", description: "Le pourcentage ne peut pas dépasser 100%", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const promoData = {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        status: formData.status,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        applies_to: formData.applies_to,
        scope: formData.scope,
        restricted_email_domains: formData.restricted_email_domains
          ? formData.restricted_email_domains.split(",").map(d => d.trim().toLowerCase()).filter(Boolean)
          : null,
        min_subtotal: formData.min_subtotal ? parseFloat(formData.min_subtotal) : null,
        max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
        start_at: formData.start_at || null,
        end_at: formData.end_at || null,
        usage_limit_total: formData.usage_limit_total ? parseInt(formData.usage_limit_total) : null,
        usage_limit_per_client: formData.usage_limit_per_client ? parseInt(formData.usage_limit_per_client) : null,
        stackable: formData.stackable,
        new_customers_only: formData.new_customers_only,
        duration: formData.duration || null,
        created_by_admin_id: user?.id || null,
      };

      if (isEditing && selectedPromo) {
        const { error } = await supabase
          .from("promotions")
          .update(promoData)
          .eq("id", selectedPromo.id);
        if (error) throw error;
        toast({ title: "Promotion mise à jour" });
      } else {
        const { error } = await supabase
          .from("promotions")
          .insert(promoData);
        if (error) throw error;
        toast({ title: "Promotion créée", description: `Code: ${promoData.code}` });
      }

      setShowCreateDialog(false);
      resetForm();
      setIsEditing(false);
      fetchPromotions();
    } catch (error: any) {
      console.error("Error saving promotion:", error);
      if (error.message?.includes("duplicate")) {
        toast({ title: "Erreur", description: "Ce code promo existe déjà", variant: "destructive" });
      } else {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (promo: Promotion) => {
    try {
      const newStatus = promo.status === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("promotions")
        .update({ status: newStatus })
        .eq("id", promo.id);
      if (error) throw error;
      toast({ title: `Promotion ${newStatus === "active" ? "activée" : "désactivée"}` });
      fetchPromotions();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleDuplicate = (promo: Promotion) => {
    setFormData({
      code: `${promo.code}-COPY`,
      name: `${promo.name} (Copie)`,
      description: promo.description || "",
      status: "inactive",
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      applies_to: promo.applies_to || { ...defaultAppliesTo },
      scope: promo.scope,
      restricted_email_domains: promo.restricted_email_domains?.join(", ") || "",
      min_subtotal: promo.min_subtotal?.toString() || "",
      max_discount_amount: promo.max_discount_amount?.toString() || "",
      start_at: promo.start_at || "",
      end_at: promo.end_at || "",
      usage_limit_total: promo.usage_limit_total?.toString() || "",
      usage_limit_per_client: promo.usage_limit_per_client?.toString() || "",
      stackable: promo.stackable,
      new_customers_only: promo.new_customers_only || false,
      duration: promo.duration || "ongoing",
    });
    setIsEditing(false);
    setShowCreateDialog(true);
  };

  const handleEdit = (promo: Promotion) => {
    setSelectedPromo(promo);
    setFormData({
      code: promo.code,
      name: promo.name,
      description: promo.description || "",
      status: promo.status,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      applies_to: promo.applies_to || { ...defaultAppliesTo },
      scope: promo.scope,
      restricted_email_domains: promo.restricted_email_domains?.join(", ") || "",
      min_subtotal: promo.min_subtotal?.toString() || "",
      max_discount_amount: promo.max_discount_amount?.toString() || "",
      start_at: promo.start_at ? promo.start_at.slice(0, 16) : "",
      end_at: promo.end_at ? promo.end_at.slice(0, 16) : "",
      usage_limit_total: promo.usage_limit_total?.toString() || "",
      usage_limit_per_client: promo.usage_limit_per_client?.toString() || "",
      stackable: promo.stackable,
      new_customers_only: promo.new_customers_only || false,
      duration: promo.duration || "ongoing",
    });
    setIsEditing(true);
    setShowCreateDialog(true);
  };

  const calculatePreviewDiscount = () => {
    if (!previewSubtotal || previewSubtotal <= 0) return 0;
    let discount = 0;
    if (formData.discount_type === "percent") {
      discount = previewSubtotal * (formData.discount_value / 100);
    } else {
      discount = Math.min(formData.discount_value, previewSubtotal);
    }
    if (formData.max_discount_amount && parseFloat(formData.max_discount_amount) > 0) {
      discount = Math.min(discount, parseFloat(formData.max_discount_amount));
    }
    return Math.round(discount * 100) / 100;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Ticket className="w-6 h-6" />
              Promotions
            </h1>
            <p className="text-muted-foreground">Gérer les codes promo et réductions</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchPromotions} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={() => { resetForm(); setIsEditing(false); setShowCreateDialog(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle promotion
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par code ou nom..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="inactive">Inactif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Promotions Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredPromotions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Aucune promotion trouvée
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Valeur</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Utilisations</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPromotions.map((promo) => (
                    <TableRow key={promo.id}>
                      <TableCell className="font-mono font-bold">{promo.code}</TableCell>
                      <TableCell>{promo.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {promo.discount_type === "percent" ? <Percent className="w-3 h-3 mr-1" /> : <DollarSign className="w-3 h-3 mr-1" />}
                          {promo.discount_type === "percent" ? "Pourcentage" : "Montant fixe"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {promo.discount_type === "percent" ? `${promo.discount_value}%` : `${promo.discount_value.toFixed(2)} $`}
                      </TableCell>
                      <TableCell>
                        <Badge className={promo.status === "active" ? "bg-emerald-500/20 text-emerald-600" : "bg-gray-500/20 text-gray-600"}>
                          {promo.status === "active" ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {promo.start_at && promo.end_at ? (
                          <>
                            {format(new Date(promo.start_at), "d MMM", { locale: fr })} - {format(new Date(promo.end_at), "d MMM yyyy", { locale: fr })}
                          </>
                        ) : promo.start_at ? (
                          <>Dès {format(new Date(promo.start_at), "d MMM yyyy", { locale: fr })}</>
                        ) : promo.end_at ? (
                          <>Jusqu'au {format(new Date(promo.end_at), "d MMM yyyy", { locale: fr })}</>
                        ) : (
                          "Illimité"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {promo.redemption_count || 0}
                            {promo.usage_limit_total && ` / ${promo.usage_limit_total}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {promo.unique_users_count || 0} client{(promo.unique_users_count || 0) !== 1 ? 's' : ''} unique{(promo.unique_users_count || 0) !== 1 ? 's' : ''}
                          </span>
                          {promo.usage_limit_total && (
                            <span className="text-xs text-muted-foreground">
                              Restant: {Math.max(0, promo.usage_limit_total - (promo.redemption_count || 0))}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedPromo(promo); setShowDetailsDialog(true); }}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(promo)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDuplicate(promo)}>
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(promo)}>
                            {promo.status === "active" ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (!open) { resetForm(); setIsEditing(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              {isEditing ? "Modifier la promotion" : "Nouvelle promotion"}
            </DialogTitle>
            <DialogDescription>
              {isEditing ? "Modifiez les détails de cette promotion" : "Créez un nouveau code promo pour vos clients"}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="restrictions">Restrictions</TabsTrigger>
              <TabsTrigger value="preview">Aperçu</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Code promo *</Label>
                  <Input
                    placeholder="EX: PROMO2025"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s/g, "") })}
                    className="font-mono uppercase"
                  />
                </div>
                <div>
                  <Label>Statut</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="inactive">Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Nom *</Label>
                <Input
                  placeholder="Nom de la promotion"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  placeholder="Description optionnelle..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type de réduction</Label>
                  <Select value={formData.discount_type} onValueChange={(v) => setFormData({ ...formData, discount_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Pourcentage (%)</SelectItem>
                      <SelectItem value="fixed_amount">Montant fixe ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valeur *</Label>
                  <Input
                    type="number"
                    min="0"
                    max={formData.discount_type === "percent" ? "100" : undefined}
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <Label className="mb-3 block">S'applique à</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { key: "services", label: "Services" },
                    { key: "one_time_fees", label: "Frais uniques" },
                    { key: "equipment", label: "Équipement" },
                    { key: "delivery", label: "Livraison" },
                    { key: "installation", label: "Installation" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={formData.applies_to[key as keyof typeof formData.applies_to]}
                        onCheckedChange={(checked) => setFormData({
                          ...formData,
                          applies_to: { ...formData.applies_to, [key]: !!checked }
                        })}
                      />
                      <Label htmlFor={key} className="text-sm font-normal">{label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date de début</Label>
                  <Input
                    type="datetime-local"
                    value={formData.start_at}
                    onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Date de fin</Label>
                  <Input
                    type="datetime-local"
                    value={formData.end_at}
                    onChange={(e) => setFormData({ ...formData, end_at: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="restrictions" className="space-y-4 mt-4">
              <div>
                <Label>Portée</Label>
                <Select value={formData.scope} onValueChange={(v) => setFormData({ ...formData, scope: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Globale (tous les clients)</SelectItem>
                    <SelectItem value="restricted">Restreinte</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.scope === "restricted" && (
                <div>
                  <Label>Domaines email autorisés (séparés par virgule)</Label>
                  <Input
                    placeholder="exemple.com, entreprise.ca"
                    value={formData.restricted_email_domains}
                    onChange={(e) => setFormData({ ...formData, restricted_email_domains: e.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sous-total minimum ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Optionnel"
                    value={formData.min_subtotal}
                    onChange={(e) => setFormData({ ...formData, min_subtotal: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Réduction max ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Optionnel"
                    value={formData.max_discount_amount}
                    onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Limite totale d'utilisations</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Illimité"
                    value={formData.usage_limit_total}
                    onChange={(e) => setFormData({ ...formData, usage_limit_total: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Limite par client</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Illimité"
                    value={formData.usage_limit_per_client}
                    onChange={(e) => setFormData({ ...formData, usage_limit_per_client: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="stackable"
                  checked={formData.stackable}
                  onCheckedChange={(checked) => setFormData({ ...formData, stackable: checked })}
                />
                <Label htmlFor="stackable">Cumulable avec d'autres promotions</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="new_customers_only"
                  checked={formData.new_customers_only}
                  onCheckedChange={(checked) => setFormData({ ...formData, new_customers_only: checked })}
                />
                <Label htmlFor="new_customers_only">Nouveaux clients uniquement</Label>
              </div>

              <div>
                <Label>Durée du rabais</Label>
                <Select value={formData.duration} onValueChange={(v) => setFormData({ ...formData, duration: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ongoing">Continu (tous les cycles)</SelectItem>
                    <SelectItem value="first_cycle_only">Premier mois seulement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    Aperçu du calcul
                  </CardTitle>
                  <CardDescription>
                    Testez le calcul de réduction avec un sous-total d'exemple
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Sous-total d'exemple ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={previewSubtotal}
                      onChange={(e) => setPreviewSubtotal(parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sous-total</span>
                      <span>{previewSubtotal.toFixed(2)} $</span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>Réduction ({formData.code || "CODE"})</span>
                      <span>-{calculatePreviewDiscount().toFixed(2)} $</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-bold">
                      <span>Après réduction</span>
                      <span>{(previewSubtotal - calculatePreviewDiscount()).toFixed(2)} $</span>
                    </div>
                    {(() => { const taxResult = estimateTaxes(previewSubtotal - calculatePreviewDiscount()); return (<>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{TAX_DISPLAY.TPS_LABEL}</span>
                      <span>{taxResult.tps.toFixed(2)} $</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{TAX_DISPLAY.TVQ_LABEL}</span>
                      <span>{taxResult.tvq.toFixed(2)} $</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-bold text-lg">
                      <span>Total</span>
                      <span>{taxResult.total.toFixed(2)} $</span>
                    </div>
                    </>); })()}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); setIsEditing(false); }}>
              Annuler
            </Button>
            <Button onClick={handleCreateOrUpdate} disabled={isSubmitting}>
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              {isEditing ? "Mettre à jour" : "Créer la promotion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              {selectedPromo?.code}
            </DialogTitle>
          </DialogHeader>

          {selectedPromo && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Statut</span>
                <Badge className={selectedPromo.status === "active" ? "bg-emerald-500/20 text-emerald-600" : "bg-gray-500/20 text-gray-600"}>
                  {selectedPromo.status === "active" ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                  {selectedPromo.status === "active" ? "Actif" : "Inactif"}
                </Badge>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Nom</p>
                <p className="font-medium">{selectedPromo.name}</p>
              </div>

              {selectedPromo.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p>{selectedPromo.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">
                    {selectedPromo.discount_type === "percent" ? "Pourcentage" : "Montant fixe"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valeur</p>
                  <p className="font-medium text-lg">
                    {selectedPromo.discount_type === "percent" ? `${selectedPromo.discount_value}%` : `${selectedPromo.discount_value.toFixed(2)} $`}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">S'applique à</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPromo.applies_to?.services && <Badge variant="outline">Services</Badge>}
                  {selectedPromo.applies_to?.one_time_fees && <Badge variant="outline">Frais uniques</Badge>}
                  {selectedPromo.applies_to?.equipment && <Badge variant="outline">Équipement</Badge>}
                  {selectedPromo.applies_to?.delivery && <Badge variant="outline">Livraison</Badge>}
                  {selectedPromo.applies_to?.installation && <Badge variant="outline">Installation</Badge>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Utilisations</p>
                  <p className="font-medium">
                    {selectedPromo.redemption_count || 0}
                    {selectedPromo.usage_limit_total && ` / ${selectedPromo.usage_limit_total}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Portée</p>
                  <p className="font-medium capitalize">{selectedPromo.scope}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nouveaux clients</p>
                  <Badge variant={selectedPromo.new_customers_only ? "default" : "outline"}>
                    {selectedPromo.new_customers_only ? "Oui" : "Non"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Durée</p>
                  <Badge variant="outline">
                    {selectedPromo.duration === "first_cycle_only" ? "1er mois seulement" : "Continu"}
                  </Badge>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => handleEdit(selectedPromo)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Modifier
                </Button>
                <Button variant="outline" onClick={() => handleToggleStatus(selectedPromo)}>
                  {selectedPromo.status === "active" ? "Désactiver" : "Activer"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminPromotions;
