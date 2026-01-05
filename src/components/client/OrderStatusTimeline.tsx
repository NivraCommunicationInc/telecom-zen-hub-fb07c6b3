import { CheckCircle, Clock, Truck, Package, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderStatusTimelineProps {
  currentStatus: string;
  isDeliveryOrder?: boolean;
}

const ORDER_STATUSES = [
  { key: "pending", label: "Reçu", icon: Clock },
  { key: "verification", label: "En traitement", icon: Settings },
  { key: "shipped", label: "Expédié/Planifié", icon: Truck },
  { key: "completed", label: "Livré/Installé", icon: Package },
];

const getStatusIndex = (status: string): number => {
  const statusMap: Record<string, number> = {
    pending: 0,
    payment_pending: 0,
    verification: 1,
    hold: 1,
    paid: 1,
    ready_to_ship: 2,
    shipped: 2,
    completed: 3,
    cancel: -1,
    cancelled: -1,
  };
  return statusMap[status] ?? 0;
};

const OrderStatusTimeline = ({ currentStatus, isDeliveryOrder = true }: OrderStatusTimelineProps) => {
  const currentIndex = getStatusIndex(currentStatus);
  const isCancelled = currentStatus === "cancel" || currentStatus === "cancelled";

  if (isCancelled) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
        <p className="text-red-500 font-medium">Commande annulée</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-border" />
        <div 
          className="absolute top-4 left-0 h-0.5 bg-accent transition-all duration-500"
          style={{ width: `${(currentIndex / (ORDER_STATUSES.length - 1)) * 100}%` }}
        />
        
        {ORDER_STATUSES.map((status, index) => {
          const Icon = status.icon;
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          
          return (
            <div key={status.key} className="flex flex-col items-center relative z-10">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                  isCompleted 
                    ? "bg-accent text-accent-foreground" 
                    : "bg-muted border border-border text-muted-foreground",
                  isCurrent && "ring-2 ring-accent ring-offset-2 ring-offset-background"
                )}
              >
                {isCompleted && index < currentIndex ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span 
                className={cn(
                  "text-xs mt-2 text-center max-w-[80px]",
                  isCompleted ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {status.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrderStatusTimeline;
