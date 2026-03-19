/**
 * EmployeeSidebar — Operational sidebar for Employee Portal.
 * Exact order: Dashboard, Work Queue, Orders, Clients, Payments,
 * KYC, Activations, Support, Audit. Bottom: Profile, Security, Logout.
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, ListTodo, ShoppingCart, Users, CreditCard,
  ShieldCheck, Zap, Headphones, ScrollText, User, Lock, LogOut,
  Briefcase, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

const EMP_BASE = "/employee";

const navItems = [
  { label: "Tableau de bord", href: `${EMP_BASE}/dashboard`, icon: LayoutDashboard },
  { label: "File de travail", href: `${EMP_BASE}/work-queue`, icon: ListTodo },
  { label: "Commandes", href: `${EMP_BASE}/orders`, icon: ShoppingCart },
  { label: "Clients", href: `${EMP_BASE}/clients`, icon: Users },
  { label: "Paiements", href: `${EMP_BASE}/payments`, icon: CreditCard },
  { label: "KYC / Vérification", href: `${EMP_BASE}/kyc`, icon: ShieldCheck },
  { label: "Activations", href: `${EMP_BASE}/activations`, icon: Zap },
  { label: "Support", href: `${EMP_BASE}/support`, icon: Headphones },
  { label: "Audit / Historique", href: `${EMP_BASE}/audit`, icon: ScrollText },
];

const bottomItems = [
  { label: "Mon profil", href: `${EMP_BASE}/profile`, icon: User },
  { label: "Sécurité", href: `${EMP_BASE}/security`, icon: Lock },
];

export default function EmployeeSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + "/");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/hub/login", { replace: true });
  };

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-r border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7%)] transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-[hsl(220,15%,12%)]">
        {!collapsed && (
          <Link to="/employee/dashboard" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-blue-600 flex items-center justify-center">
              <Briefcase className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm text-white tracking-tight">Nivra Employee</span>
          </Link>
        )}
        {collapsed && (
          <div className="mx-auto h-7 w-7 rounded-md bg-blue-600 flex items-center justify-center">
            <Briefcase className="h-3.5 w-3.5 text-white" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded text-[hsl(220,10%,40%)] hover:text-white hover:bg-[hsl(220,15%,15%)] transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav className="px-2 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors",
                isActive(item.href)
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-[hsl(220,10%,50%)] hover:text-white hover:bg-[hsl(220,15%,12%)]"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>
      </ScrollArea>

      {/* Bottom */}
      <div className="border-t border-[hsl(220,15%,12%)] py-2 px-2 space-y-0.5">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors",
              isActive(item.href)
                ? "bg-blue-600/15 text-blue-400"
                : "text-[hsl(220,10%,50%)] hover:text-white hover:bg-[hsl(220,15%,12%)]"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium text-[hsl(220,10%,50%)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
}
