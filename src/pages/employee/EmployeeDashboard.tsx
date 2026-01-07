import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { employeeClient as supabase } from "@/integrations/backend/employeeClient";
import { Package, MessageSquare, XCircle, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";


const EmployeeDashboard = () => {
  // Pending orders count
  const { data: pendingOrdersCount } = useQuery({
    queryKey: ["employee-pending-orders"],
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "processing", "verification"]);
      return count || 0;
    },
  });

  // Open tickets count
  const { data: openTicketsCount } = useQuery({
    queryKey: ["employee-open-tickets"],
    queryFn: async () => {
      const { count } = await supabase
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "pending", "in_progress"]);
      return count || 0;
    },
  });

  // Pending cancellations count
  const { data: pendingCancellationsCount } = useQuery({
    queryKey: ["employee-pending-cancellations"],
    queryFn: async () => {
      // Note: Table may not exist yet, gracefully return 0
      try {
        const { count } = await supabase
          .from("support_tickets")
          .select("*", { count: "exact", head: true })
          .eq("category", "cancellation")
          .in("status", ["open", "pending", "in_progress"]);
        return count || 0;
      } catch { return 0; }
    },
  });

  // Pending disputes count
  const { data: pendingDisputesCount } = useQuery({
    queryKey: ["employee-pending-disputes"],
    queryFn: async () => {
      const { count } = await supabase
        .from("payment_disputes")
        .select("*", { count: "exact", head: true })
        .in("status", ["submitted", "under_review", "awaiting_client"]);
      return count || 0;
    },
  });

  // Recent activity
  const { data: recentActivity } = useQuery({
    queryKey: ["employee-recent-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const stats = [
    {
      label: "Commandes en attente",
      value: pendingOrdersCount || 0,
      icon: Package,
      color: "text-amber-500",
      bg: "bg-amber-500/20",
      href: "/employee/orders",
    },
    {
      label: "Tickets ouverts",
      value: openTicketsCount || 0,
      icon: MessageSquare,
      color: "text-cyan-500",
      bg: "bg-cyan-500/20",
      href: "/employee/tickets",
    },
    {
      label: "Annulations en attente",
      value: pendingCancellationsCount || 0,
      icon: XCircle,
      color: "text-red-500",
      bg: "bg-red-500/20",
      href: "/employee/cancellations",
    },
    {
      label: "Contestations en attente",
      value: pendingDisputesCount || 0,
      icon: AlertTriangle,
      color: "text-purple-500",
      bg: "bg-purple-500/20",
      href: "/employee/payment-disputes",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble de vos tâches</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.href}>
            <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            Activité récente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((activity: any) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 bg-accent/30 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.entity_type} • {activity.actor_name || "Système"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(activity.created_at), "d MMM HH:mm", { locale: fr })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Aucune activité récente</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeDashboard;
