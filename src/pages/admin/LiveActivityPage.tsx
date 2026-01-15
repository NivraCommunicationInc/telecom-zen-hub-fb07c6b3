import React, { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  MapPin,
  ShoppingCart,
  UserPlus,
  LogIn,
  Zap,
  Users,
  RefreshCw,
  Search,
  Clock,
  TrendingUp,
  Eye,
  Wifi,
  Globe,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
} from "lucide-react";
import { useLiveActivityFeed, LiveActivity } from "@/hooks/useLiveActivityFeed";
import { QuebecMap } from "@/components/admin/live-activity/QuebecMap";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const activityIcons: Record<string, React.ElementType> = {
  order_started: ShoppingCart,
  order_completed: ShoppingCart,
  signup: UserPlus,
  login: LogIn,
  profile_update: Users,
  subscription: Zap,
  payment: CreditCard,
  page_view: Eye,
};

const activityColors: Record<string, { text: string; bg: string; border: string }> = {
  order_started: { text: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  order_completed: { text: "text-green-600", bg: "bg-green-500/10", border: "border-green-500/20" },
  signup: { text: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  login: { text: "text-purple-600", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  profile_update: { text: "text-indigo-600", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
  subscription: { text: "text-pink-600", bg: "bg-pink-500/10", border: "border-pink-500/20" },
  payment: { text: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  page_view: { text: "text-slate-600", bg: "bg-slate-500/10", border: "border-slate-500/20" },
};

const activityLabels: Record<string, string> = {
  order_started: "Commande débutée",
  order_completed: "Commande complétée",
  signup: "Inscription",
  login: "Connexion",
  profile_update: "Mise à jour profil",
  subscription: "Abonnement",
  payment: "Paiement",
  page_view: "Visite",
};

// Stat Card Component
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  trend?: number;
  color?: "default" | "green" | "blue" | "purple" | "amber" | "red";
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, trend, color = "default", subtitle }) => {
  const colorStyles = {
    default: "bg-card",
    green: "bg-green-500/5 border-green-500/20",
    blue: "bg-blue-500/5 border-blue-500/20",
    purple: "bg-purple-500/5 border-purple-500/20",
    amber: "bg-amber-500/5 border-amber-500/20",
    red: "bg-red-500/5 border-red-500/20",
  };

  const textColors = {
    default: "text-foreground",
    green: "text-green-600",
    blue: "text-blue-600",
    purple: "text-purple-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };

  const iconColors = {
    default: "text-muted-foreground/30",
    green: "text-green-500/30",
    blue: "text-blue-500/30",
    purple: "text-purple-500/30",
    amber: "text-amber-500/30",
    red: "text-red-500/30",
  };

  return (
    <Card className={cn("transition-all hover:shadow-md", colorStyles[color])}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className={cn("text-xs font-medium", color === "default" ? "text-muted-foreground" : textColors[color])}>
              {title}
            </p>
            <p className={cn("text-2xl font-bold tracking-tight", textColors[color])}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend !== undefined && (
              <div className="flex items-center gap-1 text-xs">
                {trend >= 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                )}
                <span className={trend >= 0 ? "text-green-600" : "text-red-600"}>
                  {Math.abs(trend)}%
                </span>
                <span className="text-muted-foreground">vs hier</span>
              </div>
            )}
          </div>
          <Icon className={cn("h-8 w-8", iconColors[color])} />
        </div>
      </CardContent>
    </Card>
  );
};

export default function LiveActivityPage() {
  const { activities, stats, isLoading, refetch, activitiesByCity } = useLiveActivityFeed({
    limit: 100,
    autoRefresh: true,
    refreshInterval: 3000,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // Filter activities
  const filteredActivities = activities.filter((a) => {
    if (typeFilter !== "all" && a.activity_type !== typeFilter) return false;
    if (selectedCity && a.city !== selectedCity) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        a.activity_label?.toLowerCase().includes(query) ||
        a.city?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Prepare map points
  const mapPoints = activities
    .filter((a) => a.latitude && a.longitude)
    .map((a) => ({
      id: a.id,
      lat: a.latitude!,
      lng: a.longitude!,
      city: a.city || "Inconnu",
      activityType: a.activity_type,
      label: a.activity_label || "",
      isRecent: Date.now() - new Date(a.created_at).getTime() < 5 * 60 * 1000,
    }));

  // Get unique activity types
  const activityTypes = [...new Set(activities.map((a) => a.activity_type))];

  // Get top cities
  const topCities = Object.entries(activitiesByCity)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, 10);

  // Calculate additional stats
  const recentActivities = activities.filter(
    (a) => Date.now() - new Date(a.created_at).getTime() < 5 * 60 * 1000
  ).length;
  
  const pageViews = activities.filter((a) => a.activity_type === "page_view").length;
  const payments = activities.filter((a) => a.activity_type === "payment").length;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              Activité en direct
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualisez l'activité des clients en temps réel sur la carte du Québec
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Connecté</span>
            </div>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            title="Dernière heure"
            value={stats.totalHour}
            icon={Clock}
            subtitle="actions"
          />
          <StatCard
            title="24 dernières heures"
            value={stats.total24h}
            icon={TrendingUp}
            subtitle="total"
          />
          <StatCard
            title="Commandes"
            value={stats.orders}
            icon={ShoppingCart}
            color="green"
          />
          <StatCard
            title="Inscriptions"
            value={stats.signups}
            icon={UserPlus}
            color="blue"
          />
          <StatCard
            title="Connexions"
            value={stats.logins}
            icon={LogIn}
            color="purple"
          />
          <StatCard
            title="Villes actives"
            value={stats.uniqueCities}
            icon={MapPin}
            color="amber"
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-500/5 to-emerald-500/10 border-green-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <Wifi className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{recentActivities}</p>
                  <p className="text-xs text-muted-foreground">Actif maintenant (5 min)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Eye className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pageViews}</p>
                  <p className="text-xs text-muted-foreground">Pages vues (24h)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CreditCard className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{payments}</p>
                  <p className="text-xs text-muted-foreground">Paiements (24h)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{mapPoints.length}</p>
                  <p className="text-xs text-muted-foreground">Points sur la carte</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Map */}
          <Card className="lg:col-span-3 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Carte du Québec
                {mapPoints.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {mapPoints.length} point{mapPoints.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[600px] bg-gradient-to-b from-background to-muted/30">
                <QuebecMap
                  points={mapPoints}
                  className="h-full"
                  onPointClick={(point) => setSelectedCity(point.city)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Cities Sidebar */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5" />
                Villes les plus actives
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="h-[550px]">
                <div className="space-y-1.5 pr-2">
                  {topCities.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <MapPin className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Aucune ville active</p>
                    </div>
                  ) : (
                    topCities.map(([city, cityActivities], index) => {
                      const hasRecent = cityActivities.some(
                        (a) => Date.now() - new Date(a.created_at).getTime() < 5 * 60 * 1000
                      );
                      const maxCount = topCities[0]?.[1]?.length || 1;
                      const percentage = (cityActivities.length / maxCount) * 100;

                      return (
                        <button
                          key={city}
                          onClick={() => setSelectedCity(selectedCity === city ? null : city)}
                          className={cn(
                            "w-full flex flex-col p-3 rounded-lg border transition-all",
                            selectedCity === city
                              ? "bg-primary/10 border-primary shadow-sm"
                              : "hover:bg-muted/50 border-transparent"
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-muted-foreground w-5">
                                #{index + 1}
                              </span>
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium text-sm">{city}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {hasRecent && (
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              )}
                              <Badge variant="secondary" className="text-xs">
                                {cityActivities.length}
                              </Badge>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                hasRecent ? "bg-green-500" : "bg-primary/50"
                              )}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Fil d'activité
                {filteredActivities.length > 0 && (
                  <Badge variant="outline">{filteredActivities.length}</Badge>
                )}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-48"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    {activityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {activityLabels[type] || type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCity && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCity(null)}
                    className="gap-1"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {selectedCity}
                    <span className="text-muted-foreground">×</span>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredActivities.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <Activity className="h-16 w-16 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">Aucune activité récente</p>
                    <p className="text-sm mt-1">Les nouvelles activités apparaîtront ici en temps réel</p>
                  </div>
                ) : (
                  filteredActivities.map((activity) => (
                    <ActivityRow key={activity.id} activity={activity} />
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function ActivityRow({ activity }: { activity: LiveActivity }) {
  const Icon = activityIcons[activity.activity_type] || Activity;
  const colors = activityColors[activity.activity_type] || activityColors.page_view;
  const isRecent = Date.now() - new Date(activity.created_at).getTime() < 60 * 1000;
  const isVeryRecent = Date.now() - new Date(activity.created_at).getTime() < 10 * 1000;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all duration-300",
        isVeryRecent && "bg-green-500/10 border-green-500/30 shadow-sm",
        isRecent && !isVeryRecent && "bg-primary/5 border-primary/20",
        !isRecent && "hover:bg-muted/50"
      )}
    >
      {/* Activity indicator */}
      {isVeryRecent && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      )}
      
      <div className={cn("p-2 rounded-lg", colors.bg, colors.border, "border")}>
        <Icon className={cn("h-4 w-4", colors.text)} />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{activity.activity_label || activityLabels[activity.activity_type]}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {activity.city && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {activity.city}
            </span>
          )}
          <span>•</span>
          <span>
            {formatDistanceToNow(new Date(activity.created_at), {
              addSuffix: true,
              locale: fr,
            })}
          </span>
        </div>
      </div>
      
      <Badge variant="outline" className={cn("text-xs shrink-0", colors.text, colors.border)}>
        {activityLabels[activity.activity_type] || activity.activity_type}
      </Badge>
      
      <span className="text-xs text-muted-foreground font-mono shrink-0">
        {format(new Date(activity.created_at), "HH:mm:ss")}
      </span>
    </div>
  );
}
