import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { navGroups, NavGroup } from "./AdminSidebarNav";

interface AdminMobileNavProps {
  onClose: () => void;
  onSignOut: () => void;
}

const AdminMobileNav = ({ onClose, onSignOut }: AdminMobileNavProps) => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return navGroups;
    const query = searchQuery.toLowerCase().trim();
    return navGroups
      .map(group => {
        const groupMatches = group.label.toLowerCase().includes(query);
        const matchingItems = group.items.filter(item =>
          item.label.toLowerCase().includes(query)
        );
        if (groupMatches) return group;
        if (matchingItems.length > 0) return { ...group, items: matchingItems };
        return null;
      })
      .filter((group): group is NavGroup => group !== null);
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const newOpen: Record<string, boolean> = {};
      filteredGroups.forEach(g => { newOpen[g.id] = true; });
      setOpenGroups(prev => ({ ...prev, ...newOpen }));
    }
  }, [searchQuery, filteredGroups]);

  useEffect(() => {
    for (const group of navGroups) {
      if (group.items.some(item => location.pathname === item.href)) {
        setOpenGroups(prev => ({ ...prev, [group.id]: true }));
        break;
      }
    }
  }, [location.pathname]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const isItemActive = (href: string) => location.pathname === href;
  const isGroupActive = (group: NavGroup) =>
    group.items.some(item => isItemActive(item.href));

  return (
    <div className="absolute top-full left-0 right-0 bg-background/98 backdrop-blur-xl border-b border-border max-h-[calc(100dvh-4.5rem)] overflow-hidden flex flex-col z-50">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Filtrer le menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-10 text-sm bg-secondary border-border text-foreground placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-3 space-y-1 overflow-y-auto overscroll-contain">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Aucun résultat pour « {searchQuery} »
          </div>
        ) : (
          filteredGroups.map((group, index) => {
            const isOpen = openGroups[group.id] ?? false;
            const hasActiveItem = isGroupActive(group);

            return (
              <div key={group.id}>
                <Collapsible open={isOpen} onOpenChange={() => toggleGroup(group.id)}>
                  <CollapsibleTrigger
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                      hasActiveItem
                        ? "text-primary"
                        : "text-admin-text-secondary hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <group.icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{group.label}</span>
                    </div>
                    <ChevronRight className={cn(
                      "w-4 h-4 shrink-0 transition-transform duration-200",
                      isOpen && "rotate-90"
                    )} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1">
                    <div className="ml-4 pl-3 border-l-2 border-border space-y-0.5">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                            isItemActive(item.href)
                              ? "bg-primary text-primary-foreground font-medium"
                              : "text-admin-text-secondary hover:bg-secondary hover:text-foreground"
                          )}
                        >
                          <item.icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                {index < filteredGroups.length - 1 && (
                  <div className="my-1.5 mx-3 border-t border-border/50" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Sign Out */}
      <div className="p-3 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary h-10"
          onClick={onSignOut}
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </Button>
      </div>
    </div>
  );
};

export default AdminMobileNav;
