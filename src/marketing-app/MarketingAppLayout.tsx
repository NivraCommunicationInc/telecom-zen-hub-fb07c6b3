import { useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bot,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Phone,
  Settings,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import InternalThemeToggle from "@/components/internal/InternalThemeToggle";
import { useInternalTheme } from "@/hooks/useInternalTheme";

const NAV_ITEMS = [
  { label: "Dashboard Marketing", href: "/marketing", icon: LayoutDashboard },
  { label: "Conversations OpenPhone", href: "/marketing/conversations", icon: Phone },
  { label: "Agent IA Config", href: "/marketing/ai-config", icon: Bot },
  { label: "Live Chat", href: "/marketing/live-chat", icon: MessageCircle },
  { label: "Campagnes SMS", href: "/marketing/sms-campaigns", icon: MessageSquare },
  { label: "Campagnes Email", href: "/marketing/email-campaigns", icon: Mail },
  { label: "Settings", href: "/marketing/settings", icon: Settings },
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
    <div className={cn("internal-ui min-h-screen bg-background text-foreground", themeClass)}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-border bg-card md:w-72 md:border-b-0 md:border-r">
          <div className="flex items-center gap-3 border-b border-border px-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Megaphone className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Marketing Hub</p>
              <p className="text-xs text-muted-foreground">Portail marketing dédié</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1 p-3">
            {items.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive(item.href)
                    ? "bg-primary text-primary-foreground"
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
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Marketing Portal
            </span>
            <div className="flex items-center gap-3">
              <InternalThemeToggle theme={theme} onToggle={toggleTheme} />
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