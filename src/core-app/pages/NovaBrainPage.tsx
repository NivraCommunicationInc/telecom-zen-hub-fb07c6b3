/**
 * NOVA Brain — Digital Brain Nivra Telecom (admin only)
 * 3-column layout: cockpit metrics + chat (streaming Claude) + recent actions/memory
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useIsCoreAdmin } from "@/core-app/hooks/useIsCoreAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Brain, Send, Sparkles, Activity, AlertTriangle, Users, DollarSign,
  Bot, Mail, Plus, CheckCircle2, XCircle, Loader2, History,
} from "lucide-react";
import { executeNovaAction, type NovaAction } from "@/core-app/utils/novaExecutor";

type ChatMsg = { role: "user" | "assistant"; content: string; ts: number };

interface NovaCtx {
  mrr: number;
  active_clients: number;
  new_clients_month: number;
  open_complaints: number;
  sla_at_risk: number;
  dlq_emails: number;
  pending_orders: number;
  agents_active: number;
  crm_hot_leads: number;
  revenue_this_month: number;
  top_agent: string | null;
  timestamp: string;
}

interface ActionCard {
  msgIndex: number;
  action: NovaAction;
  status: "pending" | "approved" | "rejected" | "executing" | "done" | "failed";
  result?: string;
}

const NOVA_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nova-brain`;

export default function NovaBrainPage() {
  const { isAdmin, isLoading: adminLoading } = useIsCoreAdmin();
  const [ctx, setCtx] = useState<NovaCtx | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionCard[]>([]);
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const [recentMemories, setRecentMemories] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [showMemoryDialog, setShowMemoryDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoBriefedRef = useRef(false);

  // Load context + side panels
  const loadContext = async () => {
    const { data } = await supabase.rpc("get_nova_context");
    if (data) setCtx(data as unknown as NovaCtx);
  };
  const loadSidePanels = async () => {
    const [{ data: a }, { data: m }, { data: c }] = await Promise.all([
      supabase.from("nova_actions").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("nova_memory").select("id,title,memory_type,importance,created_at")
        .order("created_at", { ascending: false }).limit(10),
      supabase.from("nova_conversations").select("id,title,created_at")
        .order("created_at", { ascending: false }).limit(10),
    ]);
    setRecentActions(a ?? []);
    setRecentMemories(m ?? []);
    setConversations(c ?? []);
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadContext();
    loadSidePanels();
    const t = setInterval(loadContext, 30_000);
    return () => clearInterval(t);
  }, [isAdmin]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  // Auto-briefing on mount
  useEffect(() => {
    if (!isAdmin || autoBriefedRef.current) return;
    autoBriefedRef.current = true;
    const briefing = "Génère mon briefing Nivra complet pour aujourd'hui avec toutes les données en temps réel. Identifie les problèmes critiques et donne moi ta recommandation prioritaire.";
    setTimeout(() => sendMessage(briefing), 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const parseActions = (text: string, msgIndex: number) => {
    const regex = /<action>([\s\S]*?)<\/action>/g;
    const found: ActionCard[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim()) as NovaAction;
        found.push({ msgIndex, action: parsed, status: "pending" });
      } catch { /* ignore malformed */ }
    }
    if (found.length) setActions((prev) => [...prev, ...found]);
  };

  const persistConversation = async (msgs: ChatMsg[]) => {
    try {
      if (!conversationId) {
        const title = msgs.find((m) => m.role === "user")?.content.slice(0, 80) ?? "Conversation";
        const { data } = await supabase
          .from("nova_conversations")
          .insert({ title, messages: msgs as any, context_snapshot: ctx as any })
          .select("id").single();
        if (data?.id) setConversationId(data.id);
      } else {
        await supabase.from("nova_conversations")
          .update({ messages: msgs as any, context_snapshot: ctx as any })
          .eq("id", conversationId);
      }
    } catch (e) { console.error("persist conv", e); }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: ChatMsg = { role: "user", content: text.trim(), ts: Date.now() };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setInput("");
    setStreaming(true);

    // Insert empty assistant placeholder
    setMessages((prev) => [...prev, { role: "assistant", content: "", ts: Date.now() }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(NOVA_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          messages: nextMsgs.map((m) => ({ role: m.role, content: m.content })),
          conversation_id: conversationId,
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.text();
        throw new Error(err || `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json || json === "[DONE]") continue;
          try {
            const evt = JSON.parse(json);
            // Anthropic SSE event types
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              assistantText += evt.delta.text;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: assistantText };
                return copy;
              });
            }
          } catch { buffer = line + "\n" + buffer; break; }
        }
      }

      const finalMsgs: ChatMsg[] = [
        ...nextMsgs,
        { role: "assistant", content: assistantText, ts: Date.now() },
      ];
      setMessages(finalMsgs);
      parseActions(assistantText, finalMsgs.length - 1);
      await persistConversation(finalMsgs);
    } catch (e: any) {
      console.error("nova stream error", e);
      toast.error("Erreur NOVA: " + (e?.message ?? "inconnue"));
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  };

  const approveAction = async (idx: number) => {
    const card = actions[idx];
    if (!card) return;
    setActions((prev) => prev.map((a, i) => i === idx ? { ...a, status: "executing" } : a));

    const { data: inserted } = await supabase.from("nova_actions").insert({
      conversation_id: conversationId,
      action_type: card.action.type,
      action_payload: card.action.payload,
      status: "executing",
      requires_approval: !!card.action.requires_approval,
      approved_at: new Date().toISOString(),
    }).select("id").single();

    const result = await executeNovaAction(card.action, supabase);

    if (inserted?.id) {
      await supabase.from("nova_actions").update({
        status: result.success ? "completed" : "failed",
        result: result as any,
        executed_at: new Date().toISOString(),
        error_message: result.success ? null : result.message,
      }).eq("id", inserted.id);
    }

    setActions((prev) => prev.map((a, i) => i === idx
      ? { ...a, status: result.success ? "done" : "failed", result: result.message }
      : a));
    toast[result.success ? "success" : "error"](result.message);
    loadSidePanels();
  };

  const rejectAction = (idx: number) => {
    setActions((prev) => prev.map((a, i) => i === idx ? { ...a, status: "rejected" } : a));
  };

  const newConversation = () => {
    setMessages([]);
    setActions([]);
    setConversationId(null);
    autoBriefedRef.current = false;
  };

  const loadConversation = async (id: string) => {
    const { data } = await supabase.from("nova_conversations").select("*").eq("id", id).single();
    if (data) {
      setConversationId(id);
      setMessages((data.messages as any) ?? []);
      setActions([]);
    }
  };

  // Quick prompts
  const QUICK_PROMPTS = [
    { icon: Activity, label: "📊 Rapport maintenant", text: "Génère un rapport complet de la situation actuelle de Nivra avec MRR, clients, plaintes, agents." },
    { icon: Sparkles, label: "🚀 Lancer campagne", text: "Propose une campagne marketing ciblée basée sur les données actuelles. Quel segment? Quel message? Quel ROI attendu?" },
    { icon: Bot, label: "🤖 Contrôler agents", text: "État des 12 agents IA: qui est actif, qui a des problèmes, recommandations d'optimisation." },
    { icon: Users, label: "📞 Leads chauds CRM", text: "Combien de leads chauds dans le CRM? Quelle action prioritaire pour les convertir aujourd'hui?" },
    { icon: AlertTriangle, label: "⚠️ Alertes critiques", text: "Donne moi toutes les alertes critiques en ce moment: SLA, DLQ emails, plaintes urgentes, problèmes système." },
  ];

  if (adminLoading) return <div className="p-8 text-muted-foreground">Chargement…</div>;
  if (!isAdmin) return <div className="p-8 text-destructive">Accès admin requis.</div>;

  const fmt = (n: number) => new Intl.NumberFormat("fr-CA").format(n);
  const fmt$ = (n: number) => `${fmt(Math.round(n))}$`;

  return (
    <>
      <Helmet><title>NOVA — Digital Brain | Nivra Core</title></Helmet>

      <div className="flex h-[calc(100vh-4rem)] gap-3 p-3 bg-background">
        {/* LEFT — COCKPIT */}
        <aside className="w-[280px] flex-shrink-0 flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-bold tracking-wide">COCKPIT NIVRA</h2>
          </div>
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-2">
              <MetricCard icon={<DollarSign className="h-4 w-4" />} label="MRR" value={ctx ? fmt$(ctx.mrr) + " /mois" : "—"} sub={ctx ? `Revenu commissions: ${fmt$(ctx.revenue_this_month)}` : ""} />
              <MetricCard icon={<Users className="h-4 w-4" />} label="Clients actifs" value={ctx ? fmt(ctx.active_clients) : "—"} sub={ctx ? `+${ctx.new_clients_month} ce mois` : ""} />
              <MetricCard icon={<Bot className="h-4 w-4" />} label="Agents IA" value={ctx ? `${ctx.agents_active}/12 actifs` : "—"} sub={ctx?.top_agent ? `Top: ${ctx.top_agent}` : ""} />
              <MetricCard icon={<AlertTriangle className="h-4 w-4" />} label="Plaintes" value={ctx ? fmt(ctx.open_complaints) : "—"} sub={ctx ? `${ctx.sla_at_risk} SLA à risque` : ""} severity={ctx && ctx.sla_at_risk > 0 ? "warn" : undefined} />
              <MetricCard icon={<Mail className="h-4 w-4" />} label="Emails" value={ctx ? `${fmt(ctx.dlq_emails)} en DLQ` : "—"} sub={ctx ? `${ctx.pending_orders} commandes en attente` : ""} severity={ctx && ctx.dlq_emails > 0 ? "warn" : undefined} />
              <MetricCard icon={<Sparkles className="h-4 w-4" />} label="CRM" value={ctx ? `${fmt(ctx.crm_hot_leads)} leads chauds` : "—"} />

              <div className="pt-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Quick Actions</p>
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => sendMessage(q.text)}
                    disabled={streaming}
                    className="w-full text-left text-xs px-3 py-2 rounded-md bg-card hover:bg-primary/10 border border-border transition-colors disabled:opacity-50"
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              <div className="pt-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <History className="h-3 w-3" /> Historique
                </p>
                {conversations.length === 0 && <p className="text-xs text-muted-foreground">Aucune conversation</p>}
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => loadConversation(c.id)}
                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted truncate"
                    title={c.title}
                  >
                    {c.title || "Sans titre"}
                  </button>
                ))}
              </div>
            </div>
          </ScrollArea>
        </aside>

        {/* CENTER — CHAT */}
        <main className="flex-1 flex flex-col bg-card rounded-lg border border-border overflow-hidden">
          <header className="px-4 py-3 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent">
            <div>
              <h1 className="text-base font-bold flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" /> NOVA — Digital Brain Nivra
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Connecté · Données temps réel {ctx?.timestamp ? `· ${ctx.timestamp}` : ""}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={newConversation}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nouvelle conversation
            </Button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !streaming && (
              <div className="text-center text-muted-foreground text-sm py-12">
                <Brain className="h-10 w-10 mx-auto mb-3 text-primary/40" />
                NOVA est prêt. Posez votre question ou utilisez les actions rapides.
              </div>
            )}

            {messages.map((m, i) => {
              const linkedActions = actions.filter((a) => a.msgIndex === i);
              return (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={m.role === "user"
                    ? "max-w-[80%] bg-primary/20 text-foreground rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap"
                    : "max-w-[85%] bg-card border-l-4 border-primary rounded-lg px-4 py-3 text-sm space-y-2"}>
                    {m.role === "assistant" && (
                      <div className="flex items-center gap-2 text-xs text-primary font-bold">
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">🧠</div>
                        NOVA
                      </div>
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {m.role === "assistant"
                        ? m.content.replace(/<action>[\s\S]*?<\/action>/g, "").trim() || (streaming && i === messages.length - 1 ? "" : "")
                        : m.content}
                    </div>
                    {streaming && i === messages.length - 1 && m.role === "assistant" && (!m.content) && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> NOVA analyse vos données…
                      </div>
                    )}

                    {linkedActions.map((card, ai) => {
                      const globalIdx = actions.indexOf(card);
                      return (
                        <Card key={ai} className="mt-2 p-3 bg-primary/5 border-primary/30">
                          <div className="flex items-center gap-2 text-xs font-bold text-primary mb-1">
                            <Bot className="h-3.5 w-3.5" /> NOVA veut agir
                          </div>
                          <p className="text-sm font-medium">{card.action.description ?? card.action.type}</p>
                          <p className="text-xs text-muted-foreground mt-1">Type: <code>{card.action.type}</code></p>
                          <pre className="text-[10px] mt-1 p-2 bg-background rounded overflow-auto max-h-32">{JSON.stringify(card.action.payload, null, 2)}</pre>
                          <div className="flex gap-2 mt-2">
                            {card.status === "pending" && (
                              <>
                                <Button size="sm" onClick={() => approveAction(globalIdx)}>
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approuver
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => rejectAction(globalIdx)}>
                                  <XCircle className="h-3.5 w-3.5 mr-1" /> Annuler
                                </Button>
                              </>
                            )}
                            {card.status === "executing" && <Badge><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Exécution…</Badge>}
                            {card.status === "done" && <Badge className="bg-green-600">✓ {card.result}</Badge>}
                            {card.status === "failed" && <Badge variant="destructive">✗ {card.result}</Badge>}
                            {card.status === "rejected" && <Badge variant="secondary">Annulée</Badge>}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border p-3 bg-background/50">
            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
                }}
                placeholder="Parlez à NOVA…"
                rows={2}
                disabled={streaming}
                className="resize-none"
              />
              <Button onClick={() => sendMessage(input)} disabled={streaming || !input.trim()} size="lg">
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </main>

        {/* RIGHT — ACTIONS + MEMORY */}
        <aside className="w-[260px] flex-shrink-0 flex flex-col gap-3 overflow-hidden">
          <div>
            <h2 className="text-sm font-bold tracking-wide mb-2">ACTIONS RÉCENTES</h2>
            <ScrollArea className="h-[40vh]">
              <div className="space-y-1.5 pr-2">
                {recentActions.length === 0 && <p className="text-xs text-muted-foreground">Aucune action</p>}
                {recentActions.map((a) => (
                  <Card key={a.id} className="p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{a.action_type}</span>
                      <Badge variant={a.status === "completed" ? "default" : a.status === "failed" ? "destructive" : "secondary"} className="text-[9px] py-0">
                        {a.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(a.created_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold tracking-wide">MÉMOIRE NOVA</h2>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowMemoryDialog(true)}>
                <Plus className="h-3 w-3 mr-1" /> Ajouter
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-1.5 pr-2">
                {recentMemories.map((m) => (
                  <Card key={m.id} className="p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{m.title}</span>
                      <Badge variant="outline" className="text-[9px] py-0">{m.importance}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{m.memory_type}</p>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        </aside>
      </div>

      <AddMemoryDialog open={showMemoryDialog} onClose={() => { setShowMemoryDialog(false); loadSidePanels(); }} />
    </>
  );
}

function MetricCard({ icon, label, value, sub, severity }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; severity?: "warn";
}) {
  return (
    <Card className={`p-2.5 ${severity === "warn" ? "border-yellow-500/50" : ""}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {icon} {label}
      </div>
      <p className="text-base font-bold mt-1">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

function AddMemoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [memory_type, setType] = useState("company");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState(5);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!category.trim() || !title.trim() || !content.trim()) {
      toast.error("Catégorie, titre et contenu requis");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("nova_memory").insert({
      memory_type, category, title, content, importance,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Mémoire ajoutée");
    setCategory(""); setTitle(""); setContent(""); setImportance(5);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajouter une mémoire NOVA</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold">Type</label>
            <select value={memory_type} onChange={(e) => setType(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
              {["company","personal_oldo","contextual","learned","decision","market","agent_insight"].map((t) =>
                <option key={t} value={t}>{t}</option>
              )}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold">Catégorie</label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="ex: pricing, rules…" />
          </div>
          <div>
            <label className="text-xs font-semibold">Titre</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold">Contenu</label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} />
          </div>
          <div>
            <label className="text-xs font-semibold">Importance (1-10): {importance}</label>
            <input type="range" min={1} max={10} value={importance} onChange={(e) => setImportance(Number(e.target.value))} className="w-full" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? "..." : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
