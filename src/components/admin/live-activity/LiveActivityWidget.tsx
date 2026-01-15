import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  MapPin,
  ShoppingCart,
  UserPlus,
  LogIn,
  ArrowRight,
  Zap,
  Users,
  Eye,
  Wifi,
  CreditCard,
} from "lucide-react";
import { useLiveActivityFeed } from "@/hooks/useLiveActivityFeed";
import { QuebecMap } from "./QuebecMap";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
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

const activityColors: Record<string, string> = {
  order_started: "text-amber-500 bg-amber-500/10",
  order_completed: "text-green-500 bg-green-500/10",
  signup: "text-blue-500 bg-blue-500/10",
  login: "text-purple-500 bg-purple-500/10",
  profile_update: "text-indigo-500 bg-indigo-500/10",
  subscription: "text-pink-500 bg-pink-500/10",
  payment: "text-emerald-500 bg-emerald-500/10",
  page_view: "text-slate-500 bg-slate-500/10",
};

const activityLabels: Record<string, string> = {
  order_started: "Commande",
  order_completed: "Commande",
  signup: "Inscription",
  login: "Connexion",
  profile_update: "Profil",
  subscription: "Abonnement",
  payment: "Paiement",
  page_view: "Visite",
};

export const LiveActivityWidget: React.FC = () => {
  const navigate = useNavigate();
  const { activities, stats, isLoading } = useLiveActivityFeed({ limit: 20 });

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

  // Calculate active now
  const activeNow = activities.filter(
    (a) => Date.now() - new Date(a.created_at).getTime() < 5 * 60 * 1000
  ).length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 bg-gradient-to-r from-background to-muted/30">
        <div className="flex items-center gap-3">
          <div className="relative p-2 rounded-lg bg-primary/10">
            <Activity className="h-5 w-5 text-primary" />
            {activities.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse border-2 border-background" />
            )}
          </div>
          <div>
            <CardTitle className="text-lg">Activité en direct</CardTitle>
            {activeNow > 0 && (
              <div className="flex items-center gap-1 mt-0.5">
                <Wifi className="h-3 w-3 text-green-500" />
                <span className="text-xs text-muted-foreground">
                  {activeNow} actif{activeNow > 1 ? "s" : ""} maintenant
                </span>
              </div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/live-activity")}
          className="text-xs gap-1"
        >
          Voir tout <ArrowRight className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid lg:grid-cols-3 gap-0">
          {/* Mini Map */}
          <div className="lg:col-span-2 relative h-56 bg-gradient-to-b from-background to-muted/20 border-b lg:border-b-0 lg:border-r">
            <QuebecMap points={mapPoints} className="h-full" showLabels={false} />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
          </div>

          {/* Stats & Recent Activity */}
          <div className="flex flex-col">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-px bg-border/50">
              <div className="bg-card p-3 text-center">
                <div className="text-xl font-bold text-primary">{stats.totalHour}</div>
                <div className="text-[10px] text-muted-foreground">Dernière heure</div>
              </div>
              <div className="bg-card p-3 text-center">
                <div className="text-xl font-bold text-green-600">{stats.orders}</div>
                <div className="text-[10px] text-muted-foreground">Commandes (24h)</div>
              </div>
              <div className="bg-card p-3 text-center">
                <div className="text-xl font-bold text-blue-600">{stats.signups}</div>
                <div className="text-[10px] text-muted-foreground">Inscriptions (24h)</div>
              </div>
              <div className="bg-card p-3 text-center">
                <div className="text-xl font-bold text-amber-600">{stats.uniqueCities}</div>
                <div className="text-[10px] text-muted-foreground">Villes actives</div>
              </div>
            </div>

            {/* Recent Activity List */}
            <div className="flex-1 p-2">
              <div className="text-[10px] font-medium text-muted-foreground mb-1.5 px-1">
                ACTIVITÉ RÉCENTE
              </div>
              <ScrollArea className="h-24">
                <div className="space-y-1">
                  {activities.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">
                      <Activity className="h-8 w-8 mx-auto mb-1 opacity-20" />
                      <p className="text-xs">Aucune activité</p>
                    </div>
                  ) : (
                    activities.slice(0, 5).map((activity) => {
                      const Icon = activityIcons[activity.activity_type] || Activity;
                      const colorClass =
                        activityColors[activity.activity_type] || activityColors.page_view;
                      const isRecent =
                        Date.now() - new Date(activity.created_at).getTime() < 60 * 1000;

                      return (
                        <div
                          key={activity.id}
                          className={cn(
                            "flex items-center gap-2 text-xs p-1.5 rounded-md transition-all",
                            isRecent
                              ? "bg-green-500/10 border border-green-500/20"
                              : "hover:bg-muted/50"
                          )}
                        >
                          {isRecent && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                            </span>
                          )}
                          <div className={cn("p-1 rounded", colorClass)}>
                            <Icon className="h-3 w-3" />
                          </div>
                          <span className="flex-1 truncate text-[11px]">
                            {activity.activity_label || activityLabels[activity.activity_type]}
                          </span>
                          {activity.city && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                              <MapPin className="h-2 w-2 mr-0.5" />
                              {activity.city}
                            </Badge>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
