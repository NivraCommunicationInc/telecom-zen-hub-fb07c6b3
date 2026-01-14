import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Eye, Search } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Json } from "@/integrations/supabase/types";

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  html_content: string;
  preview_text: string | null;
  category: string | null;
  variables: Json;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: "general", label: "Général" },
  { value: "onboarding", label: "Onboarding" },
  { value: "billing", label: "Facturation" },
  { value: "service", label: "Services" },
  { value: "newsletter", label: "Newsletter" },
  { value: "promotional", label: "Promotionnel" },
];

const AVAILABLE_VARIABLES = [
  "client_name", "client_email", "client_phone",
  "invoice_number", "amount", "due_date",
  "service_type", "plan_name", "activation_date",
  "portal_link", "payment_link", "unsubscribe_link",
  "month", "year", "content"
];

const MarketingTemplates = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    subject: "",
    html_content: "",
    preview_text: "",
    category: "general",
    is_active: true
  });

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["email-templates", selectedCategory],
    queryFn: async () => {
      let query = supabase
        .from("email_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (selectedCategory !== "all") {
        query = query.eq("category", selectedCategory);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EmailTemplate[];
    }
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      // Extract variables from HTML content
      const variableMatches = data.html_content.match(/\{\{([^}]+)\}\}/g) || [];
      const variables = [...new Set(variableMatches.map(v => v.replace(/\{\{|\}\}/g, "").trim()))];

      const payload = {
        name: data.name,
        slug: data.slug,
        subject: data.subject,
        html_content: data.html_content,
        preview_text: data.preview_text || null,
        category: data.category,
        is_active: data.is_active,
        variables: variables as unknown as Json
      };

      if (data.id) {
        const { error } = await supabase
          .from("email_templates")
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("email_templates")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      queryClient.invalidateQueries({ queryKey: ["email-templates-list"] });
      queryClient.invalidateQueries({ queryKey: ["marketing-stats"] });
      setIsDialogOpen(false);
      resetForm();
      toast.success(selectedTemplate ? "Template modifié avec succès" : "Template créé avec succès");
    },
    onError: (error: Error) => {
      console.error("Error saving template:", error);
      toast.error(`Erreur: ${error.message}`);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      queryClient.invalidateQueries({ queryKey: ["email-templates-list"] });
      queryClient.invalidateQueries({ queryKey: ["marketing-stats"] });
      toast.success("Template supprimé");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      subject: "",
      html_content: "",
      preview_text: "",
      category: "general",
      is_active: true
    });
    setSelectedTemplate(null);
  };

  const openEditDialog = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      slug: template.slug,
      subject: template.subject,
      html_content: template.html_content,
      preview_text: template.preview_text || "",
      category: template.category || "general",
      is_active: template.is_active ?? true
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name.trim()) {
      toast.error("Le nom du template est requis");
      return;
    }
    if (!formData.slug.trim()) {
      toast.error("Le slug est requis");
      return;
    }
    if (!formData.subject.trim()) {
      toast.error("Le sujet de l'email est requis");
      return;
    }
    if (!formData.html_content.trim()) {
      toast.error("Le contenu HTML est requis");
      return;
    }

    saveMutation.mutate({
      ...formData,
      id: selectedTemplate?.id
    });
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[àáâãäå]/g, "a")
      .replace(/[èéêë]/g, "e")
      .replace(/[ìíîï]/g, "i")
      .replace(/[òóôõö]/g, "o")
      .replace(/[ùúûü]/g, "u")
      .replace(/[ç]/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const insertVariable = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      html_content: prev.html_content + `{{${variable}}}`
    }));
  };

  const getVariablesArray = (variables: Json): string[] => {
    if (Array.isArray(variables)) {
      return variables.filter((v): v is string => typeof v === "string");
    }
    return [];
  };

  const filteredTemplates = templates?.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedTemplate ? "Modifier le template" : "Nouveau template"}
              </DialogTitle>
              <DialogDescription>
                Créez un template email avec des variables dynamiques
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom du template *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        name: e.target.value,
                        slug: selectedTemplate ? prev.slug : generateSlug(e.target.value)
                      }));
                    }}
                    placeholder="Ex: Bienvenue nouveau client"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (identifiant unique) *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="Ex: bienvenue-nouveau-client"
                    required
                    disabled={!!selectedTemplate}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Sujet de l'email *</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Bienvenue {{client_name}}!"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Catégorie</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preview_text">Texte de prévisualisation</Label>
                <Input
                  id="preview_text"
                  value={formData.preview_text}
                  onChange={(e) => setFormData(prev => ({ ...prev, preview_text: e.target.value }))}
                  placeholder="Texte visible dans la boîte de réception..."
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="html_content">Contenu HTML *</Label>
                  <div className="flex gap-1 flex-wrap">
                    {AVAILABLE_VARIABLES.slice(0, 6).map(v => (
                      <Button
                        key={v}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-6"
                        onClick={() => insertVariable(v)}
                      >
                        {`{{${v}}}`}
                      </Button>
                    ))}
                  </div>
                </div>
                <Textarea
                  id="html_content"
                  value={formData.html_content}
                  onChange={(e) => setFormData(prev => ({ ...prev, html_content: e.target.value }))}
                  placeholder="<!DOCTYPE html><html><body><h1>Bonjour {{client_name}}</h1>...</body></html>"
                  className="font-mono text-sm min-h-[300px]"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Utilisez les variables comme {"{{client_name}}"} pour personnaliser vos emails
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Template actif</Label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))
        ) : filteredTemplates?.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <p>Aucun template trouvé</p>
            <p className="text-sm mt-2">Créez votre premier template en cliquant sur "Nouveau Template"</p>
          </div>
        ) : (
          filteredTemplates?.map((template) => {
            const variables = getVariablesArray(template.variables);
            return (
              <Card key={template.id} className="relative group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{template.name}</CardTitle>
                      <CardDescription className="line-clamp-1">
                        {template.subject}
                      </CardDescription>
                    </div>
                    <Badge variant={template.is_active ? "default" : "secondary"}>
                      {template.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">
                      {CATEGORIES.find(c => c.value === template.category)?.label || template.category || "Général"}
                    </Badge>
                    {variables.slice(0, 3).map((v) => (
                      <Badge key={v} variant="secondary" className="text-xs">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                    {variables.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{variables.length - 3}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Modifié le {format(new Date(template.updated_at), "d MMM yyyy", { locale: fr })}
                  </p>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setPreviewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(template)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("Supprimer ce template?")) {
                          deleteMutation.mutate(template.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Prévisualisation: {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted p-3 border-b text-sm">
              <strong>Sujet:</strong> {selectedTemplate?.subject}
            </div>
            <iframe
              srcDoc={selectedTemplate?.html_content}
              className="w-full h-[500px] bg-white"
              title="Email Preview"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketingTemplates;
