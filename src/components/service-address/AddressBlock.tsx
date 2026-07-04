/**
 * AddressBlock — bloc d'affichage par adresse, réutilisable multi-portails (Pass 3A).
 * Chaque adresse est indépendante : ses propres services et équipements.
 */
import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import type { ServiceAddress } from "@/hooks/useAccountAddresses";

export interface AddressBlockProps {
  address: ServiceAddress;
  children: ReactNode;
  actions?: ReactNode;
  badges?: ReactNode;
}

export function AddressBlock({ address, children, actions, badges }: AddressBlockProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2 min-w-0">
            <MapPin className="h-4 w-4 mt-1 shrink-0 text-primary" />
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{address.address_line}</CardTitle>
              <p className="text-xs text-muted-foreground truncate">
                {[address.city, address.province, address.postal_code].filter(Boolean).join(", ")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {badges}
            {actions}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function AddressSectionTitle({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between border-b pb-1 mb-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h4>
      <Badge variant="secondary" className="text-xs">{count}</Badge>
    </div>
  );
}
