/**
 * CoreAppLayout — Nivra Core internal operations console shell.
 * Dark ops-grade layout with sidebar navigation, header bar, and routed content area.
 */
import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ListTodo,
  ShoppingCart,
  Users,
  FileText,
  CreditCard,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_SECTIONS = [
  { label: "Dashboard", href: "/core", icon: LayoutDashboard },
  { label: "Work Queue", href: "/core/queue", icon: ListTodo },
  { label: "Orders", href: "/core/orders", icon: ShoppingCart },
  { label: "Accounts", href: "/core/accounts", icon: Users },
  { label: "Invoices", href: "/core/invoices", icon: FileText },
  { label: "Payments", href: "/core/payments", icon: CreditCard },
  { label: "Subscriptions", href: "/core/subscriptions", icon: RefreshCcw },
] as const;

const CoreAppLayout = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === "/core") return location.pathname === "/core";
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen flex bg-[hsl(220,20%,8%)] text-[hsl(220,10%,85%)]">
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
                to={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors",
                  collapsed ? "justify-center px-0 py-2" : "px-2.5 py-2",
                  active
                    ? "bg-emerald-600/15 text-emerald-400"
                    : "text-[hsl(220,10%,55%)] hover:bg-[hsl(220,15%,14%)] hover:text-[hsl(220,10%,80%)]"
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
            className="w-full flex items-center justify-center py-1.5 rounded-md text-[hsl(220,10%,45%)] hover:text-[hsl(220,10%,70%)] hover:bg-[hsl(220,15%,14%)] transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 h-12 flex items-center justify-between px-4 border-b border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)]/95 backdrop-blur">
          <span className="text-xs font-medium text-[hsl(220,10%,45%)] uppercase tracking-wider">
            Internal Operations Console
          </span>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-600/10 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Core Online
            </span>
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
