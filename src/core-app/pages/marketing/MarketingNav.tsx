/**
 * MarketingNav — Onglets partagés du Marketing Hub (style Mailchimp).
 * À insérer en haut de chaque page marketing pour navigation cohérente.
 */
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Users, Target, LayoutTemplate, Send, MessageSquare,
  Bot, Settings, Zap, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/marketing", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/marketing/audiences", label: "Audiences", icon: Target },
  { to: "/marketing/contacts", label: "Contacts", icon: Users },
  { to: "/marketing/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/marketing/campaigns", label: "Campagnes", icon: Send },
  { to: "/marketing/sms-campaigns", label: "SMS", icon: MessageSquare },
  { to: "/marketing/automations", label: "Automations", icon: Zap },
  { to: "/marketing/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/marketing/ai-config", label: "IA", icon: Bot },
  { to: "/marketing/settings", label: "Réglages", icon: Settings },
];

export default function MarketingNav() {
  return (
    <div className="border-b border-[#1E1E2E] -mx-4 sm:-mx-6 px-4 sm:px-6 mb-4">
      <nav className="flex gap-1 overflow-x-auto scrollbar-none py-1">
        {TABS.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              cn(
                "shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-[10px] text-xs font-semibold whitespace-nowrap transition-colors",
                isActive
                  ? "bg-[#7C3AED] text-white"
                  : "text-[#888] hover:text-white hover:bg-[#1E1E2E]"
              )
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
