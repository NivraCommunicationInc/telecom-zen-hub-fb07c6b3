/**
 * TechnicianSidebar - Sidebar navigation for technician portal
 */
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Calendar,
  Wrench,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: "Tableau de bord", href: "/staff/technician", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Point de Vente (POS)", href: "/staff/technician/pos", icon: <ShoppingCart className="h-4 w-4" /> },
  { label: "Mes rendez-vous", href: "/staff/appointments", icon: <Calendar className="h-4 w-4" /> },
  { label: "Mon compte", href: "/staff/account", icon: <Settings className="h-4 w-4" /> },
];

interface TechnicianSidebarProps {
  onSignOut: () => void;
  userEmail?: string;
  userName?: string;
}

export function TechnicianSidebar({ onSignOut, userEmail, userName }: TechnicianSidebarProps) {
  const location = useLocation();
  const isActive = (href: string) => location.pathname === href;

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border">
      <div className="p-6 border-b border-sidebar-border">
        <Link to="/staff/technician" className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary">
            <Wrench className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-foreground">Nivra Tech</span>
        </Link>
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive(item.href) ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </ScrollArea>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        <div className="px-3">
          <p className="text-xs text-muted-foreground">Connecté en tant que</p>
          <p className="text-sm font-medium text-foreground truncate">{userName || userEmail}</p>
        </div>
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Button>
      </div>
    </aside>
  );
}
