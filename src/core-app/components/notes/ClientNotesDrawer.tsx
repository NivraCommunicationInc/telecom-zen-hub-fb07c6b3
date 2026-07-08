/**
 * ClientNotesDrawer — Right-side drawer for internal notes.
 * The wrapped ClientNotesPanel already exposes System/Admin/Call/Ticket filter tabs.
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ClientNotesPanel } from "@/core-app/components/notes/ClientNotesPanel";
import { StickyNote } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  clientId?: string;
  onMutationSuccess?: () => void;
}

export function ClientNotesDrawer({ open, onClose, clientId, onMutationSuccess }: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-3">
          <SheetTitle className="flex items-center gap-2">
            <StickyNote className="h-4 w-4" /> Notes internes
          </SheetTitle>
        </SheetHeader>
        <p className="text-xs text-muted-foreground mb-2">
          Utilise les onglets Admin / Appel / Ticket pour masquer les notes système répétitives.
        </p>
        <ClientNotesPanel clientId={clientId} onMutationSuccess={onMutationSuccess} />
      </SheetContent>
    </Sheet>
  );
}
