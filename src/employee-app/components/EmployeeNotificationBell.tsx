/**
 * EmployeeNotificationBell — Bell icon with unread count + dropdown.
 * Shows real-time employee notifications inside the portal header.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, AlertTriangle, UserCheck, Clock, Info } from "lucide-react";
import { useEmployeeNotifications, EmployeeNotification } from "@/employee-app/hooks/useEmployeeNotifications";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

const NOTIF_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  assignment: { icon: UserCheck, color: "text-blue-400", bg: "bg-blue-500/10" },
  urgent: { icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
  sla_breach: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
  escalation: { icon: AlertTriangle, color: "text-purple-400", bg: "bg-purple-500/10" },
  system: { icon: Info, color: "text-[hsl(220,10%,50%)]", bg: "bg-[hsl(220,15%,13%)]" },
};

export default function EmployeeNotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useEmployeeNotifications();
  const [open, setOpen] = useState(false);

  const handleClick = (n: EmployeeNotification) => {
    if (!n.is_read) markAsRead(n.id);
    setOpen(false);
    if (n.work_item_id) {
      navigate(employeePath("/work-queue"));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-[hsl(220,15%,12%)] transition-colors">
          <Bell className="h-4.5 w-4.5 text-[hsl(220,10%,45%)]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4.5 min-w-4.5 px-1 rounded-full bg-red-500 text-[9px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)]"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(220,15%,12%)]">
          <span className="text-xs font-semibold text-[hsl(220,10%,55%)] uppercase tracking-wider">
            Notifications
          </span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              <CheckCheck className="h-3 w-3" />
              Tout lire
            </button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <p className="p-4 text-center text-xs text-[hsl(220,10%,35%)]">Chargement…</p>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="h-6 w-6 mx-auto mb-2 text-[hsl(220,10%,20%)]" />
              <p className="text-xs text-[hsl(220,10%,35%)]">Aucune notification</p>
            </div>
          ) : (
            <div className="divide-y divide-[hsl(220,15%,10%)]">
              {notifications.slice(0, 25).map((n) => {
                const config = NOTIF_CONFIG[n.notification_type] || NOTIF_CONFIG.system;
                const Icon = config.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 hover:bg-[hsl(220,20%,10%)] transition-colors",
                      !n.is_read && "bg-blue-500/[0.03]"
                    )}
                  >
                    <div className="flex gap-2.5">
                      <div className={cn("mt-0.5 h-6 w-6 rounded flex items-center justify-center shrink-0", config.bg)}>
                        <Icon className={cn("h-3 w-3", config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "text-xs font-medium leading-tight",
                            !n.is_read ? "text-white" : "text-[hsl(220,10%,50%)]"
                          )}>
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 mt-1" />
                          )}
                        </div>
                        {n.message && (
                          <p className="text-[10px] text-[hsl(220,10%,40%)] truncate mt-0.5">
                            {n.message}
                          </p>
                        )}
                        <p className="text-[10px] text-[hsl(220,10%,30%)] mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
