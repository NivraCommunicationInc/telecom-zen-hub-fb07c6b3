import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { navGroups } from "./AdminSidebarNav";

interface AdminMobileNavProps {
  onClose: () => void;
  onSignOut: () => void;
}

const MOBILE_STORAGE_KEY = "admin_mobile_nav_groups_state";

const AdminMobileNav = ({ onClose, onSignOut }: AdminMobileNavProps) => {
  const location = useLocation();
  
  // Initialize open groups from localStorage or auto-open active group
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(MOBILE_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore parse errors
    }
    return {};
  });

  // Find which group contains the active route
  const getActiveGroupId = (): string | null => {
    for (const group of navGroups) {
      if (group.items.some(item => location.pathname === item.href)) {
        return group.id;
      }
    }
    return null;
  };

  // Auto-open the group containing the active route
  useEffect(() => {
    const activeGroupId = getActiveGroupId();
    if (activeGroupId && !openGroups[activeGroupId]) {
      setOpenGroups(prev => ({
        ...prev,
        [activeGroupId]: true,
      }));
    }
  }, [location.pathname]);

  // Persist open groups state
  useEffect(() => {
    localStorage.setItem(MOBILE_STORAGE_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const isItemActive = (href: string) => location.pathname === href;

  const isGroupActive = (group: typeof navGroups[0]) => 
    group.items.some(item => isItemActive(item.href));

  return (
    <div className="absolute top-full left-0 right-0 bg-card border-b border-border p-4 space-y-1 max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain">
      {navGroups.map((group) => {
        const isOpen = openGroups[group.id] ?? false;
        const hasActiveItem = isGroupActive(group);

        return (
          <Collapsible
            key={group.id}
            open={isOpen}
            onOpenChange={() => toggleGroup(group.id)}
          >
            <CollapsibleTrigger
              className={cn(
                "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                hasActiveItem
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <group.icon className="w-4 h-4" />
                <span>{group.label}</span>
              </div>
              {isOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 mt-1 space-y-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    isItemActive(item.href)
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
      
      <Button
        variant="ghost"
        className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground mt-4"
        onClick={onSignOut}
      >
        <LogOut className="w-5 h-5" />
        Déconnexion
      </Button>
    </div>
  );
};

export default AdminMobileNav;
