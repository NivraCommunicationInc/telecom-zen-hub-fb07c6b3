import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle, 
  Wrench, 
  Clock, 
  X,
  Wifi,
  Tv,
  Smartphone,
  Film,
  Globe,
  CreditCard,
  Server,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface SystemStatusBannerProps {
  userType: "client" | "employee" | "technician" | "admin";
}

const statusTypeIcons: Record<string, any> = {
  maintenance: Wrench,
  incident: AlertTriangle,
  info: Info,
  resolved: CheckCircle,
  scheduled: Clock,
};

const severityStyles: Record<string, string> = {
  critical: "bg-red-600 text-white border-red-700",
  warning: "bg-amber-500 text-white border-amber-600",
  info: "bg-blue-500 text-white border-blue-600",
  success: "bg-green-500 text-white border-green-600",
};

// Service icons
const serviceIcons: Record<string, any> = {
  internet: Wifi,
  tv: Tv,
  mobile: Smartphone,
  streaming: Film,
  portal: Globe,
  billing: CreditCard,
};

// Service status config
const serviceStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  operational: { label: "Opérationnel", color: "bg-green-500", bgColor: "bg-green-50" },
  degraded: { label: "Dégradé", color: "bg-yellow-500", bgColor: "bg-yellow-50" },
  partial_outage: { label: "Panne partielle", color: "bg-orange-500", bgColor: "bg-orange-50" },
  major_outage: { label: "Panne majeure", color: "bg-red-500", bgColor: "bg-red-50" },
  maintenance: { label: "Maintenance", color: "bg-blue-500", bgColor: "bg-blue-50" },
};

export const SystemStatusBanner = ({ userType }: SystemStatusBannerProps) => {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const { data: statuses } = useQuery({
    queryKey: ["system-status", userType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_status")
        .select("id, title, message, status_type, severity, is_banner, starts_at, ends_at, affected_services, show_to_clients, show_to_employees, show_to_technicians")
        .eq("is_active", true)
        .eq("is_banner", true)
        .order("severity", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  // Filter statuses based on user type visibility
  const visibleStatuses = statuses?.filter((status) => {
    if (dismissedIds.includes(status.id)) return false;
    
    switch (userType) {
      case "client":
        return status.show_to_clients;
      case "employee":
        return status.show_to_employees;
      case "technician":
        return status.show_to_technicians;
      case "admin":
        return true;
      default:
        return false;
    }
  }) || [];

  // Check if within time range
  const activeStatuses = visibleStatuses.filter((status) => {
    const now = new Date();
    if (status.starts_at && new Date(status.starts_at) > now) return false;
    if (status.ends_at && new Date(status.ends_at) < now) return false;
    return true;
  });

  if (activeStatuses.length === 0) return null;

  const handleDismiss = (id: string) => {
    setDismissedIds([...dismissedIds, id]);
  };

  return (
    <div className="space-y-0">
      {activeStatuses.map((status) => {
        const Icon = statusTypeIcons[status.status_type] || Info;
        return (
          <div
            key={status.id}
            className={cn(
              "px-4 py-2 flex items-center justify-between gap-4 text-sm",
              severityStyles[status.severity] || severityStyles.info
            )}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Icon className="w-4 h-4 shrink-0" />
              <span className="font-medium shrink-0">{status.title}</span>
              <span className="hidden sm:inline truncate opacity-90">— {status.message}</span>
            </div>
            <button
              onClick={() => handleDismiss(status.id)}
              className="p-1 hover:bg-white/20 rounded shrink-0"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

// Compact status indicator for sidebars
export const SystemStatusIndicator = () => {
  const { data: statuses } = useQuery({
    queryKey: ["system-status-indicator"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_status")
        .select("id, severity")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  if (!statuses || statuses.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span>Systèmes opérationnels</span>
      </div>
    );
  }

  const hasCritical = statuses.some(s => s.severity === "critical");
  const hasWarning = statuses.some(s => s.severity === "warning");

  if (hasCritical) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-600">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span>Incident en cours</span>
      </div>
    );
  }

  if (hasWarning) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-600">
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span>Maintenance</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-blue-600">
      <div className="w-2 h-2 rounded-full bg-blue-500" />
      <span>{statuses.length} annonce(s)</span>
    </div>
  );
};

// Service status dashboard cards for client/employee/technician portals
export const ServiceStatusCards = ({ compact = false }: { compact?: boolean }) => {
  const [expanded, setExpanded] = useState(!compact);

  const { data: services, isLoading } = useQuery({
    queryKey: ["public-service-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_status")
        .select("service_name, display_name, status, status_message, uptime_percent")
        .order("service_name");
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const operationalCount = services?.filter(s => s.status === "operational").length || 0;
  const totalServices = services?.length || 0;
  const allOperational = operationalCount === totalServices;

  const ServiceIcon = ({ name }: { name: string }) => {
    const Icon = serviceIcons[name] || Server;
    return <Icon className="w-4 h-4" />;
  };

  if (isLoading) return null;

  if (compact && !expanded) {
    return (
      <Card className={cn(
        "cursor-pointer transition-all",
        allOperational ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
      )}>
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between" onClick={() => setExpanded(true)}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                allOperational ? "bg-green-500" : "bg-amber-500"
              )} />
              <span className="text-sm font-medium">
                {allOperational ? "Tous les services opérationnels" : `${operationalCount}/${totalServices} services opérationnels`}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4">
        {compact && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mb-3 justify-between"
            onClick={() => setExpanded(false)}
          >
            <span className="text-sm font-medium">Statut des services</span>
            <ChevronUp className="w-4 h-4" />
          </Button>
        )}
        <div className={cn(
          "grid gap-2",
          compact ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
        )}>
          {services?.map((service) => {
            const config = serviceStatusConfig[service.status] || serviceStatusConfig.operational;
            return (
              <div 
                key={service.service_name}
                className={cn(
                  "p-3 rounded-lg border transition-all",
                  config.bgColor,
                  service.status === "operational" ? "border-green-200" : "border-amber-200"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("p-1.5 rounded", config.color)}>
                    <ServiceIcon name={service.service_name} />
                  </div>
                  <span className="text-xs font-medium truncate">{service.display_name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={cn("w-2 h-2 rounded-full", config.color)} />
                  <span className="text-xs text-muted-foreground">{config.label}</span>
                </div>
                {service.uptime_percent && (
                  <div className="mt-2">
                    <Progress value={service.uptime_percent} className="h-1" />
                    <span className="text-[10px] text-muted-foreground">{service.uptime_percent?.toFixed(1)}% uptime</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default SystemStatusBanner;