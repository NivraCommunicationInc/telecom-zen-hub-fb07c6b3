import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatPhoneDisplay } from "@/lib/phoneUtils";
import { toast } from "sonner";
import { Copy, Headphones, Info, Maximize2, RefreshCw, User } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCallNumber?: string;
  activeCallClientName?: string;
  onOpenOpenPhone: () => void;
  onRefreshHistory: () => void;
  onCopyNumber?: () => void;
};

export function OpenPhoneCallPanel({
  open,
  onOpenChange,
  activeCallNumber,
  activeCallClientName,
  onOpenOpenPhone,
  onRefreshHistory,
  onCopyNumber,
}: Props) {
  const formattedNumber = activeCallNumber ? formatPhoneDisplay(activeCallNumber) : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[560px] sm:max-w-[560px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b bg-background flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Headphones className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-left">Gestion d'appel</SheetTitle>
                <SheetDescription className="text-left">
                  {activeCallClientName ? (
                    <span className="flex items-center gap-2 min-w-0">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{activeCallClientName}</span>
                      {formattedNumber ? <span className="flex-shrink-0">• {formattedNumber}</span> : null}
                    </span>
                  ) : (
                    formattedNumber || ""
                  )}
                </SheetDescription>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={() => window.open("https://app.openphone.com", "_blank")}
            >
              <Maximize2 className="w-4 h-4 mr-2" />
              Plein écran
            </Button>
          </div>
        </SheetHeader>

        {/* IMPORTANT: OpenPhone blocks iframe embedding (CSP / X-Frame-Options), so we guide to a popup */}
        <div className="flex-1 bg-muted p-4">
          <div className="h-full rounded-lg border bg-background p-4 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Info className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Contrôle des appels</p>
                <p className="text-sm text-muted-foreground">
                  OpenPhone n'autorise pas l'intégration directe dans cette page (iframe). Pour gérer l'appel (hold, mute, transfer, hang up), ouvrez OpenPhone dans une fenêtre.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="default"
                onClick={onOpenOpenPhone}
                className="w-full"
              >
                <Headphones className="w-4 h-4 mr-2" />
                Ouvrir OpenPhone
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  if (!activeCallNumber) {
                    toast.message("Aucun numéro", { description: "Sélectionnez d'abord un appel / numéro." });
                    return;
                  }
                  onCopyNumber?.();
                }}
                className="w-full"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copier le numéro
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              Astuce: collez le numéro dans le composeur OpenPhone pour lancer l'appel.
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-background flex-shrink-0">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onRefreshHistory}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser l'historique
            </Button>
            <Button variant="default" className="flex-1" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
