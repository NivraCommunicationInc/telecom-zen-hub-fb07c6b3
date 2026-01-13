import { useState } from "react";
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
  RefreshCw
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { formatPhoneDisplay, toE164, isValidPhone } from "@/lib/phoneUtils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const AdminTelephony = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("messages");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [dialerMode, setDialerMode] = useState<"call" | "sms">("sms");
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch OpenPhone numbers
  const { data: openPhoneNumbers, isLoading: numbersLoading } = useQuery({
    queryKey: ["openphone-numbers"],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;
      
      if (!token) return [];

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openphone-phone-numbers`,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const err = await res.json();
        console.error("Failed to fetch OpenPhone numbers:", err);
        return [];
      }

      const data = await res.json();
      return data.phoneNumbers || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch OpenPhone message history
  const { data: messageHistory, isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ["openphone-messages"],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;
      
      if (!token) return [];

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openphone-conversations?maxResults=50`,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        console.error("Failed to fetch messages");
        return [];
      }

      const data = await res.json();
      return data.messages || [];
    },
    staleTime: 30 * 1000,
  });

  // Fetch OpenPhone call history
  const { data: callHistory, isLoading: callsLoading, refetch: refetchCalls } = useQuery({
    queryKey: ["openphone-calls"],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;
      
      if (!token) return [];

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openphone-call-history?maxResults=50`,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        console.error("Failed to fetch calls");
        return [];
      }

      const data = await res.json();
      return data.calls || [];
    },
    staleTime: 30 * 1000,
  });

  // Send SMS mutation
  const smsMutation = useMutation({
    mutationFn: async ({ to, text }: { to: string; text: string }) => {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;
      
      if (!token) throw new Error("Non authentifié");

      const e164 = toE164(to);
      if (!e164) throw new Error("Numéro de téléphone invalide");

      if (!text.trim()) throw new Error("Le message ne peut pas être vide");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openphone-sms`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: e164,
            text: text.trim(),
            agentName: user?.email,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || "Échec de l'envoi SMS");
      return data;
    },
    onSuccess: () => {
      toast.success("SMS envoyé", {
        description: "Le message a été envoyé avec succès",
      });
      setPhoneNumber("");
      setSmsMessage("");
      refetchMessages();
    },
    onError: (err: Error) => {
      toast.error("Erreur", { description: err.message });
    },
  });

  // Aggregate stats from OpenPhone data
  const stats = {
    totalCalls: callHistory?.length || 0,
    totalSms: messageHistory?.length || 0,
    totalToday: [...(callHistory || []), ...(messageHistory || [])].filter((item: any) => {
      const today = new Date();
      const itemDate = new Date(item.createdAt);
      return itemDate.toDateString() === today.toDateString();
    }).length,
  };

  const handleCall = () => {
    const e164 = toE164(phoneNumber);
    if (!e164) {
      toast.error("Numéro invalide");
      return;
    }

    // Open OpenPhone in new tab for call (iframe doesn't work due to security)
    window.open(`https://app.openphone.com/dialer?number=${encodeURIComponent(e164)}`, "_blank");
    
    toast.success("OpenPhone ouvert", {
      description: "L'appel va démarrer dans OpenPhone (nouvel onglet)",
    });
  };

  const handleSendSms = () => {
    if (!phoneNumber || !smsMessage) return;
    smsMutation.mutate({ to: phoneNumber, text: smsMessage });
  };

  const getCallStatusIcon = (call: any) => {
    if (call.status === "missed") {
      return <PhoneMissed className="w-4 h-4 text-destructive" />;
    }
    if (call.direction === "outgoing") {
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
    return <Badge variant="outline" className="text-xs">{call.status}</Badge>;
  };

  const isPhoneValid = phoneNumber ? isValidPhone(phoneNumber) : true;
  const hasOpenPhoneConfig = openPhoneNumbers && openPhoneNumbers.length > 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-2">
              <Phone className="w-8 h-8 text-cyan-400" />
              Téléphonie (OpenPhone)
            </h1>
            <p className="text-muted-foreground mt-1">
              Appeler et envoyer des SMS directement depuis l'admin
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                refetchMessages();
                refetchCalls();
                toast.success("Données actualisées");
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="https://app.openphone.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Ouvrir OpenPhone
              </a>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center">
                <Phone className="w-6 h-6 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalCalls}</p>
                <p className="text-sm text-muted-foreground">Appels récents</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalSms}</p>
                <p className="text-sm text-muted-foreground">SMS récents</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalToday}</p>
                <p className="text-sm text-muted-foreground">Aujourd'hui</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Dialer Panel */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-cyan-400" />
                Composeur
              </CardTitle>
              <CardDescription>
                Appeler ou envoyer un SMS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasOpenPhoneConfig && !numbersLoading && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-amber-500">Configuration requise</p>
                      <p className="text-muted-foreground mt-1">
                        Vérifiez que la clé API OpenPhone est configurée.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {hasOpenPhoneConfig && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {openPhoneNumbers.length} ligne(s) disponible(s)
                    </span>
                  </div>
                </div>
              )}

              {/* Mode Toggle */}
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <Button
                  variant={dialerMode === "call" ? "default" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setDialerMode("call")}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Appel
                </Button>
                <Button
                  variant={dialerMode === "sms" ? "default" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setDialerMode("sms")}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  SMS
                </Button>
              </div>

              {/* Phone Input */}
              <div className="space-y-2">
                <Label htmlFor="phone">Numéro de téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(514) 555-1234"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className={!isPhoneValid ? "border-destructive" : ""}
                />
                {!isPhoneValid && (
                  <p className="text-xs text-destructive">Format invalide</p>
                )}
              </div>

              {/* SMS Message (only for SMS mode) */}
              {dialerMode === "sms" && (
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
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
              )}

              {/* Info for calls */}
              {dialerMode === "call" && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-muted-foreground">
                      L'appel s'ouvrira dans OpenPhone (nouvel onglet). Utilisez l'app OpenPhone pour les contrôles d'appel.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Button */}
              {dialerMode === "call" ? (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCall}
                  disabled={!phoneNumber || !isPhoneValid}
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Appeler via OpenPhone
                </Button>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSendSms}
                  disabled={!phoneNumber || !smsMessage || !isPhoneValid || smsMutation.isPending || !hasOpenPhoneConfig}
                >
                  {smsMutation.isPending ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 mr-2" />
                  )}
                  {smsMutation.isPending ? "Envoi en cours..." : "Envoyer SMS"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* History Panels */}
          <Card className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="pb-0">
                <TabsList>
                  <TabsTrigger value="messages" className="gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Messages ({messageHistory?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="calls" className="gap-2">
                    <Phone className="w-4 h-4" />
                    Appels ({callHistory?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="gap-2">
                    <Settings className="w-4 h-4" />
                    Configuration
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="pt-6">
                {/* Messages Tab */}
                <TabsContent value="messages" className="m-0">
                  <ScrollArea className="h-[500px]">
                    {messagesLoading ? (
                      <div className="space-y-3 p-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                        ))}
                      </div>
                    ) : messageHistory && messageHistory.length > 0 ? (
                      <div className="divide-y">
                        {messageHistory.map((msg: any) => (
                          <div
                            key={msg.id}
                            className="flex items-start gap-4 p-4 hover:bg-accent/50 transition-colors"
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              msg.direction === "outgoing" ? "bg-cyan-500/10" : "bg-emerald-500/10"
                            }`}>
                              {msg.direction === "outgoing" ? (
                                <ArrowUpRight className="w-5 h-5 text-cyan-500" />
                              ) : (
                                <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">
                                  {msg.direction === "outgoing" ? "Envoyé à" : "Reçu de"}
                                </span>
                                <span className="font-mono text-sm">
                                  {formatPhoneDisplay(msg.to?.[0] || msg.from || "N/A")}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {msg.direction === "outgoing" ? "Sortant" : "Entrant"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {msg.content || msg.body || "(Pas de contenu)"}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {msg.createdAt ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: fr }) : ""}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <p className="text-muted-foreground">Aucun message récent</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Les SMS envoyés et reçus apparaîtront ici
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Calls Tab */}
                <TabsContent value="calls" className="m-0">
                  <ScrollArea className="h-[500px]">
                    {callsLoading ? (
                      <div className="space-y-3 p-4">
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
                                call.direction === "outgoing" ? "bg-cyan-500/10" : "bg-emerald-500/10"
                              }`}>
                                {getCallStatusIcon(call)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {call.direction === "outgoing" ? "Appel vers" : "Appel de"}
                                  </span>
                                  <span className="font-mono text-sm">
                                    {formatPhoneDisplay(call.to || call.from || "N/A")}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  {getCallStatusBadge(call)}
                                  {call.duration && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {Math.floor(call.duration / 60)}:{String(call.duration % 60).padStart(2, '0')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">
                                {call.createdAt ? format(new Date(call.createdAt), "d MMM yyyy", { locale: fr }) : ""}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {call.createdAt ? format(new Date(call.createdAt), "HH:mm", { locale: fr }) : ""}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <p className="text-muted-foreground">Aucun appel récent</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          L'historique des appels apparaîtra ici
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings" className="m-0 space-y-4">
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      {hasOpenPhoneConfig ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-destructive" />
                      )}
                      <span className="font-medium">
                        {hasOpenPhoneConfig ? "API OpenPhone connectée" : "API OpenPhone non configurée"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {hasOpenPhoneConfig
                        ? "SMS envoyés via API. Les appels s'ouvrent dans OpenPhone."
                        : "Ajoutez la clé OPENPHONE_API_KEY dans les secrets du projet."}
                    </p>
                  </div>

                  {hasOpenPhoneConfig && openPhoneNumbers && (
                    <div className="p-4 rounded-lg border">
                      <h4 className="font-medium mb-3">Lignes téléphoniques</h4>
                      <div className="space-y-2">
                        {openPhoneNumbers.map((num: any) => (
                          <div key={num.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <Phone className="w-4 h-4 text-cyan-500" />
                              <span className="font-mono">{num.formattedNumber || num.phoneNumber}</span>
                            </div>
                            <Badge variant="outline">{num.name || "Principale"}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-4 rounded-lg border">
                    <h4 className="font-medium mb-2">Accès OpenPhone</h4>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full" asChild>
                        <a href="https://app.openphone.com" target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Ouvrir l'application OpenPhone
                        </a>
                      </Button>
                      <Button variant="outline" className="w-full" asChild>
                        <a href="https://app.openphone.com/settings/api" target="_blank" rel="noopener noreferrer">
                          <Settings className="w-4 h-4 mr-2" />
                          Gérer les clés API OpenPhone
                        </a>
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminTelephony;
