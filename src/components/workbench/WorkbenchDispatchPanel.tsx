/**
 * WorkbenchDispatchPanel — Operational routing: assign order to shipping or technician
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Truck, Wrench, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { canPerformAction } from "@/lib/workbenchRoles";
import { adminClient as supabase } from "@/integrations/backend";
import { useQuery } from "@tanstack/react-query";

interface Props {
  order: any;
  role: string | null;
  onAssignToShipping: (notes?: string) => Promise<void>;
  onAssignToTechnician: (technicianId?: string, notes?: string) => Promise<void>;
}

export function WorkbenchDispatchPanel({ order, role, onAssignToShipping, onAssignToTechnician }: Props) {
  const [showShipDialog, setShowShipDialog] = useState(false);
  const [showTechDialog, setShowTechDialog] = useState(false);
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [selectedTech, setSelectedTech] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const fulfillmentType = order?.fulfillment_type;
  const isAssigned = !!fulfillmentType;

  // Load available technicians
  const { data: technicians = [] } = useQuery({
    queryKey: ["technicians-list"],
    queryFn: async () => {
      const { data } = await supabase.from("technicians").select("id, full_name, specialization, is_active").eq("is_active", true).order("full_name");
      return data || [];
    },
    enabled: showTechDialog,
  });

  const handleShip = async () => {
    setIsProcessing(true);
    try {
      await onAssignToShipping(dispatchNotes || undefined);
      setShowShipDialog(false);
      setDispatchNotes("");
    } finally { setIsProcessing(false); }
  };

  const handleTech = async () => {
    setIsProcessing(true);
    try {
      await onAssignToTechnician(selectedTech || undefined, dispatchNotes || undefined);
      setShowTechDialog(false);
      setDispatchNotes("");
      setSelectedTech("");
    } finally { setIsProcessing(false); }
  };

  return (
    <>
      <div className="border border-border rounded-lg bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-primary" /> Acheminement / Dispatch
        </h3>

        {isAssigned ? (
          <div className="flex items-center gap-3 p-3 rounded bg-muted/50 border border-border">
            {fulfillmentType === "shipping" ? (
              <Truck className="h-5 w-5 text-primary" />
            ) : (
              <Wrench className="h-5 w-5 text-primary" />
            )}
            <div className="flex-1">
              <p className="text-sm text-foreground font-medium">
                {fulfillmentType === "shipping" ? "Expédition / Livraison" : "Installation par technicien"}
              </p>
              <p className="text-xs text-muted-foreground">
                Assigné le {order?.fulfillment_assigned_at ? new Date(order.fulfillment_assigned_at).toLocaleDateString("fr-CA") : "—"}
              </p>
              {order?.fulfillment_notes && (
                <p className="text-xs text-muted-foreground mt-1">Notes: {order.fulfillment_notes}</p>
              )}
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400">
              <CheckCircle className="h-3 w-3 mr-1" /> Assigné
            </Badge>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {canPerformAction(role, "manage_shipment") && (
              <button
                onClick={() => setShowShipDialog(true)}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <Truck className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Expédier / Livrer</span>
                <span className="text-xs text-muted-foreground text-center">Auto-installation par le client</span>
              </button>
            )}
            {canPerformAction(role, "manage_shipment") && (
              <button
                onClick={() => setShowTechDialog(true)}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <Wrench className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Technicien / Installation</span>
                <span className="text-xs text-muted-foreground text-center">Installation professionnelle sur site</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Ship Dialog */}
      <Dialog open={showShipDialog} onOpenChange={setShowShipDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assigner à l'expédition</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">L'équipement sera expédié au client pour auto-installation.</p>
          <Textarea
            placeholder="Notes de dispatch (optionnel)…"
            value={dispatchNotes}
            onChange={e => setDispatchNotes(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShipDialog(false)}>Annuler</Button>
            <Button onClick={handleShip} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              <Truck className="h-4 w-4 mr-1" /> Confirmer l'expédition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tech Dialog */}
      <Dialog open={showTechDialog} onOpenChange={setShowTechDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assigner à un technicien</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Technicien (optionnel)</label>
              <Select value={selectedTech} onValueChange={setSelectedTech}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un technicien…" /></SelectTrigger>
                <SelectContent>
                  {technicians.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name} {t.specialization ? `(${t.specialization})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              placeholder="Notes d'installation (optionnel)…"
              value={dispatchNotes}
              onChange={e => setDispatchNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTechDialog(false)}>Annuler</Button>
            <Button onClick={handleTech} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              <Wrench className="h-4 w-4 mr-1" /> Assigner l'installation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
