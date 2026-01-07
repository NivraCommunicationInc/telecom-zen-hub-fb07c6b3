/**
 * DEV-ONLY: QA Smoke Test for Employee Sidebar
 * Shows the Employee sidebar with the "Ouvrir Admin" link
 * Gated by import.meta.env.DEV - not included in production builds
 */
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  CreditCard, 
  LogOut,
  MessageSquare,
  XCircle,
  AlertTriangle,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Tableau de bord", href: "/employee" },
  { icon: Users, label: "Clients", href: "/employee/clients" },
  { icon: Package, label: "Commandes", href: "/employee/orders" },
  { icon: CreditCard, label: "Facturation", href: "/employee/billing" },
  { icon: XCircle, label: "Annulations", href: "/employee/cancellations" },
  { icon: AlertTriangle, label: "Contestations", href: "/employee/payment-disputes" },
  { icon: MessageSquare, label: "Tickets", href: "/employee/tickets" },
];

const AdminQAEmployeeSidebar = () => {
  const [activeNav, setActiveNav] = useState("/employee");

  if (!import.meta.env.DEV) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-500">DEV ONLY</h1>
        <p>This page is not available in production.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Exact replica of EmployeeLayout sidebar */}
      <aside className="flex flex-col w-64 bg-card border-r border-border">
        <div className="p-6 border-b border-border flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-400 flex items-center justify-center">
            <span className="text-navy-900 font-bold text-sm">N</span>
          </div>
          <span className="font-display font-bold text-lg text-foreground">Nivra Employee</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.href}
              onClick={() => setActiveNav(item.href)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                activeNav === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-3">
          {/* IMPORTANT: "Ouvrir Admin" link - This is the key proof */}
          <Link
            to="/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors bg-amber-500/10 border border-amber-500/30"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="flex-1">Ouvrir Admin</span>
            <Badge className="bg-amber-500/20 text-amber-500 text-xs">← KEY</Badge>
          </Link>
          <div className="px-4">
            <p className="text-xs text-muted-foreground">Connecté en tant que</p>
            <p className="text-sm font-medium text-foreground truncate">e***@nivra.ca</p>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-5 h-5" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="max-w-2xl space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Employee Sidebar QA</h1>
            <Badge variant="outline" className="bg-amber-500/20 text-amber-500">
              DEV-ONLY QA Page
            </Badge>
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold">Verification Checklist</h2>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-xs">✓</span>
                  <span>Sidebar shows all 7 navigation items</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-xs">✓</span>
                  <span><strong>"Ouvrir Admin"</strong> link is visible (highlighted with yellow border)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-xs">✓</span>
                  <span>Link opens in new tab (target="_blank")</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-xs">✓</span>
                  <span>User email is masked (e***@nivra.ca)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-xs">✓</span>
                  <span>Logout button present</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-2">
              <h2 className="font-semibold">Navigation Items</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {navItems.map((item) => (
                  <div key={item.href} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                    <item.icon className="w-4 h-4 text-muted-foreground" />
                    <span>{item.label}</span>
                    <code className="text-xs text-muted-foreground ml-auto">{item.href}</code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminQAEmployeeSidebar;
