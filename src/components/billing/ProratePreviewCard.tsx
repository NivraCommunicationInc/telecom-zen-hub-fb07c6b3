import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProratePreview } from "@/hooks/useProratePreview";

interface Props {
  accountId?: string | null;
  serviceAddressId?: string | null;
  monthlyPriceCents?: number | null;
  serviceLabel?: string;
  activationDate?: string;
}

function formatCad(cents: number) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
}

/**
 * Shared read-only card showing the immediate prorata amount for a service
 * being added to a specific service_address. All math comes from the DB.
 */
export function ProratePreviewCard({
  accountId,
  serviceAddressId,
  monthlyPriceCents,
  serviceLabel = "Service",
  activationDate,
}: Props) {
  const { data, isLoading, error } = useProratePreview({
    accountId,
    serviceAddressId,
    monthlyPriceCents,
    activationDate,
  });

  if (!accountId || !serviceAddressId || monthlyPriceCents == null) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajustement au prorata</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-5 w-40" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) return null;

  if (data.is_zero) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajustement au prorata</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Activation le jour d'anniversaire de facturation — aucun prorata.
          Premier cycle plein dès aujourd'hui.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ajustement au prorata</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {serviceLabel} · {data.days_remaining}/{data.days_in_cycle} jours
          </span>
          <span className="font-semibold">{formatCad(data.prorata_cents)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Période facturée : {formatDate(data.activation_date)} →{" "}
          {formatDate(data.next_anchor)} (exclu). Prochain cycle plein tarif
          le {formatDate(data.next_anchor)}.
        </p>
      </CardContent>
    </Card>
  );
}
