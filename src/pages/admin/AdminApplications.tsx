import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Users,
  Eye,
  FileText,
  Download,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  Loader2,
} from "lucide-react";

const statusColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-500",
  reviewing: "bg-amber-500/20 text-amber-500",
  interview: "bg-purple-500/20 text-purple-500",
  accepted: "bg-emerald-500/20 text-emerald-500",
  rejected: "bg-red-500/20 text-red-500",
};

const statusLabels: Record<string, string> = {
  new: "Nouveau",
  reviewing: "En révision",
  interview: "Entrevue",
  accepted: "Accepté",
  rejected: "Refusé",
};

const AdminApplications = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: applications, isLoading } = useQuery({
    queryKey: ["admin-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_applications")
        .select("*, jobs(title)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("job_applications")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      toast({ title: "Statut mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const handleDownloadCV = async (app: any) => {
    if (!app.cv_path) {
      toast({ title: "Aucun CV téléversé", variant: "destructive" });
      return;
    }

    const { data, error } = await supabase.storage
      .from("job-applications")
      .download(app.cv_path);

    if (error) {
      toast({ title: "Erreur lors du téléchargement", variant: "destructive" });
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = app.cv_filename || "cv.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleViewDetails = (app: any) => {
    setSelectedApp(app);
    setDetailsOpen(true);
  };

  const filteredApps = applications?.filter((app: any) => {
    const matchesTab = activeTab === "all" || app.status === activeTab;
    const matchesSearch =
      !searchQuery ||
      app.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.position.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const stats = {
    new: applications?.filter((a: any) => a.status === "new").length || 0,
    reviewing: applications?.filter((a: any) => a.status === "reviewing").length || 0,
    interview: applications?.filter((a: any) => a.status === "interview").length || 0,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Candidatures
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérer les candidatures reçues
            </p>
          </div>
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nouvelles</p>
                <p className="text-2xl font-bold text-foreground">{stats.new}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En révision</p>
                <p className="text-2xl font-bold text-foreground">{stats.reviewing}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entrevues</p>
                <p className="text-2xl font-bold text-foreground">{stats.interview}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                Candidatures
              </CardTitle>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">Toutes</TabsTrigger>
                  <TabsTrigger value="new">Nouvelles</TabsTrigger>
                  <TabsTrigger value="reviewing">En révision</TabsTrigger>
                  <TabsTrigger value="interview">Entrevue</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredApps && filteredApps.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Candidat
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Poste
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Date
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        CV
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Statut
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApps.map((app: any) => (
                      <tr
                        key={app.id}
                        className="border-b border-border/50 hover:bg-accent/50"
                      >
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-foreground">
                            {app.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{app.email}</p>
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">
                          {app.position}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {format(new Date(app.created_at), "d MMM yyyy", {
                            locale: fr,
                          })}
                        </td>
                        <td className="py-3 px-4">
                          {app.cv_path ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownloadCV(app)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={statusColors[app.status] || "bg-muted"}>
                            {statusLabels[app.status] || app.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetails(app)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune candidature</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Détails de la candidature</DialogTitle>
            </DialogHeader>
            {selectedApp && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Nom</Label>
                    <p className="font-medium">{selectedApp.full_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Poste</Label>
                    <p className="font-medium">{selectedApp.position}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a
                      href={`mailto:${selectedApp.email}`}
                      className="text-cyan-400 hover:underline"
                    >
                      {selectedApp.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a
                      href={`tel:${selectedApp.phone}`}
                      className="text-cyan-400 hover:underline"
                    >
                      {selectedApp.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Soumis le{" "}
                    {format(new Date(selectedApp.created_at), "d MMMM yyyy à HH:mm", {
                      locale: fr,
                    })}
                  </span>
                </div>

                {selectedApp.message && (
                  <div>
                    <Label className="text-muted-foreground">Message</Label>
                    <div className="mt-1 p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                      {selectedApp.message}
                    </div>
                  </div>
                )}

                {selectedApp.cv_path && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleDownloadCV(selectedApp)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger le CV ({selectedApp.cv_filename})
                  </Button>
                )}

                <div>
                  <Label>Statut</Label>
                  <Select
                    value={selectedApp.status}
                    onValueChange={(value) => {
                      updateMutation.mutate({ id: selectedApp.id, status: value });
                      setSelectedApp({ ...selectedApp, status: value });
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Nouveau</SelectItem>
                      <SelectItem value="reviewing">En révision</SelectItem>
                      <SelectItem value="interview">Entrevue</SelectItem>
                      <SelectItem value="accepted">Accepté</SelectItem>
                      <SelectItem value="rejected">Refusé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" asChild>
                    <a href={`mailto:${selectedApp.email}`}>
                      <Mail className="w-4 h-4 mr-2" />
                      Envoyer un courriel
                    </a>
                  </Button>
                  <Button variant="outline" className="flex-1" asChild>
                    <a href={`tel:${selectedApp.phone}`}>
                      <Phone className="w-4 h-4 mr-2" />
                      Appeler
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminApplications;