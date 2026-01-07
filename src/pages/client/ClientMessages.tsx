import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { MessageSquare, Plus, Send, Clock, CheckCircle, Circle, AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Conversation {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  last_message_at: string;
  unread_by_client: boolean;
}

interface Message {
  id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
}

const ClientMessages = () => {
  const { user } = useClientAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newContent, setNewContent] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: conversations, isLoading, error: conversationsError, refetch } = useQuery({
    queryKey: ["client-conversations", user?.id],
    queryFn: async () => {
      console.log("[ClientMessages] Fetching conversations for user:", user?.id);
      const { data, error } = await supabase
        .from("message_conversations")
        .select("*")
        .eq("client_id", user?.id)
        .order("last_message_at", { ascending: false });

      if (error) {
        console.error("[ClientMessages] Query error:", error);
        throw error;
      }
      console.log("[ClientMessages] Fetched conversations:", data?.length);
      return data as Conversation[];
    },
    enabled: !!user?.id,
  });

  const { data: messages, error: messagesError } = useQuery({
    queryKey: ["conversation-messages", selectedConversation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_messages")
        .select("*")
        .eq("conversation_id", selectedConversation)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[ClientMessages] Messages query error:", error);
        toast.error(language === "fr" ? "Erreur lors du chargement des messages" : "Error loading messages");
        throw error;
      }
      
      // Mark as read by client when viewing
      await supabase
        .from("message_conversations")
        .update({ unread_by_client: false })
        .eq("id", selectedConversation);
        
      return data as Message[];
    },
    enabled: !!selectedConversation,
  });

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id)
        .single();

      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from("message_conversations")
        .insert({
          client_id: user?.id,
          subject: newSubject,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Create first message
      const { error: msgError } = await supabase
        .from("helpdesk_messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: user?.id,
          sender_name: profile?.full_name || "Client",
          sender_role: "client",
          content: newContent,
        });

      if (msgError) throw msgError;

      return conversation;
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["client-conversations"] });
      setDialogOpen(false);
      setNewSubject("");
      setNewContent("");
      setSelectedConversation(conversation.id);
      toast.success(language === "fr" ? "Conversation créée" : "Conversation created");
    },
    onError: () => {
      toast.error(language === "fr" ? "Erreur lors de la création" : "Error creating conversation");
    },
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
          sender_name: profile?.full_name || "Client",
          sender_role: "client",
          content: newMessage,
        });

      if (error) throw error;

      // Update last_message_at
      await supabase
        .from("message_conversations")
        .update({ last_message_at: new Date().toISOString(), unread_by_admin: true })
        .eq("id", selectedConversation);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ["client-conversations"] });
      setNewMessage("");
    },
    onError: () => {
      toast.error(language === "fr" ? "Erreur lors de l'envoi" : "Error sending message");
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="default"><Circle className="w-2 h-2 mr-1" />{language === "fr" ? "Ouvert" : "Open"}</Badge>;
      case "in_progress":
        return <Badge variant="secondary"><Clock className="w-2 h-2 mr-1" />{language === "fr" ? "En cours" : "In Progress"}</Badge>;
      case "closed":
        return <Badge variant="outline"><CheckCircle className="w-2 h-2 mr-1" />{language === "fr" ? "Fermé" : "Closed"}</Badge>;
      default:
        return null;
    }
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="w-6 h-6" />
              {language === "fr" ? "Messagerie" : "Messages"}
            </h1>
            <p className="text-muted-foreground">
              {language === "fr" ? "Communiquez avec notre équipe" : "Communicate with our team"}
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {language === "fr" ? "Nouvelle conversation" : "New Conversation"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {language === "fr" ? "Nouvelle conversation" : "New Conversation"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{language === "fr" ? "Sujet" : "Subject"}</Label>
                  <Input
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder={language === "fr" ? "Ex: Question sur ma facture" : "Ex: Question about my bill"}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "fr" ? "Message" : "Message"}</Label>
                  <Textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder={language === "fr" ? "Décrivez votre demande..." : "Describe your request..."}
                    rows={4}
                  />
                </div>
                <Button
                  onClick={() => createConversationMutation.mutate()}
                  disabled={!newSubject.trim() || !newContent.trim() || createConversationMutation.isPending}
                  className="w-full"
                >
                  {language === "fr" ? "Créer" : "Create"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conversations List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">
                {language === "fr" ? "Conversations" : "Conversations"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {conversationsError ? (
                  <div className="p-6 text-center">
                    <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                    <p className="text-sm text-destructive mb-2">
                      {language === "fr" ? "Erreur de chargement" : "Loading error"}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                      {language === "fr" ? "Réessayer" : "Retry"}
                    </Button>
                  </div>
                ) : isLoading ? (
                  <div className="p-6 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">
                      {language === "fr" ? "Chargement..." : "Loading..."}
                    </p>
                  </div>
                ) : conversations?.length === 0 ? (
                  <div className="p-8 text-center">
                    <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground mb-3">
                      {language === "fr" ? "Aucune conversation" : "No conversations"}
                    </p>
                    <Button onClick={() => setDialogOpen(true)} size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      {language === "fr" ? "Démarrer une conversation" : "Start a conversation"}
                    </Button>
                  </div>
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
                            {format(new Date(conv.last_message_at || conv.created_at), "d MMM yyyy HH:mm", {
                              locale: language === "fr" ? fr : undefined,
                            })}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {getStatusBadge(conv.status)}
                          {conv.unread_by_client && (
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
            <CardContent className="p-0 h-[550px] flex flex-col">
              {selectedConversation ? (
                <>
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages?.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender_role === "client" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                              msg.sender_role === "client"
                                ? "bg-accent text-white rounded-br-md"
                                : "bg-muted rounded-bl-md"
                            }`}
                          >
                            <p className="text-xs opacity-70 mb-1">
                              {msg.sender_name} • {format(new Date(msg.created_at), "HH:mm")}
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
                        placeholder={language === "fr" ? "Votre message..." : "Your message..."}
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
                  {language === "fr"
                    ? "Sélectionnez une conversation ou créez-en une nouvelle"
                    : "Select a conversation or create a new one"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ClientLayout>
  );
};

export default ClientMessages;
