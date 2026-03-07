/**
 * AccountServicesTab — Services grouped by address (telecom-grade)
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, Tv, Smartphone, Play, Package, MapPin, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AccountServicesTabProps {
  subscriptions: any[];
  serviceAddresses: any[];
  account: any;
  locations: any[];
}

const categoryIcons: Record<string, any> = {
  internet: Wifi,
  tv: Tv,
  mobile: Smartphone,
  streaming: Play,
};

const categoryLabels: Record<string, string> = {
  internet: "Internet",
  tv: "Télévision",
  mobile: "Mobile",
  streaming: "Streaming",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Actif", variant: "default" },
  pending: { label: "En attente", variant: "outline" },
  suspended: { label: "Suspendu", variant: "secondary" },
  cancelled: { label: "Annulé", variant: "destructive" },
  expired: { label: "Expiré", variant: "destructive" },
};

export function AccountServicesTab({ subscriptions, serviceAddresses, account, locations }: AccountServicesTabProps) {
  // Group subscriptions by address
  const byAddress: Record<string, { address: any; subs: any[] }> = {};
  
  // Primary address group
  const primaryKey = "primary";
  byAddress[primaryKey] = {
    address: {
      label: "Principal",
      service_address: account?.primary_service_address,
      service_city: account?.primary_service_city,
      service_postal_code: account?.primary_service_postal_code,
    },
    subs: [],
  };

  // Additional location groups
  locations.forEach((loc: any) => {
    byAddress[loc.id] = { address: loc, subs: [] };
  });

  // Assign subscriptions to addresses
  subscriptions.forEach((sub: any) => {
    if (sub.address_id) {
      const matchedLoc = locations.find((l: any) => l.id === sub.address_id);
      const matchedSA = serviceAddresses.find((sa: any) => sa.id === sub.address_id);
      if (matchedLoc && byAddress[matchedLoc.id]) {
        byAddress[matchedLoc.id].subs.push(sub);
      } else if (matchedSA) {
        // Create group if not exists
        if (!byAddress[sub.address_id]) {
          byAddress[sub.address_id] = {
            address: {
              label: matchedSA.label || "Adresse de service",
              service_address: matchedSA.address || matchedSA.full_address,
              service_city: matchedSA.city,
              service_postal_code: matchedSA.postal_code,
            },
            subs: [],
          };
        }
        byAddress[sub.address_id].subs.push(sub);
      } else {
        byAddress[primaryKey].subs.push(sub);
      }
    } else {
      byAddress[primaryKey].subs.push(sub);
    }
  });

  // Filter out empty non-primary groups
  const addressGroups = Object.entries(byAddress).filter(
    ([key, val]) => key === primaryKey || val.subs.length > 0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Services par adresse ({subscriptions.length} total)
        </h3>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <PlusCircle className="h-3.5 w-3.5" />
          Ajouter un service
        </Button>
      </div>

      {addressGroups.map(([key, { address, subs }]) => (
        <Card key={key}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <Badge variant={key === primaryKey ? "default" : "outline"} className="text-[10px]">
                {address.label || "Service"}
              </Badge>
              <span className="text-muted-foreground font-normal text-xs">
                {address.service_address}
                {address.service_city && `, ${address.service_city}`}
                {address.service_postal_code && ` ${address.service_postal_code}`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun service à cette adresse</p>
            ) : (
              <div className="space-y-2">
                {subs.map((sub: any) => {
                  const Icon = categoryIcons[sub.service_category] || Package;
                  const st = statusConfig[sub.status] || statusConfig.active;
                  return (
                    <div key={sub.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{sub.plan_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{categoryLabels[sub.service_category] || sub.service_category}</span>
                            <span>•</span>
                            <span>{sub.plan_code}</span>
                            {sub.cycle_start_date && (
                              <>
                                <span>•</span>
                                <span>Depuis {format(new Date(sub.cycle_start_date), "d MMM yyyy", { locale: fr })}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-medium">{sub.plan_price?.toFixed(2)} $/mois</p>
                          <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
