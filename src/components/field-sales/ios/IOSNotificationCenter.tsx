/**
 * IOSNotificationCenter - iOS-style notification center with grouped notifications
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Bell, DollarSign, Trophy, ShoppingBag, Target, 
  Check, ChevronRight, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export interface FieldSalesNotification {
  id: string;
  type: "sale" | "commission" | "bonus" | "achievement" | "system";
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

interface IOSNotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: FieldSalesNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export function IOSNotificationCenter({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}: IOSNotificationCenterProps) {
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getNotificationIcon = (type: FieldSalesNotification["type"]) => {
    switch (type) {
      case "sale":
        return <ShoppingBag className="h-5 w-5" />;
      case "commission":
        return <DollarSign className="h-5 w-5" />;
      case "bonus":
        return <Target className="h-5 w-5" />;
      case "achievement":
        return <Trophy className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getNotificationColor = (type: FieldSalesNotification["type"]) => {
    switch (type) {
      case "sale":
        return "bg-blue-500/20 text-blue-400";
      case "commission":
        return "bg-emerald-500/20 text-emerald-400";
      case "bonus":
        return "bg-amber-500/20 text-amber-400";
      case "achievement":
        return "bg-purple-500/20 text-purple-400";
      default:
        return "bg-slate-500/20 text-slate-400";
    }
  };

  // Group notifications by date
  const groupedNotifications = notifications.reduce((groups, notification) => {
    const date = format(new Date(notification.createdAt), "yyyy-MM-dd");
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(notification);
    return groups;
  }, {} as Record<string, FieldSalesNotification[]>);

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) {
      return "Aujourd'hui";
    } else if (format(date, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd")) {
      return "Hier";
    }
    return format(date, "EEEE d MMMM", { locale: fr });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-0 right-0 bottom-0 z-[101] max-h-[85vh] bg-slate-950 rounded-t-3xl border-t border-slate-800/60 flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 bg-slate-700 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-400" />
                <h2 className="text-lg font-semibold text-white">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="h-5 px-2 bg-red-500 text-white text-xs font-bold rounded-full flex items-center">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onMarkAllAsRead}
                    className="text-xs text-orange-400 hover:text-orange-300"
                  >
                    Tout marquer lu
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-slate-400"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500">Aucune notification</p>
                </div>
              ) : (
                Object.entries(groupedNotifications).map(([date, items]) => (
                  <div key={date}>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                      {getDateLabel(date)}
                    </p>
                    <div className="space-y-2">
                      {items.map((notification) => (
                        <motion.button
                          key={notification.id}
                          onClick={() => onMarkAsRead(notification.id)}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            "w-full flex items-start gap-3 p-3 rounded-xl transition-all text-left",
                            notification.isRead 
                              ? "bg-slate-900/40" 
                              : "bg-slate-900/80 border border-slate-800/60"
                          )}
                        >
                          <div className={cn(
                            "p-2 rounded-xl shrink-0",
                            getNotificationColor(notification.type)
                          )}>
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "font-medium text-sm",
                              notification.isRead ? "text-slate-400" : "text-white"
                            )}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(notification.createdAt), { 
                                addSuffix: true, 
                                locale: fr 
                              })}
                            </p>
                          </div>
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-orange-500 rounded-full shrink-0 mt-2" />
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
