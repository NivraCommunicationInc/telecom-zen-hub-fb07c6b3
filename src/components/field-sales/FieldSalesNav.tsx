/**
 * FieldSalesNav - Bottom navigation for field sales mobile portal
 * Optimized for one-handed thumb access on mobile devices
 */
import { Link, useLocation } from "react-router-dom";
import { Home, PlusCircle, List, DollarSign, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/field-sales/dashboard", label: "Accueil", icon: Home },
  { path: "/field-sales/new-sale", label: "Vente", icon: PlusCircle },
  { path: "/field-sales/sales", label: "Mes ventes", icon: List },
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
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[60px]",
                isActive
                  ? "text-orange-400 bg-orange-500/10"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              <item.icon className={cn("h-6 w-6", isActive && "scale-110")} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-orange-400" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
