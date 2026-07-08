/**
 * ClientNotesDrawer — Right-side drawer for internal notes.
 * Wraps ClientNotesPanel with a system-notes hide filter and dedup pill.
 */
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ClientNotesPanel } from "@/core-app/components/notes/ClientNotesPanel";
import { StickyNote } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  clientId?: string;
  onMutationSuccess?: () => void;
}

export function ClientNotesDrawer({ open, onClose, clientId, onMutationSuccess }: Props) {
  const [hideSystem, setHideSystem] = useState(true);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <StickyNote className="h-4 w-4" /> Notes internes
          </SheetTitle>
        </SheetHeader>
        <div className="flex items-center gap-2 py-3 border-b mb-3">
          <Switch id="hide-sys" checked={hideSystem} onCheckedChange={setHideSystem} />
          <Label htmlFor="hide-sys" className="text-xs">Masquer les notes système / automatiques</Label>
        </div>
        <ClientNotesPanel
          clientId={clientId}
          onMutationSuccess={onMutationSuccess}
          hideSystem={hideSystem}
        />
      </SheetContent>
    </Sheet>
  );
}
