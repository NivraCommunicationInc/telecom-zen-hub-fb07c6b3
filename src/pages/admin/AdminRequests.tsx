import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { MessageSquare, Eye, Send, Flag, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";

const statusColors: Record<string, string> = {
  new: "bg-cyan-500/20 text-cyan-400",
  open: "bg-cyan-500/20 text-cyan-400",
  in_progress: "bg-amber-500/20 text-amber-500",
  resolved: "bg-emerald-500/20 text-emerald-500",
  closed: "bg-muted text-muted-foreground",
  contacted: "bg-amber-500/20 text-amber-500",
  converted: "bg-emerald-500/20 text-emerald-500",
};

const statusLabels: Record<string, string> = {
  new: "Nouveau",
  open: "Ouvert",
  in_progress: "En cours",
  resolved: "Résolu",
  closed: "Fermé",
  contacted: "Contacté",
  converted: "Converti",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-500/20 text-blue-500",
  high: "bg-orange-500/20 text-orange-500",
  urgent: "bg-red-500/20 text-red-500",
};

const priorityLabels: Record<string, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

const AdminRequests = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [replyContent, setReplyContent] = useState("");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["admin-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch replies for the selected request
  const { data: replies, refetch: refetchReplies } = useQuery({
    queryKey: ["request-replies", selectedRequest?.id],
    queryFn: async () => {
      if (!selectedRequest?.id) return [];
      const { data, error } = await supabase
        .from("request_replies")
        .select("*")
        .eq("request_id", selectedRequest.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedRequest?.id,
  });

  const updateRequestMutation = useMutation({
    mutationFn: async (request: any) => {
      const { error } = await supabase
        .from("contact_requests")
        .update({
          status: request.status,
          priority: request.priority,
          internal_notes: request.internal_notes,
        })
        .eq("id", request.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
      logActivity("update", "request", selectedRequest?.id, { status: selectedRequest?.status });
      toast({ title: "Demande mise à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const sendReplyMutation = useMutation({
    mutationFn: async ({ requestId, content }: { requestId: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Save reply to request_replies table
      const { error } = await supabase.from("request_replies").insert({
        request_id: requestId,
        user_id: user.id,
        content: content,
        is_admin: true,
      });

      if (error) throw error;

      // Update request status to in_progress if it was new
      const request = requests?.find((r: any) => r.id === requestId);
      if (request && (request.status === "new" || request.status === "open")) {
        await supabase
          .from("contact_requests")
          .update({ status: "in_progress" })
          .eq("id", requestId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
      refetchReplies();
      toast({ title: "Réponse envoyée" });
      setReplyContent("");
    },
    onError: () => {
      toast({ title: "Erreur lors de l'envoi", variant: "destructive" });
    },
  });

  const handleViewDetails = (request: any) => {
    setSelectedRequest({ ...request });
    setReplyContent("");
    setDetailsDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Demandes de consultation</h1>
          <p className="text-muted-foreground mt-1">Gérer les demandes de consultation entrantes</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {["new", "in_progress", "resolved", "closed"].map((status) => (
            <Card key={status} className="bg-card border-border">
              <CardContent className="p-4">
                <Badge className={statusColors[status]}>{statusLabels[status]}</Badge>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {requests?.filter((r: any) => r.status === status).length || 0}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
              Liste des demandes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : requests && requests.length > 0 ? (
              <div className="space-y-4">
                {requests.map((request: any) => (
                  <div
                    key={request.id}
                    className="p-4 rounded-lg border border-border hover:border-cyan-400/30 transition-colors cursor-pointer"
                    onClick={() => handleViewDetails(request)}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="font-medium text-foreground">{request.name}</h3>
                          <Badge className={statusColors[request.status] || "bg-muted"}>
                            {statusLabels[request.status] || request.status}
                          </Badge>
                          {request.priority && request.priority !== "normal" && (
                            <Badge className={priorityColors[request.priority]}>
                              <Flag className="w-3 h-3 mr-1" />
                              {priorityLabels[request.priority]}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {request.email} • {request.phone}
                        </p>
                        {request.notes && (
                          <p className="text-sm text-foreground mt-2 bg-muted p-2 rounded line-clamp-2">
                            {request.notes}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Reçu le {format(new Date(request.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => handleViewDetails(request)}>
                          <Eye className="w-4 h-4 mr-1" />
                          Voir
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune demande pour le moment</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Details Dialog with Conversation */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Détails de la demande</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Client Info Section */}
                <div className="space-y-4 pb-4 border-b border-border">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nom</Label>
                      <Input value={selectedRequest.name} disabled className="bg-muted" />
                    </div>
                    <div>
                      <Label>Téléphone</Label>
                      <Input value={selectedRequest.phone} disabled className="bg-muted" />
                    </div>
                  </div>
                  <div>
                    <Label>Courriel</Label>
                    <Input value={selectedRequest.email} disabled className="bg-muted" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Statut</Label>
                      <Select
                        value={selectedRequest.status}
                        onValueChange={(v) => setSelectedRequest({ ...selectedRequest, status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Nouveau</SelectItem>
                          <SelectItem value="open">Ouvert</SelectItem>
                          <SelectItem value="in_progress">En cours</SelectItem>
                          <SelectItem value="resolved">Résolu</SelectItem>
                          <SelectItem value="closed">Fermé</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Priorité</Label>
                      <Select
                        value={selectedRequest.priority || "normal"}
                        onValueChange={(v) => setSelectedRequest({ ...selectedRequest, priority: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Basse</SelectItem>
                          <SelectItem value="normal">Normale</SelectItem>
                          <SelectItem value="high">Haute</SelectItem>
                          <SelectItem value="urgent">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Notes internes</Label>
                    <Textarea
                      value={selectedRequest.internal_notes || ""}
                      onChange={(e) =>
                        setSelectedRequest({ ...selectedRequest, internal_notes: e.target.value })
                      }
                      placeholder="Notes privées pour l'équipe..."
                      rows={2}
                    />
                  </div>
                  <Button
                    onClick={() => {
                      updateRequestMutation.mutate(selectedRequest);
                    }}
                    disabled={updateRequestMutation.isPending}
                  >
                    Enregistrer les modifications
                  </Button>
                </div>

                {/* Conversation Section */}
                <div className="flex-1 flex flex-col overflow-hidden pt-4">
                  <Label className="mb-2">Historique de la conversation</Label>
                  <ScrollArea className="flex-1 max-h-[300px] border border-border rounded-lg p-4 mb-4">
                    <div className="space-y-4">
                      {/* Original message from client */}
                      {selectedRequest.notes && (
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{selectedRequest.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(selectedRequest.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                              </span>
                            </div>
                            <div className="bg-muted rounded-lg p-3 text-sm">
                              {selectedRequest.notes}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Replies */}
                      {replies?.map((reply: any) => (
                        <div key={reply.id} className={`flex gap-3 ${reply.is_admin ? "flex-row-reverse" : ""}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            reply.is_admin ? "bg-cyan-500/20" : "bg-muted"
                          }`}>
                            <User className={`w-4 h-4 ${reply.is_admin ? "text-cyan-400" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1">
                            <div className={`flex items-center gap-2 mb-1 ${reply.is_admin ? "justify-end" : ""}`}>
                              <span className="font-medium text-sm">
                                {reply.is_admin ? "Admin" : selectedRequest.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(reply.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                              </span>
                            </div>
                            <div className={`rounded-lg p-3 text-sm ${
                              reply.is_admin 
                                ? "bg-cyan-500/10 border border-cyan-500/20" 
                                : "bg-muted"
                            }`}>
                              {reply.content}
                            </div>
                          </div>
                        </div>
                      ))}

                      {!selectedRequest.notes && (!replies || replies.length === 0) && (
                        <p className="text-center text-muted-foreground text-sm py-4">
                          Aucun message dans cette conversation
                        </p>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Reply input */}
                  <div className="space-y-2">
                    <Label>Votre réponse</Label>
                    <div className="flex gap-2">
                      <Textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Tapez votre réponse..."
                        rows={2}
                        className="flex-1"
                      />
                      <Button
                        variant="hero"
                        onClick={() => {
                          if (selectedRequest && replyContent.trim()) {
                            sendReplyMutation.mutate({ requestId: selectedRequest.id, content: replyContent });
                          }
                        }}
                        disabled={!replyContent.trim() || sendReplyMutation.isPending}
                        className="self-end"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminRequests;
