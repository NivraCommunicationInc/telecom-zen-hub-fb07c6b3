/**
 * CoreLoyaltyPage — Nivra Core admin console for the loyalty program.
 *
 * Actions (all via SECURITY DEFINER RPCs, audited server-side):
 *   - admin_loyalty_adjust          → add/remove points (delta ±)
 *   - admin_loyalty_approve_pending → approve/reject pending point transactions
 *   - admin_loyalty_transfer        → transfer points between accounts
 *   - admin_loyalty_convert_to_credit → convert points to account credit
 *   - admin_loyalty_extend_expiration → change transaction expiry
 *
 * Realtime: `loyalty_points` and `loyalty_transactions` are on the
 * supabase_realtime publication so client portal reflects changes live.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Award, Loader2, Plus, Minus, ArrowRightLeft, Coins, Clock,
  CheckCircle, XCircle, Search, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

type ActionKind =
  | "adjust" | "transfer" | "convert" | "extend" | "decide" | null;

export default function CoreLoyaltyPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<ActionKind>(null);
  const [ctx, setCtx] = useState<any>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Live data ---------------------------------------------------------
  const { data: points = [], isLoading: pLoading } = useQuery({
    queryKey: ["core-loyalty-points"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_points" as any)
        .select("*")
        .order("available_points", { ascending: false })
        .limit(500);
      return (data as any[]) || [];
    },
  });

  const { data: txs = [], isLoading: tLoading } = useQuery({
    queryKey: ["core-loyalty-transactions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_transactions" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      return (data as any[]) || [];
    },
  });

  // Realtime -> auto refetch -----------------------------------------
  useEffect(() => {
    const ch = supabase
      .channel("core-loyalty-admin")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "loyalty_points" },
        () => qc.invalidateQueries({ queryKey: ["core-loyalty-points"] }))
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "loyalty_transactions" },
        () => qc.invalidateQueries({ queryKey: ["core-loyalty-transactions"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const filteredPoints = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return points;
    return points.filter((p: any) =>
      String(p.account_id).toLowerCase().includes(q) ||
      String(p.card_number ?? "").toLowerCase().includes(q));
  }, [points, search]);

  const pendingTxs = useMemo(
    () => txs.filter((t: any) => (t.status ?? "confirmed") === "pending"),
    [txs],
  );

  const openAction = (kind: Exclude<ActionKind, null>, initialCtx: any = {}) => {
    setAction(kind); setCtx(initialCtx); setReason("");
  };
  const closeAction = () => { setAction(null); setCtx({}); setReason(""); };

  const run = async () => {
    if (!reason.trim()) {
      toast.error("Raison obligatoire");
      return;
    }
    setBusy(true);
    try {
      let res: any;
      if (action === "adjust") {
        res = await supabase.rpc("admin_loyalty_adjust", {
          p_account_id: ctx.account_id,
          p_delta_points: Number(ctx.delta),
          p_reason: reason,
          p_expires_at: ctx.expires_at || null,
        });
      } else if (action === "transfer") {
        res = await supabase.rpc("admin_loyalty_transfer", {
          p_from_account: ctx.from,
          p_to_account: ctx.to,
          p_points: Number(ctx.points),
          p_reason: reason,
        });
      } else if (action === "convert") {
        res = await supabase.rpc("admin_loyalty_convert_to_credit", {
          p_account_id: ctx.account_id,
          p_points: Number(ctx.points),
          p_credit_amount: Number(ctx.amount),
          p_reason: reason,
        });
      } else if (action === "extend") {
        res = await supabase.rpc("admin_loyalty_extend_expiration", {
          p_transaction_id: ctx.transaction_id,
          p_new_expires_at: ctx.new_expires_at,
          p_reason: reason,
        });
      } else if (action === "decide") {
        res = await supabase.rpc("admin_loyalty_approve_pending", {
          p_transaction_id: ctx.transaction_id,
          p_decision: ctx.decision,
          p_reason: reason,
        });
      }
      if (res?.error) throw res.error;
      toast.success("Action appliquée");
      closeAction();
      qc.invalidateQueries({ queryKey: ["core-loyalty-points"] });
      qc.invalidateQueries({ queryKey: ["core-loyalty-transactions"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Award className="h-6 w-6 text-purple-500" /> Fidélité — Administration
          </h1>
          <p className="text-sm text-muted-foreground">
            Ajuster, approuver, transférer et convertir les points. Toutes les
            actions sont journalisées et se propagent en temps réel au portail client.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          qc.invalidateQueries({ queryKey: ["core-loyalty-points"] });
          qc.invalidateQueries({ queryKey: ["core-loyalty-transactions"] });
        }}>
          <RefreshCw className="h-4 w-4 mr-2" /> Rafraîchir
        </Button>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Soldes ({points.length})</TabsTrigger>
          <TabsTrigger value="pending">En attente ({pendingTxs.length})</TabsTrigger>
          <TabsTrigger value="history">Historique ({txs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher account_id ou numéro de carte…"
                className="pl-9"
              />
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Compte</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Disponibles</TableHead>
                    <TableHead className="text-right">Vie</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pLoading && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-4 w-4 animate-spin inline" />
                    </TableCell></TableRow>
                  )}
                  {!pLoading && filteredPoints.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucun compte
                    </TableCell></TableRow>
                  )}
                  {filteredPoints.map((p: any) => (
                    <TableRow key={p.account_id}>
                      <TableCell className="font-mono text-xs">{p.account_id}</TableCell>
                      <TableCell><Badge variant="outline">{p.tier ?? "bronze"}</Badge></TableCell>
                      <TableCell className="text-right font-semibold">{p.available_points ?? 0}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{p.lifetime_points ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button size="sm" variant="outline"
                            onClick={() => openAction("adjust", { account_id: p.account_id, delta: 100 })}>
                            <Plus className="h-3 w-3 mr-1" />Ajuster
                          </Button>
                          <Button size="sm" variant="outline"
                            onClick={() => openAction("transfer", { from: p.account_id, points: 100 })}>
                            <ArrowRightLeft className="h-3 w-3 mr-1" />Transférer
                          </Button>
                          <Button size="sm" variant="outline"
                            onClick={() => openAction("convert", {
                              account_id: p.account_id,
                              points: Math.min(p.available_points ?? 0, 100),
                              amount: Math.min((p.available_points ?? 0) / 100, 1),
                            })}>
                            <Coins className="h-3 w-3 mr-1" />Convertir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Compte</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Décision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTxs.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Aucune transaction en attente
                    </TableCell></TableRow>
                  )}
                  {pendingTxs.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{new Date(t.created_at).toLocaleString("fr-CA")}</TableCell>
                      <TableCell className="font-mono text-xs">{t.account_id}</TableCell>
                      <TableCell><Badge variant="outline">{t.type}</Badge></TableCell>
                      <TableCell className="text-right">{t.points}</TableCell>
                      <TableCell className="text-xs">{t.description}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline"
                            onClick={() => openAction("decide", { transaction_id: t.id, decision: "approve" })}>
                            <CheckCircle className="h-3 w-3 mr-1" />Approuver
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600"
                            onClick={() => openAction("decide", { transaction_id: t.id, decision: "reject" })}>
                            <XCircle className="h-3 w-3 mr-1" />Rejeter
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Compte</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">Solde après</TableHead>
                    <TableHead>Expire</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tLoading && <TableRow><TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin inline" />
                  </TableCell></TableRow>}
                  {txs.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{new Date(t.created_at).toLocaleString("fr-CA")}</TableCell>
                      <TableCell className="font-mono text-xs">{t.account_id}</TableCell>
                      <TableCell><Badge variant="outline">{t.type}</Badge></TableCell>
                      <TableCell className={`text-right ${t.points < 0 ? "text-red-500" : "text-emerald-500"}`}>
                        {t.points > 0 ? "+" : ""}{t.points}
                      </TableCell>
                      <TableCell className="text-right">{t.balance_after}</TableCell>
                      <TableCell className="text-xs">
                        {t.expires_at ? new Date(t.expires_at).toLocaleDateString("fr-CA") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.expires_at && (
                          <Button size="sm" variant="ghost"
                            onClick={() => openAction("extend", {
                              transaction_id: t.id,
                              new_expires_at: new Date(new Date(t.expires_at).getTime() + 90 * 86400000).toISOString(),
                            })}>
                            <Clock className="h-3 w-3 mr-1" />Prolonger
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Unified action dialog */}
      <Dialog open={action !== null} onOpenChange={(o) => !o && closeAction()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "adjust" && "Ajuster les points"}
              {action === "transfer" && "Transférer des points"}
              {action === "convert" && "Convertir en crédit facture"}
              {action === "extend" && "Prolonger l'expiration"}
              {action === "decide" && `${ctx.decision === "approve" ? "Approuver" : "Rejeter"} la transaction`}
            </DialogTitle>
            <DialogDescription>
              Cette action est journalisée dans l'audit admin et propagée en temps réel au client.
            </DialogDescription>
          </DialogHeader>

          {action === "adjust" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Compte</label>
                <Input value={ctx.account_id ?? ""} readOnly className="font-mono text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant={ctx.delta > 0 ? "default" : "outline"} size="sm"
                  onClick={() => setCtx({ ...ctx, delta: Math.abs(ctx.delta || 100) })}>
                  <Plus className="h-3 w-3 mr-1" />Ajouter
                </Button>
                <Button variant={ctx.delta < 0 ? "default" : "outline"} size="sm"
                  onClick={() => setCtx({ ...ctx, delta: -Math.abs(ctx.delta || 100) })}>
                  <Minus className="h-3 w-3 mr-1" />Retirer
                </Button>
              </div>
              <div>
                <label className="text-xs font-medium">Points (± {ctx.delta})</label>
                <Input type="number" value={Math.abs(ctx.delta || 0)}
                  onChange={(e) => setCtx({ ...ctx, delta: (ctx.delta >= 0 ? 1 : -1) * Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs font-medium">Expiration (optionnel)</label>
                <Input type="date"
                  onChange={(e) => setCtx({ ...ctx, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
            </div>
          )}

          {action === "transfer" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">De</label>
                <Input value={ctx.from ?? ""} readOnly className="font-mono text-xs" />
              </div>
              <div>
                <label className="text-xs font-medium">Vers (account_id)</label>
                <Input value={ctx.to ?? ""} onChange={(e) => setCtx({ ...ctx, to: e.target.value })}
                  placeholder="uuid du compte destinataire" className="font-mono text-xs" />
              </div>
              <div>
                <label className="text-xs font-medium">Points à transférer</label>
                <Input type="number" value={ctx.points ?? 0}
                  onChange={(e) => setCtx({ ...ctx, points: Number(e.target.value) })} />
              </div>
            </div>
          )}

          {action === "convert" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Compte</label>
                <Input value={ctx.account_id ?? ""} readOnly className="font-mono text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium">Points</label>
                  <Input type="number" value={ctx.points ?? 0}
                    onChange={(e) => setCtx({ ...ctx, points: Number(e.target.value), amount: Number(e.target.value) / 100 })} />
                </div>
                <div>
                  <label className="text-xs font-medium">Crédit ($)</label>
                  <Input type="number" step="0.01" value={ctx.amount ?? 0}
                    onChange={(e) => setCtx({ ...ctx, amount: Number(e.target.value) })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Ratio suggéré : 100 pts = 1,00 $.</p>
            </div>
          )}

          {action === "extend" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Nouvelle expiration</label>
                <Input type="date"
                  value={ctx.new_expires_at ? ctx.new_expires_at.slice(0, 10) : ""}
                  onChange={(e) => setCtx({ ...ctx, new_expires_at: new Date(e.target.value).toISOString() })} />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium">Raison (obligatoire)</label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
              rows={3} placeholder="Motif du geste, référence de ticket, etc." />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeAction} disabled={busy}>Annuler</Button>
            <Button onClick={run} disabled={busy || !reason.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
