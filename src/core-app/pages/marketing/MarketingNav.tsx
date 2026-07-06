/**
 * MarketingNav — Onglets partagés du Marketing Hub (style Mailchimp).
 * À insérer en haut de chaque page marketing pour navigation cohérente.
 */
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Target, LayoutTemplate, Send, MessageSquare,
  Bot, Settings, Zap, BarChart3, CalendarClock, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { path: "", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { path: "audiences", label: "Audiences", icon: Target },
  { path: "contacts", label: "Contacts", icon: Users },
  { path: "templates", label: "Templates", icon: LayoutTemplate },
  { path: "campaigns", label: "Campagnes", icon: Send },
  { path: "push-campaigns", label: "Push web", icon: MessageCircle },
  { path: "planning", label: "Planification", icon: CalendarClock },
  { path: "sms-campaigns", label: "SMS", icon: MessageSquare },
  { path: "automations", label: "Automations", icon: Zap },
  { path: "analytics", label: "Analytics", icon: BarChart3 },
  { path: "live-chat", label: "Live Chat", icon: MessageCircle },
  { path: "ai-config", label: "IA", icon: Bot },
  { path: "settings", label: "Réglages", icon: Settings },
];

export default function MarketingNav() {
  const { pathname } = useLocation();
  const base = pathname === "/core/marketing" || pathname.startsWith("/core/marketing/") ? "/core/marketing" : "/marketing";
  return (
    <div className="border-b border-border -mx-4 sm:-mx-6 px-4 sm:px-6 mb-4">
      <nav className="flex gap-1 overflow-x-auto scrollbar-none py-1">
        {TABS.map(({ path, label, icon: Icon, exact }) => {
          const to = path ? `${base}/${path}` : base;
          return (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              cn(
                "shrink-0 inline-flex items-center gap-1.5 px-3 h-10 rounded-full text-xs font-black whitespace-nowrap transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
