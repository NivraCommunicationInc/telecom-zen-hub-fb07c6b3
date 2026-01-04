import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldX, Lock, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface AccessDeniedCardProps {
  neededPermission?: string;
  message?: string;
  requestId?: string;
  showBackButton?: boolean;
}

const permissionLabels: Record<string, string> = {
  can_view_orders: "Voir les commandes",
  can_view_clients: "Voir les clients",
  can_view_tickets: "Voir les tickets",
  can_view_appointments: "Voir les rendez-vous",
  manage_orders: "Gérer les commandes",
  manage_clients: "Gérer les clients",
  manage_tickets: "Gérer les tickets",
  manage_appointments: "Gérer les rendez-vous",
};

const AccessDeniedCard = ({ 
  neededPermission, 
  message = "Vous n'avez pas la permission d'accéder à cette section.", 
  requestId,
  showBackButton = true 
}: AccessDeniedCardProps) => {
  const permissionLabel = neededPermission ? permissionLabels[neededPermission] || neededPermission : null;

  return (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <ShieldX className="w-8 h-8 text-red-500" />
        </div>
        
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-red-500">Accès non autorisé</h3>
          <p className="text-muted-foreground max-w-md">{message}</p>
          
          {permissionLabel && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Permission requise: <strong>{permissionLabel}</strong>
              </span>
            </div>
          )}
          
          {requestId && (
            <p className="text-xs text-muted-foreground/60 mt-2">
              ID de requête: {requestId}
            </p>
          )}
        </div>
        
        {showBackButton && (
          <Link to="/employee">
            <Button variant="outline" size="sm" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au tableau de bord
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
};

export default AccessDeniedCard;
