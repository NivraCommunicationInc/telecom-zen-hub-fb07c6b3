import React, { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  payment: ShoppingCart,
  page_view: Eye,
};

const activityColors: Record<string, { text: string; bg: string }> = {
  order_started: { text: "text-amber-500", bg: "bg-amber-500/10" },
  order_completed: { text: "text-green-500", bg: "bg-green-500/10" },
  signup: { text: "text-blue-500", bg: "bg-blue-500/10" },
  login: { text: "text-purple-500", bg: "bg-purple-500/10" },
  profile_update: { text: "text-indigo-500", bg: "bg-indigo-500/10" },
  subscription: { text: "text-pink-500", bg: "bg-pink-500/10" },
  payment: { text: "text-emerald-500", bg: "bg-emerald-500/10" },
  page_view: { text: "text-slate-500", bg: "bg-slate-500/10" },
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

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Activité en direct
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
            </h1>
            <p className="text-muted-foreground">
              Visualisez l'activité des clients en temps réel sur la carte du Québec
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Actualiser
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Dernière heure</p>
                  <p className="text-2xl font-bold">{stats.totalHour}</p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">24 dernières heures</p>
                  <p className="text-2xl font-bold">{stats.total24h}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600">Commandes</p>
                  <p className="text-2xl font-bold text-green-600">{stats.orders}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-green-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600">Inscriptions</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.signups}</p>
                </div>
                <UserPlus className="h-8 w-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-purple-500/5 border-purple-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600">Connexions</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.logins}</p>
                </div>
                <LogIn className="h-8 w-8 text-purple-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600">Villes actives</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.uniqueCities}</p>
                </div>
                <MapPin className="h-8 w-8 text-amber-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Map */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Carte du Québec
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] rounded-lg overflow-hidden border bg-gradient-to-b from-muted/30 to-muted/10">
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Villes les plus actives
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[450px]">
                <div className="space-y-2">
                  {topCities.map(([city, cityActivities]) => (
                    <button
                      key={city}
                      onClick={() => setSelectedCity(selectedCity === city ? null : city)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
                        selectedCity === city
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{city}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{cityActivities.length}</Badge>
                        {cityActivities.some(
                          (a) =>
                            Date.now() - new Date(a.created_at).getTime() < 5 * 60 * 1000
                        ) && (
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        )}
                      </div>
                    </button>
                  ))}
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
                <Activity className="h-5 w-5" />
                Fil d'activité
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-48"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40">
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
                  >
                    <MapPin className="h-4 w-4 mr-1" />
                    {selectedCity}
                    <span className="ml-1">×</span>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredActivities.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Activity className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>Aucune activité récente</p>
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

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
        isRecent && "bg-primary/5 border-primary/20 animate-pulse"
      )}
    >
      <div className={cn("p-2 rounded-lg", colors.bg)}>
        <Icon className={cn("h-4 w-4", colors.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{activity.activity_label}</p>
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
      <Badge variant="outline" className={cn("text-xs", colors.text)}>
        {activityLabels[activity.activity_type] || activity.activity_type}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {format(new Date(activity.created_at), "HH:mm:ss")}
      </span>
    </div>
  );
}
