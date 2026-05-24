/**
 * AccountFollowupsDialog — Phase 18
 * Staff-facing internal follow-up tasks tied to a client account.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ListTodo, Plus, CheckCircle2, XCircle, Clock, AlertCircle, Trash2, PlayCircle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName: string;
  accountId?: string | null;
}

interface Followup {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "done" | "cancelled";
  due_at: string | null;
  assigned_to_email: string | null;
  created_by_email: string | null;
  created_at: string;
  completed_at: string | null;
  completion_note: string | null;
}

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  normal: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  high: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  urgent: "bg-red-500/15 text-red-300 border-red-500/30",
};

const STATUS_BADGE: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  in_progress: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Ouvert", in_progress: "En cours", done: "Terminé", cancelled: "Annulé",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Basse", normal: "Normale", high: "Haute", urgent: "Urgente",
};

const CATEGORY_LABEL: Record<string, string> = {
  general: "Général", billing: "Facturation", technical: "Technique", retention: "Rétention",
  collections: "Recouvrement", kyc: "KYC", escalation: "Escalade", callback: "Rappel",
};

export function AccountFollowupsDialog({ open, onClose, clientUserId, clientName, accountId }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"list" | "create">("list");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Followup[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // create form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [dueAt, setDueAt] = useState("");
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("account-followups-actions", {
        body: { action: "list", client_user_id: clientUserId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setItems(((data as any).followups ?? []) as Followup[]);
      setCategories(((data as any).categories ?? []) as string[]);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setTab("list");
      setTitle(""); setDescription(""); setCategory("general");
      setPriority("normal"); setDueAt(""); setReason("");
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientUserId]);

  const create = async () => {
    if (!title.trim()) return toast({ title: "Titre requis", variant: "destructive" });
    if (!reason.trim()) return toast({ title: "Motif requis", variant: "destructive" });
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("account-followups-actions", {
        body: {
          action: "create",
          client_user_id: clientUserId,
          account_id: accountId ?? null,
          title, description, category, priority,
          due_at: dueAt || null,
          reason,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Suivi créé" });
      setTitle(""); setDescription(""); setDueAt(""); setReason("");
      setTab("list");
      await load();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (f: Followup, status: Followup["status"]) => {
    const r = window.prompt(`Motif pour passer "${f.title}" → ${STATUS_LABEL[status]} :`);
    if (!r?.trim()) return;
    let completion_note: string | null = null;
    if (status === "done" || status === "cancelled") {
      completion_note = window.prompt("Note de complétion (optionnel) :") ?? null;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("account-followups-actions", {
        body: {
          action: "update_status",
          client_user_id: clientUserId,
          followup_id: f.id, status, completion_note, reason: r,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Statut mis à jour" });
      await load();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (f: Followup) => {
    const r = window.prompt(`Supprimer définitivement "${f.title}". Motif :`);
    if (!r?.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("account-followups-actions", {
        body: { action: "delete", client_user_id: clientUserId, followup_id: f.id, reason: r },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Suivi supprimé" });
      await load();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const fmt = (d: string | null) => d ? new Date(d).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" }) : "—";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" /> Tâches & suivis — {clientName}
          </DialogTitle>
          <DialogDescription>
            Tâches internes liées au compte client. Toutes les actions sont auditées.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">Liste ({items.length})</TabsTrigger>
            <TabsTrigger value="create"><Plus className="h-4 w-4 mr-1" /> Nouveau suivi</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <ScrollArea className="h-[480px] pr-3">
              {loading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Aucun suivi.</p>
              ) : (
                <div className="space-y-2">
                  {items.map((f) => (
                    <div key={f.id} className="border border-border rounded-lg p-3 bg-card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-sm">{f.title}</span>
                            <Badge variant="outline" className={STATUS_BADGE[f.status]}>{STATUS_LABEL[f.status]}</Badge>
                            <Badge variant="outline" className={PRIORITY_BADGE[f.priority]}>{PRIORITY_LABEL[f.priority]}</Badge>
                            <Badge variant="outline">{CATEGORY_LABEL[f.category] ?? f.category}</Badge>
                          </div>
                          {f.description && (
                            <p className="text-xs text-muted-foreground mb-1 whitespace-pre-wrap">{f.description}</p>
                          )}
                          <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Échéance : {fmt(f.due_at)}</span>
                            <span>Assigné : {f.assigned_to_email ?? "—"}</span>
                            <span>Créé par {f.created_by_email ?? "—"} · {fmt(f.created_at)}</span>
                            {f.completed_at && <span>Terminé : {fmt(f.completed_at)}</span>}
                          </div>
                          {f.completion_note && (
                            <p className="text-[11px] italic text-muted-foreground mt-1">Note : {f.completion_note}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          {f.status === "open" && (
                            <Button size="sm" variant="outline" disabled={busy}
                              onClick={() => updateStatus(f, "in_progress")}>
                              <PlayCircle className="h-3.5 w-3.5 mr-1" /> Démarrer
                            </Button>
                          )}
                          {(f.status === "open" || f.status === "in_progress") && (
                            <>
                              <Button size="sm" variant="outline" disabled={busy}
                                onClick={() => updateStatus(f, "done")}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Terminer
                              </Button>
                              <Button size="sm" variant="outline" disabled={busy}
                                onClick={() => updateStatus(f, "cancelled")}>
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Annuler
                              </Button>
                            </>
                          )}
                          {(f.status === "done" || f.status === "cancelled") && (
                            <Button size="sm" variant="outline" disabled={busy}
                              onClick={() => updateStatus(f, "open")}>
                              <AlertCircle className="h-3.5 w-3.5 mr-1" /> Rouvrir
                            </Button>
                          )}
                          <Button size="sm" variant="outline" disabled={busy}
                            onClick={() => remove(f)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="create">
            <div className="space-y-3 py-2">
              <div>
                <Label>Titre *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={240}
                  placeholder="Ex: Rappeler le client pour confirmer l'installation" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  rows={3} maxLength={4000} placeholder="Contexte, étapes, notes…" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Catégorie</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(categories.length ? categories : Object.keys(CATEGORY_LABEL)).map((c) => (
                        <SelectItem key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priorité</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["low", "normal", "high", "urgent"] as const).map((p) => (
                        <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Échéance</Label>
                  <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Motif (audit) *</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: demande client, escalade interne…" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setTab("list")} disabled={busy}>Annuler</Button>
                <Button onClick={create} disabled={busy || !title.trim() || !reason.trim()}>
                  {busy ? "Création…" : "Créer le suivi"}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
