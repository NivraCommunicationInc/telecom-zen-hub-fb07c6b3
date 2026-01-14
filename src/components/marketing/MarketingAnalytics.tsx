import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Mail, Send, Eye, MousePointer, AlertTriangle, TrendingUp, Users, Clock } from "lucide-react";

const COLORS = ["#0d9488", "#0891b2", "#f59e0b", "#ef4444", "#8b5cf6"];

const MarketingAnalytics = () => {
  const [dateRange, setDateRange] = useState("30");

  // Fetch email sends analytics
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["email-analytics", dateRange],
    queryFn: async () => {
      const startDate = subDays(new Date(), parseInt(dateRange)).toISOString();
      
      const { data: sends, error } = await supabase
        .from("email_sends")
        .select("*")
        .gte("created_at", startDate);
      
      if (error) throw error;

      // Calculate metrics
      const total = sends?.length || 0;
      const sent = sends?.filter(s => s.status !== "queued" && s.status !== "failed").length || 0;
      const delivered = sends?.filter(s => ["delivered", "opened", "clicked"].includes(s.status)).length || 0;
      const opened = sends?.filter(s => ["opened", "clicked"].includes(s.status)).length || 0;
      const clicked = sends?.filter(s => s.status === "clicked").length || 0;
      const bounced = sends?.filter(s => s.status === "bounced").length || 0;
      const failed = sends?.filter(s => s.status === "failed").length || 0;

      // Status distribution for pie chart
      const statusDistribution = [
        { name: "Livrés", value: delivered - opened, color: "#0d9488" },
        { name: "Ouverts", value: opened - clicked, color: "#0891b2" },
        { name: "Cliqués", value: clicked, color: "#10b981" },
        { name: "Rebonds", value: bounced, color: "#f59e0b" },
        { name: "Échoués", value: failed, color: "#ef4444" }
      ].filter(s => s.value > 0);

      // Daily sends for line chart
      const dailyData: Record<string, { date: string; sent: number; opened: number; clicked: number }> = {};
      const days = parseInt(dateRange);
      
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd");
        dailyData[date] = { date, sent: 0, opened: 0, clicked: 0 };
      }

      sends?.forEach(send => {
        const date = format(new Date(send.created_at), "yyyy-MM-dd");
        if (dailyData[date]) {
          if (send.status !== "queued" && send.status !== "failed") dailyData[date].sent++;
          if (["opened", "clicked"].includes(send.status)) dailyData[date].opened++;
          if (send.status === "clicked") dailyData[date].clicked++;
        }
      });

      const dailyTrend = Object.values(dailyData).map(d => ({
        ...d,
        dateLabel: format(new Date(d.date), "d MMM", { locale: fr })
      }));

      return {
        total,
        sent,
        delivered,
        opened,
        clicked,
        bounced,
        failed,
        deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
        openRate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
        clickRate: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
        bounceRate: sent > 0 ? Math.round((bounced / sent) * 100) : 0,
        statusDistribution,
        dailyTrend
      };
    }
  });

  // Fetch recent campaigns performance
  const { data: recentCampaigns } = useQuery({
    queryKey: ["recent-campaigns-performance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_campaigns")
        .select("*")
        .in("status", ["sent", "sending"])
        .order("started_at", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch automation performance
  const { data: automationStats } = useQuery({
    queryKey: ["automation-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_automation_rules")
        .select("name, trigger_type, total_triggered, total_sent, is_active")
        .eq("is_active", true)
        .order("total_sent", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-1/3" />
            </CardHeader>
            <CardContent>
              <div className="h-48 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex justify-end">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Période" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 derniers jours</SelectItem>
            <SelectItem value="30">30 derniers jours</SelectItem>
            <SelectItem value="90">90 derniers jours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails envoyés</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.sent || 0}</div>
            <p className="text-xs text-muted-foreground">
              Taux de livraison: {analytics?.deliveryRate}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux d'ouverture</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.openRate}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.opened} emails ouverts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de clics</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.clickRate}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.clicked} clics
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de rebond</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.bounceRate}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.bounced} rebonds
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Daily Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tendance des envois</CardTitle>
            <CardDescription>Évolution sur la période</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={analytics?.dailyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dateLabel" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="sent" 
                  name="Envoyés"
                  stroke="#0d9488" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="opened" 
                  name="Ouverts"
                  stroke="#0891b2" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="clicked" 
                  name="Cliqués"
                  stroke="#10b981" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribution des statuts</CardTitle>
            <CardDescription>Répartition des emails</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={analytics?.statusDistribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {analytics?.statusDistribution?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Campaigns & Automations */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle>Campagnes récentes</CardTitle>
            <CardDescription>Performance des 5 dernières campagnes</CardDescription>
          </CardHeader>
          <CardContent>
            {recentCampaigns?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Aucune campagne envoyée</p>
            ) : (
              <div className="space-y-4">
                {recentCampaigns?.map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.total_sent} envoyés • {campaign.total_opened} ouverts
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">
                        {campaign.total_sent > 0 
                          ? `${Math.round((campaign.total_opened / campaign.total_sent) * 100)}%`
                          : "0%"
                        }
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Automation Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Performance des automatisations</CardTitle>
            <CardDescription>Top 5 des automatisations actives</CardDescription>
          </CardHeader>
          <CardContent>
            {automationStats?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Aucune automatisation active</p>
            ) : (
              <div className="space-y-4">
                {automationStats?.map((auto) => (
                  <div key={auto.name} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{auto.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {auto.total_triggered} déclenchés • {auto.total_sent} envoyés
                      </p>
                    </div>
                    <Badge variant={auto.is_active ? "default" : "secondary"}>
                      {auto.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MarketingAnalytics;
