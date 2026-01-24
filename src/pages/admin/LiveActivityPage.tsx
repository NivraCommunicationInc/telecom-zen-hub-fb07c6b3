import React from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Activity,
  MapPin,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
  TrendingUp,
  ShoppingCart,
  UserPlus,
  LogIn,
} from "lucide-react";
import { useLiveActivityFeedV2 } from "@/hooks/useLiveActivityFeedV2";
import { QuebecMap } from "@/components/admin/live-activity/QuebecMap";
import { ActivityFeedItem } from "@/components/admin/live-activity/ActivityFeedItem";
import { ActivityFeedSkeleton } from "@/components/admin/live-activity/ActivityFeedSkeleton";
import { ActivityFeedEmpty } from "@/components/admin/live-activity/ActivityFeedEmpty";
import { ActivityFeedError } from "@/components/admin/live-activity/ActivityFeedError";
import { ActivityFilterTabs } from "@/components/admin/live-activity/ActivityFilterTabs";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Stats Card Component
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color?: "default" | "primary" | "success" | "warning" | "info";
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  color = "default",
  subtitle,
}) => {
  const styles = {
    default: {
      bg: "bg-card",
      iconBg: "bg-muted",
      iconColor: "text-muted-foreground",
      valueColor: "text-foreground",
    },
    primary: {
      bg: "bg-primary/5 border-primary/20",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      valueColor: "text-primary",
    },
    success: {
      bg: "bg-emerald-500/5 border-emerald-500/20",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-600",
    },
    warning: {
      bg: "bg-amber-500/5 border-amber-500/20",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
      valueColor: "text-amber-600",
    },
    info: {
      bg: "bg-blue-500/5 border-blue-500/20",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
      valueColor: "text-blue-600",
    },
  };

  const s = styles[color];

  return (
    <Card className={cn("transition-shadow hover:shadow-md", s.bg)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-lg", s.iconBg)}>
            <Icon className={cn("h-5 w-5", s.iconColor)} />
          </div>
          <div>
            <p className={cn("text-2xl font-bold", s.valueColor)}>{value}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground/70">{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function LiveActivityPage() {
  const {
    activities,
    filteredActivities,
    isLoading,
    isError,
    refetch,
    lastUpdated,
    isLive,
    setIsLive,
    filter,
    setFilter,
    filterCounts,
    newActivityIds,
  } = useLiveActivityFeedV2({
    limit: 50,
    pollingInterval: 15000, // 15 seconds
  });

  // Prepare map points from all activities (not filtered)
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

  // Calculate stats
  const now = new Date();
  const stats = {
    total: activities.length,
    lastHour: activities.filter(
      (a) => now.getTime() - new Date(a.created_at).getTime() < 60 * 60 * 1000
    ).length,
    orders: activities.filter((a) => a.activity_type.includes("order")).length,
    signups: activities.filter((a) => a.activity_type === "signup").length,
    logins: activities.filter((a) => a.activity_type === "login").length,
    uniqueCities: new Set(activities.map((a) => a.city).filter(Boolean)).size,
  };

  const handleClearFilter = () => {
    setFilter("all");
  };

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
              {isLive && (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualisez l'activité des clients en temps réel
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Last updated */}
            {lastUpdated && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-md">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Mis à jour{" "}
                  {formatDistanceToNow(lastUpdated, {
                    addSuffix: true,
                    locale: fr,
                  })}
                </span>
              </div>
            )}

            {/* Live toggle */}
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors",
                isLive
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-muted/50 border-border"
              )}
            >
              {isLive ? (
                <Wifi className="h-4 w-4 text-emerald-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">
                {isLive ? "En direct" : "Pause"}
              </span>
              <Switch
                checked={isLive}
                onCheckedChange={setIsLive}
                aria-label="Toggle live updates"
              />
            </div>

            {/* Refresh button */}
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw
                className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")}
              />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            title="Total affiché"
            value={stats.total}
            icon={Activity}
            subtitle="50 max"
          />
          <StatCard
            title="Dernière heure"
            value={stats.lastHour}
            icon={Clock}
            color="primary"
          />
          <StatCard
            title="Commandes"
            value={stats.orders}
            icon={ShoppingCart}
            color="success"
          />
          <StatCard
            title="Inscriptions"
            value={stats.signups}
            icon={UserPlus}
            color="info"
          />
          <StatCard
            title="Connexions"
            value={stats.logins}
            icon={LogIn}
            color="warning"
          />
          <StatCard
            title="Villes actives"
            value={stats.uniqueCities}
            icon={MapPin}
          />
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Map Section */}
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
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
              <div className="h-[400px] bg-gradient-to-b from-background to-muted/20">
                <QuebecMap points={mapPoints} className="h-full" />
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats Sidebar */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-primary" />
                Résumé rapide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category breakdown */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Par catégorie
                </p>
                <div className="space-y-1.5">
                  {Object.entries(filterCounts)
                    .filter(([key]) => key !== "all")
                    .map(([key, count]) => {
                      const percentage =
                        filterCounts.all > 0
                          ? Math.round((count / filterCounts.all) * 100)
                          : 0;
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize">{key}</span>
                            <span className="text-muted-foreground">
                              {count} ({percentage}%)
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary/50 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Live status indicator */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      isLive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                    )}
                  />
                  <span className="text-sm">
                    {isLive
                      ? "Actualisation toutes les 15 secondes"
                      : "Actualisation en pause"}
                  </span>
                </div>
                {lastUpdated && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Dernière mise à jour:{" "}
                    {format(lastUpdated, "HH:mm:ss", { locale: fr })}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-5 w-5 text-primary" />
                  Fil d'activité
                  <Badge variant="outline" className="ml-1">
                    {filteredActivities.length}
                  </Badge>
                </CardTitle>
              </div>

              {/* Filter Tabs */}
              <ActivityFilterTabs
                activeFilter={filter}
                onFilterChange={setFilter}
                counts={filterCounts}
              />
            </div>
          </CardHeader>

          <CardContent>
            {/* Loading state */}
            {isLoading && filteredActivities.length === 0 && (
              <ActivityFeedSkeleton count={8} />
            )}

            {/* Error state */}
            {isError && (
              <ActivityFeedError onRetry={refetch} isRetrying={isLoading} />
            )}

            {/* Empty state */}
            {!isLoading && !isError && filteredActivities.length === 0 && (
              <ActivityFeedEmpty
                hasFilter={filter !== "all"}
                onClearFilter={handleClearFilter}
              />
            )}

            {/* Activity list */}
            {!isError && filteredActivities.length > 0 && (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-2">
                  {filteredActivities.map((activity) => (
                    <ActivityFeedItem
                      key={activity.id}
                      activity={activity}
                      isNew={newActivityIds.has(activity.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
