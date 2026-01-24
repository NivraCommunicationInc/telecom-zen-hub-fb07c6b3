import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ShoppingCart,
  UserPlus,
  LogIn,
  CreditCard,
  Users,
  Zap,
  Eye,
  Ticket,
  Settings,
  CheckCircle,
  XCircle,
  Edit,
  Truck,
  Phone,
  Shield,
  FileText,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { LiveActivity } from "@/hooks/useLiveActivityFeedV2";

// Activity type configuration based on action field from activity_logs
export const ACTIVITY_CONFIG: Record<
  string,
  {
    icon: React.ElementType;
    label: string;
    color: string;
    bgColor: string;
    category: "orders" | "payments" | "clients" | "tickets" | "system";
  }
> = {
  // Order actions
  order_started: {
    icon: ShoppingCart,
    label: "Commande débutée",
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    category: "orders",
  },
  order_completed: {
    icon: ShoppingCart,
    label: "Commande complétée",
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    category: "orders",
  },
  order_cancelled: {
    icon: XCircle,
    label: "Commande annulée",
    color: "text-red-600",
    bgColor: "bg-red-500/10",
    category: "orders",
  },
  order_status_changed: {
    icon: ShoppingCart,
    label: "Statut commande",
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    category: "orders",
  },
  status_changed: {
    icon: Edit,
    label: "Statut modifié",
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    category: "orders",
  },
  technician_assigned: {
    icon: Truck,
    label: "Technicien assigné",
    color: "text-indigo-600",
    bgColor: "bg-indigo-500/10",
    category: "orders",
  },
  equipment_assigned: {
    icon: Phone,
    label: "Équipement assigné",
    color: "text-teal-600",
    bgColor: "bg-teal-500/10",
    category: "orders",
  },
  
  // Client actions
  signup: {
    icon: UserPlus,
    label: "Inscription",
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    category: "clients",
  },
  login: {
    icon: LogIn,
    label: "Connexion",
    color: "text-purple-600",
    bgColor: "bg-purple-500/10",
    category: "clients",
  },
  profile_update: {
    icon: Users,
    label: "Mise à jour profil",
    color: "text-indigo-600",
    bgColor: "bg-indigo-500/10",
    category: "clients",
  },
  id_verification: {
    icon: Shield,
    label: "Vérification ID",
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    category: "clients",
  },
  update: {
    icon: Edit,
    label: "Mise à jour",
    color: "text-slate-600",
    bgColor: "bg-slate-500/10",
    category: "system",
  },
  
  // Payment actions
  payment: {
    icon: CreditCard,
    label: "Paiement",
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
    category: "payments",
  },
  payment_recorded: {
    icon: CreditCard,
    label: "Paiement enregistré",
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
    category: "payments",
  },
  payment_confirmed: {
    icon: CheckCircle,
    label: "Paiement confirmé",
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    category: "payments",
  },
  subscription: {
    icon: Zap,
    label: "Abonnement",
    color: "text-pink-600",
    bgColor: "bg-pink-500/10",
    category: "payments",
  },
  
  // Ticket actions
  ticket_created: {
    icon: Ticket,
    label: "Ticket créé",
    color: "text-orange-600",
    bgColor: "bg-orange-500/10",
    category: "tickets",
  },
  ticket_updated: {
    icon: Ticket,
    label: "Ticket mis à jour",
    color: "text-orange-600",
    bgColor: "bg-orange-500/10",
    category: "tickets",
  },
  
  // System actions
  page_view: {
    icon: Eye,
    label: "Visite",
    color: "text-slate-600",
    bgColor: "bg-slate-500/10",
    category: "system",
  },
  system: {
    icon: Settings,
    label: "Système",
    color: "text-gray-600",
    bgColor: "bg-gray-500/10",
    category: "system",
  },
};

const DEFAULT_CONFIG = {
  icon: Activity,
  label: "Activité",
  color: "text-muted-foreground",
  bgColor: "bg-muted",
  category: "system" as const,
};

// Helper to format action label from snake_case
const formatActionLabel = (action: string): string => {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

interface ActivityFeedItemProps {
  activity: LiveActivity;
  isNew?: boolean;
}

export const ActivityFeedItem: React.FC<ActivityFeedItemProps> = ({
  activity,
  isNew = false,
}) => {
  const config = ACTIVITY_CONFIG[activity.action] || DEFAULT_CONFIG;
  const Icon = config.icon;

  const timeAgo = formatDistanceToNow(new Date(activity.created_at), {
    addSuffix: true,
    locale: fr,
  });

  const exactTime = format(new Date(activity.created_at), "HH:mm:ss", {
    locale: fr,
  });

  // Build subtitle from details or actor info
  const getSubtitle = (): string | null => {
    // Try to get message from details
    if (activity.details && typeof activity.details === "object") {
      const details = activity.details as Record<string, unknown>;
      if (details.message && typeof details.message === "string") {
        return details.message;
      }
      // Fallback: show order_number, ticket_number, etc.
      if (details.order_number) return `Commande ${details.order_number}`;
      if (details.ticket_number) return `Ticket ${details.ticket_number}`;
      if (details.reference) return `Réf: ${details.reference}`;
    }
    // Show entity info
    if (activity.entity_type && activity.entity_id) {
      return `${activity.entity_type} • ${activity.entity_id.substring(0, 8)}...`;
    }
    return null;
  };

  const subtitle = getSubtitle();
  const displayLabel = config === DEFAULT_CONFIG ? formatActionLabel(activity.action) : config.label;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-all duration-300",
        isNew
          ? "bg-green-500/5 border-green-500/30 shadow-sm"
          : "bg-card border-border/50 hover:bg-accent/30"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
          config.bgColor
        )}
      >
        <Icon className={cn("h-4.5 w-4.5", config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Title row */}
        <div className="flex items-center gap-2">
          <span className={cn("font-medium text-sm", config.color)}>
            {displayLabel}
          </span>
          {isNew && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-sm text-foreground truncate">
            {subtitle}
          </p>
        )}

        {/* Actor & Time row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {activity.actor_name && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {activity.actor_name}
              {activity.actor_role && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">
                  {activity.actor_role}
                </Badge>
              )}
            </span>
          )}
          <span title={exactTime} className="cursor-default">
            {timeAgo}
          </span>
        </div>
      </div>

      {/* Right side badge */}
      <div className="flex-shrink-0">
        <Badge
          variant="outline"
          className={cn("text-[10px] font-normal", config.color)}
        >
          {exactTime}
        </Badge>
      </div>
    </div>
  );
};

export default ActivityFeedItem;
