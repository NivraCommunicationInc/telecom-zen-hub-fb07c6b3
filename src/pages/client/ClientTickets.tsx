import { useState, useRef } from "react";
import ClientLayout from "@/components/client/ClientLayout";
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
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Plus, Send, ArrowLeft, Upload, FileText, CheckCircle, Clock, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const ClientTickets = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [newTicket, setNewTicket] = useState({ subject: "", description: "", priority: "normal" });
  const [replyContent, setReplyContent] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["client-tickets-all", user?.id, user?.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: replies } = useQuery({
    queryKey: ["ticket-replies", selectedTicket?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_replies")
        .select("*")
        .eq("ticket_id", selectedTicket?.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedTicket?.id,
  });

  const createTicketMutation = useMutation({
    mutationFn: async (ticket: typeof newTicket) => {
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user?.id,
          subject: ticket.subject,
          description: ticket.description,
          priority: ticket.priority,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-tickets-all"] });
      toast({ title: "Ticket créé avec succès" });
      setCreateDialogOpen(false);
      setNewTicket({ subject: "", description: "", priority: "normal" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création du ticket", variant: "destructive" });
    },
  });

  const addReplyMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data, error } = await supabase
        .from("ticket_replies")
        .insert({
          ticket_id: selectedTicket?.id,
          user_id: user?.id,
          content,
          is_admin: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-replies"] });
      toast({ title: "Réponse envoyée" });
      setReplyContent("");
    },
    onError: () => {
      toast({ title: "Erreur lors de l'envoi", variant: "destructive" });
    },
  });

  // Handle ID file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user?.id || !selectedTicket) return;

    setUploadingFiles(true);

    try {
      const uploadedFiles: any[] = [];
      
      for (const file of Array.from(files)) {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
          toast({ 
            title: "Type de fichier non supporté", 
            description: "Formats acceptés: JPG, PNG, HEIC, PDF", 
            variant: "destructive" 
          });
          continue;
        }

        // Validate file size (15MB max)
        if (file.size > 15 * 1024 * 1024) {
          toast({ 
            title: "Fichier trop volumineux", 
            description: "Taille maximale: 15 Mo", 
            variant: "destructive" 
          });
          continue;
        }

        // Upload to storage
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `${user.id}/${selectedTicket.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from("ticket-id-uploads")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("ticket-id-uploads")
          .getPublicUrl(filePath);

        uploadedFiles.push({
          url: filePath, // Store the path, not public URL (bucket is private)
          filename: file.name,
          mime: file.type,
          size: file.size,
          uploaded_at: new Date().toISOString(),
          uploaded_by: user.id,
        });
      }

      if (uploadedFiles.length > 0) {
        // Update ticket with new files
        const existingFiles = (selectedTicket.id_files as any[]) || [];
        const { error: updateError } = await supabase
          .from("support_tickets")
          .update({ 
            id_files: [...existingFiles, ...uploadedFiles],
            id_verification_status: 'received',
            updated_at: new Date().toISOString()
          })
          .eq("id", selectedTicket.id);

        if (updateError) throw updateError;

        // Update local state
        setSelectedTicket((prev: any) => ({
          ...prev,
          id_files: [...existingFiles, ...uploadedFiles],
          id_verification_status: 'received',
        }));

        queryClient.invalidateQueries({ queryKey: ["client-tickets-all"] });
        toast({ title: "Fichier(s) téléversé(s) avec succès" });
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ 
        title: "Erreur lors du téléversement", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const statusColors: Record<string, string> = {
    open: "bg-cyan-500/20 text-cyan-500",
    pending: "bg-slate-500/20 text-slate-400",
    in_progress: "bg-amber-500/20 text-amber-500",
    resolved: "bg-emerald-500/20 text-emerald-500",
    closed: "bg-muted text-muted-foreground",
  };

  const statusLabels: Record<string, string> = {
    open: "Ouvert",
    pending: "En attente",
    in_progress: "En cours",
    resolved: "Résolu",
    closed: "Fermé",
  };

  const priorityLabels: Record<string, string> = {
    low: "Faible",
    normal: "Normal",
    high: "Urgent",
  };

  const idVerificationStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
    not_received: { label: "Non reçu", color: "bg-slate-500/20 text-slate-400", icon: Clock },
    received: { label: "Reçu", color: "bg-amber-500/20 text-amber-500", icon: FileText },
    verified: { label: "Vérifié", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle },
    rejected: { label: "Refusé", color: "bg-red-500/20 text-red-500", icon: XCircle },
  };

  if (selectedTicket) {
    const idFiles = (selectedTicket.id_files as any[]) || [];
    const idStatus = idVerificationStatusConfig[selectedTicket.id_verification_status || 'not_received'];
    const IdStatusIcon = idStatus?.icon || Clock;

    return (
      <ClientLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => setSelectedTicket(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux tickets
          </Button>

          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedTicket.subject}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedTicket.ticket_number && `#${selectedTicket.ticket_number} • `}
                    Créé le {format(new Date(selectedTicket.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                </div>
                <Badge className={statusColors[selectedTicket.status] || "bg-muted"}>
                  {statusLabels[selectedTicket.status] || selectedTicket.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Original Description */}
              <div className="p-4 bg-accent/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Description initiale</p>
                <p className="text-foreground whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* ID Upload Section - Only show if ticket requires ID upload */}
              {selectedTicket.requires_id_upload && (
                <Card className="bg-accent/30 border-amber-500/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-amber-500" />
                        Documents d'identité requis
                      </div>
                      <Badge className={idStatus?.color}>
                        <IdStatusIcon className="w-3 h-3 mr-1" />
                        {idStatus?.label}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Veuillez téléverser une copie de votre pièce d'identité (recto/verso si nécessaire).
                    </p>

                    {/* Uploaded files list */}
                    {idFiles.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Fichiers téléversés:</Label>
                        {idFiles.map((file: any, index: number) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-background rounded border">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm flex-1 truncate">{file.filename}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(file.uploaded_at), "d MMM HH:mm", { locale: fr })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload area - only show if not verified/rejected */}
                    {selectedTicket.id_verification_status !== 'verified' && 
                     selectedTicket.id_verification_status !== 'rejected' && (
                      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".jpg,.jpeg,.png,.heic,.pdf"
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                          id="id-file-upload"
                        />
                        <label htmlFor="id-file-upload" className="cursor-pointer">
                          {uploadingFiles ? (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-8 h-8 animate-spin text-primary" />
                              <p className="text-sm text-muted-foreground">Téléversement en cours...</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Upload className="w-8 h-8 text-muted-foreground" />
                              <p className="text-sm font-medium">Cliquez pour téléverser</p>
                              <p className="text-xs text-muted-foreground">
                                JPG, PNG, HEIC, PDF • Max 15 Mo par fichier
                              </p>
                            </div>
                          )}
                        </label>
                      </div>
                    )}

                    {/* Status messages */}
                    {selectedTicket.id_verification_status === 'verified' && (
                      <div className="flex items-center gap-2 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                        <p className="text-sm text-emerald-500">Votre identité a été vérifiée avec succès.</p>
                      </div>
                    )}
                    {selectedTicket.id_verification_status === 'rejected' && (
                      <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                        <XCircle className="w-5 h-5 text-red-500" />
                        <p className="text-sm text-red-500">Documents refusés. Veuillez contacter le support.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Replies */}
              <div className="space-y-4">
                {replies?.map((reply: any) => (
                  <div
                    key={reply.id}
                    className={`p-4 rounded-lg ${
                      reply.is_admin ? "bg-cyan-500/10 ml-4" : "bg-accent/50 mr-4"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">
                        {reply.is_admin ? "Support Nivra" : "Vous"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(reply.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                      </span>
                    </div>
                    <p className="text-foreground whitespace-pre-wrap">{reply.content}</p>
                  </div>
                ))}
              </div>

              {/* Reply Form */}
              {selectedTicket.status !== "closed" && selectedTicket.status !== "resolved" && (
                <div className="flex gap-3">
                  <Textarea
                    placeholder="Écrivez votre réponse..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="hero"
                    onClick={() => addReplyMutation.mutate(replyContent)}
                    disabled={!replyContent.trim() || addReplyMutation.isPending}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Support</h1>
            <p className="text-muted-foreground mt-1">Gérez vos demandes de support</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer un ticket de support</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Sujet</Label>
                  <Input
                    placeholder="Décrivez brièvement votre problème"
                    value={newTicket.subject}
                    onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Priorité</Label>
                  <Select
                    value={newTicket.priority}
                    onValueChange={(v) => setNewTicket({ ...newTicket, priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Faible</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Décrivez votre problème en détail..."
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                    rows={5}
                  />
                </div>
                <Button
                  className="w-full"
                  variant="hero"
                  onClick={() => createTicketMutation.mutate(newTicket)}
                  disabled={!newTicket.subject || !newTicket.description || createTicketMutation.isPending}
                >
                  Créer le ticket
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
              Mes tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : tickets && tickets.length > 0 ? (
              <div className="space-y-4">
                {tickets.map((ticket: any) => (
                  <div
                    key={ticket.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-accent/50 rounded-lg cursor-pointer hover:bg-accent/70 transition-colors"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className="font-medium text-foreground">{ticket.subject}</h3>
                        <Badge className={statusColors[ticket.status] || "bg-muted"}>
                          {statusLabels[ticket.status] || ticket.status}
                        </Badge>
                        {ticket.requires_id_upload && (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-500">
                            <FileText className="w-3 h-3 mr-1" />
                            ID requis
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {ticket.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ticket.ticket_number && `#${ticket.ticket_number} • `}
                        {format(new Date(ticket.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                      </p>
                    </div>
                    <Badge variant="outline">{priorityLabels[ticket.priority] || ticket.priority}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Aucun ticket de support</p>
                <Button variant="hero" onClick={() => setCreateDialogOpen(true)}>
                  Créer un ticket
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ClientTickets;
