import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, Plus, Search, Send, Eye, Download, Clock, CheckCircle, 
  AlertTriangle, X, User, Mail, Calendar, ExternalLink, Loader2,
  FileImage, RefreshCw, Trash2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const STATUS_CONFIG = {
  pending: { label: "En attente", color: "bg-amber-500/20 text-amber-500 border-amber-500/30", icon: Clock },
  partial: { label: "Partiel", color: "bg-blue-500/20 text-blue-500 border-blue-500/30", icon: AlertTriangle },
  completed: { label: "Complété", color: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30", icon: CheckCircle },
  expired: { label: "Expiré", color: "bg-red-500/20 text-red-500 border-red-500/30", icon: X },
};

const DOCUMENT_TYPES = [
  { value: "id_front", label: "Pièce d'identité (recto)" },
  { value: "id_back", label: "Pièce d'identité (verso)" },
  { value: "proof_of_address", label: "Preuve d'adresse" },
  { value: "void_check", label: "Chèque annulé / Spécimen bancaire" },
  { value: "credit_authorization", label: "Autorisation vérification crédit" },
  { value: "contract_signed", label: "Contrat signé" },
  { value: "other", label: "Autre document" },
];

const AdminDocumentRequests = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    client_id: "",
    required_documents: [] as string[],
    request_reason: "",
    deadline_days: 7,
    ticket_id: "",
  });

  // Fetch document requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ["admin-document-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch profiles for each request
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email, full_name, client_number")
          .in("user_id", userIds);

        return data.map(req => ({
          ...req,
          profile: profiles?.find(p => p.user_id === req.user_id),
        }));
      }
      return data || [];
    },
  });

  // Fetch clients for selection
  const { data: clients } = useQuery({
    queryKey: ["clients-for-doc-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, client_number")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch tickets for linking
  const { data: tickets } = useQuery({
    queryKey: ["tickets-for-doc-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, ticket_number, subject, user_id")
        .in("status", ["open", "in_progress", "pending"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Create document request mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const token = crypto.randomUUID();
      const deadline = addDays(new Date(), data.deadline_days);

      const { data: newRequest, error } = await supabase
        .from("document_requests")
        .insert({
          user_id: data.client_id,
          ticket_id: data.ticket_id || null,
          request_token: token,
          required_documents: data.required_documents.map(d => ({
            type: d,
            label: DOCUMENT_TYPES.find(dt => dt.value === d)?.label || d,
          })),
          request_reason: data.request_reason,
          deadline: deadline.toISOString(),
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Send email notification
      const client = clients?.find(c => c.user_id === data.client_id);
      if (client?.email) {
        await supabase.functions.invoke("send-email-previews", {
          body: {
            to: client.email,
            templateType: "document_request",
            templateData: {
              clientName: client.full_name || client.email,
              documentsRequired: data.required_documents.map(d => 
                DOCUMENT_TYPES.find(dt => dt.value === d)?.label || d
              ),
              reason: data.request_reason,
              deadline: format(deadline, "d MMMM yyyy", { locale: fr }),
              uploadUrl: `${window.location.origin}/portal/upload?token=${token}`,
            },
          },
        });
      }

      return newRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-document-requests"] });
      toast.success("Demande de documents créée et envoyée au client");
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Delete request mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("document_requests")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-document-requests"] });
      toast.success("Demande supprimée");
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Send reminder mutation
  const sendReminderMutation = useMutation({
    mutationFn: async (request: any) => {
      const { error } = await supabase.functions.invoke("send-email-previews", {
        body: {
          to: request.profile?.email,
          templateType: "document_reminder",
          templateData: {
            clientName: request.profile?.full_name || request.profile?.email,
            documentsRequired: (request.required_documents || []).map((d: any) => d.label || d.type),
            reason: request.request_reason,
            deadline: format(new Date(request.deadline), "d MMMM yyyy", { locale: fr }),
            uploadUrl: `${window.location.origin}/portal/upload?token=${request.request_token}`,
          },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rappel envoyé au client");
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      client_id: "",
      required_documents: [],
      request_reason: "",
      deadline_days: 7,
      ticket_id: "",
    });
  };

  const toggleDocument = (docType: string) => {
    setFormData(prev => ({
      ...prev,
      required_documents: prev.required_documents.includes(docType)
        ? prev.required_documents.filter(d => d !== docType)
        : [...prev.required_documents, docType],
    }));
  };

  const openViewDialog = async (request: any) => {
    setSelectedRequest(request);
    
    // Load uploaded files
    try {
      const { data: files } = await supabase.storage
        .from("client-documents")
        .list(`${request.user_id}/${request.id}`);
      
      setSelectedRequest((prev: any) => ({
        ...prev,
        uploadedFiles: files || [],
      }));
    } catch (err) {
      console.error("Error loading files:", err);
    }
    
    setViewDialogOpen(true);
  };

  const downloadFile = async (request: any, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("client-documents")
        .download(`${request.user_id}/${request.id}/${fileName}`);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error("Erreur lors du téléchargement");
    }
  };

  // Filtered requests
  const filteredRequests = requests?.filter((req: any) => {
    const matchesSearch = 
      req.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.profile?.client_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || req.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  // Stats
  const stats = {
    total: requests?.length || 0,
    pending: requests?.filter((r: any) => r.status === "pending").length || 0,
    partial: requests?.filter((r: any) => r.status === "partial").length || 0,
    completed: requests?.filter((r: any) => r.status === "completed").length || 0,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Demandes de Documents
            </h1>
            <p className="text-muted-foreground">
              Créer et gérer les demandes de documents clients
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle demande
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-amber-500">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">En attente</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-500">{stats.partial}</div>
              <div className="text-sm text-muted-foreground">Partiel</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-emerald-500">{stats.completed}</div>
              <div className="text-sm text-muted-foreground">Complété</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par email, nom, numéro client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="partial">Partiel</SelectItem>
                  <SelectItem value="completed">Complété</SelectItem>
                  <SelectItem value="expired">Expiré</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Requests Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucune demande de documents</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Documents requis</TableHead>
                    <TableHead>Raison</TableHead>
                    <TableHead>Date limite</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((req: any) => {
                    const StatusIcon = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG]?.icon || Clock;
                    const statusConfig = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG];
                    const isExpired = req.deadline && new Date(req.deadline) < new Date() && req.status !== "completed";
                    
                    return (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">
                                {req.profile?.full_name || "—"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {req.profile?.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(req.required_documents || []).slice(0, 2).map((doc: any, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {doc.label || doc.type}
                              </Badge>
                            ))}
                            {(req.required_documents || []).length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{(req.required_documents || []).length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm line-clamp-1">
                            {req.request_reason || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {req.deadline ? (
                            <div className={isExpired ? "text-destructive" : ""}>
                              {format(new Date(req.deadline), "d MMM yyyy", { locale: fr })}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig?.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig?.label || req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openViewDialog(req)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {req.status !== "completed" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => sendReminderMutation.mutate(req)}
                                disabled={sendReminderMutation.isPending}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMutation.mutate(req.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nouvelle demande de documents</DialogTitle>
              <DialogDescription>
                Sélectionnez un client et les documents requis. Un email sera envoyé automatiquement.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Client Selection */}
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={formData.client_id} onValueChange={(v) => setFormData(prev => ({ ...prev, client_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-[200px]">
                      {clients?.map((client: any) => (
                        <SelectItem key={client.user_id} value={client.user_id}>
                          <div className="flex items-center gap-2">
                            <span>{client.full_name || client.email}</span>
                            {client.client_number && (
                              <Badge variant="outline" className="text-xs">
                                {client.client_number}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>

              {/* Documents Required */}
              <div className="space-y-2">
                <Label>Documents requis *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {DOCUMENT_TYPES.map((doc) => (
                    <button
                      key={doc.value}
                      type="button"
                      onClick={() => toggleDocument(doc.value)}
                      className={`p-3 text-left rounded-lg border transition-colors ${
                        formData.required_documents.includes(doc.value)
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FileImage className={`h-4 w-4 ${
                          formData.required_documents.includes(doc.value)
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`} />
                        <span className="text-sm">{doc.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Raison de la demande</Label>
                <Textarea
                  placeholder="Ex: Vérification d'identité requise pour activation..."
                  value={formData.request_reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, request_reason: e.target.value }))}
                  rows={2}
                />
              </div>

              {/* Deadline */}
              <div className="space-y-2">
                <Label>Délai (jours)</Label>
                <Select 
                  value={String(formData.deadline_days)} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, deadline_days: parseInt(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 jours</SelectItem>
                    <SelectItem value="7">7 jours</SelectItem>
                    <SelectItem value="14">14 jours</SelectItem>
                    <SelectItem value="30">30 jours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Link to Ticket (optional) */}
              <div className="space-y-2">
                <Label>Lier à un ticket (optionnel)</Label>
                <Select 
                  value={formData.ticket_id} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, ticket_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun ticket" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucun ticket</SelectItem>
                    {tickets?.map((ticket: any) => (
                      <SelectItem key={ticket.id} value={ticket.id}>
                        {ticket.ticket_number} - {ticket.subject?.substring(0, 40)}...
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => createMutation.mutate(formData)}
                disabled={!formData.client_id || formData.required_documents.length === 0 || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Envoyer la demande
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Détails de la demande</DialogTitle>
            </DialogHeader>
            
            {selectedRequest && (
              <div className="space-y-4 py-4">
                {/* Client Info */}
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{selectedRequest.profile?.full_name}</div>
                    <div className="text-sm text-muted-foreground">{selectedRequest.profile?.email}</div>
                  </div>
                </div>

                {/* Status & Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Statut</Label>
                    <Badge className={STATUS_CONFIG[selectedRequest.status as keyof typeof STATUS_CONFIG]?.color}>
                      {STATUS_CONFIG[selectedRequest.status as keyof typeof STATUS_CONFIG]?.label}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Date limite</Label>
                    <div>
                      {selectedRequest.deadline 
                        ? format(new Date(selectedRequest.deadline), "d MMMM yyyy", { locale: fr })
                        : "—"}
                    </div>
                  </div>
                </div>

                {/* Required Documents */}
                <div>
                  <Label className="text-muted-foreground">Documents demandés</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {(selectedRequest.required_documents || []).map((doc: any, i: number) => (
                      <Badge key={i} variant="outline">
                        {doc.label || doc.type}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Reason */}
                {selectedRequest.request_reason && (
                  <div>
                    <Label className="text-muted-foreground">Raison</Label>
                    <p className="text-sm">{selectedRequest.request_reason}</p>
                  </div>
                )}

                {/* Uploaded Files */}
                <div>
                  <Label className="text-muted-foreground">Documents téléversés</Label>
                  {selectedRequest.uploadedFiles?.length > 0 ? (
                    <div className="space-y-2 mt-2">
                      {selectedRequest.uploadedFiles.map((file: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-muted rounded">
                          <div className="flex items-center gap-2">
                            <FileImage className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{file.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadFile(selectedRequest, file.name)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Aucun document téléversé</p>
                  )}
                </div>

                {/* Upload Link */}
                <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg">
                  <ExternalLink className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Lien de téléversement</div>
                    <div className="text-xs text-muted-foreground break-all">
                      {`${window.location.origin}/portal/upload?token=${selectedRequest.request_token}`}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/portal/upload?token=${selectedRequest.request_token}`
                      );
                      toast.success("Lien copié");
                    }}
                  >
                    Copier
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                Fermer
              </Button>
              {selectedRequest?.status !== "completed" && (
                <Button onClick={() => sendReminderMutation.mutate(selectedRequest)}>
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer un rappel
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminDocumentRequests;
