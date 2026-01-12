import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  XCircle
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { formatPhoneDisplay } from "@/lib/phoneUtils";

const AdminTelephony = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("activity");

  // Fetch recent telephony logs
  const { data: logs, isLoading } = useQuery({
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

  // Aggregate stats
  const stats = {
    totalCalls: logs?.filter(l => l.action === "call").length || 0,
    totalSms: logs?.filter(l => l.action === "sms").length || 0,
    totalToday: logs?.filter(l => {
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
              Journal des appels et SMS avec les clients
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href="https://app.openphone.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Ouvrir OpenPhone
            </a>
          </Button>
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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="w-4 h-4" />
              Activité
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="space-y-4">
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-cyan-400" />
                  Journal des communications
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : logs && logs.length > 0 ? (
                  <div className="space-y-2">
                    {logs.map((log: any) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
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
                      Les appels et SMS avec les clients apparaîtront ici
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configuration OpenPhone</CardTitle>
                <CardDescription>
                  Paramètres d'intégration avec OpenPhone. Les clés API sont stockées côté serveur uniquement.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <span className="font-medium">Intégration de base active</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Les boutons "Appeler" et "SMS" ouvrent OpenPhone avec le numéro client préconfiguré.
                    Chaque action est journalisée pour l'audit.
                  </p>
                </div>

                <div className="p-4 rounded-lg border bg-amber-500/10 border-amber-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="w-5 h-5 text-amber-500" />
                    <span className="font-medium">API OpenPhone (optionnel)</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Pour synchroniser automatiquement l'historique des appels depuis OpenPhone, 
                    configurez les clés API dans les secrets du projet.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">OPENPHONE_API_KEY — Non configuré</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">OPENPHONE_WEBHOOK_SECRET — Non configuré</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium mb-2">Lien direct OpenPhone</h4>
                  <Button variant="outline" asChild className="w-full">
                    <a href="https://app.openphone.com/settings/api" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Gérer les clés API OpenPhone
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminTelephony;
