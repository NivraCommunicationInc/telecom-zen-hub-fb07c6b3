import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { AlertTriangle, AlertCircle, Wrench, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * HomeStatusBanner - Displays a banner on the homepage when there are active incidents or maintenance
 * Only shows if there are non-operational services or active system announcements
 */
const HomeStatusBanner = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";

  // Fetch service status to check for non-operational services
  const { data: services } = useQuery({
    queryKey: ["home-service-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_status")
        .select("id, status, display_name, status_message")
        .neq("status", "operational");
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  // Fetch active system announcements that should be shown to clients
  const { data: announcements } = useQuery({
    queryKey: ["home-system-status"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("system_status")
        .select("id, title, status_type, severity, message")
        .eq("is_active", true)
        .eq("show_to_clients", true)
        .or(`ends_at.is.null,ends_at.gt.${now}`)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .order("severity", { ascending: true })
        .limit(1);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  // Check if there are issues
  const hasIncidents = services?.some(s => s.status === "partial_outage" || s.status === "major_outage");
  const hasDegraded = services?.some(s => s.status === "degraded");
  const hasMaintenance = services?.some(s => s.status === "maintenance");
  const hasActiveAnnouncement = announcements && announcements.length > 0;

  // No issues = no banner
  if (!hasIncidents && !hasDegraded && !hasMaintenance && !hasActiveAnnouncement) {
    return null;
  }

  // Determine banner type
  const getBannerConfig = () => {
    if (hasIncidents) {
      return {
        icon: AlertCircle,
        bgClass: "bg-gradient-to-r from-red-600 to-red-500",
        label: isFr ? "Incident en cours" : "Ongoing Incident",
        message: services?.find(s => s.status === "partial_outage" || s.status === "major_outage")?.status_message 
          || (isFr ? "Certains services sont actuellement affectés. Réparation en cours." : "Some services are currently affected. Repair in progress."),
      };
    }
    if (hasDegraded) {
      return {
        icon: AlertTriangle,
        bgClass: "bg-gradient-to-r from-amber-600 to-amber-500",
        label: isFr ? "Performance dégradée" : "Degraded Performance",
        message: services?.find(s => s.status === "degraded")?.status_message 
          || (isFr ? "Certains services fonctionnent en mode dégradé." : "Some services are operating in degraded mode."),
      };
    }
    if (hasMaintenance) {
      return {
        icon: Wrench,
        bgClass: "bg-gradient-to-r from-blue-600 to-blue-500",
        label: isFr ? "Maintenance en cours" : "Maintenance in Progress",
        message: services?.find(s => s.status === "maintenance")?.status_message 
          || (isFr ? "Maintenance planifiée en cours sur certains services." : "Scheduled maintenance in progress on some services."),
      };
    }
    // Use announcement
    const ann = announcements?.[0];
    const severity = ann?.severity;
    if (severity === "critical") {
      return {
        icon: AlertCircle,
        bgClass: "bg-gradient-to-r from-red-600 to-red-500",
        label: ann?.title || (isFr ? "Annonce importante" : "Important Announcement"),
        message: ann?.message || "",
      };
    }
    if (severity === "warning") {
      return {
        icon: AlertTriangle,
        bgClass: "bg-gradient-to-r from-amber-600 to-amber-500",
        label: ann?.title || (isFr ? "Avertissement" : "Warning"),
        message: ann?.message || "",
      };
    }
    return {
      icon: Wrench,
      bgClass: "bg-gradient-to-r from-blue-600 to-blue-500",
      label: ann?.title || (isFr ? "Information" : "Information"),
      message: ann?.message || "",
    };
  };

  const config = getBannerConfig();
  const Icon = config.icon;

  return (
    <div className={cn("w-full py-3 px-4", config.bgClass)}>
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-full bg-white/20 backdrop-blur-sm">
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="font-semibold text-white text-sm">{config.label}</span>
            <span className="text-white/90 text-xs sm:text-sm line-clamp-1">{config.message}</span>
          </div>
        </div>
        <Link 
          to="/status" 
          className="flex items-center gap-1 text-white hover:text-white/90 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0"
        >
          {isFr ? "Voir le statut" : "View status"}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

export default HomeStatusBanner;
