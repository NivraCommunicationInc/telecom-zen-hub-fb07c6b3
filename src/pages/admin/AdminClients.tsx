import { useState, useRef } from "react";
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
import { Users, Plus, Search, Eye, Upload, FileText, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";

const AdminClients = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [newClient, setNewClient] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, user_roles(role)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: clientDocuments } = useQuery({
    queryKey: ["client-documents", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("client_documents")
        .select("*")
        .eq("user_id", selectedClient.user_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const filteredClients = clients?.filter((client: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      client.full_name?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.phone?.includes(query)
    );
  });

  const createClientMutation = useMutation({
    mutationFn: async (client: typeof newClient) => {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: client.email,
        password: client.password,
        options: {
          data: {
            full_name: client.full_name,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ phone: client.phone })
          .eq("user_id", authData.user.id);

        if (profileError) throw profileError;
      }

      return authData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      logActivity("create", "client", undefined, { email: newClient.email });
      toast({ title: "Client créé avec succès" });
      setCreateDialogOpen(false);
      setNewClient({ email: "", password: "", full_name: "", phone: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur lors de la création",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async (client: any) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: client.full_name,
          phone: client.phone,
          internal_notes: client.internal_notes,
          sector_tags: client.sector_tags,
          employer_discount: client.employer_discount,
        })
        .eq("id", client.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      logActivity("update", "client", selectedClient?.id);
      toast({ title: "Client mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedClient?.user_id) throw new Error("No client selected");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // For now, store as a placeholder URL since we don't have storage bucket set up
      // In production, you would upload to Supabase Storage
      const documentUrl = `document://${file.name}`;

      const { error } = await supabase.from("client_documents").insert({
        user_id: selectedClient.user_id,
        uploaded_by: user.id,
        document_name: file.name,
        document_type: file.type.includes("pdf") ? "contract" : "general",
        document_url: documentUrl,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-documents"] });
      logActivity("upload", "document", selectedClient?.id);
      toast({ title: "Document ajouté" });
    },
    onError: () => {
      toast({ title: "Erreur lors de l'upload", variant: "destructive" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from("client_documents").delete().eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-documents"] });
      toast({ title: "Document supprimé" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  const handleViewDetails = (client: any) => {
    setSelectedClient({
      ...client,
      sector_tags: client.sector_tags || [],
    });
    setDetailsDialogOpen(true);
  };

  const handleOpenDocuments = (client: any) => {
    setSelectedClient(client);
    setDocumentsDialogOpen(true);
  };

  const handleAddTag = (tag: string) => {
    if (!tag.trim()) return;
    const currentTags = selectedClient.sector_tags || [];
    if (!currentTags.includes(tag)) {
      setSelectedClient({
        ...selectedClient,
        sector_tags: [...currentTags, tag],
      });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedClient({
      ...selectedClient,
      sector_tags: selectedClient.sector_tags.filter((t: string) => t !== tagToRemove),
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadDocumentMutation.mutate(file);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Clients</h1>
            <p className="text-muted-foreground mt-1">Gérer tous les profils clients</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Créer un client</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Nom complet</Label>
                  <Input
                    value={newClient.full_name}
                    onChange={(e) => setNewClient({ ...newClient, full_name: e.target.value })}
                    placeholder="Jean Dupont"
                  />
                </div>
                <div>
                  <Label>Courriel</Label>
                  <Input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="jean@exemple.com"
                  />
                </div>
                <div>
                  <Label>Mot de passe temporaire</Label>
                  <Input
                    type="password"
                    value={newClient.password}
                    onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <Input
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    placeholder="514-555-1234"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createClientMutation.mutate(newClient)}
                  disabled={!newClient.email || !newClient.password || !newClient.full_name}
                >
                  Créer le client
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, courriel ou téléphone..."
            className="pl-10"
          />
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Liste des clients ({filteredClients?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredClients && filteredClients.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nom</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Courriel</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Téléphone</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Secteur</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Rôle</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Inscrit le</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client: any) => (
                      <tr key={client.id} className="border-b border-border/50 hover:bg-accent/50">
                        <td className="py-3 px-4 text-sm text-foreground font-medium">
                          {client.full_name || "—"}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">{client.email || "—"}</td>
                        <td className="py-3 px-4 text-sm text-foreground">{client.phone || "—"}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {client.sector_tags?.slice(0, 2).map((tag: string) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {client.sector_tags?.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{client.sector_tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              client.user_roles?.[0]?.role === "admin"
                                ? "bg-cyan-500/20 text-cyan-400"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {client.user_roles?.[0]?.role === "admin" ? "Admin" : "Client"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {format(new Date(client.created_at), "d MMM yyyy", { locale: fr })}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewDetails(client)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleOpenDocuments(client)}>
                              <FileText className="w-4 h-4" />
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
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "Aucun client trouvé" : "Aucun client pour le moment"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Détails du client</DialogTitle>
            </DialogHeader>
            {selectedClient && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nom complet</Label>
                    <Input
                      value={selectedClient.full_name || ""}
                      onChange={(e) =>
                        setSelectedClient({ ...selectedClient, full_name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Téléphone</Label>
                    <Input
                      value={selectedClient.phone || ""}
                      onChange={(e) =>
                        setSelectedClient({ ...selectedClient, phone: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Courriel</Label>
                  <Input value={selectedClient.email || ""} disabled className="bg-muted" />
                </div>
                <div>
                  <Label>Rabais employeur</Label>
                  <Input
                    value={selectedClient.employer_discount || ""}
                    onChange={(e) =>
                      setSelectedClient({ ...selectedClient, employer_discount: e.target.value })
                    }
                    placeholder="Ex: 15% Entreprise XYZ"
                  />
                </div>
                <div>
                  <Label>Tags secteur</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedClient.sector_tags?.map((tag: string) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                  <Input
                    placeholder="Ajouter un tag (Entrée pour confirmer)"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddTag(e.currentTarget.value);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                </div>
                <div>
                  <Label>Notes internes</Label>
                  <Textarea
                    value={selectedClient.internal_notes || ""}
                    onChange={(e) =>
                      setSelectedClient({ ...selectedClient, internal_notes: e.target.value })
                    }
                    placeholder="Notes privées..."
                    rows={4}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      updateClientMutation.mutate(selectedClient);
                      setDetailsDialogOpen(false);
                    }}
                  >
                    Enregistrer
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setDetailsDialogOpen(false);
                    handleOpenDocuments(selectedClient);
                  }}>
                    <FileText className="w-4 h-4 mr-2" />
                    Documents
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Documents Dialog */}
        <Dialog open={documentsDialogOpen} onOpenChange={setDocumentsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Documents - {selectedClient?.full_name || selectedClient?.email}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Téléverser un document
                </Button>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {clientDocuments && clientDocuments.length > 0 ? (
                  clientDocuments.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-cyan-400" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{doc.document_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(doc.created_at), "d MMM yyyy", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Supprimer ce document ?")) {
                            deleteDocumentMutation.mutate(doc.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Aucun document</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminClients;
