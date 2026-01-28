/**
 * IOSBottomNav - iOS-style bottom tab navigation with badges and haptic feedback style
 */
import { Link, useLocation } from "react-router-dom";
import { Home, ShoppingBag, Trophy, DollarSign, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  isPrimary?: boolean;
}

interface IOSBottomNavProps {
  pendingSales?: number;
  unreadNotifications?: number;
}

export function IOSBottomNav({ pendingSales = 0, unreadNotifications = 0 }: IOSBottomNavProps) {
  const location = useLocation();

  const navItems: NavItem[] = [
    { path: "/field-sales/dashboard", label: "Accueil", icon: Home },
    { path: "/field-sales/leaderboard", label: "Classement", icon: Trophy },
    { path: "/field-sales/pos", label: "Vendre", icon: Plus, isPrimary: true },
    { path: "/field-sales/commissions", label: "Gains", icon: DollarSign },
    { path: "/field-sales/account", label: "Compte", icon: User },
  ];

  const isActive = (path: string) => {
    if (path === "/field-sales/dashboard") {
      return location.pathname === path || location.pathname === "/field-sales/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/98 backdrop-blur-2xl border-t border-slate-800/50">
      <div className="safe-area-pb">
        <div className="flex items-center justify-around px-2 pt-2 pb-1">
          {navItems.map((item, index) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            
            if (item.isPrimary) {
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="relative -mt-6"
                >
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className="p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/40"
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </motion.div>
                  <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-medium text-orange-400 whitespace-nowrap">
                    {item.label}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative flex flex-col items-center gap-0.5 py-1 px-3 min-w-[60px]"
              >
                <motion.div
                  whileTap={{ scale: 0.85 }}
                  className="relative"
                >
                  <Icon 
                    className={cn(
                      "h-6 w-6 transition-colors duration-200",
                      active ? "text-orange-400" : "text-slate-500"
                    )} 
                  />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </motion.div>
                <span 
                  className={cn(
                    "text-[10px] font-medium transition-colors duration-200",
                    active ? "text-orange-400" : "text-slate-500"
                  )}
                >
                  {item.label}
                </span>
                {active && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -bottom-1 w-5 h-0.5 bg-orange-400 rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
