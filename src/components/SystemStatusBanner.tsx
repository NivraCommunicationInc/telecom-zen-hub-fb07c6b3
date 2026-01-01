import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, AlertCircle, Info, CheckCircle, Wrench, Clock, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

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
        .order("severity", { ascending: true }); // critical first
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
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
        return true; // Admins see all
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

export default SystemStatusBanner;