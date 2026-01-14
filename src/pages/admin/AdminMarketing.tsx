import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Mail, 
  FileText, 
  Zap, 
  BarChart3, 
  Plus, 
  Search,
  Send,
  Clock,
  Users,
  TrendingUp,
  Play,
  Pause,
  Eye
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import MarketingTemplates from "@/components/marketing/MarketingTemplates";
import MarketingCampaigns from "@/components/marketing/MarketingCampaigns";
import MarketingAutomations from "@/components/marketing/MarketingAutomations";
import MarketingAnalytics from "@/components/marketing/MarketingAnalytics";

const AdminMarketing = () => {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch overview stats
  const { data: stats } = useQuery({
    queryKey: ["marketing-stats"],
    queryFn: async () => {
      const [templates, campaigns, automations, sends] = await Promise.all([
        supabase.from("email_templates").select("id", { count: "exact" }),
        supabase.from("email_campaigns").select("id, status", { count: "exact" }),
        supabase.from("email_automation_rules").select("id, is_active", { count: "exact" }),
        supabase.from("email_sends").select("id, status", { count: "exact" })
      ]);

      const activeCampaigns = campaigns.data?.filter(c => c.status === "sending" || c.status === "scheduled").length || 0;
      const activeAutomations = automations.data?.filter(a => a.is_active).length || 0;
      const totalSent = sends.data?.filter(s => s.status !== "queued" && s.status !== "failed").length || 0;
      const totalOpened = sends.data?.filter(s => s.status === "opened" || s.status === "clicked").length || 0;

      return {
        totalTemplates: templates.count || 0,
        totalCampaigns: campaigns.count || 0,
        activeCampaigns,
        totalAutomations: automations.count || 0,
        activeAutomations,
        totalSent,
        totalOpened,
        openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0
      };
    }
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Marketing Email</h1>
            <p className="text-muted-foreground">
              Gérez vos campagnes, templates et automatisations
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setActiveTab("templates")}>
              <FileText className="h-4 w-4 mr-2" />
              Nouveau Template
            </Button>
            <Button onClick={() => setActiveTab("campaigns")}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Campagne
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Templates</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalTemplates || 0}</div>
              <p className="text-xs text-muted-foreground">templates actifs</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Campagnes</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCampaigns || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.activeCampaigns || 0} en cours
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Automatisations</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalAutomations || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.activeAutomations || 0} actives
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taux d'ouverture</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.openRate || 0}%</div>
              <p className="text-xs text-muted-foreground">
                {stats?.totalSent || 0} emails envoyés
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Vue d'ensemble</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Campagnes</span>
            </TabsTrigger>
            <TabsTrigger value="automations" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Automatisations</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <MarketingAnalytics />
          </TabsContent>

          <TabsContent value="templates">
            <MarketingTemplates />
          </TabsContent>

          <TabsContent value="campaigns">
            <MarketingCampaigns />
          </TabsContent>

          <TabsContent value="automations">
            <MarketingAutomations />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminMarketing;
