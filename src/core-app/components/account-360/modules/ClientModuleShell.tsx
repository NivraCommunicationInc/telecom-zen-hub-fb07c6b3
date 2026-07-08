/**
 * ClientModuleShell — Standard chrome for every Client-360 module.
 * 4 tabs: État · Historique · Audit · Actions + Impact preview + Confirmation footer.
 */
import { ReactNode, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useModuleAudit } from "@/core-app/hooks/useModuleAudit";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export interface ImpactRow { label: string; before: string; after: string; delta?: string; }
export interface ImpactedTable { table: string; rows?: number; note?: string; }
export interface PlannedEmail { template: string; recipient?: string; note?: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  clientId: string;
  moduleTag: string;
  badges?: { label: string; variant?: "default" | "secondary" | "destructive" | "outline" }[];
  clientContext?: ReactNode;   // Bandeau contexte client (persistant, en tête)
  state: ReactNode;           // Onglet État actuel
  history?: ReactNode;         // Onglet Historique métier
  actions: ReactNode;          // Onglet Actions (formulaires)
  impact?: ImpactRow[];        // Aperçu chiffré avant confirmation
  impactedTables?: ImpactedTable[]; // Tables/écritures prévues
  plannedEmails?: PlannedEmail[];   // Emails/templates qui seront envoyés
  requireReason?: boolean;
  confirmLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  onConfirm?: (reason: string) => Promise<void> | void;
}

export function ClientModuleShell(p: Props) {
  const [tab, setTab] = useState("state");
  const [reason, setReason] = useState("");
  const audit = useModuleAudit(p.clientId, p.moduleTag);

  const canConfirm =
    !!p.onConfirm &&
    !p.disabled &&
    !p.loading &&
    (!p.requireReason || reason.trim().length >= 3);

  return (
    <Dialog open={p.open} onOpenChange={(o) => !o && p.onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] overflow-hidden flex flex-col bg-card text-card-foreground border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{p.title}</span>
            {p.badges?.map((b, i) => (
              <Badge key={i} variant={b.variant ?? "secondary"}>{b.label}</Badge>
            ))}
          </DialogTitle>
          {p.subtitle && <p className="text-sm text-muted-foreground">{p.subtitle}</p>}
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="state">État</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pr-1 pt-3">
            <TabsContent value="state" className="mt-0 space-y-3">{p.state}</TabsContent>
            <TabsContent value="history" className="mt-0 space-y-3">
              {p.history ?? <p className="text-sm text-muted-foreground">Aucun historique métier pour ce module.</p>}
            </TabsContent>
            <TabsContent value="audit" className="mt-0 space-y-2">
              {audit.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
              {!audit.isLoading && (audit.data?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">Aucune entrée d'audit pour ce module.</p>
              )}
              {audit.data?.map((e) => (
                <div key={e.id} className="border rounded-md p-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{e.action}</span>
                    <span className="text-muted-foreground">
                      {format(new Date(e.occurred_at), "dd MMM yyyy HH:mm", { locale: fr })}
                    </span>
                  </div>
                  <div className="text-muted-foreground">Par: {e.actor_name} · Source: {e.source}</div>
                  {e.reason && <div className="mt-1">Motif: {e.reason}</div>}
                </div>
              ))}
            </TabsContent>
            <TabsContent value="actions" className="mt-0 space-y-4">
              {p.actions}

              {p.impact && p.impact.length > 0 && (
                <div className="border rounded-md p-3 bg-muted/40">
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Aperçu de l'impact
                  </p>
                  <div className="space-y-1">
                    {p.impact.map((r, i) => (
                      <div key={i} className="grid grid-cols-4 gap-2 text-xs">
                        <span className="text-muted-foreground">{r.label}</span>
                        <span className="line-through">{r.before}</span>
                        <span className="font-medium">{r.after}</span>
                        <span className="text-primary">{r.delta ?? ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {p.onConfirm && (
                <div className="space-y-2">
                  {p.requireReason && (
                    <>
                      <Label htmlFor="core-action-reason">Motif (obligatoire, journalisé)</Label>
                      <Textarea
                        id="core-action-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ex. Demande client par téléphone — ref. ticket #123"
                        rows={2}
                      />
                    </>
                  )}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="border-t pt-3">
          <Button variant="ghost" onClick={p.onClose}>Fermer</Button>
          {p.onConfirm && (
            <Button
              disabled={!canConfirm}
              onClick={async () => {
                await p.onConfirm?.(reason);
              }}
            >
              {p.loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {p.confirmLabel ?? "Confirmer"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
