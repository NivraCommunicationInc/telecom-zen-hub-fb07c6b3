import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { History, ChevronDown, ChevronUp, User, Shield, Briefcase } from "lucide-react";

interface ClientProfileChangeHistoryProps {
  clientId: string;
}

const FIELD_LABELS: Record<string, string> = {
  first_name: "Prénom",
  last_name: "Nom",
  full_name: "Nom complet",
  phone: "Téléphone",
  date_of_birth: "Date de naissance",
  service_address: "Adresse de service",
  service_city: "Ville",
  service_province: "Province",
  service_postal_code: "Code postal",
  avatar_url: "Photo de profil",
  billing_address: "Adresse de facturation",
  billing_city: "Ville (facturation)",
  billing_postal_code: "Code postal (facturation)",
  client_pin_hash: "NIP client",
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  client: <User className="w-3 h-3" />,
  admin: <Shield className="w-3 h-3" />,
  staff: <Briefcase className="w-3 h-3" />,
};

const ROLE_LABELS: Record<string, string> = {
  client: "Vous",
  admin: "Admin",
  staff: "Employé",
};

export const ClientProfileChangeHistory = ({
  clientId,
}: ClientProfileChangeHistoryProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: changes, isLoading } = useQuery({
    queryKey: ["client-profile-changes", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_profile_changes")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId && isExpanded,
  });

  const formatFieldName = (field: string) => {
    return FIELD_LABELS[field] || field;
  };

  const formatValue = (field: string, value: string | null) => {
    if (!value) return "—";
    
    // Mask sensitive values
    if (field === "client_pin_hash") {
      return "••••";
    }
    
    // Format avatar URL
    if (field === "avatar_url") {
      return value ? "Photo ajoutée" : "Photo supprimée";
    }
    
    // Truncate long values
    if (value.length > 50) {
      return value.substring(0, 50) + "...";
    }
    
    return value;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-4 h-4 text-cyan-400" />
            Historique des modifications
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                Masquer <ChevronUp className="w-4 h-4 ml-1" />
              </>
            ) : (
              <>
                Afficher <ChevronDown className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !changes || changes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune modification enregistrée
            </p>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {changes.map((change) => (
                  <div
                    key={change.id}
                    className="p-3 rounded-lg bg-accent/30 border border-border/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1"
                      >
                        {ROLE_ICONS[change.changed_by_role] || <User className="w-3 h-3" />}
                        {ROLE_LABELS[change.changed_by_role] || change.changed_by_role}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(change.created_at), "d MMM yyyy 'à' HH:mm", {
                          locale: fr,
                        })}
                      </span>
                    </div>
                    <p className="text-sm font-medium">
                      {formatFieldName(change.field_name)}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <span className="text-muted-foreground line-through">
                        {formatValue(change.field_name, change.old_value)}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-foreground">
                        {formatValue(change.field_name, change.new_value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default ClientProfileChangeHistory;
