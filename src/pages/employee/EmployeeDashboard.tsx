import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Package,
  Calendar,
  Ticket,
  FileText,
  LogOut,
  RefreshCw,
  Clock,
  LayoutDashboard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface EmployeeSession {
  employeeId: string;
  email: string;
  name: string;
  role: string;
  permissions: Record<string, boolean>;
  token: string;
  loginAt: string;
}

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<EmployeeSession | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    const stored = localStorage.getItem("nivra_employee_session");
    if (!stored) {
      navigate("/employee/login");
      return;
    }
    try {
      setSession(JSON.parse(stored));
    } catch {
      navigate("/employee/login");
    }
  }, [navigate]);

  const fetchStats = async () => {
    if (!session?.token) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "get_dashboard_stats" },
      });
      if (error) throw error;
      if (data?.stats) setStats(data.stats);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.token) fetchStats();
  }, [session?.token]);

  const handleLogout = () => {
    localStorage.removeItem("nivra_employee_session");
    toast({ title: "Déconnexion", description: "À bientôt!" });
    navigate("/employee/login");
  };

  const permissions = session?.permissions || {};

  const menuItems = [
    { 
      label: "Commandes", 
      icon: Package, 
      href: "/employee/orders", 
      count: stats?.orders || 0,
      enabled: permissions.can_view_orders,
      color: "text-blue-500"
    },
    { 
      label: "Rendez-vous", 
      icon: Calendar, 
      href: "/employee/appointments", 
      count: stats?.upcomingAppointments || 0,
      enabled: permissions.can_view_appointments,
      color: "text-cyan-500"
    },
    { 
      label: "Tickets", 
      icon: Ticket, 
      href: "/employee/tickets", 
      count: stats?.openTickets || 0,
      enabled: permissions.can_view_tickets,
      color: "text-amber-500"
    },
    { 
      label: "Clients", 
      icon: Users, 
      href: "/employee/clients", 
      count: stats?.totalClients || 0,
      enabled: permissions.can_view_clients,
      color: "text-emerald-500"
    },
    { 
      label: "Factures", 
      icon: FileText, 
      href: "/employee/invoices", 
      count: null,
      enabled: permissions.can_generate_invoices || permissions.can_edit_invoices,
      color: "text-purple-500"
    },
  ];

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg">Portail Employé – Nivra</h1>
                <p className="text-xs text-muted-foreground">
                  {session.name} <Badge variant="outline" className="ml-2 text-xs">Employé</Badge>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchStats} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Welcome Banner */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-display font-bold">Bonjour, {session.name}!</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Bienvenue dans le portail employé Nivra
                </p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Dernière actualisation: {format(lastRefresh, "HH:mm", { locale: fr })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {menuItems.filter(item => item.enabled && item.count !== null).map((item) => (
            <Link key={item.label} to={item.href}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4 text-center">
                  <item.icon className={`w-6 h-6 mx-auto mb-2 ${item.color}`} />
                  <div className="text-2xl font-bold">{item.count}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Navigation Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {menuItems.map((item) => (
            <Card 
              key={item.label} 
              className={`${item.enabled ? "hover:border-primary/50 cursor-pointer" : "opacity-50"} transition-colors`}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  {item.label}
                  {item.count !== null && item.enabled && (
                    <Badge variant="secondary" className="ml-auto">{item.count}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {item.enabled ? (
                  <Link to={item.href}>
                    <Button variant="outline" size="sm" className="w-full">
                      Accéder
                    </Button>
                  </Link>
                ) : (
                  <p className="text-xs text-muted-foreground">Accès non autorisé</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Permissions Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Vos permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(permissions).map(([key, value]) => (
                <Badge 
                  key={key} 
                  variant={value ? "default" : "outline"}
                  className={`text-xs ${value ? "" : "opacity-50"}`}
                >
                  {key.replace("can_", "").replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EmployeeDashboard;
