import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, FileText, Tag, Pencil, Plus, Trash2, Save, Loader2 } from "lucide-react";

interface SiteSetting {
  id: string;
  key: string;
  value_text: string | null;
  description: string | null;
  category: string;
  is_public: boolean;
}

interface SitePage {
  id: string;
  slug: string;
  title_fr: string;
  title_en: string | null;
  body_fr: string;
  body_en: string | null;
  is_published: boolean;
  updated_at: string;
  updated_by_name: string | null;
}

interface SiteOffer {
  id: string;
  offer_type: string;
  category: string;
  name_fr: string;
  name_en: string | null;
  description_fr: string | null;
  price_monthly: number | null;
  discount_percent: number | null;
  promo_code: string | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
}

export default function AdminSite() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("settings");

  // Fetch settings
  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["admin-site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .order("category", { ascending: true });
      if (error) throw error;
      return data as SiteSetting[];
    },
  });

  // Fetch pages
  const { data: pages, isLoading: loadingPages } = useQuery({
    queryKey: ["admin-site-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_pages")
        .select("id, slug, title_fr, title_en, body_fr, body_en, is_published, updated_at, updated_by_name")
        .order("title_fr");
      if (error) throw error;
      return data as SitePage[];
    },
  });

  // Fetch offers
  const { data: offers, isLoading: loadingOffers } = useQuery({
    queryKey: ["admin-site-offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_offers")
        .select("id, offer_type, category, name_fr, name_en, description_fr, price_monthly, discount_percent, promo_code, is_active, is_featured, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data as SiteOffer[];
    },
  });

  // Update setting mutation
  const updateSetting = useMutation({
    mutationFn: async ({ id, value_text }: { id: string; value_text: string }) => {
      const { error } = await supabase
        .from("site_settings")
        .update({
          value_text,
          updated_at: new Date().toISOString(),
          updated_by_id: user?.id,
          updated_by_name: user?.email,
          updated_by_role: "admin",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-site-settings"] });
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast({ title: "Paramètre mis à jour" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gestion du Site</h1>
          <p className="text-muted-foreground">
            Gérez les paramètres, pages et offres du site public.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Paramètres
            </TabsTrigger>
            <TabsTrigger value="pages" className="gap-2">
              <FileText className="w-4 h-4" />
              Pages
            </TabsTrigger>
            <TabsTrigger value="offers" className="gap-2">
              <Tag className="w-4 h-4" />
              Offres
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4">
            <SettingsTab 
              settings={settings || []} 
              loading={loadingSettings} 
              onUpdate={(id, value) => updateSetting.mutate({ id, value_text: value })}
              updating={updateSetting.isPending}
            />
          </TabsContent>

          <TabsContent value="pages" className="space-y-4">
            <PagesTab pages={pages || []} loading={loadingPages} userId={user?.id} userEmail={user?.email} />
          </TabsContent>

          <TabsContent value="offers" className="space-y-4">
            <OffersTab offers={offers || []} loading={loadingOffers} userId={user?.id} userEmail={user?.email} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

// Settings Tab Component
function SettingsTab({ 
  settings, 
  loading, 
  onUpdate,
  updating 
}: { 
  settings: SiteSetting[]; 
  loading: boolean; 
  onUpdate: (id: string, value: string) => void;
  updating: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const categories = [...new Set(settings.map((s) => s.category))];

  const handleEdit = (setting: SiteSetting) => {
    setEditingId(setting.id);
    setEditValue(setting.value_text || "");
  };

  const handleSave = (id: string) => {
    onUpdate(id, editValue);
    setEditingId(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="capitalize">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings
              .filter((s) => s.category === category)
              .map((setting) => (
                <div key={setting.id} className="flex items-start gap-4 p-3 border rounded-lg">
                  <div className="flex-1 space-y-1">
                    <Label className="font-medium">{setting.key}</Label>
                    <p className="text-xs text-muted-foreground">{setting.description}</p>
                    {editingId === setting.id ? (
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1"
                          data-testid={`setting-input-${setting.key}`}
                        />
                        <Button size="sm" onClick={() => handleSave(setting.id)} disabled={updating}>
                          <Save className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm font-mono bg-muted px-2 py-1 rounded" data-testid={`setting-value-${setting.key}`}>
                        {setting.value_text || "(vide)"}
                      </p>
                    )}
                  </div>
                  {editingId !== setting.id && (
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(setting)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Pages Tab Component
function PagesTab({ pages, loading, userId, userEmail }: { pages: SitePage[]; loading: boolean; userId?: string; userEmail?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPage, setEditingPage] = useState<SitePage | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const savePage = useMutation({
    mutationFn: async (page: Partial<SitePage> & { id?: string }) => {
      const payload = {
        ...page,
        updated_at: new Date().toISOString(),
        updated_by_id: userId,
        updated_by_name: userEmail,
        updated_by_role: "admin",
      };

      if (page.id) {
        const { error } = await supabase.from("site_pages").update(payload).eq("id", page.id);
        if (error) throw error;
      } else {
        const insertPayload = {
          slug: page.slug || `page-${Date.now()}`,
          title_fr: page.title_fr || "",
          title_en: page.title_en || "",
          ...payload,
          created_by_id: userId,
          created_by_name: userEmail,
        };
        const { error } = await supabase.from("site_pages").insert([insertPayload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-site-pages"] });
      queryClient.invalidateQueries({ queryKey: ["site-pages"] });
      toast({ title: "Page sauvegardée" });
      setIsDialogOpen(false);
      setEditingPage(null);
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Pages du site</CardTitle>
          <CardDescription>Gérez les pages de contenu dynamique</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingPage(null)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle page
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <PageEditDialog
              page={editingPage}
              onSave={(data) => savePage.mutate(data)}
              saving={savePage.isPending}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Slug</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Modifié</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.map((page) => (
              <TableRow key={page.id}>
                <TableCell className="font-mono text-sm">/page/{page.slug}</TableCell>
                <TableCell>{page.title_fr}</TableCell>
                <TableCell>
                  <Badge variant={page.is_published ? "default" : "secondary"}>
                    {page.is_published ? "Publié" : "Brouillon"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(page.updated_at).toLocaleDateString("fr-CA")}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingPage(page);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// Page Edit Dialog
function PageEditDialog({ 
  page, 
  onSave, 
  saving 
}: { 
  page: SitePage | null; 
  onSave: (data: Partial<SitePage>) => void; 
  saving: boolean;
}) {
  const [formData, setFormData] = useState({
    id: page?.id,
    slug: page?.slug || "",
    title_fr: page?.title_fr || "",
    title_en: page?.title_en || "",
    body_fr: page?.body_fr || "",
    body_en: page?.body_en || "",
    is_published: page?.is_published ?? false,
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{page ? "Modifier la page" : "Nouvelle page"}</DialogTitle>
        <DialogDescription>Les pages sont accessibles via /page/[slug]</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Slug (URL)</Label>
            <Input
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="mon-article"
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch
              checked={formData.is_published}
              onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
            />
            <Label>Publié</Label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Titre (FR)</Label>
            <Input
              value={formData.title_fr}
              onChange={(e) => setFormData({ ...formData, title_fr: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Titre (EN)</Label>
            <Input
              value={formData.title_en}
              onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Contenu (FR)</Label>
          <Textarea
            value={formData.body_fr}
            onChange={(e) => setFormData({ ...formData, body_fr: e.target.value })}
            rows={6}
          />
        </div>
        <div className="space-y-2">
          <Label>Contenu (EN)</Label>
          <Textarea
            value={formData.body_en}
            onChange={(e) => setFormData({ ...formData, body_en: e.target.value })}
            rows={6}
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(formData)} disabled={saving || !formData.slug || !formData.title_fr}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Sauvegarder
        </Button>
      </DialogFooter>
    </>
  );
}

// Offers Tab Component
function OffersTab({ offers, loading, userId, userEmail }: { offers: SiteOffer[]; loading: boolean; userId?: string; userEmail?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingOffer, setEditingOffer] = useState<SiteOffer | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const saveOffer = useMutation({
    mutationFn: async (offer: Partial<SiteOffer> & { id?: string }) => {
      const payload = {
        ...offer,
        updated_at: new Date().toISOString(),
        updated_by_id: userId,
        updated_by_name: userEmail,
        updated_by_role: "admin",
      };

      if (offer.id) {
        const { error } = await supabase.from("site_offers").update(payload).eq("id", offer.id);
        if (error) throw error;
      } else {
        const insertPayload = {
          offer_type: offer.offer_type || "plan",
          category: offer.category || "general",
          name_fr: offer.name_fr || "",
          name_en: offer.name_en || "",
          ...payload,
          created_by_id: userId,
          created_by_name: userEmail,
        };
        const { error } = await supabase.from("site_offers").insert([insertPayload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-site-offers"] });
      queryClient.invalidateQueries({ queryKey: ["site-offers"] });
      toast({ title: "Offre sauvegardée" });
      setIsDialogOpen(false);
      setEditingOffer(null);
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("site_offers").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-site-offers"] });
      queryClient.invalidateQueries({ queryKey: ["site-offers"] });
    },
  });

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Offres et promotions</CardTitle>
          <CardDescription>Plans, prix et codes promo affichés sur le site</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingOffer(null)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle offre
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <OfferEditDialog
              offer={editingOffer}
              onSave={(data) => saveOffer.mutate(data)}
              saving={saveOffer.isPending}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Prix</TableHead>
              <TableHead>Code promo</TableHead>
              <TableHead>Actif</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {offers.map((offer) => (
              <TableRow key={offer.id}>
                <TableCell className="font-medium">
                  {offer.name_fr}
                  {offer.is_featured && (
                    <Badge variant="outline" className="ml-2">Vedette</Badge>
                  )}
                </TableCell>
                <TableCell>{offer.offer_type}</TableCell>
                <TableCell>{offer.category}</TableCell>
                <TableCell>
                  {offer.price_monthly !== null ? `${offer.price_monthly}$/mois` : "-"}
                  {offer.discount_percent && (
                    <Badge variant="secondary" className="ml-2">-{offer.discount_percent}%</Badge>
                  )}
                </TableCell>
                <TableCell className="font-mono">{offer.promo_code || "-"}</TableCell>
                <TableCell>
                  <Switch
                    checked={offer.is_active}
                    onCheckedChange={(checked) => toggleActive.mutate({ id: offer.id, is_active: checked })}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingOffer(offer);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// Offer Edit Dialog
function OfferEditDialog({ 
  offer, 
  onSave, 
  saving 
}: { 
  offer: SiteOffer | null; 
  onSave: (data: Partial<SiteOffer>) => void; 
  saving: boolean;
}) {
  const [formData, setFormData] = useState({
    id: offer?.id,
    offer_type: offer?.offer_type || "plan",
    category: offer?.category || "internet",
    name_fr: offer?.name_fr || "",
    name_en: offer?.name_en || "",
    description_fr: offer?.description_fr || "",
    price_monthly: offer?.price_monthly ?? null,
    discount_percent: offer?.discount_percent ?? null,
    promo_code: offer?.promo_code || "",
    is_active: offer?.is_active ?? true,
    is_featured: offer?.is_featured ?? false,
    sort_order: offer?.sort_order ?? 0,
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{offer ? "Modifier l'offre" : "Nouvelle offre"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={formData.offer_type} onValueChange={(v) => setFormData({ ...formData, offer_type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plan">Plan</SelectItem>
                <SelectItem value="promo">Promotion</SelectItem>
                <SelectItem value="addon">Add-on</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internet">Internet</SelectItem>
                <SelectItem value="tv">TV</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
                <SelectItem value="streaming">Streaming</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nom (FR)</Label>
            <Input
              value={formData.name_fr}
              onChange={(e) => setFormData({ ...formData, name_fr: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Nom (EN)</Label>
            <Input
              value={formData.name_en || ""}
              onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description (FR)</Label>
          <Textarea
            value={formData.description_fr || ""}
            onChange={(e) => setFormData({ ...formData, description_fr: e.target.value })}
            rows={3}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Prix mensuel ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.price_monthly ?? ""}
              onChange={(e) => setFormData({ ...formData, price_monthly: e.target.value ? parseFloat(e.target.value) : null })}
            />
          </div>
          <div className="space-y-2">
            <Label>Rabais (%)</Label>
            <Input
              type="number"
              value={formData.discount_percent ?? ""}
              onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value ? parseFloat(e.target.value) : null })}
            />
          </div>
          <div className="space-y-2">
            <Label>Code promo</Label>
            <Input
              value={formData.promo_code}
              onChange={(e) => setFormData({ ...formData, promo_code: e.target.value })}
            />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label>Actif</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.is_featured}
              onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
            />
            <Label>Vedette (affiché sur la page d'accueil)</Label>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(formData)} disabled={saving || !formData.name_fr}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Sauvegarder
        </Button>
      </DialogFooter>
    </>
  );
}
