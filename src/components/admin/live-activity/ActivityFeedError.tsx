import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActivityFeedErrorProps {
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const ActivityFeedError: React.FC<ActivityFeedErrorProps> = ({
  onRetry,
  isRetrying = false,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">
        Erreur de chargement
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        Impossible de charger les activités. Veuillez vérifier votre connexion et réessayer.
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={isRetrying}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isRetrying ? "animate-spin" : ""}`}
          />
          {isRetrying ? "Chargement..." : "Réessayer"}
        </Button>
      )}
    </div>
  );
};

export default ActivityFeedError;
