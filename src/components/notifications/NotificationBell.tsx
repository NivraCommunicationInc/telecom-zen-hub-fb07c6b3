import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStaffNotifications, StaffNotification } from "@/hooks/useStaffNotifications";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  basePath: "/admin" | "/staff";
}

const notificationIcons: Record<string, string> = {
  new_order: "🛒",
  invoice_created: "📄",
  payment_received: "💰",
  service_suspended: "⚠️",
  service_cancelled: "❌",
};

const notificationColors: Record<string, string> = {
  new_order: "bg-blue-500/20 text-blue-400",
  invoice_created: "bg-amber-500/20 text-amber-400",
  payment_received: "bg-emerald-500/20 text-emerald-400",
  service_suspended: "bg-orange-500/20 text-orange-400",
  service_cancelled: "bg-red-500/20 text-red-400",
};

export function NotificationBell({ basePath }: NotificationBellProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useStaffNotifications();

  const recentNotifications = notifications.slice(0, 8);

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-slate-300 hover:text-white hover:bg-slate-700/50"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs bg-red-500 hover:bg-red-500 border-0"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-96 bg-white border-gray-200 text-gray-900 shadow-lg"
      >
        <DropdownMenuLabel className="flex items-center justify-between py-3">
          <span className="text-base font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                markAllAsRead();
              }}
              className="h-7 text-xs text-teal-400 hover:text-teal-300 hover:bg-slate-800"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Tout marquer lu
            </Button>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-slate-700" />

        {isLoading ? (
          <div className="py-8 text-center text-slate-400">Chargement...</div>
        ) : recentNotifications.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            Aucune notification
          </div>
        ) : (
          <ScrollArea className="h-[360px]">
            {recentNotifications.map((notification) => {
              const link = getEntityLink(notification);
              const content = (
                <div
                  className={cn(
                    "flex gap-3 p-3 cursor-pointer transition-colors",
                    notification.is_read
                      ? "bg-transparent hover:bg-slate-800/50"
                      : "bg-slate-800/70 hover:bg-slate-800"
                  )}
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsRead(notification.id);
                    }
                  }}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg",
                      notificationColors[notification.notification_type] || "bg-slate-700"
                    )}
                  >
                    {notificationIcons[notification.notification_type] || "📌"}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        "text-sm truncate",
                        notification.is_read ? "text-slate-300" : "text-white font-medium"
                      )}>
                        {notification.title}
                      </p>
                      {!notification.is_read && (
                        <div className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </span>
                      {notification.amount && (
                        <Badge variant="outline" className="text-xs h-5 border-slate-600 text-slate-300">
                          {notification.amount.toFixed(2)} $
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Link indicator */}
                  {link && (
                    <ExternalLink className="h-4 w-4 text-slate-500 flex-shrink-0 mt-1" />
                  )}
                </div>
              );

              return link ? (
                <Link key={notification.id} to={link}>
                  {content}
                </Link>
              ) : (
                <div key={notification.id}>{content}</div>
              );
            })}
          </ScrollArea>
        )}

        <DropdownMenuSeparator className="bg-slate-700" />

        <DropdownMenuItem asChild className="p-0">
          <Link
            to={`${basePath}/notifications`}
            className="flex items-center justify-center py-3 text-sm text-teal-400 hover:text-teal-300 hover:bg-slate-800"
          >
            Voir toutes les notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
