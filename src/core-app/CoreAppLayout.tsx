/**
 * CoreAppLayout — Nivra Core internal operations console shell.
 * Dark ops-grade layout with sidebar navigation, header bar, and routed content area.
 */
import { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { CoreGlobalSearch } from "./components/CoreGlobalSearch";
import { supabase } from "@/integrations/supabase/client";
import { corePath, isCorePathActive } from "@/core-app/lib/corePaths";
import {
  LayoutDashboard,
  ListTodo,
  ShoppingCart,
  Users,
  UserCircle,
  FileText,
  CreditCard,
  RefreshCcw,
  Calendar,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Receipt,
  Package,
  Shield,
  Settings,
  Tv,
  Boxes,
  Headphones,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_SECTIONS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Work Queue", href: "/work-queue", icon: ListTodo },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Clients", href: "/clients", icon: UserCircle },
  { label: "Accounts", href: "/accounts", icon: Users },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Subscriptions", href: "/subscriptions", icon: RefreshCcw },
  { label: "Équipements", href: "/equipment", icon: Package },
  { label: "Rendez-vous", href: "/appointments", icon: Calendar },
  { label: "POS", href: "/pos", icon: Receipt },
] as const;

const CoreAppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate(corePath("/login"), { replace: true });
  };

  const isActive = (href: string) => isCorePathActive(location.pathname, href);

  return (
    <div className="core-console min-h-screen flex bg-[hsl(220,20%,8%)] text-[hsl(var(--core-text-primary))]">
      {/* ═══ SIDEBAR ═══ */}
      <aside
        className={cn(
          "flex flex-col shrink-0 border-r border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] transition-all duration-200",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* Brand */}
        <div className="h-12 flex items-center gap-2 px-3 border-b border-[hsl(220,15%,16%)]">
          <div className="h-7 w-7 rounded-md bg-emerald-600 flex items-center justify-center shrink-0">
            <Terminal className="h-3.5 w-3.5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm tracking-tight text-white whitespace-nowrap">
              Nivra Core
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
          {NAV_SECTIONS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={corePath(item.href)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors",
                  collapsed ? "justify-center px-0 py-2" : "px-2.5 py-2",
                  active
                    ? "bg-emerald-600/15 text-emerald-400"
                    : "text-[hsl(var(--core-text-secondary))] hover:bg-[hsl(220,15%,14%)] hover:text-[hsl(var(--core-text-primary))]"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-[hsl(220,15%,16%)] p-1.5">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-1.5 rounded-md text-[hsl(var(--core-text-label))] hover:text-[hsl(var(--core-text-primary))] hover:bg-[hsl(220,15%,14%)] transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 h-12 flex items-center justify-between px-4 border-b border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)]/95 backdrop-blur">
          <span className="text-xs font-medium text-[hsl(var(--core-text-label))] uppercase tracking-wider">
            Internal Operations Console
          </span>
          <div className="flex items-center gap-3">
            <CoreGlobalSearch />
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-600/10 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Core Online
            </span>
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="p-1.5 rounded-md text-[hsl(var(--core-text-label))] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default CoreAppLayout;
