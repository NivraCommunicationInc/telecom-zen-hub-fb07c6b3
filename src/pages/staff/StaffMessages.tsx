import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { MessageSquare, Send, Clock, CheckCircle, Circle, User, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Conversation {
  id: string;
  client_id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  last_message_at: string;
  unread_by_admin: boolean;
}

interface Message {
  id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
  is_internal_note: boolean;
}

const StaffMessages = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { role, isAdmin, isEmployee } = useRoleAccess();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [queryError, setQueryError] = useState<string | null>(null);

  // Redirect if not admin or employee
  useEffect(() => {
    if (!authLoading && user && !isAdmin && !isEmployee) {
      toast.error("Accès refusé - Employés et admins uniquement");
      navigate("/");
    }
  }, [authLoading, user, isAdmin, isEmployee, navigate]);

  const { data: conversations, isLoading, error: conversationsError, refetch } = useQuery({
    queryKey: ["staff-conversations", statusFilter],
    queryFn: async () => {
      setQueryError(null);
      let query = supabase
        .from("message_conversations")
        .select("*")
        .order("last_message_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        console.error("[StaffMessages] Query error:", error);
        setQueryError(error.message);
        throw error;
      }
      console.log("[StaffMessages] Fetched conversations:", data?.length);
      return data as Conversation[];
    },
    enabled: !!user && (isAdmin || isEmployee),
  });

  const { data: messages, error: messagesError } = useQuery({
    queryKey: ["staff-conversation-messages", selectedConversation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_messages")
        .select("*")
        .eq("conversation_id", selectedConversation)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[StaffMessages] Messages query error:", error);
        toast.error("Erreur lors du chargement des messages");
        throw error;
      }
      
      // Mark as read by admin when viewing
      await supabase
        .from("message_conversations")
        .update({ unread_by_admin: false })
        .eq("id", selectedConversation);
        
      return data as Message[];
    },
    enabled: !!selectedConversation,
  });

  const selectedConv = conversations?.find(c => c.id === selectedConversation);

  const { data: clientProfile } = useQuery({
    queryKey: ["client-profile-staff", selectedConv?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", selectedConv?.client_id)
        .single();

      if (error) {
        console.error("[StaffMessages] Client profile error:", error);
        return null;
      }
      return data;
    },
    enabled: !!selectedConv?.client_id,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!newMessage.trim()) throw new Error("Message vide");
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id)
        .single();

      const senderRole = isAdmin ? "admin" : "employee";
      
      const { error } = await supabase
        .from("helpdesk_messages")
        .insert({
          conversation_id: selectedConversation,
          sender_id: user?.id,
          sender_name: profile?.full_name || (isAdmin ? "Admin" : "Employé"),
          sender_role: senderRole,
          content: newMessage,
        });

      if (error) {
        console.error("[StaffMessages] Send message error:", error);
        throw error;
      }

      // Update conversation status
      const { error: updateError } = await supabase
        .from("message_conversations")
        .update({ 
          last_message_at: new Date().toISOString(), 
          unread_by_client: true,
          status: "in_progress"
        })
        .eq("id", selectedConversation);

      if (updateError) {
        console.error("[StaffMessages] Update conversation error:", updateError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-conversation-messages", selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ["staff-conversations"] });
      setNewMessage("");
      toast.success("Message envoyé");
    },
    onError: (error: Error) => {
      console.error("[StaffMessages] Mutation error:", error);
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("message_conversations")
        .update({ 
          status,
          ...(status === "closed" ? { closed_at: new Date().toISOString() } : {})
        })
        .eq("id", selectedConversation);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-conversations"] });
      toast.success("Statut mis à jour");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="default"><Circle className="w-2 h-2 mr-1" />Ouvert</Badge>;
      case "in_progress":
        return <Badge variant="secondary"><Clock className="w-2 h-2 mr-1" />En cours</Badge>;
      case "closed":
        return <Badge variant="outline"><CheckCircle className="w-2 h-2 mr-1" />Fermé</Badge>;
      default:
        return null;
    }
  };

  // Show loading while auth is checking
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Access denied
  if (!user || (!isAdmin && !isEmployee)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Accès refusé</h1>
          <p className="text-muted-foreground">Cette page est réservée aux employés et administrateurs.</p>
          <Button onClick={() => navigate("/")}>Retour à l'accueil</Button>
        </div>
      </div>
    );
  }

  const unreadCount = conversations?.filter(c => c.unread_by_admin).length || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Simple header for staff */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Messagerie {isAdmin ? "(Admin)" : "(Employé)"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} non lu(s)` : "Conversations avec les clients"}
              </p>
            </div>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filtrer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="open">Ouverts</SelectItem>
              <SelectItem value="in_progress">En cours</SelectItem>
              <SelectItem value="closed">Fermés</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Error display */}
        {(queryError || conversationsError) && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Erreur de chargement</p>
              <p className="text-sm text-muted-foreground">{queryError || (conversationsError as Error)?.message}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
              Réessayer
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conversations List */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Conversations</span>
                {unreadCount > 0 && (
                  <Badge variant="destructive">{unreadCount}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-280px)]">
                {isLoading ? (
                  <div className="p-4 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">Chargement...</p>
                  </div>
                ) : !conversations?.length ? (
                  <div className="p-8 text-center">
                    <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">Aucune conversation</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Les clients peuvent créer des conversations depuis leur portail.
                    </p>
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={`w-full p-4 border-b text-left hover:bg-muted/50 transition-colors ${
                        selectedConversation === conv.id ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {conv.unread_by_admin && (
                              <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                            )}
                            <p className="font-medium truncate">{conv.subject}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(conv.last_message_at || conv.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                          </p>
                        </div>
                        {getStatusBadge(conv.status)}
                      </div>
                    </button>
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Messages */}
          <Card className="lg:col-span-2">
            <CardContent className="p-0 h-[calc(100vh-220px)] flex flex-col">
              {selectedConversation ? (
                <>
                  {/* Header */}
                  <div className="border-b p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{clientProfile?.full_name || "Client"}</p>
                        <p className="text-xs text-muted-foreground">{clientProfile?.email || "—"}</p>
                      </div>
                    </div>
                    <Select 
                      value={selectedConv?.status} 
                      onValueChange={(v) => updateStatusMutation.mutate(v)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Ouvert</SelectItem>
                        <SelectItem value="in_progress">En cours</SelectItem>
                        <SelectItem value="closed">Fermé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Messages thread */}
                  <ScrollArea className="flex-1 p-4">
                    {messagesError ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                          <p className="text-sm text-destructive">Erreur de chargement des messages</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages?.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender_role !== "client" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                msg.sender_role !== "client"
                                  ? "bg-accent text-accent-foreground rounded-br-md"
                                  : "bg-muted rounded-bl-md"
                              }`}
                            >
                              <p className="text-xs opacity-70 mb-1">
                                {msg.sender_name} ({msg.sender_role}) • {format(new Date(msg.created_at), "HH:mm")}
                              </p>
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  {/* Reply input */}
                  <div className="border-t p-4">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (newMessage.trim()) {
                          sendMessageMutation.mutate();
                        }
                      }}
                      className="flex gap-2"
                    >
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Votre réponse..."
                        disabled={sendMessageMutation.isPending}
                      />
                      <Button 
                        type="submit" 
                        disabled={!newMessage.trim() || sendMessageMutation.isPending}
                      >
                        {sendMessageMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground">Sélectionnez une conversation</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default StaffMessages;
