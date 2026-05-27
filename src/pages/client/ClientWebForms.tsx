import { useState, useEffect, useMemo } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import {
  Mail,
  ArrowLeft,
  Send,
  Clock,
  MessageSquare,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface WebFormThread {
  id: string;
  thread_number: string;
  created_at: string;
  status: string;
  subject: string;
  contact_full_name: string;
  contact_email: string;
  last_message_at: string;
  last_sender_type: string;
}

interface WebFormMessage {
  id: string;
  thread_id: string;
  created_at: string;
  sender_type: string;
  sender_email: string | null;
  sender_name: string | null;
  body_text: string;
  direction: string;
  is_internal_note: boolean;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  new: { label: "Nouveau", color: "bg-cyan-500/20 text-cyan-400" },
  open: { label: "Ouvert", color: "bg-amber-500/20 text-amber-500" },
  pending: { label: "En attente", color: "bg-slate-500/20 text-slate-400" },
  closed: { label: "Fermé", color: "bg-emerald-500/20 text-emerald-500" },
};

const ClientWebForms = () => {
  const { user } = useClientAuth();
  const [threads, setThreads] = useState<WebFormThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<WebFormThread | null>(null);
  const [messages, setMessages] = useState<WebFormMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  // Fetch threads for this user
  const fetchThreads = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("web_form_threads")
        .select("*")
        .eq("linked_user_id", user.id)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      setThreads(data || []);
    } catch (err) {
      console.error("Failed to fetch threads:", err);
      toast.error("Erreur lors du chargement des conversations");
    } finally {
      setLoading(false);
    }
  };

  // Fetch thread messages
  const fetchThreadDetail = async (threadId: string) => {
    setLoadingThread(true);
    try {
      const { data, error } = await supabase
        .from("web_form_messages")
        .select("*")
        .eq("thread_id", threadId)
        .eq("is_internal_note", false) // Don't show internal notes to clients
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      toast.error("Erreur lors du chargement de la conversation");
    } finally {
      setLoadingThread(false);
    }
  };

  // Send reply
  const handleSendReply = async () => {
    if (!selectedThread || !replyText.trim()) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("client-web-form-reply", {
        body: {
          thread_id: selectedThread.id,
          body_text: replyText,
        },
      });

      if (error) throw error;

      toast.success("Réponse envoyée");
      setReplyText("");
      
      // Refresh messages
      await fetchThreadDetail(selectedThread.id);
      fetchThreads();
    } catch (err) {
      console.error("Failed to send reply:", err);
      toast.error("Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [user?.id]);

  // Thread detail view
  if (selectedThread) {
    return (
      <ClientLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setSelectedThread(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{selectedThread.thread_number}</h1>
              <p className="text-sm text-muted-foreground">{selectedThread.subject}</p>
            </div>
            <Badge className={statusConfig[selectedThread.status]?.color || "bg-muted"}>
              {statusConfig[selectedThread.status]?.label || selectedThread.status}
            </Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Conversation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingThread ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-lg ${
                        msg.sender_type === "admin"
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-accent"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {msg.sender_type === "admin" ? "Support Nivra" : "Vous"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(msg.created_at), "d MMM HH:mm", { locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.body_text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply box - only if thread is not closed */}
              {selectedThread.status !== "closed" && (
                <div className="mt-6 space-y-3 border-t border-border pt-4">
                  <Textarea
                    placeholder="Écrire une réponse..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || sending}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {sending ? "Envoi..." : "Répondre"}
                    </Button>
                    <p className="text-xs text-muted-foreground ml-auto">
                      Notre équipe vous répondra dans les meilleurs délais
                    </p>
                  </div>
                </div>
              )}

              {selectedThread.status === "closed" && (
                <div className="mt-6 p-4 bg-muted rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">
                    Cette conversation est fermée. Pour toute nouvelle question, veuillez soumettre un nouveau formulaire.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ClientLayout>
    );
  }

  // List view
  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Mail className="w-6 h-6 text-cyan-400" />
            Formulaire Web
          </h1>
          <p className="text-muted-foreground mt-1">
            Vos demandes soumises via le formulaire de contact
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <Card className="p-12 text-center">
            <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Aucune conversation</p>
            <p className="text-muted-foreground">
              Vos demandes via le formulaire de contact apparaîtront ici
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {threads.map((thread) => {
              const statusInfo = statusConfig[thread.status] || statusConfig.new;
              return (
                <Card
                  key={thread.id}
                  className="hover:border-primary/50 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedThread(thread);
                    fetchThreadDetail(thread.id);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm text-muted-foreground">
                            {thread.thread_number}
                          </span>
                          <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                        </div>
                        <p className="font-medium truncate">{thread.subject}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {format(new Date(thread.last_message_at), "d MMM HH:mm", { locale: fr })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientWebForms;
