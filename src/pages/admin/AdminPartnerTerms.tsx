import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Save, Eye, FileText, AlertTriangle, Users, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const AdminPartnerTerms = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState({
    version: "",
    title: "",
    content: "",
  });

  // Fetch active terms
  const { data: terms, isLoading } = useQuery({
    queryKey: ["partner-program-terms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_program_terms")
        .select("*")
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch count of partners who need to re-accept
  const { data: partnersCount } = useQuery({
    queryKey: ["partners-needing-reaccept", terms?.version],
    queryFn: async () => {
      if (!terms?.version) return 0;
      
      const { count, error } = await supabase
        .from("influencers")
        .select("*", { count: "exact", head: true })
        .or(`partner_terms_version.is.null,partner_terms_version.neq.${terms.version}`);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!terms?.version,
  });

  // Initialize form with fetched data
  useEffect(() => {
    if (terms) {
      setFormData({
        version: terms.version,
        title: terms.title,
        content: terms.content,
      });
    }
  }, [terms]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newVersion: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (newVersion) {
        // Create new version - this invalidates all partner acceptances
        // First, deactivate current version
        await supabase
          .from("partner_program_terms")
          .update({ is_active: false })
          .eq("is_active", true);

        // Insert new version
        const { error } = await supabase
          .from("partner_program_terms")
          .insert({
            version: formData.version,
            title: formData.title,
            content: formData.content,
            is_active: true,
            published_at: new Date().toISOString(),
            updated_by: user?.id,
          });

        if (error) throw error;
      } else {
        // Update current version without changing version number
        const { error } = await supabase
          .from("partner_program_terms")
          .update({
            title: formData.title,
            content: formData.content,
            updated_by: user?.id,
          })
          .eq("id", terms?.id);

        if (error) throw error;
      }
    },
    onSuccess: (_, newVersion) => {
      queryClient.invalidateQueries({ queryKey: ["partner-program-terms"] });
      queryClient.invalidateQueries({ queryKey: ["partners-needing-reaccept"] });
      
      if (newVersion) {
        toast.success("Nouvelle version publiée! Tous les partenaires devront accepter à nouveau.");
      } else {
        toast.success("Conditions mises à jour (même version)");
      }
    },
    onError: (error) => {
      console.error("Error saving terms:", error);
      toast.error("Erreur lors de la sauvegarde");
    },
  });

  const handleSaveCurrentVersion = () => {
    saveMutation.mutate(false);
  };

  const handlePublishNewVersion = () => {
    // Increment version
    const currentVersion = parseFloat(formData.version) || 1.0;
    const newVersion = (currentVersion + 0.1).toFixed(1);
    setFormData(prev => ({ ...prev, version: newVersion }));
    
    setTimeout(() => {
      saveMutation.mutate(true);
    }, 100);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Conditions du Programme Partenaires</h1>
              <p className="text-muted-foreground">
                Gérez les termes et conditions du programme de parrainage
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              <Eye className="w-4 h-4 mr-2" />
              Aperçu
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Version actuelle</p>
                  <p className="text-2xl font-bold">v{terms?.version}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Partenaires à re-valider</p>
                  <p className="text-2xl font-bold">{partnersCount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <History className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dernière mise à jour</p>
                  <p className="text-lg font-medium">
                    {terms?.updated_at 
                      ? format(new Date(terms.updated_at), "dd MMM yyyy HH:mm", { locale: fr })
                      : "N/A"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Editor */}
        <Card>
          <CardHeader>
            <CardTitle>Éditeur de conditions</CardTitle>
            <CardDescription>
              Le contenu supporte le format Markdown pour une mise en forme riche
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Version</Label>
                <Input
                  value={formData.version}
                  onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="1.0"
                />
              </div>
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Programme Partenaires Nivra"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Contenu (Markdown)</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="# Titre principal..."
                className="min-h-[500px] font-mono text-sm"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="w-4 h-4" />
                <span>Publier une nouvelle version obligera tous les partenaires à ré-accepter les conditions</span>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleSaveCurrentVersion}
                  disabled={saveMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Sauvegarder (même version)
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={saveMutation.isPending}>
                      Publier nouvelle version
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Publier une nouvelle version?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action créera une nouvelle version des conditions (v{(parseFloat(formData.version) + 0.1).toFixed(1)}).
                        <br /><br />
                        <strong className="text-foreground">
                          Tous les {partnersCount || 0} partenaires devront accepter les nouvelles conditions avant d'accéder à leur tableau de bord.
                        </strong>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handlePublishNewVersion}>
                        Confirmer et publier
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Aperçu des conditions</DialogTitle>
            </DialogHeader>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {formData.content}
              </ReactMarkdown>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminPartnerTerms;
