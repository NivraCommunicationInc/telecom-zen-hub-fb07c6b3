import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageSquare, Send, Clock, CheckCircle, Circle, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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

const AdminMessages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["admin-conversations", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("message_conversations")
        .select("*")
        .order("last_message_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Conversation[];
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["admin-conversation-messages", selectedConversation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_messages")
        .select("*")
        .eq("conversation_id", selectedConversation)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedConversation,
  });

  const selectedConv = conversations?.find(c => c.id === selectedConversation);

  const { data: clientProfile } = useQuery({
    queryKey: ["client-profile", selectedConv?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", selectedConv?.client_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!selectedConv?.client_id,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id)
        .single();

      const { error } = await supabase
        .from("helpdesk_messages")
        .insert({
          conversation_id: selectedConversation,
          sender_id: user?.id,
          sender_name: profile?.full_name || "Admin",
          sender_role: "admin",
          content: newMessage,
        });

      if (error) throw error;

      await supabase
        .from("message_conversations")
        .update({ 
          last_message_at: new Date().toISOString(), 
          unread_by_client: true,
          status: "in_progress"
        })
        .eq("id", selectedConversation);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-conversation-messages", selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ["admin-conversations"] });
      setNewMessage("");
    },
    onError: () => {
      toast.error("Erreur lors de l'envoi");
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
      queryClient.invalidateQueries({ queryKey: ["admin-conversations"] });
      toast.success("Statut mis à jour");
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

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="w-6 h-6" />
              Messagerie
            </h1>
            <p className="text-muted-foreground">
              Conversations avec les clients
            </p>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="open">Ouverts</SelectItem>
              <SelectItem value="in_progress">En cours</SelectItem>
              <SelectItem value="closed">Fermés</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conversations List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Conversations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                {isLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Chargement...</div>
                ) : conversations?.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">Aucune conversation</div>
                ) : (
                  conversations?.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={`w-full p-4 border-b text-left hover:bg-muted/50 transition-colors ${
                        selectedConversation === conv.id ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{conv.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(conv.last_message_at), "d MMM yyyy HH:mm", { locale: fr })}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {getStatusBadge(conv.status)}
                          {conv.unread_by_admin && (
                            <span className="w-2 h-2 rounded-full bg-accent" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Messages */}
          <Card className="lg:col-span-2">
            <CardContent className="p-0 h-[650px] flex flex-col">
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
                        <p className="text-xs text-muted-foreground">{clientProfile?.email}</p>
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

                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages?.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender_role !== "client" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                              msg.sender_role !== "client"
                                ? "bg-accent text-white rounded-br-md"
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
                  </ScrollArea>

                  <div className="border-t p-4">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        sendMessageMutation.mutate();
                      }}
                      className="flex gap-2"
                    >
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Votre réponse..."
                        disabled={sendMessageMutation.isPending}
                      />
                      <Button type="submit" disabled={!newMessage.trim() || sendMessageMutation.isPending}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  Sélectionnez une conversation
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminMessages;
