import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Filter, 
  RefreshCw,
  ShoppingCart,
  FileText,
  DollarSign,
  AlertTriangle,
  XCircle,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStaffNotifications, StaffNotification, StaffNotificationType } from "@/hooks/useStaffNotifications";
import { cn } from "@/lib/utils";

const notificationConfig: Record<StaffNotificationType, { 
  icon: typeof Bell; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  new_order: { 
    icon: ShoppingCart, 
    label: "Nouvelle commande", 
    color: "text-blue-400",
    bgColor: "bg-blue-500/20"
  },
  invoice_created: { 
    icon: FileText, 
    label: "Facture créée", 
    color: "text-amber-400",
    bgColor: "bg-amber-500/20"
  },
  payment_received: { 
    icon: DollarSign, 
    label: "Paiement reçu", 
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20"
  },
  service_suspended: { 
    icon: AlertTriangle, 
    label: "Service suspendu", 
    color: "text-orange-400",
    bgColor: "bg-orange-500/20"
  },
  service_cancelled: {
    icon: XCircle,
    label: "Service annulé",
    color: "text-red-400",
    bgColor: "bg-red-500/20"
  },
  order_failed: {
    icon: XCircle,
    label: "Échec provisionnement",
    color: "text-red-400",
    bgColor: "bg-red-500/20"
  },
  order_on_hold: {
    icon: AlertTriangle,
    label: "Commande suspendue",
    color: "text-orange-400",
    bgColor: "bg-orange-500/20"
  },
  order_stalled: {
    icon: AlertTriangle,
    label: "Commande bloquée",
    color: "text-amber-400",
    bgColor: "bg-amber-500/20"
  },
};

interface AdminNotificationsProps {
  basePath?: "/admin" | "/staff";
}

export default function AdminNotifications({ basePath = "/admin" }: AdminNotificationsProps) {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, refetch } = useStaffNotifications();
  const [typeFilter, setTypeFilter] = useState<StaffNotificationType | "all">("all");
  const [tab, setTab] = useState<"all" | "unread">("all");

  const filteredNotifications = notifications.filter(n => {
    if (tab === "unread" && n.is_read) return false;
    if (typeFilter !== "all" && n.notification_type !== typeFilter) return false;
    return true;
  });

  const getEntityLink = (notification: StaffNotification): string | null => {
    if (!notification.entity_id) return null;
    
    switch (notification.entity_type) {
      case "order":
        return `${basePath}/orders/${notification.entity_id}`;
      case "invoice":
        return `${basePath}/billing-v2`;
      case "subscription":
        return `${basePath}/billing-v2`;
      default:
        return null;
    }
  };

  // Group by date
  const groupedNotifications = filteredNotifications.reduce((acc, notification) => {
    const date = format(new Date(notification.created_at), "yyyy-MM-dd");
    if (!acc[date]) acc[date] = [];
    acc[date].push(notification);
    return acc;
  }, {} as Record<string, StaffNotification[]>);

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) {
      return "Aujourd'hui";
    }
    if (format(date, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd")) {
      return "Hier";
    }
    return format(date, "EEEE d MMMM yyyy", { locale: fr });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500/20 to-cyan-500/20">
            <Bell className="h-6 w-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            <p className="text-sm text-slate-400">
              {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="border-teal-600 text-teal-400 hover:bg-teal-500/20"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Tout marquer lu
            </Button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(Object.keys(notificationConfig) as StaffNotificationType[]).map((type) => {
          const config = notificationConfig[type];
          const count = notifications.filter(n => n.notification_type === type).length;
          const Icon = config.icon;

          return (
            <Card
              key={type}
              className={cn(
                "bg-slate-800/50 border-slate-700 cursor-pointer transition-all hover:border-slate-600",
                typeFilter === type && "ring-2 ring-teal-500"
              )}
              onClick={() => setTypeFilter(typeFilter === type ? "all" : type)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", config.bgColor)}>
                    <Icon className={cn("h-4 w-4", config.color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{count}</p>
                    <p className="text-xs text-slate-400">{config.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")} className="flex-1">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="all" className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-400">
              Toutes ({notifications.length})
            </TabsTrigger>
            <TabsTrigger value="unread" className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-400">
              Non lues ({unreadCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as StaffNotificationType | "all")}>
          <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-slate-200">
            <Filter className="h-4 w-4 mr-2 text-slate-400" />
            <SelectValue placeholder="Filtrer par type" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all">Tous les types</SelectItem>
            {(Object.keys(notificationConfig) as StaffNotificationType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {notificationConfig[type].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notifications list */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400">Chargement...</div>
      ) : filteredNotifications.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Aucune notification</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedNotifications).map(([date, items]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-slate-400 mb-3 capitalize">
                {formatDateHeader(date)}
              </h3>
              <div className="space-y-2">
                {items.map((notification) => {
                  const config = notificationConfig[notification.notification_type];
                  const Icon = config.icon;
                  const link = getEntityLink(notification);

                  const content = (
                    <Card
                      className={cn(
                        "bg-slate-800/50 border-slate-700 transition-all hover:border-slate-600",
                        !notification.is_read && "border-l-4 border-l-teal-500"
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className={cn("p-2.5 rounded-lg flex-shrink-0", config.bgColor)}>
                            <Icon className={cn("h-5 w-5", config.color)} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className={cn(
                                  "text-sm",
                                  notification.is_read ? "text-slate-300" : "text-white font-medium"
                                )}>
                                  {notification.title}
                                </p>
                                <p className="text-sm text-slate-400 mt-1">
                                  {notification.message}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                {notification.amount && (
                                  <Badge className="bg-slate-700 text-slate-200 border-0">
                                    {notification.amount.toFixed(2)} $
                                  </Badge>
                                )}
                                {!notification.is_read && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      markAsRead(notification.id);
                                    }}
                                    className="h-8 w-8 text-slate-400 hover:text-teal-400 hover:bg-teal-500/20"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                )}
                                {link && (
                                  <ExternalLink className="h-4 w-4 text-slate-500" />
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 mt-2">
                              <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                                {config.label}
                              </Badge>
                              {notification.entity_number && (
                                <span className="text-xs text-slate-500 font-mono">
                                  {notification.entity_number}
                                </span>
                              )}
                              <span className="text-xs text-slate-500">
                                {formatDistanceToNow(new Date(notification.created_at), {
                                  addSuffix: true,
                                  locale: fr,
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );

                  return link ? (
                    <Link key={notification.id} to={link}>
                      {content}
                    </Link>
                  ) : (
                    <div key={notification.id}>{content}</div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
