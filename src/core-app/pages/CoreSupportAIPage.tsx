/**
 * CoreSupportAIPage — admin view for AI Customer Support tickets.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Bot, RefreshCw, Send, CheckCircle2 } from "lucide-react";

import { enqueueCommunication } from "@/lib/enqueueCommunication";
const STATUS_LABEL: Record<string, string> = {
  new: "Nouveau",
  ai_responded: "Répondu IA",
  escalated: "Escaladé",
  in_progress: "En cours",
  resolved: "Résolu",
  closed: "Fermé",
};
const SENTIMENT_EMOJI: Record<string, string> = {
  positive: "😊",
  neutral: "😐",
  frustrated: "😤",
  angry: "😠",
  urgent: "🚨",
};
const PRIORITY_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  urgent: "destructive",
  high: "destructive",
  normal: "secondary",
  low: "outline",
};

export default function CoreSupportAIPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [reply, setReply] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("support_tickets_ai")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setTickets(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const runAgent = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("agent-support", { body: { action: "process_queue" } });
      if (error) throw error;
      toast.success("Agent support exécuté");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally { setRunning(false); }
  };

  const stats = useMemo(() => {
    const total = tickets.length;
    const aiResponded = tickets.filter((t) => t.ai_response_sent).length;
    const escalated = tickets.filter((t) => t.ai_escalated).length;
    const rate = total > 0 ? Math.round((aiResponded / total) * 100) : 0;
    return { total, aiResponded, escalated, rate };
  }, [tickets]);

  const filtered = useMemo(() => {
    if (filter === "all") return tickets;
    if (filter === "new") return tickets.filter((t) => t.status === "new");
    if (filter === "ai") return tickets.filter((t) => t.status === "ai_responded");
    if (filter === "escalated") return tickets.filter((t) => t.status === "escalated");
    if (filter === "resolved") return tickets.filter((t) => ["resolved", "closed"].includes(t.status));
    return tickets;
  }, [tickets, filter]);

  const resolve = async (id: string) => {
    const { error } = await supabase.from("support_tickets_ai").update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Ticket résolu"); await load(); }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    const { error: emailErr } = await enqueueCommunication({
      channel: "email",
      templateKey: "support_ai_response",
      recipient: selected.from_email,
      idempotencyKey: `support-ai-reply:${selected.id}`,
      templateVars: {
        client_name: selected.from_name ?? "Client",
        first_name: selected.from_name ?? "Client",
        ticket_number: selected.ticket_number,
        ai_response: reply,
      },
      subject: `Réponse — Ticket ${selected.ticket_number}`,
    });
    if (emailErr) { toast.error(emailErr.message); return; }
    await supabase.from("support_tickets_ai").update({
      status: "in_progress",
      ai_response: reply,
    }).eq("id", selected.id);
    toast.success("Réponse envoyée");
    setReply("");
    setSelected(null);
    await load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="h-7 w-7" /> Support IA
          </h1>
          <p className="text-muted-foreground">Tickets traités automatiquement par l'IA, escalades vers Core.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Actualiser
          </Button>
          <Button onClick={runAgent} disabled={running}>
            <Bot className={`h-4 w-4 mr-2 ${running ? "animate-pulse" : ""}`} />Exécuter l'agent
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total tickets</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{stats.total}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Répondus par IA</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold text-green-600">{stats.aiResponded}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Escaladés</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold text-orange-600">{stats.escalated}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Taux résolution IA</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{stats.rate}%</CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="new">Nouveaux</TabsTrigger>
              <TabsTrigger value="ai">Répondus IA</TabsTrigger>
              <TabsTrigger value="escalated">Escaladés</TabsTrigger>
              <TabsTrigger value="resolved">Résolus</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Priorité</TableHead>
                <TableHead>Sentiment</TableHead>
                <TableHead>Confiance</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Aucun ticket</TableCell></TableRow>
              )}
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.ticket_number}</TableCell>
                  <TableCell>
                    <div className="font-medium">{t.from_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{t.from_email}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{t.category ?? "—"}</Badge></TableCell>
                  <TableCell><Badge variant={PRIORITY_VARIANT[t.priority] ?? "secondary"}>{t.priority ?? "—"}</Badge></TableCell>
                  <TableCell>{SENTIMENT_EMOJI[t.sentiment] ?? "—"} {t.sentiment ?? ""}</TableCell>
                  <TableCell>{t.ai_confidence != null ? `${Math.round(Number(t.ai_confidence) * 100)}%` : "—"}</TableCell>
                  <TableCell><Badge>{STATUS_LABEL[t.status] ?? t.status}</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(t.created_at).toLocaleString("fr-CA")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => { setSelected(t); setReply(t.ai_response ?? ""); }}>
                        Voir
                      </Button>
                      {t.status !== "resolved" && t.status !== "closed" && (
                        <Button size="sm" variant="ghost" onClick={() => resolve(t.id)} title="Marquer résolu">
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Ticket {selected.ticket_number}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">De</div>
                  <div className="font-medium">{selected.from_name ?? "—"} &lt;{selected.from_email}&gt;</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Sujet</div>
                  <div className="font-medium">{selected.subject ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Message original</div>
                  <div className="p-3 bg-muted rounded text-sm whitespace-pre-wrap">{selected.body}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><div className="text-xs text-muted-foreground">Catégorie</div><Badge variant="outline">{selected.category ?? "—"}</Badge></div>
                  <div><div className="text-xs text-muted-foreground">Sentiment</div>{SENTIMENT_EMOJI[selected.sentiment] ?? "—"} {selected.sentiment ?? ""}</div>
                  <div><div className="text-xs text-muted-foreground">Confiance IA</div>{selected.ai_confidence != null ? `${Math.round(Number(selected.ai_confidence) * 100)}%` : "—"}</div>
                </div>
                {selected.escalation_reason && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded text-sm">
                    <div className="font-semibold text-orange-700 dark:text-orange-300 mb-1">Raison escalade</div>
                    {selected.escalation_reason}
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Réponse {selected.ai_response_sent ? "(envoyée par IA)" : "(brouillon)"}</div>
                  <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={8} />
                </div>
                <Button onClick={sendReply} disabled={!reply.trim()} className="w-full">
                  <Send className="h-4 w-4 mr-2" />Envoyer la réponse
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
