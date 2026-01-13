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
  Maximize2,
  Minimize2
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { formatPhoneDisplay, toE164, isValidPhone, getOpenPhoneDeepLink } from "@/lib/phoneUtils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const AdminTelephony = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("openphone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [dialerMode, setDialerMode] = useState<"call" | "sms">("call");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch recent telephony logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["telephony-logs", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("telephony_logs")
        .select(`
          *,
          profiles:client_id(full_name, email, phone)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (searchQuery) {
        query = query.or(`agent_name.ilike.%${searchQuery}%,phone_number.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      
      if (error) {
        console.warn("telephony_logs query error:", error.message);
        return [];
      }
      return data || [];
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ["telephony-logs"] });
    },
    onError: (err: Error) => {
      toast.error("Erreur", { description: err.message });
    },
  });

  // Log call action (for tracking only - actual call is via deep link)
  const logCallAction = async () => {
    const e164 = toE164(phoneNumber);
    if (!e164) return;

    try {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;
      
      if (token) {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-telephony-action`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              phone_number: e164,
              action: "call",
              direction: "outbound",
            }),
          }
        );
      }
    } catch (err) {
      console.warn("Failed to log call action:", err);
    }
  };

  // Aggregate stats
  const stats = {
    totalCalls: logs?.filter((l: any) => l.action === "call").length || 0,
    totalSms: logs?.filter((l: any) => l.action === "sms").length || 0,
    totalToday: logs?.filter((l: any) => {
      const today = new Date();
      const logDate = new Date(l.created_at);
      return logDate.toDateString() === today.toDateString();
    }).length || 0,
  };

  const getActionIcon = (action: string) => {
    if (action === "call") {
      return <Phone className="w-4 h-4 text-cyan-500" />;
    }
    return <MessageSquare className="w-4 h-4 text-emerald-500" />;
  };

  const getDirectionBadge = (direction: string) => {
    if (direction === "outbound") {
      return (
        <Badge variant="outline" className="text-xs gap-1">
          <ArrowUpRight className="w-3 h-3" />
          Sortant
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs gap-1 text-emerald-500 border-emerald-500/30">
        <ArrowDownLeft className="w-3 h-3" />
        Entrant
      </Badge>
    );
  };

  const handleCall = () => {
    const e164 = toE164(phoneNumber);
    if (!e164) {
      toast.error("Numéro invalide");
      return;
    }
    
    // Log the action for tracking
    logCallAction();
    
    // Open OpenPhone with the number pre-filled
    const deepLink = getOpenPhoneDeepLink(e164, "call");
    window.open(deepLink, "_blank");
    
    toast.success("OpenPhone ouvert", {
      description: "L'appel va démarrer dans OpenPhone",
    });
    
    queryClient.invalidateQueries({ queryKey: ["telephony-logs"] });
  };

  const handleSendSms = () => {
    if (!phoneNumber || !smsMessage) return;
    smsMutation.mutate({ to: phoneNumber, text: smsMessage });
  };

  const isPhoneValid = phoneNumber ? isValidPhone(phoneNumber) : true;
  const hasOpenPhoneConfig = openPhoneNumbers && openPhoneNumbers.length > 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Fullscreen OpenPhone Overlay */}
        {isFullscreen && (
          <div className="fixed inset-0 z-50 bg-background">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Phone className="w-6 h-6 text-cyan-400" />
                <span className="font-semibold">OpenPhone</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(false)}>
                <Minimize2 className="w-4 h-4 mr-2" />
                Réduire
              </Button>
            </div>
            <iframe
              src="https://app.openphone.com"
              className="w-full h-[calc(100vh-65px)]"
              title="OpenPhone"
              allow="microphone; camera; clipboard-write"
            />
          </div>
        )}

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
            <Button variant="outline" onClick={() => setIsFullscreen(true)}>
              <Maximize2 className="w-4 h-4 mr-2" />
              Plein écran
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
                <p className="text-sm text-muted-foreground">Appels</p>
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
                <p className="text-sm text-muted-foreground">SMS</p>
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
                        Vérifiez que la clé API OpenPhone est configurée dans les secrets.
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
                      L'appel s'ouvrira dans OpenPhone Web. Assurez-vous d'être connecté à votre compte.
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

          {/* Main Content - Now prioritizing embedded OpenPhone */}
          <Card className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="pb-0">
                <TabsList>
                  <TabsTrigger value="openphone" className="gap-2">
                    <Phone className="w-4 h-4" />
                    OpenPhone
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="gap-2">
                    <Activity className="w-4 h-4" />
                    Activité
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="gap-2">
                    <Settings className="w-4 h-4" />
                    Configuration
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="pt-6">
                {/* OpenPhone Embedded Tab */}
                <TabsContent value="openphone" className="m-0">
                  <div className="rounded-lg border overflow-hidden bg-muted/30">
                    <div className="flex items-center justify-between p-3 border-b bg-muted/50">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span>Connecté à OpenPhone - Passez vos appels et SMS directement ici</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(true)}>
                        <Maximize2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <iframe
                      src="https://app.openphone.com"
                      className="w-full h-[600px]"
                      title="OpenPhone"
                      allow="microphone; camera; clipboard-write"
                    />
                  </div>
                </TabsContent>

                {/* Activity Log Tab */}
                <TabsContent value="activity" className="m-0 space-y-4">
                  {/* Search */}
                  <div className="flex gap-2 max-w-md">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher par agent ou numéro..."
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Activity Log */}
                  <div className="border rounded-lg">
                    <div className="p-4 border-b bg-muted/30">
                      <h3 className="font-medium flex items-center gap-2">
                        <Clock className="w-4 h-4 text-cyan-400" />
                        Journal des communications
                      </h3>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {logsLoading ? (
                        <div className="p-4 space-y-3">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                          ))}
                        </div>
                      ) : logs && logs.length > 0 ? (
                        <div className="divide-y">
                          {logs.map((log: any) => (
                            <div
                              key={log.id}
                              className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                  {getActionIcon(log.action)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {log.action === "call" ? "Appel" : "SMS"}
                                    </span>
                                    {getDirectionBadge(log.direction)}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <User className="w-3 h-3" />
                                    <span>{log.agent_name || "Agent"}</span>
                                    <span>→</span>
                                    <span className="font-mono">
                                      {log.phone_number ? formatPhoneDisplay(log.phone_number) : "N/A"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(log.created_at), "d MMM yyyy", { locale: fr })}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(log.created_at), "HH:mm", { locale: fr })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                          <p className="text-muted-foreground">Aucune communication enregistrée</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Les appels et SMS apparaîtront ici
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
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
                        ? "SMS envoyés directement via API. Les appels se font via OpenPhone intégré."
                        : "Ajoutez la clé OPENPHONE_API_KEY dans les secrets du projet pour activer les fonctionnalités avancées."}
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
                    <h4 className="font-medium mb-2">Accès direct OpenPhone</h4>
                    <Button variant="outline" asChild className="w-full">
                      <a href="https://app.openphone.com/settings/api" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Gérer les clés API OpenPhone
                      </a>
                    </Button>
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
