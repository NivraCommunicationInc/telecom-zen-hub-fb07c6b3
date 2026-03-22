/**
 * Service Countdown - Shows days remaining until service expiration
 * Based on subscription cycle_end_date from V2 billing
 */

import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertTriangle, CheckCircle, Calendar } from "lucide-react";
import { differenceInDays, format, addDays } from "date-fns";
import { fr } from "date-fns/locale";

interface ServiceCountdownProps {
  userId: string;
  compact?: boolean;
}

interface SubscriptionInfo {
  id: string;
  plan_name: string;
  cycle_end_date: string;
  status: string;
}

export function ServiceCountdown({ userId, compact = false }: ServiceCountdownProps) {
  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["active-subscriptions-v2", userId],
    queryFn: async () => {
      // Get customer_id first
      const { data: customer } = await backendClient
        .from('billing_customers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!customer) return [];

      const { data, error } = await backendClient
        .from('billing_subscriptions')
        .select('id, plan_name, cycle_end_date, status')
        .eq('customer_id', customer.id)
        .in('status', ['active', 'pending_renewal', 'grace_period', 'suspended'])
        .order('cycle_end_date', { ascending: true });

      if (error) throw error;
      return (data || []) as SubscriptionInfo[];
    },
    enabled: !!userId,
  });

  if (isLoading || !subscriptions || subscriptions.length === 0) {
    return null;
  }

  // Find the subscription expiring soonest
  const nextExpiring = subscriptions[0];
  const endDate = new Date(nextExpiring.cycle_end_date);
  const today = new Date();
  const daysRemaining = differenceInDays(endDate, today);
  
  // Calculate progress (assuming 30-day cycle)
  const cycleDays = 30;
  const daysUsed = cycleDays - daysRemaining;
  const progress = Math.max(0, Math.min(100, (daysUsed / cycleDays) * 100));
  
  // Determine urgency level
  const isExpired = daysRemaining < 0;
  const isCritical = daysRemaining <= 3 && daysRemaining >= 0;
  const isWarning = daysRemaining <= 7 && daysRemaining > 3;
  const isOk = daysRemaining > 7;

  const getStatusConfig = () => {
    if (isExpired) {
      return {
        icon: AlertTriangle,
        color: "text-red-500",
        bgColor: "bg-red-500/10 border-red-500/30",
        progressColor: "bg-red-500",
        label: "Service expiré",
      };
    }
    if (isCritical) {
      return {
        icon: AlertTriangle,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10 border-amber-500/30",
        progressColor: "bg-amber-500",
        label: "Renouvellement urgent",
      };
    }
    if (isWarning) {
      return {
        icon: Clock,
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10 border-yellow-500/30",
        progressColor: "bg-yellow-500",
        label: "Renouvellement bientôt",
      };
    }
    return {
      icon: CheckCircle,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10 border-emerald-500/30",
      progressColor: "bg-emerald-500",
      label: "Service actif",
    };
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.bgColor}`}>
        <StatusIcon className={`w-4 h-4 ${config.color}`} />
        <span className="text-sm font-medium">
          {isExpired 
            ? "Expiré" 
            : `${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}`}
        </span>
      </div>
    );
  }

  return (
    <Card className={`border ${config.bgColor}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <StatusIcon className={`w-5 h-5 ${config.color}`} />
            <span className={`font-medium ${config.color}`}>{config.label}</span>
          </div>
          <div className="text-right">
            <span className={`text-2xl font-bold ${config.color}`}>
              {isExpired ? 0 : daysRemaining}
            </span>
            <span className="text-sm text-muted-foreground ml-1">
              jour{daysRemaining !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <Progress 
            value={progress} 
            className="h-2 bg-muted/50"
            indicatorClassName={config.progressColor}
          />
        </div>

        {/* Details */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>
              {isExpired ? 'Expiré le' : 'Expire le'} {format(endDate, "d MMMM yyyy", { locale: fr })}
            </span>
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-[150px]">
            {nextExpiring.plan_name}
          </span>
        </div>

        {/* Warning message for critical status */}
        {(isExpired || isCritical) && (
          <div className={`mt-3 p-2 rounded text-xs ${isExpired ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>
            {isExpired 
              ? "Votre service est suspendu. Payez maintenant pour réactiver."
              : "Payez avant l'échéance pour éviter une interruption de service."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ServiceCountdown;
