/**
 * CartResumeBanner — universal "Reprendre votre panier" banner.
 * Shown when a persisted draft exists and the current cart is empty.
 */
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShoppingCart, X } from "lucide-react";

interface CartResumeBannerProps {
  onResume: () => void;
  onDismiss: () => void;
  itemCount?: number;
  savedAt?: number;
  className?: string;
}

export function CartResumeBanner({
  onResume,
  onDismiss,
  itemCount,
  savedAt,
  className,
}: CartResumeBannerProps) {
  const timeLabel = savedAt
    ? new Date(savedAt).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })
    : null;

  return (
    <Alert className={className}>
      <ShoppingCart className="h-4 w-4" />
      <AlertTitle>Reprendre votre panier ?</AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
        <span className="text-sm">
          Nous avons trouvé un panier sauvegardé
          {typeof itemCount === "number" && itemCount > 0 ? ` (${itemCount} article${itemCount > 1 ? "s" : ""})` : ""}
          {timeLabel ? ` du ${timeLabel}` : ""}.
        </span>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" onClick={onResume}>Reprendre</Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            <X className="h-4 w-4 mr-1" />
            Ignorer
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
