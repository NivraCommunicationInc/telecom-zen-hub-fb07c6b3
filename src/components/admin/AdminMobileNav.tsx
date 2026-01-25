import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

const MOBILE_STORAGE_KEY = "admin_mobile_nav_groups_state";
const MOBILE_ACCORDION_KEY = "admin_mobile_accordion_mode";

const AdminMobileNav = ({ onClose, onSignOut }: AdminMobileNavProps) => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Accordion mode
  const [accordionMode, setAccordionMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(MOBILE_ACCORDION_KEY);
      return saved === "true";
    } catch {
      return false;
    }
  });

  // Initialize open groups from localStorage
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

  // Filter groups and items based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return navGroups;
    }

    const query = searchQuery.toLowerCase().trim();
    
    return navGroups
      .map(group => {
        const groupMatches = group.label.toLowerCase().includes(query);
        const matchingItems = group.items.filter(item =>
          item.label.toLowerCase().includes(query)
        );

        if (groupMatches) {
          return group;
        } else if (matchingItems.length > 0) {
          return { ...group, items: matchingItems };
        }
        
        return null;
      })
      .filter((group): group is NavGroup => group !== null);
  }, [searchQuery]);

  // Auto-expand groups that have search matches
  useEffect(() => {
    if (searchQuery.trim()) {
      const matchingGroupIds = filteredGroups.map(g => g.id);
      const newOpenGroups: Record<string, boolean> = {};
      matchingGroupIds.forEach(id => {
        newOpenGroups[id] = true;
      });
      setOpenGroups(prev => ({
        ...prev,
        ...newOpenGroups,
      }));
    }
  }, [searchQuery, filteredGroups]);

  // Auto-open the group containing the active route
  useEffect(() => {
    if (!searchQuery.trim()) {
      const activeGroupId = getActiveGroupId();
      if (activeGroupId && !openGroups[activeGroupId]) {
        if (accordionMode) {
          setOpenGroups({ [activeGroupId]: true });
        } else {
          setOpenGroups(prev => ({
            ...prev,
            [activeGroupId]: true,
          }));
        }
      }
    }
  }, [location.pathname, accordionMode]);

  // Persist state
  useEffect(() => {
    localStorage.setItem(MOBILE_STORAGE_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  useEffect(() => {
    localStorage.setItem(MOBILE_ACCORDION_KEY, String(accordionMode));
  }, [accordionMode]);

  const toggleGroup = (groupId: string) => {
    if (accordionMode) {
      setOpenGroups(prev => ({
        [groupId]: !prev[groupId],
      }));
    } else {
      setOpenGroups(prev => ({
        ...prev,
        [groupId]: !prev[groupId],
      }));
    }
  };

  const isItemActive = (href: string) => location.pathname === href;

  const isGroupActive = (group: NavGroup) => 
    group.items.some(item => isItemActive(item.href));

  const handleAccordionModeChange = (checked: boolean) => {
    setAccordionMode(checked);
    if (checked) {
      const activeGroupId = getActiveGroupId();
      if (activeGroupId) {
        setOpenGroups({ [activeGroupId]: true });
      } else {
        setOpenGroups({});
      }
    }
  };

  return (
    <div className="absolute top-full left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 max-h-[calc(100dvh-4.5rem)] overflow-hidden flex flex-col">
      {/* Search Input */}
      <div className="p-3 border-b border-slate-700/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            type="text"
            placeholder="Filtrer le menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-400 hover:text-white"
              onClick={() => setSearchQuery("")}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
        {/* Accordion Mode Toggle */}
        <div className="flex items-center justify-between mt-2">
          <Label htmlFor="mobile-accordion-mode" className="text-xs text-slate-500 cursor-pointer">
            Mode accordéon
          </Label>
          <Switch
            id="mobile-accordion-mode"
            checked={accordionMode}
            onCheckedChange={handleAccordionModeChange}
            className="scale-75"
          />
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 p-3 space-y-1 overflow-y-auto overscroll-contain">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            Aucun résultat pour "{searchQuery}"
          </div>
        ) : (
          filteredGroups.map((group, index) => {
            const isOpen = openGroups[group.id] ?? false;
            const hasActiveItem = isGroupActive(group);
            const isLastGroup = index === filteredGroups.length - 1;

            return (
              <div key={group.id}>
                <Collapsible
                  open={isOpen}
                  onOpenChange={() => toggleGroup(group.id)}
                >
                  <CollapsibleTrigger
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      hasActiveItem
                        ? "bg-teal-500/20 text-teal-400"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <group.icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{group.label}</span>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1">
                    <div className="ml-3 pl-3 border-l-2 border-slate-700/50 space-y-0.5">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                            isItemActive(item.href)
                              ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 font-medium"
                              : "text-slate-400 hover:bg-slate-800 hover:text-white"
                          )}
                        >
                          <item.icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                
                {/* Subtle separator between groups */}
                {!isLastGroup && (
                  <div className="my-2 mx-3 border-t border-slate-700/30" />
                )}
              </div>
            );
          })
        )}
      </div>
      
      {/* Sign Out Button */}
      <div className="p-3 border-t border-slate-700/50">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-slate-800"
          onClick={onSignOut}
        >
          <LogOut className="w-5 h-5" />
          Déconnexion
        </Button>
      </div>
    </div>
  );
};

export default AdminMobileNav;
