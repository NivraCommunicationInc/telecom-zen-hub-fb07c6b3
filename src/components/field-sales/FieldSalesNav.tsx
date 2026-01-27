/**
 * FieldSalesNav - Professional bottom navigation for field sales POS portal
 */
import { Link, useLocation } from "react-router-dom";
import { Home, ShoppingCart, List, DollarSign, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { path: "/field-sales/dashboard", label: "Accueil", icon: Home },
  { path: "/field-sales/new-sale", label: "POS", icon: ShoppingCart },
  { path: "/field-sales/sales", label: "Ventes", icon: List },
  { path: "/field-sales/commissions", label: "Gains", icon: DollarSign },
  { path: "/field-sales/account", label: "Compte", icon: User },
];

export function FieldSalesNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 safe-area-pb">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== "/field-sales/dashboard" && location.pathname.startsWith(item.path));
          const isPOS = item.path === "/field-sales/new-sale";
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[56px] relative",
                isPOS 
                  ? "text-orange-400"
                  : isActive
                    ? "text-cyan-400 bg-cyan-500/10"
                    : "text-slate-500 hover:text-slate-300"
              )}
            >
              {isPOS ? (
                <div className="p-2 -mt-4 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/30">
                  <item.icon className="h-5 w-5 text-white" />
                </div>
              ) : (
                <item.icon className={cn("h-5 w-5", isActive && "scale-110")} />
              )}
              <span className={cn(
                "text-[10px] font-medium",
                isPOS && "-mt-1"
              )}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
