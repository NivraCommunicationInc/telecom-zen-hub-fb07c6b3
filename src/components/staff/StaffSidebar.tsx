/**
 * StaffSidebar - Sidebar navigation for employee portal
 */
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  DollarSign,
  Calendar,
  Ticket,
  Tv,
  FileText,
  Settings,
  ChevronDown,
  Eye,
  PenTool,
  Play,
  LogOut,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: { label: string; href: string; icon: React.ReactNode }[];
}

const navItems: NavItem[] = [
  { label: "Tableau de bord", href: "/staff/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Point de Vente (POS)", href: "/staff/pos", icon: <ShoppingCart className="h-4 w-4" /> },
  { label: "Clients", icon: <Users className="h-4 w-4" />, children: [{ label: "Voir clients", href: "/staff/clients", icon: <Eye className="h-4 w-4" /> }] },
  { label: "Commandes", icon: <ShoppingCart className="h-4 w-4" />, children: [{ label: "Voir commandes", href: "/staff/orders", icon: <Eye className="h-4 w-4" /> }] },
  { label: "Facturation", icon: <DollarSign className="h-4 w-4" />, children: [{ label: "Voir facturation", href: "/staff/billing", icon: <Eye className="h-4 w-4" /> }] },
  { label: "Rendez-vous", icon: <Calendar className="h-4 w-4" />, children: [{ label: "Voir rendez-vous", href: "/staff/appointments", icon: <Eye className="h-4 w-4" /> }] },
  { label: "Support", icon: <Ticket className="h-4 w-4" />, children: [{ label: "Voir tickets", href: "/staff/tickets", icon: <Eye className="h-4 w-4" /> }] },
  {
    label: "TV / Streaming",
    icon: <Tv className="h-4 w-4" />,
    children: [
      { label: "Gérer chaînes", href: "/staff/tv-channels", icon: <PenTool className="h-4 w-4" /> },
      { label: "Gérer streaming", href: "/staff/streaming", icon: <Play className="h-4 w-4" /> },
    ],
  },
  { label: "Notes internes", href: "/staff/notes", icon: <FileText className="h-4 w-4" /> },
  { label: "Mon compte", href: "/staff/account", icon: <Settings className="h-4 w-4" /> },
];

interface StaffSidebarProps {
  onSignOut: () => void;
  userEmail?: string;
  userName?: string;
}

export function StaffSidebar({ onSignOut, userEmail, userName }: StaffSidebarProps) {
  const location = useLocation();
  const [openSections, setOpenSections] = useState<string[]>([]);

  const toggleSection = (label: string) => {
    setOpenSections((prev) => (prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]));
  };

  const isActive = (href: string) => location.pathname === href;
  const isParentActive = (item: NavItem) => item.children?.some((child) => location.pathname.startsWith(child.href)) ?? false;

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border">
      <div className="p-6 border-b border-sidebar-border">
        <Link to="/staff/dashboard" className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-foreground">Nivra Staff</span>
        </Link>
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            if (item.children) {
              const isOpen = openSections.includes(item.label) || isParentActive(item);
              return (
                <Collapsible key={item.label} open={isOpen} onOpenChange={() => toggleSection(item.label)}>
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        isParentActive(item) ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      )}
                    >
                      <span className="flex items-center gap-3">{item.icon}{item.label}</span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-6 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        to={child.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                          isActive(child.href) ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        )}
                      >
                        {child.icon}
                        {child.label}
                      </Link>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            }

            return (
              <Link
                key={item.href}
                to={item.href!}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive(item.href!) ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
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
