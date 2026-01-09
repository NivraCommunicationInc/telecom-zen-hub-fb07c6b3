import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tv, CheckCircle, Clock, Settings, Wrench, PartyPopper } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface TVOrder {
  id: string;
  order_number: string;
  status: string;
  service_type: string;
  created_at: string;
  updated_at: string;
  channel_selection_locked?: boolean;
}

interface TVOrderStatusTrackerProps {
  orders: TVOrder[];
}

const statusSteps = [
  { key: "pending", label: "Commande placée", icon: Clock },
  { key: "channels_confirmed", label: "Chaînes confirmées", icon: Settings },
  { key: "installation_scheduled", label: "Installation planifiée", icon: Wrench },
  { key: "completed", label: "Terminé", icon: PartyPopper },
];

const getStepIndex = (status: string): number => {
  const statusMap: Record<string, number> = {
    pending: 0,
    processing: 1,
    channels_confirmed: 1,
    confirmed: 1,
    installation_scheduled: 2,
    shipped: 2,
    in_transit: 2,
    delivered: 3,
    completed: 3,
    active: 3,
  };
  return statusMap[status] ?? 0;
};

const TVOrderStatusTracker = ({ orders }: TVOrderStatusTrackerProps) => {
  // Filter TV-related orders
  const tvOrders = orders.filter(
    (order) =>
      order.service_type?.toLowerCase().includes("tv") ||
      order.service_type?.toLowerCase().includes("télé") ||
      order.service_type?.toLowerCase().includes("tele") ||
      order.service_type?.toLowerCase().includes("iptv")
  );

  if (tvOrders.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-card to-cyan-500/5 border-cyan-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Tv className="w-5 h-5 text-cyan-400" />
          Suivi de vos commandes TV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {tvOrders.map((order) => {
          const currentStep = getStepIndex(order.status);
          
          return (
            <div key={order.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono font-medium text-foreground">{order.order_number}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(order.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                </div>
                <Badge 
                  variant={currentStep === 3 ? "default" : "secondary"}
                  className={currentStep === 3 ? "bg-emerald-500 text-white" : ""}
                >
                  {order.status === "pending" && "En attente"}
                  {(order.status === "processing" || order.status === "confirmed") && "En cours"}
                  {order.status === "installation_scheduled" && "Installation planifiée"}
                  {(order.status === "completed" || order.status === "active" || order.status === "delivered") && "Terminé"}
                  {!["pending", "processing", "confirmed", "installation_scheduled", "completed", "active", "delivered"].includes(order.status) && order.status}
                </Badge>
              </div>

              {/* Progress Steps */}
              <div className="relative">
                <div className="flex justify-between items-center">
                  {statusSteps.map((step, index) => {
                    const StepIcon = step.icon;
                    const isCompleted = index <= currentStep;
                    const isCurrent = index === currentStep;

                    return (
                      <div key={step.key} className="flex flex-col items-center z-10 relative">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            isCompleted
                              ? "bg-gradient-to-br from-cyan-500 to-emerald-500 text-white shadow-lg shadow-cyan-500/30"
                              : "bg-muted text-muted-foreground"
                          } ${isCurrent ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-background" : ""}`}
                        >
                          {isCompleted && index < currentStep ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            <StepIcon className="w-5 h-5" />
                          )}
                        </div>
                        <span
                          className={`text-xs mt-2 text-center max-w-[80px] ${
                            isCompleted ? "text-foreground font-medium" : "text-muted-foreground"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Progress Line */}
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted -z-0">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${(currentStep / (statusSteps.length - 1)) * 100}%` }}
                  />
                </div>
              </div>

              {/* Channel Lock Status */}
              {order.channel_selection_locked && currentStep < 3 && (
                <p className="text-xs text-amber-500 text-center">
                  🔒 Les chaînes seront accessibles après l'installation
                </p>
              )}

              {tvOrders.length > 1 && order !== tvOrders[tvOrders.length - 1] && (
                <div className="border-b border-border" />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default TVOrderStatusTracker;
