import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  MessageSquare, 
  Send, 
  Users, 
  Search, 
  Phone, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Plus,
  X,
  Eye,
  Loader2,
  MessageCircle,
  ArrowLeft,
  User
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Helper to format phone to E.164
function toE164(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.startsWith("+") && phone.replace(/\D/g, "").length >= 10) return phone;
  return null;
}

// Format phone for display
function formatPhoneDisplay(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

interface Client {
  id: string;
  phone: string;
  full_name: string | null;
  email: string | null;
  status?: string;
}

interface SMSCampaign {
  id: string;
  message: string;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
  created_at: string;
  sent_by_email: string | null;
}

interface ConversationMessage {
  id: string;
  direction: string;
  message_preview: string | null;
  created_at: string;
  agent_name: string | null;
  status: string | null;
}

export default function AdminCommunicationSMS() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("compose");
  const [message, setMessage] = useState("");
  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [manualPhones, setManualPhones] = useState<string[]>([]);
  const [manualPhoneInput, setManualPhoneInput] = useState("");
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [conversationPhone, setConversationPhone] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState("");

  // Fetch clients with phone numbers
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["sms-clients"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, phone, full_name, email")
        .not("phone", "is", null)
        .neq("phone", "")
        .order("full_name", { ascending: true });

      if (error) throw error;

      // Get user roles to filter out admin/employee
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const adminIds = new Set(
        (roles || [])
          .filter(r => r.role === "admin" || r.role === "employee")
          .map(r => r.user_id)
      );

      return (profiles || []).filter(p => !adminIds.has(p.id)) as Client[];
    },
  });

  // Fetch SMS campaigns history
  const { data: campaigns = [], isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery({
    queryKey: ["sms-campaigns"],
    queryFn: async () => {
      // Use raw query to bypass type checking since table was just created
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/sms_campaigns?select=*&order=created_at.desc&limit=50`,
        {
          headers: {
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );
      
      if (!response.ok) {
        console.log("SMS campaigns fetch failed");
        return [];
      }
      
      return (await response.json()) as SMSCampaign[];
    },
  });

  // Fetch conversation messages
  const { data: conversationMessages = [], refetch: refetchConversation } = useQuery({
    queryKey: ["sms-conversation", conversationPhone],
    queryFn: async () => {
      if (!conversationPhone) return [];
      
      const { data, error } = await supabase
        .from("telephony_logs")
        .select("id, direction, message_preview, created_at, agent_name, status")
        .eq("action", "sms")
        .eq("phone_number", conversationPhone)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as ConversationMessage[];
    },
    enabled: !!conversationPhone,
    refetchInterval: conversationPhone ? 5000 : false,
  });

  // Realtime subscription for conversation
  useEffect(() => {
    if (!conversationPhone) return;

    const channel = supabase
      .channel(`sms-conv-${conversationPhone}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "telephony_logs",
          filter: `phone_number=eq.${conversationPhone}`,
        },
        () => {
          refetchConversation();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationPhone, refetchConversation]);

  // Send SMS campaign mutation
  const sendCampaignMutation = useMutation({
    mutationFn: async () => {
      const allPhones: { phone: string; name: string | null; client_id: string | null }[] = [];

      // Add selected clients
      selectedClients.forEach(client => {
        const e164 = toE164(client.phone);
        if (e164) {
          allPhones.push({
            phone: e164,
            name: client.full_name,
            client_id: client.id,
          });
        }
      });

      // Add manual phones
      manualPhones.forEach(phone => {
        const e164 = toE164(phone);
        if (e164 && !allPhones.find(p => p.phone === e164)) {
          allPhones.push({
            phone: e164,
            name: null,
            client_id: null,
          });
        }
      });

      if (allPhones.length === 0) {
        throw new Error("Aucun destinataire valide");
      }

      if (!message.trim()) {
        throw new Error("Le message ne peut pas être vide");
      }

      const { data, error } = await supabase.functions.invoke("send-marketing-sms", {
        body: {
          message: message.trim(),
          recipients: allPhones,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Échec de l'envoi");

      return data;
    },
    onSuccess: (data) => {
      toast.success("SMS envoyés", {
        description: `${data.sent} SMS envoyés avec succès${data.failed > 0 ? `, ${data.failed} échoués` : ""}`,
      });
      setMessage("");
      setSelectedClients([]);
      setManualPhones([]);
      setConfirmSendOpen(false);
      queryClient.invalidateQueries({ queryKey: ["sms-campaigns"] });
    },
    onError: (err: Error) => {
      toast.error("Erreur", { description: err.message });
    },
  });

  // Send reply mutation
  const sendReplyMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!conversationPhone) throw new Error("Aucun numéro sélectionné");

      const e164 = toE164(conversationPhone);
      if (!e164) throw new Error("Numéro de téléphone invalide");

      const session = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke("openphone-sms", {
        body: {
          to: e164,
          text: text.trim(),
          agentName: session.data?.session?.user?.email,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Échec de l'envoi");

      return data;
    },
    onSuccess: () => {
      setReplyMessage("");
      refetchConversation();
      toast.success("SMS envoyé");
    },
    onError: (err: Error) => {
      toast.error("Erreur", { description: err.message });
    },
  });

  // Filtered clients for search
  const filteredClients = clients.filter(client => {
    const query = searchQuery.toLowerCase();
    return (
      client.full_name?.toLowerCase().includes(query) ||
      client.phone?.includes(query) ||
      client.email?.toLowerCase().includes(query)
    );
  });

  // Handle select all
  const handleSelectAll = () => {
    if (selectedClients.length === filteredClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients([...filteredClients]);
    }
  };

  // Toggle client selection
  const toggleClientSelection = (client: Client) => {
    const isSelected = selectedClients.some(c => c.id === client.id);
    if (isSelected) {
      setSelectedClients(selectedClients.filter(c => c.id !== client.id));
    } else {
      setSelectedClients([...selectedClients, client]);
    }
  };

  // Add manual phone
  const handleAddManualPhone = () => {
    const e164 = toE164(manualPhoneInput);
    if (e164 && !manualPhones.includes(e164)) {
      setManualPhones([...manualPhones, e164]);
      setManualPhoneInput("");
    } else if (!e164) {
      toast.error("Numéro invalide", { description: "Format: (514) 555-1234" });
    }
  };

  // Remove manual phone
  const handleRemoveManualPhone = (phone: string) => {
    setManualPhones(manualPhones.filter(p => p !== phone));
  };

  // Total recipients
  const totalRecipients = selectedClients.length + manualPhones.length;

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Terminé</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Échoué</Badge>;
      case "sending":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><Loader2 className="h-3 w-3 mr-1 animate-spin" />En cours</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-primary" />
              Communication SMS
            </h1>
            <p className="text-muted-foreground mt-1">
              Envoyez des SMS à vos clients et gérez les conversations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <Users className="h-4 w-4 mr-1" />
              {clients.length} clients avec téléphone
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="compose" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Composer
            </TabsTrigger>
            <TabsTrigger value="conversations" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Conversations
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Historique
            </TabsTrigger>
          </TabsList>

          {/* Compose Tab */}
          <TabsContent value="compose" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Message Composer */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Message SMS
                  </CardTitle>
                  <CardDescription>
                    Rédigez votre message (max 160 caractères recommandé)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Bonjour! Voici une offre spéciale de Nivra Telecom..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[150px] resize-none"
                    maxLength={320}
                  />
                  <div className="flex items-center justify-between text-sm">
                    <span className={message.length > 160 ? "text-amber-600" : "text-muted-foreground"}>
                      {message.length}/320 caractères
                      {message.length > 160 && " (2 SMS)"}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewOpen(true)}
                        disabled={!message.trim()}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Aperçu
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium">{totalRecipients}</span> destinataire(s) sélectionné(s)
                    </div>
                    <Button
                      onClick={() => setConfirmSendOpen(true)}
                      disabled={!message.trim() || totalRecipients === 0 || sendCampaignMutation.isPending}
                      className="gap-2"
                    >
                      {sendCampaignMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Envoyer les SMS
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Recipients Panel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Destinataires
                  </CardTitle>
                  <CardDescription>
                    Sélectionnez les clients ou ajoutez des numéros manuellement
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Client Selection Button */}
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => setClientDialogOpen(true)}
                  >
                    <Users className="h-4 w-4" />
                    Sélectionner des clients ({selectedClients.length} sélectionné(s))
                  </Button>

                  {/* Manual Phone Input */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="(514) 555-1234"
                      value={manualPhoneInput}
                      onChange={(e) => setManualPhoneInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddManualPhone()}
                    />
                    <Button variant="secondary" onClick={handleAddManualPhone}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Selected Recipients List */}
                  <ScrollArea className="h-[250px] border rounded-lg p-3">
                    {selectedClients.length === 0 && manualPhones.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Aucun destinataire sélectionné</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedClients.map((client) => (
                          <div
                            key={client.id}
                            className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{client.full_name || "Sans nom"}</p>
                                <p className="text-xs text-muted-foreground">{formatPhoneDisplay(client.phone)}</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleClientSelection(client)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        {manualPhones.map((phone) => (
                          <div
                            key={phone}
                            className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-blue-600" />
                              <p className="text-sm font-medium">{formatPhoneDisplay(phone)}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleRemoveManualPhone(phone)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Conversations Tab */}
          <TabsContent value="conversations" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Conversation List */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Conversations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {clients.slice(0, 50).map((client) => (
                        <button
                          key={client.id}
                          onClick={() => setConversationPhone(client.phone)}
                          className={`w-full p-3 rounded-lg text-left transition-colors ${
                            conversationPhone === client.phone
                              ? "bg-primary/10 border-primary border"
                              : "bg-muted/50 hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{client.full_name || "Sans nom"}</p>
                              <p className="text-xs text-muted-foreground">{formatPhoneDisplay(client.phone)}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Conversation View */}
              <Card className="lg:col-span-2">
                <CardHeader className="border-b">
                  {conversationPhone ? (
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        onClick={() => setConversationPhone(null)}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {clients.find(c => c.phone === conversationPhone)?.full_name || "Contact"}
                        </CardTitle>
                        <CardDescription>{formatPhoneDisplay(conversationPhone)}</CardDescription>
                      </div>
                    </div>
                  ) : (
                    <CardTitle className="text-muted-foreground">
                      Sélectionnez une conversation
                    </CardTitle>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {conversationPhone ? (
                    <>
                      <ScrollArea className="h-[380px] p-4">
                        <div className="space-y-3">
                          {conversationMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                                  msg.direction === "outbound"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">{msg.message_preview}</p>
                                <p className={`text-xs mt-1 ${
                                  msg.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground"
                                }`}>
                                  {format(new Date(msg.created_at), "HH:mm", { locale: fr })}
                                  {msg.agent_name && ` • ${msg.agent_name}`}
                                </p>
                              </div>
                            </div>
                          ))}
                          {conversationMessages.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">
                              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                              <p>Aucun message dans cette conversation</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                      <div className="p-4 border-t">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Écrire un message..."
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey && replyMessage.trim()) {
                                e.preventDefault();
                                sendReplyMutation.mutate(replyMessage);
                              }
                            }}
                          />
                          <Button
                            onClick={() => sendReplyMutation.mutate(replyMessage)}
                            disabled={!replyMessage.trim() || sendReplyMutation.isPending}
                          >
                            {sendReplyMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-[440px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
                        <p>Sélectionnez un client pour voir la conversation</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Historique des campagnes SMS
                  </CardTitle>
                  <CardDescription>
                    Consultez les SMS marketing envoyés
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchCampaigns()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Rafraîchir
                </Button>
              </CardHeader>
              <CardContent>
                {campaignsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Aucune campagne SMS envoyée</p>
                    <p className="text-sm">Commencez par envoyer votre premier SMS marketing!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {campaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusBadge(campaign.status)}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(campaign.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                            </span>
                          </div>
                          <p className="text-sm line-clamp-2">{campaign.message}</p>
                          {campaign.sent_by_email && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Par: {campaign.sent_by_email}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm ml-4">
                          <div className="text-center">
                            <p className="font-semibold">{campaign.recipients_count}</p>
                            <p className="text-xs text-muted-foreground">Total</p>
                          </div>
                          <div className="text-center text-green-600">
                            <p className="font-semibold">{campaign.sent_count}</p>
                            <p className="text-xs">Envoyés</p>
                          </div>
                          {campaign.failed_count > 0 && (
                            <div className="text-center text-red-600">
                              <p className="font-semibold">{campaign.failed_count}</p>
                              <p className="text-xs">Échoués</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Client Selector Dialog */}
        <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Sélectionner des clients</DialogTitle>
              <DialogDescription>
                Choisissez les clients à qui envoyer le SMS
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, téléphone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedClients.length === filteredClients.length && filteredClients.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm">
                    Sélectionner tout ({filteredClients.length})
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {selectedClients.length} sélectionné(s)
                </span>
              </div>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {filteredClients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleClientSelection(client)}
                    >
                      <Checkbox
                        checked={selectedClients.some(c => c.id === client.id)}
                        onCheckedChange={() => toggleClientSelection(client)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{client.full_name || "Sans nom"}</p>
                        <p className="text-sm text-muted-foreground">{formatPhoneDisplay(client.phone)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setClientDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={() => setClientDialogOpen(false)}>
                Confirmer ({selectedClients.length})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Aperçu du SMS</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <div className="w-64 bg-gray-900 rounded-3xl p-4 shadow-xl">
                <div className="bg-gray-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-white text-sm">Nivra Telecom</span>
                  </div>
                  <div className="bg-gray-700 rounded-xl p-3">
                    <p className="text-white text-sm whitespace-pre-wrap">{message}</p>
                    <p className="text-gray-400 text-xs mt-2 text-right">
                      {format(new Date(), "HH:mm")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setPreviewOpen(false)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Send Dialog */}
        <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmer l'envoi</DialogTitle>
              <DialogDescription>
                Vous êtes sur le point d'envoyer {totalRecipients} SMS.
              </DialogDescription>
            </DialogHeader>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm line-clamp-3">{message}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmSendOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => sendCampaignMutation.mutate()}
                disabled={sendCampaignMutation.isPending}
              >
                {sendCampaignMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer {totalRecipients} SMS
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
