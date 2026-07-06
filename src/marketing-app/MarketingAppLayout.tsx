import { useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bot,
  CalendarClock,
  FileStack,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  Settings,
  LogOut,
  LayoutGrid,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import InternalThemeToggle from "@/components/internal/InternalThemeToggle";
import { useInternalTheme } from "@/hooks/useInternalTheme";

const NAV_ITEMS = [
  { label: "Accueil", href: "/marketing", icon: LayoutDashboard },
  { label: "Audiences", href: "/marketing/audiences", icon: Target },
  { label: "Contacts", href: "/marketing/contacts", icon: Users },
  { label: "Templates", href: "/marketing/templates", icon: FileStack },
  { label: "Campagnes", href: "/marketing/campaigns", icon: Send },
  { label: "Push web", href: "/marketing/push-campaigns", icon: MessageCircle },
  { label: "Planification", href: "/marketing/planning", icon: CalendarClock },
  { label: "Automations", href: "/marketing/automations", icon: Zap },
  { label: "Analytics", href: "/marketing/analytics", icon: BarChart3 },
  { label: "SMS", href: "/marketing/sms-campaigns", icon: MessageSquare },
  { label: "Conversations", href: "/marketing/conversations", icon: Phone },
  { label: "Live Chat", href: "/marketing/live-chat", icon: MessageCircle },
  { label: "Email legacy", href: "/marketing/email-campaigns", icon: Mail },
  { label: "IA", href: "/marketing/ai-config", icon: Bot },
  { label: "Réglages", href: "/marketing/settings", icon: Settings },
] as const;

export default function MarketingAppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, themeClass, toggleTheme } = useInternalTheme();

  const activePath = location.pathname;
  const items = useMemo(() => NAV_ITEMS, []);

  const isActive = (href: string) => {
    if (href === "/marketing") return activePath === "/marketing";
    return activePath === href || activePath.startsWith(`${href}/`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/nivra-secure-hub-2617-internal", { replace: true });
  };

  return (
    <div className={cn("internal-ui min-h-screen bg-background text-foreground", themeClass)} data-marketing-portal>
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-border bg-sidebar md:w-72 md:border-b-0 md:border-r">
          <div className="flex items-center gap-3 border-b border-border px-4 py-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary">
              <Megaphone className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-base font-black tracking-normal">Nivra Marketing</p>
              <p className="text-xs font-medium text-muted-foreground">Audiences · campagnes · automatisations</p>
            </div>
          </div>

          <nav className="flex max-h-[calc(100vh-88px)] flex-col gap-1 overflow-y-auto p-3">
            {items.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-full px-4 py-2.5 text-sm font-bold transition-colors",
                  isActive(item.href)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
            <span className="text-xs font-black uppercase tracking-normal text-muted-foreground">
              Marketing workbench
            </span>
            <div className="flex items-center gap-3">
              <InternalThemeToggle theme={theme} onToggle={toggleTheme} />
              <button
                onClick={() => navigate('/nivra-secure-hub-2617-internal')}
                title="Changer de portail"
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground border-l border-border pl-3 ml-1"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={handleLogout}
                title="Déconnexion"
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}