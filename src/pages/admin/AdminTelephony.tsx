import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Phone,
  MessageSquare,
  Search,
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  User,
  Settings,
  Activity,
  CheckCircle,
  XCircle,
  Send,
  PhoneCall,
  Loader2,
  AlertCircle,
  Info,
  PhoneOutgoing,
  PhoneIncoming,
  PhoneMissed,
  RefreshCw,
  Plus,
  Copy,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { formatPhoneDisplay, toE164, isValidPhone } from "@/lib/phoneUtils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import SMSThreadsList from "@/components/admin/SMSThreadsList";
import { ClientSearchAutocomplete } from "@/components/admin/ClientSearchAutocomplete";
import SMSConversationView from "@/components/admin/SMSConversationView";
import { getInvokeErrorMessage } from "@/lib/functionsInvokeError";
const AdminTelephony = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("conversations");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newCallOpen, setNewCallOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(undefined);
  const [selectedClientName, setSelectedClientName] = useState<string>("");
  const [callPhoneNumber, setCallPhoneNumber] = useState("");
  const [callClientId, setCallClientId] = useState<string | undefined>(undefined);
  const [callClientName, setCallClientName] = useState<string>("");
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch OpenPhone numbers
  const { data: openPhoneNumbers, isLoading: numbersLoading } = useQuery({
    queryKey: ["openphone-numbers"],
    queryFn: async () => {
      // Use the backend client invoke to ensure required headers (apikey + auth) are always present.
      const { data, error } = await supabase.functions.invoke("openphone-phone-numbers", {
        method: "GET",
      });

      if (error) {
        console.error("Failed to fetch OpenPhone numbers:", error);
        return [];
      }

      return ((data as any)?.phoneNumbers ?? []) as any[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch call history from database with client info
  const { data: callHistory, isLoading: callsLoading, refetch: refetchCalls } = useQuery({
    queryKey: ["telephony-calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telephony_logs")
        .select("*")
        .eq("action", "call")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error fetching calls:", error);
        return [];
      }

      // Get unique phone numbers to match with clients
      const phoneNumbers = [...new Set((data || []).map(c => c.phone_number).filter(Boolean))];
      
      if (phoneNumbers.length > 0) {
        // Fetch client profiles that match these phone numbers
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, phone")
          .in("phone", phoneNumbers);
        
        // Create a phone -> client map
        const phoneToClient = new Map<string, { name: string; id: string }>();
        profiles?.forEach(p => {
          if (p.phone) {
            const normalized = toE164(p.phone);
            if (normalized) {
              phoneToClient.set(normalized, { name: p.full_name || p.email || "", id: p.user_id });
            }
          }
        });

        // Enrich calls with client info
        return (data || []).map(call => {
          const normalized = call.phone_number ? toE164(call.phone_number) : null;
          const client = normalized ? phoneToClient.get(normalized) : undefined;
          return {
            ...call,
            client_name: call.client_id ? call.client_name : client?.name,
            matched_client_id: client?.id,
          };
        });
      }

      return data || [];
    },
    staleTime: 30 * 1000,
  });

  // Fetch SMS stats
  const { data: smsStats } = useQuery({
    queryKey: ["telephony-sms-stats"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: allSms, error } = await supabase
        .from("telephony_logs")
        .select("id, created_at, direction")
        .eq("action", "sms");

      if (error) return { total: 0, today: 0, incoming: 0, outgoing: 0 };

      const todayCount = allSms?.filter(
        (sms) => new Date(sms.created_at) >= today
      ).length || 0;

      const incomingCount = allSms?.filter(
        (sms) => sms.direction === "inbound" || sms.direction === "incoming"
      ).length || 0;

      return {
        total: allSms?.length || 0,
        today: todayCount,
        incoming: incomingCount,
        outgoing: (allSms?.length || 0) - incomingCount,
      };
    },
    staleTime: 30 * 1000,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("telephony-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "telephony_logs",
        },
        (payload) => {
          console.log("New telephony log:", payload);
          queryClient.invalidateQueries({ queryKey: ["telephony-sms-stats"] });
          queryClient.invalidateQueries({ queryKey: ["telephony-calls"] });
          queryClient.invalidateQueries({ queryKey: ["sms-threads"] });
          
          // Show toast for incoming SMS
          if (payload.new.action === "sms" && 
              (payload.new.direction === "inbound" || payload.new.direction === "incoming")) {
            toast.info("Nouveau SMS reçu", {
              description: `De ${formatPhoneDisplay(payload.new.phone_number)}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Send SMS mutation for new conversation
  const smsMutation = useMutation({
    mutationFn: async ({ to, text }: { to: string; text: string }) => {
      const sessionRes = await supabase.auth.getSession();
      const agentEmail = sessionRes.data?.session?.user?.email ?? user?.email;

      const e164 = toE164(to);
      if (!e164) throw new Error("Numéro de téléphone invalide");

      if (!text.trim()) throw new Error("Le message ne peut pas être vide");

      const { data, error } = await supabase.functions.invoke("openphone-sms", {
        body: {
          to: e164,
          text: text.trim(),
          agentName: agentEmail,
        },
      });

      if (error) {
        const msg = await getInvokeErrorMessage(error);
        throw new Error(msg);
      }

      const payload = data as any;
      if (!payload?.success) {
        throw new Error(payload?.error || payload?.message || "Échec de l'envoi SMS");
      }

      return { ...payload, phone: e164 };
    },
    onSuccess: (data) => {
      toast.success("SMS envoyé", {
        description: "Le message a été envoyé avec succès",
      });
      setPhoneNumber("");
      setSmsMessage("");
      setNewConversationOpen(false);
      setSelectedPhone(data.phone);
      queryClient.invalidateQueries({ queryKey: ["sms-threads"] });
      queryClient.invalidateQueries({ queryKey: ["telephony-sms-stats"] });
    },
    onError: (err: Error) => {
      toast.error("Erreur", { description: err.message });
    },
  });

  const handleNewConversation = () => {
    setNewConversationOpen(true);
  };

  const handleStartNewConversation = () => {
    if (!phoneNumber.trim()) {
      toast.error("Erreur", { description: "Entrez un numéro de téléphone." });
      return;
    }
    if (!isValidPhone(phoneNumber)) {
      toast.error("Erreur", { description: "Numéro de téléphone invalide." });
      return;
    }
    if (!smsMessage.trim()) {
      toast.error("Erreur", { description: "Entrez un message." });
      return;
    }

    smsMutation.mutate({ to: phoneNumber, text: smsMessage });
  };

  const handleCall = (phone: string) => {
    const e164 = toE164(phone);
    if (!e164) {
      toast.error("Numéro invalide");
      return;
    }
    window.open(`https://app.openphone.com/dialer?number=${encodeURIComponent(e164)}`, "_blank");
    toast.success("OpenPhone ouvert", {
      description: "L'appel va démarrer dans OpenPhone",
    });
  };

  const getCallStatusIcon = (call: any) => {
    if (call.status === "missed") {
      return <PhoneMissed className="w-4 h-4 text-destructive" />;
    }
    if (call.direction === "outbound" || call.direction === "outgoing") {
      return <PhoneOutgoing className="w-4 h-4 text-cyan-500" />;
    }
    return <PhoneIncoming className="w-4 h-4 text-emerald-500" />;
  };

  const getCallStatusBadge = (call: any) => {
    if (call.status === "missed") {
      return <Badge variant="destructive" className="text-xs">Manqué</Badge>;
    }
    if (call.status === "completed") {
      return <Badge variant="outline" className="text-xs text-emerald-500 border-emerald-500/30">Complété</Badge>;
    }
    return <Badge variant="outline" className="text-xs">{call.status || "En cours"}</Badge>;
  };

  const isPhoneValid = phoneNumber ? isValidPhone(phoneNumber) : true;
  const hasOpenPhoneConfig = openPhoneNumbers && openPhoneNumbers.length > 0;

  const stats = {
    totalCalls: callHistory?.length || 0,
    totalSms: smsStats?.total || 0,
    todaySms: smsStats?.today || 0,
    incomingSms: smsStats?.incoming || 0,
  };

  const copyWebhookUrl = () => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openphone-webhook`;
    navigator.clipboard.writeText(url);
    toast.success("URL copiée", { description: "Collez-la dans OpenPhone Webhooks" });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-2">
              <Phone className="w-8 h-8 text-cyan-400" />
              Téléphonie SMS
            </h1>
            <p className="text-muted-foreground mt-1">
              Messagerie SMS intégrée avec historique en temps réel
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["sms-threads"] });
                queryClient.invalidateQueries({ queryKey: ["telephony-calls"] });
                toast.success("Données actualisées");
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="https://app.openphone.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                OpenPhone
              </a>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalSms}</p>
                <p className="text-xs text-muted-foreground">SMS total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.incomingSms}</p>
                <p className="text-xs text-muted-foreground">Reçus</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.todaySms}</p>
                <p className="text-xs text-muted-foreground">Aujourd'hui</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalCalls}</p>
                <p className="text-xs text-muted-foreground">Appels</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="conversations" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Conversations
            </TabsTrigger>
            <TabsTrigger value="calls" className="gap-2">
              <Phone className="w-4 h-4" />
              Appels
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Configuration
            </TabsTrigger>
          </TabsList>

          {/* Conversations Tab */}
          <TabsContent value="conversations" className="m-0">
            <Card className="overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-3 h-[600px]">
                {/* Threads List */}
                <div className="border-r hidden lg:block">
                  <SMSThreadsList
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    selectedPhone={selectedPhone}
                    onSelectPhone={setSelectedPhone}
                    onNewConversation={handleNewConversation}
                  />
                </div>

                {/* Mobile: Show either list or conversation */}
                <div className="lg:hidden">
                  {selectedPhone ? (
                    <SMSConversationView
                      selectedPhone={selectedPhone}
                      onBack={() => setSelectedPhone(null)}
                    />
                  ) : (
                    <SMSThreadsList
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      selectedPhone={selectedPhone}
                      onSelectPhone={setSelectedPhone}
                      onNewConversation={handleNewConversation}
                    />
                  )}
                </div>

                {/* Desktop: Always show conversation */}
                <div className="hidden lg:block lg:col-span-2">
                  <SMSConversationView
                    selectedPhone={selectedPhone}
                    onBack={() => setSelectedPhone(null)}
                  />
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Calls Tab */}
          <TabsContent value="calls" className="m-0">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="w-5 h-5" />
                    Historique des appels
                  </CardTitle>
                  <CardDescription>
                    Les appels sont initiés via OpenPhone. L'historique est synchronisé via webhook.
                  </CardDescription>
                </div>
                <Button onClick={() => setNewCallOpen(true)} className="gap-2">
                  <PhoneCall className="w-4 h-4" />
                  Nouvel appel
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {callsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                      ))}
                    </div>
                  ) : callHistory && callHistory.length > 0 ? (
                    <div className="divide-y">
                      {callHistory.map((call: any) => (
                        <div
                          key={call.id}
                          className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              call.status === "missed" ? "bg-destructive/10" :
                              call.direction === "outbound" ? "bg-cyan-500/10" : "bg-emerald-500/10"
                            }`}>
                              {getCallStatusIcon(call)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">
                                  {call.direction === "outbound" ? "Appel vers" : "Appel de"}
                                </span>
                                {call.client_name ? (
                                  <span className="font-medium text-primary">
                                    {call.client_name}
                                  </span>
                                ) : null}
                                <span className="font-mono text-sm text-muted-foreground">
                                  {formatPhoneDisplay(call.phone_number || "N/A")}
                                </span>
                                {call.agent_name && (
                                  <Badge variant="secondary" className="text-xs">
                                    <User className="w-3 h-3 mr-1" />
                                    {call.agent_name}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                {getCallStatusBadge(call)}
                                {call.duration_seconds > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {Math.floor(call.duration_seconds / 60)}:{String(call.duration_seconds % 60).padStart(2, '0')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">
                                {call.created_at ? format(new Date(call.created_at), "d MMM yyyy", { locale: fr }) : ""}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {call.created_at ? format(new Date(call.created_at), "HH:mm", { locale: fr }) : ""}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCall(call.phone_number)}
                            >
                              <Phone className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground">Aucun appel récent</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Configurez le webhook pour voir l'historique
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="m-0">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Status Card */}
              <Card>
                <CardHeader>
                  <CardTitle>État de la connexion</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      {hasOpenPhoneConfig ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-destructive" />
                      )}
                      <span className="font-medium">
                        {hasOpenPhoneConfig ? "API OpenPhone connectée" : "API non configurée"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {hasOpenPhoneConfig
                        ? `${openPhoneNumbers.length} ligne(s) disponible(s)`
                        : "Ajoutez OPENPHONE_API_KEY dans les secrets"}
                    </p>
                  </div>

                  {hasOpenPhoneConfig && openPhoneNumbers && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Lignes téléphoniques</h4>
                      {openPhoneNumbers.map((num: any) => (
                        <div key={num.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Phone className="w-4 h-4 text-cyan-500" />
                            <span className="font-mono text-sm">{num.formattedNumber || num.phoneNumber}</span>
                          </div>
                          <Badge variant="outline">{num.name || "Principale"}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Webhook Setup Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Configuration Webhook</CardTitle>
                  <CardDescription>
                    Pour recevoir les SMS entrants en temps réel
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-600 dark:text-amber-400">
                          Configuration requise dans OpenPhone
                        </p>
                        <ol className="text-sm text-muted-foreground mt-2 space-y-1 list-decimal ml-4">
                          <li>Allez dans OpenPhone → Settings → Webhooks</li>
                          <li>Créez un nouveau webhook</li>
                          <li>Copiez l'URL ci-dessous</li>
                          <li>Sélectionnez les événements: message.received, call.completed</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>URL du Webhook</Label>
                    <div className="flex gap-2">
                      <Input
                        value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openphone-webhook`}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="pt-4 space-y-2">
                    <Button variant="outline" className="w-full" asChild>
                      <a href="https://app.openphone.com/settings/webhooks" target="_blank" rel="noopener noreferrer">
                        <Settings className="w-4 h-4 mr-2" />
                        Configurer les Webhooks OpenPhone
                      </a>
                    </Button>
                    <Button variant="outline" className="w-full" asChild>
                      <a href="https://app.openphone.com/settings/api" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Gérer les clés API
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* New Conversation Dialog */}
      <Dialog open={newConversationOpen} onOpenChange={(open) => {
        setNewConversationOpen(open);
        if (!open) {
          // Reset form on close
          setSelectedClientId(undefined);
          setSelectedClientName("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle conversation SMS</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Client Selection */}
            <div className="space-y-2">
              <ClientSearchAutocomplete
                label="Sélectionner un client (optionnel)"
                placeholder="Rechercher par nom, email, téléphone..."
                selectedClientId={selectedClientId}
                onSelect={(client) => {
                  setSelectedClientId(client.user_id);
                  setSelectedClientName(client.full_name || client.email || "");
                  // Auto-fill phone number if client has one
                  if (client.phone) {
                    setPhoneNumber(client.phone);
                  }
                }}
              />
              {selectedClientId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    setSelectedClientId(undefined);
                    setSelectedClientName("");
                  }}
                >
                  Effacer la sélection
                </Button>
              )}
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {selectedClientId ? "ou modifier le numéro" : "ou entrer manuellement"}
                </span>
              </div>
            </div>

            {/* Phone Number Input */}
            <div className="space-y-2">
              <Label htmlFor="new-phone">Numéro de téléphone</Label>
              <Input
                id="new-phone"
                type="tel"
                placeholder="(514) 555-1234"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  // Clear client selection if manually typing different number
                  if (selectedClientId) {
                    setSelectedClientId(undefined);
                    setSelectedClientName("");
                  }
                }}
                className={!isPhoneValid ? "border-destructive" : ""}
              />
              {!isPhoneValid && phoneNumber.length > 0 && (
                <p className="text-xs text-destructive">Format invalide</p>
              )}
            </div>

            {/* Message Input */}
            <div className="space-y-2">
              <Label htmlFor="new-message">Message</Label>
              <Textarea
                id="new-message"
                placeholder="Tapez votre message..."
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                rows={4}
                maxLength={1600}
              />
              <p className="text-xs text-muted-foreground text-right">
                {smsMessage.length}/1600
              </p>
            </div>

            {/* Send Button */}
            <Button
              type="button"
              className="w-full"
              onClick={handleStartNewConversation}
              disabled={!phoneNumber || !smsMessage || !isPhoneValid || smsMutation.isPending}
            >
              {smsMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {smsMutation.isPending ? "Envoi..." : "Envoyer et démarrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Call Dialog */}
      <Dialog open={newCallOpen} onOpenChange={(open) => {
        setNewCallOpen(open);
        if (!open) {
          setCallPhoneNumber("");
          setCallClientId(undefined);
          setCallClientName("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5" />
              Nouvel appel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Client Selection */}
            <div className="space-y-2">
              <ClientSearchAutocomplete
                label="Sélectionner un client (optionnel)"
                placeholder="Rechercher par nom, email, téléphone..."
                selectedClientId={callClientId}
                onSelect={(client) => {
                  setCallClientId(client.user_id);
                  setCallClientName(client.full_name || client.email || "");
                  if (client.phone) {
                    setCallPhoneNumber(client.phone);
                  }
                }}
              />
              {callClientId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    setCallClientId(undefined);
                    setCallClientName("");
                  }}
                >
                  Effacer la sélection
                </Button>
              )}
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {callClientId ? "ou modifier le numéro" : "ou entrer manuellement"}
                </span>
              </div>
            </div>

            {/* Phone Number Input */}
            <div className="space-y-2">
              <Label htmlFor="call-phone">Numéro de téléphone</Label>
              <Input
                id="call-phone"
                type="tel"
                placeholder="(514) 555-1234"
                value={callPhoneNumber}
                onChange={(e) => {
                  setCallPhoneNumber(e.target.value);
                  if (callClientId) {
                    setCallClientId(undefined);
                    setCallClientName("");
                  }
                }}
                className={callPhoneNumber && !isValidPhone(callPhoneNumber) ? "border-destructive" : ""}
              />
              {callPhoneNumber && !isValidPhone(callPhoneNumber) && (
                <p className="text-xs text-destructive">Format invalide</p>
              )}
            </div>

            {/* Call Button */}
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                if (!callPhoneNumber.trim() || !isValidPhone(callPhoneNumber)) {
                  toast.error("Erreur", { description: "Entrez un numéro de téléphone valide." });
                  return;
                }
                handleCall(callPhoneNumber);
                setNewCallOpen(false);
                setCallPhoneNumber("");
                setCallClientId(undefined);
                setCallClientName("");
              }}
              disabled={!callPhoneNumber || !isValidPhone(callPhoneNumber)}
            >
              <PhoneOutgoing className="w-4 h-4 mr-2" />
              Appeler via OpenPhone
            </Button>
            
            <p className="text-xs text-muted-foreground text-center">
              L'appel sera initié dans l'application OpenPhone
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminTelephony;
