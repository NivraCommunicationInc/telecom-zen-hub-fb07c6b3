import React from "react";
import { Activity, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActivityFeedEmptyProps {
  hasFilter?: boolean;
  onClearFilter?: () => void;
}

export const ActivityFeedEmpty: React.FC<ActivityFeedEmptyProps> = ({
  hasFilter = false,
  onClearFilter,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        {hasFilter ? (
          <Filter className="h-8 w-8 text-muted-foreground/50" />
        ) : (
          <Activity className="h-8 w-8 text-muted-foreground/50" />
        )}
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">
        {hasFilter ? "Aucun résultat" : "Aucune activité"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        {hasFilter
          ? "Aucune activité ne correspond aux filtres sélectionnés."
          : "Il n'y a pas encore d'activité à afficher. Les événements apparaîtront ici en temps réel."}
      </p>
      {hasFilter && onClearFilter && (
        <Button variant="outline" size="sm" onClick={onClearFilter}>
          <Filter className="h-4 w-4 mr-2" />
          Réinitialiser les filtres
        </Button>
      )}
    </div>
  );
};

export default ActivityFeedEmpty;
