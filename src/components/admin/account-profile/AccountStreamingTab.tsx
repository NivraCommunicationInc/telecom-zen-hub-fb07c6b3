/**
 * AccountStreamingTab — Streaming & TV channel management workspace
 * Operational: suspend/activate/cancel streaming + view/modify/activate TV channels
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Tv, MoreHorizontal, Pause, RotateCcw, XCircle, Eye, CheckCircle2, Loader2, ListChecks } from "lucide-react";
import { adminClient as supabase } from "@/integrations/backend";
import { writeAccountJournal } from "@/lib/writeAccountJournal";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";

interface AccountStreamingTabProps {
  subscriptions: any[];
  clientId?: string;
}

export function AccountStreamingTab({ subscriptions, clientId }: AccountStreamingTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [actionSub, setActionSub] = useState<any>(null);
  const [actionType, setActionType] = useState<"suspend" | "resume" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [channelDetailOpen, setChannelDetailOpen] = useState(false);

  const streamingSubs = subscriptions.filter((s: any) => s.service_category === "streaming");
  const tvSubs = subscriptions.filter((s: any) => s.service_category === "tv");

  // Fetch client_streaming_subscriptions
  const { data: clientStreamingSubs } = useQuery({
    queryKey: ["account-client-streaming", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("client_streaming_subscriptions")
        .select("*, streaming_services(name, logo_url)")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Fetch channel_selections for this client
  const { data: channelSelections } = useQuery({
    queryKey: ["account-channel-selections", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("channel_selections")
        .select("*")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Activate/confirm channel selections
  const activateChannels = useMutation({
    mutationFn: async (selectionId: string) => {
      const { error } = await supabase
        .from("channel_selections")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          confirmed_by: user?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chaînes activées");
      queryClient.invalidateQueries({ queryKey: ["account-channel-selections"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const handleAction = async () => {
    if (!actionSub || !actionType) return;
    setSaving(true);
    try {
      const isClientStreaming = !!actionSub._isClientStreaming;
      const newStatus = actionType === "suspend" ? "suspended" : actionType === "resume" ? "active" : "cancelled";

      if (isClientStreaming) {
        const { error } = await supabase
          .from("client_streaming_subscriptions")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", actionSub.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["account-client-streaming"] });
      } else {
        const { error } = await supabase
          .from("billing_subscriptions")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", actionSub.id);
        if (error) throw error;

        await supabase.from("billing_subscription_trace_audit").insert({
          subscription_id: actionSub.id,
          customer_id: actionSub.customer_id,
          action: `streaming_${actionType}`,
          reason: reason || null,
          actor_admin_id: user?.id || null,
          details: { plan: actionSub.plan_name, new_status: newStatus },
        });
        queryClient.invalidateQueries({ queryKey: ["account-profile-subscriptions"] });
      }

      if (clientId) {
        await writeAccountJournal({
          targetTable: "client_activity_logs",
          eventKey: `streaming:${actionSub.id}:${actionType}:${new Date().toISOString().slice(0, 16)}`,
          visibility: "staff",
          payload: {
            client_id: clientId,
            action_type: `streaming_${actionType}`,
            summary: `Service "${isClientStreaming ? actionSub.streaming_services?.name : actionSub.plan_name}" ${actionType === "suspend" ? "suspendu" : actionType === "resume" ? "réactivé" : "annulé"}`,
          },
        });
      }

      toast.success(
        actionType === "suspend" ? "Service suspendu" : actionType === "resume" ? "Service réactivé" : "Service annulé"
      );
      setActionSub(null);
      setActionType(null);
      setReason("");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const renderSubRow = (sub: any, icon: any, isClientStreaming = false) => {
    const Icon = icon;
    const status = sub.status || "active";
    return (
      <div key={sub.id} className="flex items-center justify-between p-3 rounded-md border">
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">
              {isClientStreaming ? sub.streaming_services?.name || "Streaming" : sub.plan_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {isClientStreaming ? `${sub.monthly_price?.toFixed(2) || "0.00"} $/mois` : sub.plan_code}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isClientStreaming && <span className="text-sm font-medium">{sub.plan_price?.toFixed(2)} $/mois</span>}
          <Badge variant={status === "active" ? "default" : status === "cancelled" ? "destructive" : "secondary"} className="text-[10px]">
            {status === "active" ? "Actif" : status === "suspended" ? "Suspendu" : status === "cancelled" ? "Annulé" : status}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {status === "active" && (
                <DropdownMenuItem onClick={() => { setActionSub({ ...sub, _isClientStreaming: isClientStreaming }); setActionType("suspend"); }}>
                  <Pause className="h-3.5 w-3.5 mr-2" /> Suspendre
                </DropdownMenuItem>
              )}
              {status === "suspended" && (
                <DropdownMenuItem onClick={() => { setActionSub({ ...sub, _isClientStreaming: isClientStreaming }); setActionType("resume"); }}>
                  <RotateCcw className="h-3.5 w-3.5 mr-2" /> Réactiver
                </DropdownMenuItem>
              )}
              {status !== "cancelled" && (
                <DropdownMenuItem onClick={() => { setActionSub({ ...sub, _isClientStreaming: isClientStreaming }); setActionType("cancel"); }} className="text-destructive">
                  <XCircle className="h-3.5 w-3.5 mr-2" /> Annuler
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  const channelStatusLabel: Record<string, string> = {
    pending: "En attente", confirmed: "Confirmé", cancelled: "Annulé",
  };

  return (
    <div className="space-y-6">
      {/* Streaming */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Play className="h-3.5 w-3.5" />
          Streaming ({streamingSubs.length + (clientStreamingSubs?.length || 0)})
        </h4>
        {streamingSubs.length === 0 && !clientStreamingSubs?.length ? (
          <p className="text-sm text-muted-foreground">Aucun abonnement streaming</p>
        ) : (
          <>
            {streamingSubs.map((sub: any) => renderSubRow(sub, Play))}
            {clientStreamingSubs?.map((sub: any) => renderSubRow(sub, Play, true))}
          </>
        )}
      </div>

      {/* TV */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Tv className="h-3.5 w-3.5" />
          Chaînes TV ({tvSubs.length})
        </h4>
        {tvSubs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun forfait TV</p>
        ) : (
          tvSubs.map((sub: any) => renderSubRow(sub, Tv))
        )}
      </div>

      {/* Channel Selections */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5" />
          Sélections de chaînes ({channelSelections?.length || 0})
        </h4>
        {(!channelSelections || channelSelections.length === 0) ? (
          <p className="text-sm text-muted-foreground">Aucune sélection de chaînes</p>
        ) : (
          <div className="space-y-2">
            {channelSelections.map((sel: any) => {
              const channels = Array.isArray(sel.channels) ? sel.channels : [];
              const statusLabel = channelStatusLabel[sel.status] || sel.status;
              return (
                <div key={sel.id} className="p-3 rounded-md border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={sel.status === "confirmed" ? "default" : sel.status === "cancelled" ? "destructive" : "outline"} className="text-[10px]">
                        {statusLabel}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {channels.length} chaîne{channels.length !== 1 ? "s" : ""}
                        {sel.total_price != null && ` • ${sel.total_price.toFixed(2)} $`}
                      </span>
                      {sel.confirmed_at && (
                        <span className="text-xs text-muted-foreground">
                          — Confirmé le {new Date(sel.confirmed_at).toLocaleDateString("fr-CA")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {sel.status === "pending" && (
                        <Button
                          variant="default" size="sm" className="text-xs gap-1 h-7"
                          onClick={() => activateChannels.mutate(sel.id)}
                          disabled={activateChannels.isPending}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Activer
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setChannelDetailOpen(true)}>
                        <Eye className="h-3 w-3 mr-1" /> Voir
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {channels.slice(0, 10).map((ch: any, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-[9px]">
                        {ch.name || ch.channel_name || `Ch ${idx + 1}`}
                      </Badge>
                    ))}
                    {channels.length > 10 && (
                      <Badge variant="outline" className="text-[9px]">+{channels.length - 10} autres</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Channel Detail Dialog */}
      <Dialog open={channelDetailOpen} onOpenChange={setChannelDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détail des chaînes sélectionnées</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-1">
              {channelSelections?.flatMap((sel: any) => {
                const channels = Array.isArray(sel.channels) ? sel.channels : [];
                return channels.map((ch: any, idx: number) => (
                  <div key={`${sel.id}-${idx}`} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-accent/30 text-sm">
                    <span>{ch.name || ch.channel_name || `Chaîne ${idx + 1}`}</span>
                    {ch.category && <Badge variant="outline" className="text-[9px]">{ch.category}</Badge>}
                  </div>
                ));
              })}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChannelDetailOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation */}
      <AlertDialog open={!!actionType} onOpenChange={() => { setActionType(null); setActionSub(null); setReason(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "suspend" ? "Suspendre" : actionType === "resume" ? "Réactiver" : "Annuler"} le service
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionSub?._isClientStreaming ? actionSub?.streaming_services?.name : actionSub?.plan_name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Raison</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Raison (optionnel)..." />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction} disabled={saving}>
              {saving ? "En cours..." : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
