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
  Users
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
  payment: ShoppingCart,
  page_view: Activity,
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
      isRecent: Date.now() - new Date(a.created_at).getTime() < 5 * 60 * 1000, // 5 min
    }));

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className="h-5 w-5 text-primary" />
            {activities.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
          <CardTitle className="text-lg">Activité en direct</CardTitle>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/live-activity")}
          className="text-xs"
        >
          Voir tout <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          {/* Mini Map */}
          <div className="relative h-48 rounded-lg overflow-hidden border bg-muted/20">
            <QuebecMap points={mapPoints} className="h-full" />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
          </div>

          {/* Stats & Recent Activity */}
          <div className="flex flex-col gap-3">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <div className="text-xl font-bold text-primary">{stats.totalHour}</div>
                <div className="text-xs text-muted-foreground">Dernière heure</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <div className="text-xl font-bold text-green-500">{stats.orders}</div>
                <div className="text-xs text-muted-foreground">Commandes (24h)</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <div className="text-xl font-bold text-blue-500">{stats.signups}</div>
                <div className="text-xs text-muted-foreground">Inscriptions (24h)</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2 text-center">
                <div className="text-xl font-bold text-amber-500">{stats.uniqueCities}</div>
                <div className="text-xs text-muted-foreground">Villes actives</div>
              </div>
            </div>

            {/* Recent Activity List */}
            <ScrollArea className="flex-1 max-h-24">
              <div className="space-y-1">
                {activities.slice(0, 5).map((activity) => {
                  const Icon = activityIcons[activity.activity_type] || Activity;
                  const colorClass = activityColors[activity.activity_type] || activityColors.page_view;

                  return (
                    <div
                      key={activity.id}
                      className="flex items-center gap-2 text-xs p-1 rounded hover:bg-muted/50 transition-colors"
                    >
                      <div className={cn("p-1 rounded", colorClass)}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <span className="flex-1 truncate">
                        {activity.activity_label}
                      </span>
                      {activity.city && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          <MapPin className="h-2 w-2 mr-0.5" />
                          {activity.city}
                        </Badge>
                      )}
                      <span className="text-muted-foreground text-[10px]">
                        {formatDistanceToNow(new Date(activity.created_at), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
