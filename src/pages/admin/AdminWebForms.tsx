import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  Mail,
  Search,
  ArrowLeft,
  Send,
  StickyNote,
  User,
  Clock,
  Phone,
  ExternalLink,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface WebFormThread {
  id: string;
  thread_number: string;
  created_at: string;
  updated_at: string;
  status: string;
  subject: string;
  contact_full_name: string;
  contact_email: string;
  contact_phone: string | null;
  page_url: string | null;
  is_linked_client: boolean;
  linked_user_id: string | null;
  last_message_at: string;
  last_sender_type: string;
  admin_assignee_user_id: string | null;
  admin_tags: string[] | null;
  message_count?: number;
}

interface WebFormMessage {
  id: string;
  thread_id: string;
  created_at: string;
  sender_type: string;
  sender_email: string | null;
  sender_name: string | null;
  body_text: string;
  body_html: string | null;
  direction: string;
  is_internal_note: boolean;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  new: { label: "Nouveau", color: "bg-cyan-500/20 text-cyan-400" },
  open: { label: "Ouvert", color: "bg-amber-500/20 text-amber-500" },
  pending: { label: "En attente", color: "bg-slate-500/20 text-slate-400" },
  closed: { label: "Fermé", color: "bg-emerald-500/20 text-emerald-500" },
  spam: { label: "Spam", color: "bg-red-500/20 text-red-500" },
};

const AdminWebForms = () => {
  const [threads, setThreads] = useState<WebFormThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<WebFormThread | null>(null);
  const [messages, setMessages] = useState<WebFormMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [replyText, setReplyText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [total, setTotal] = useState(0);

  // Fetch threads
  const fetchThreads = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        limit: "50",
        offset: "0",
      };
      if (statusFilter !== "all") params.status = statusFilter;
      if (search) params.search = search;

      const { data, error } = await supabase.functions.invoke("admin-web-form-list", {
        body: params,
      });

      if (error) throw error;
      setThreads(data.threads || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch threads:", err);
      toast.error("Erreur lors du chargement des conversations");
    } finally {
      setLoading(false);
    }
  };

  // Fetch thread detail
  const fetchThreadDetail = async (threadId: string) => {
    setLoadingThread(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-web-form-thread", {
        body: { thread_id: threadId },
      });

      if (error) throw error;
      setSelectedThread(data.thread);
      setMessages(data.messages || []);
    } catch (err) {
      console.error("Failed to fetch thread:", err);
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
      const { data, error } = await supabase.functions.invoke("admin-web-form-reply", {
        body: {
          thread_id: selectedThread.id,
          body_text: replyText,
          is_internal_note: isInternalNote,
        },
      });

      if (error) throw error;

      toast.success(isInternalNote ? "Note interne ajoutée" : "Réponse envoyée");
      setReplyText("");
      setIsInternalNote(false);
      
      // Refresh thread and list
      await fetchThreadDetail(selectedThread.id);
      fetchThreads();
    } catch (err) {
      console.error("Failed to send reply:", err);
      toast.error("Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  // Update thread status
  const handleStatusChange = async (newStatus: string) => {
    if (!selectedThread) return;

    try {
      const { error } = await supabase.functions.invoke("admin-web-form-thread", {
        body: { thread_id: selectedThread.id, status: newStatus },
        method: "PATCH",
      });

      if (error) throw error;

      toast.success("Statut mis à jour");
      setSelectedThread({ ...selectedThread, status: newStatus });
      fetchThreads();
    } catch (err) {
      console.error("Failed to update status:", err);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [statusFilter]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchThreads();
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // Thread detail view
  if (selectedThread) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setSelectedThread(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <h1 className="text-2xl font-bold flex-1">{selectedThread.thread_number}</h1>
            <Select value={selectedThread.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Nouveau</SelectItem>
                <SelectItem value="open">Ouvert</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="closed">Fermé</SelectItem>
                <SelectItem value="spam">Spam</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contact info */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Nom</p>
                  <p className="font-medium">{selectedThread.contact_full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedThread.contact_email}</p>
                </div>
                {selectedThread.contact_phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Téléphone</p>
                    <p className="font-medium flex items-center gap-2">
                      <Phone className="w-3 h-3" />
                      {selectedThread.contact_phone}
                    </p>
                  </div>
                )}
                {selectedThread.page_url && (
                  <div>
                    <p className="text-sm text-muted-foreground">Page</p>
                    <a
                      href={selectedThread.page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-1 text-sm"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {new URL(selectedThread.page_url).pathname}
                    </a>
                  </div>
                )}
                {selectedThread.is_linked_client && (
                  <Badge className="bg-emerald-500/20 text-emerald-500">
                    Client lié
                  </Badge>
                )}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Créé le {format(new Date(selectedThread.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Messages */}
            <Card className="lg:col-span-2">
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
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-4 rounded-lg ${
                          msg.is_internal_note
                            ? "bg-amber-500/10 border border-amber-500/30"
                            : msg.direction === "inbound"
                            ? "bg-accent"
                            : "bg-primary/10 border border-primary/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {msg.is_internal_note && (
                              <StickyNote className="w-4 h-4 text-amber-500" />
                            )}
                            <span className="font-medium text-sm">
                              {msg.sender_name || msg.sender_email}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {msg.sender_type === "admin"
                                ? "Admin"
                                : msg.sender_type === "client"
                                ? "Client"
                                : msg.sender_type === "system"
                                ? "Système"
                                : "Contact"}
                            </Badge>
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

                {/* Reply box */}
                <div className="mt-6 space-y-3 border-t border-border pt-4">
                  <Textarea
                    placeholder={isInternalNote ? "Écrire une note interne..." : "Écrire une réponse..."}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    className={isInternalNote ? "border-amber-500/50" : ""}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || sending}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {sending ? "Envoi..." : "Répondre"}
                    </Button>
                    <Button
                      variant={isInternalNote ? "default" : "outline"}
                      size="sm"
                      onClick={() => setIsInternalNote(!isInternalNote)}
                      className={isInternalNote ? "bg-amber-500 hover:bg-amber-600" : ""}
                    >
                      <StickyNote className="w-4 h-4 mr-1" />
                      Note interne
                    </Button>
                    <p className="text-xs text-muted-foreground ml-auto">
                      {isInternalNote
                        ? "Cette note ne sera pas envoyée par email"
                        : "La réponse sera envoyée par email au contact"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // List view
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Mail className="w-6 h-6 text-cyan-400" />
              Formulaire Web
            </h1>
            <p className="text-muted-foreground mt-1">
              {total} conversation{total !== 1 ? "s" : ""}
            </p>
          </div>
          <Button variant="outline" onClick={() => fetchThreads()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par email, nom, numéro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="new">Nouveaux</TabsTrigger>
              <TabsTrigger value="open">Ouverts</TabsTrigger>
              <TabsTrigger value="pending">En attente</TabsTrigger>
              <TabsTrigger value="closed">Fermés</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Thread list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <Card className="p-12 text-center">
            <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Aucune conversation</p>
            <p className="text-muted-foreground">
              Les soumissions du formulaire web apparaîtront ici
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
                  onClick={() => fetchThreadDetail(thread.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm text-muted-foreground">
                            {thread.thread_number}
                          </span>
                          <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                          {thread.is_linked_client && (
                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/50">
                              Client
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium truncate">{thread.contact_full_name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {thread.contact_email}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {format(new Date(thread.last_message_at), "d MMM HH:mm", { locale: fr })}
                        </div>
                        {thread.message_count && thread.message_count > 1 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {thread.message_count} messages
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminWebForms;
