/**
 * NOVA Brain — Digital Brain Nivra Telecom (admin only)
 * Tabs: 💬 Conversation | 🧠 Intelligence
 * Voice input, auto-refresh, notification bell, decision learning, reasoning visualization.
 */
import { useEffect, useRef, useState, useCallback } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Brain, Send, Sparkles, Activity, AlertTriangle, Users, DollarSign,
  Bot, Mail, Plus, CheckCircle2, XCircle, Loader2, History, Bell, Pin,
  Search, Pencil, BarChart3, FlaskConical,
} from "lucide-react";
import { executeNovaAction, type NovaAction } from "@/core-app/utils/novaExecutor";
import { NovaVoiceInput } from "@/core-app/components/NovaVoiceInput";

type ChatMsg = { role: "user" | "assistant"; content: string; ts: number };

interface NovaCtx {
  mrr: number; active_clients: number; new_clients_month: number;
  open_complaints: number; sla_at_risk: number; dlq_emails: number;
  pending_orders: number; agents_active: number; crm_hot_leads: number;
  revenue_this_month: number; top_agent: string | null; timestamp: string;
}

interface ActionCard {
  msgIndex: number; action: NovaAction;
  status: "pending" | "approved" | "rejected" | "executing" | "done" | "failed";
  result?: string;
}

const NOVA_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nova-brain`;
const NOVA_MEMORY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nova-memory-update`;
const MEMORY_TYPES = ["company","personal_oldo","contextual","learned","decision","market","agent_insight","oldo_clone","reasoning_log"];

export default function NovaBrainPage() {
  const { isAdmin, isLoading: adminLoading } = useIsCoreAdmin();
  const [tab, setTab] = useState<"chat" | "intel">("chat");
  const [ctx, setCtx] = useState<NovaCtx | null>(null);
  const [ctxAge, setCtxAge] = useState<number>(0);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionCard[]>([]);
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const [recentMemories, setRecentMemories] = useState<any[]>([]);
  const [allMemories, setAllMemories] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [reasoningLogs, setReasoningLogs] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [showMemoryDialog, setShowMemoryDialog] = useState(false);
  const [editMemory, setEditMemory] = useState<any | null>(null);
  const [convSearch, setConvSearch] = useState("");
  const [novaStatus, setNovaStatus] = useState("Veille active");
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoBriefedRef = useRef(false);
  const learnedThisSessionRef = useRef(false);

  const loadContext = useCallback(async () => {
    const { data } = await supabase.rpc("get_nova_context");
    if (data) { setCtx(data as unknown as NovaCtx); setCtxAge(Date.now()); }
  }, []);

  const loadSidePanels = useCallback(async () => {
    const [{ data: a }, { data: m }, { data: c }, { data: d }, { data: r }, { count: pending }] = await Promise.all([
      supabase.from("nova_actions").select("*").order("created_at", { ascending: false }).limit(15),
      supabase.from("nova_memory").select("id,title,content,memory_type,importance,category,created_at")
        .eq("is_active", true).order("created_at", { ascending: false }).limit(50),
      (supabase.from("nova_conversations").select("id,title,pinned,created_at") as any)
        .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(30),
      supabase.from("nova_decisions").select("*").order("created_at", { ascending: false }).limit(20),
      (supabase as any).from("nova_reasoning_log").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("nova_actions").select("*", { count: "exact", head: true })
        .eq("status", "pending").eq("requires_approval", true),
    ]);
    setRecentActions(a ?? []);
    setAllMemories(m ?? []);
    setRecentMemories((m ?? []).slice(0, 10));
    setConversations(c ?? []);
    setDecisions(d ?? []);
    setReasoningLogs(r ?? []);
    setPendingCount(pending ?? 0);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadContext();
    loadSidePanels();
    const t = setInterval(loadContext, 60_000);
    const t2 = setInterval(loadSidePanels, 60_000);
    const t3 = setInterval(() => setCtxAge((a) => a), 5_000);
    return () => { clearInterval(t); clearInterval(t2); clearInterval(t3); };
  }, [isAdmin, loadContext, loadSidePanels]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    if (!isAdmin || autoBriefedRef.current) return;
    autoBriefedRef.current = true;
    const briefing = "Génère mon briefing Nivra complet pour aujourd'hui avec toutes les données temps réel. Identifie les problèmes critiques et donne ta recommandation prioritaire.";
    setTimeout(() => sendMessage(briefing), 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const parseActions = (text: string, msgIndex: number) => {
    const regex = /<action>([\s\S]*?)<\/action>/g;
    const found: ActionCard[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      try { found.push({ msgIndex, action: JSON.parse(match[1].trim()), status: "pending" }); } catch { /* */ }
    }
    if (found.length) setActions((prev) => [...prev, ...found]);
  };

  const persistConversation = async (msgs: ChatMsg[]) => {
    try {
      if (!conversationId) {
        const title = msgs.find((m) => m.role === "user")?.content.slice(0, 80) ?? "Conversation";
        const { data } = await supabase.from("nova_conversations")
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

  const triggerLearning = useCallback(async (msgs: ChatMsg[], convId: string | null) => {
    if (msgs.length < 4 || learnedThisSessionRef.current) return;
    learnedThisSessionRef.current = true;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setNovaStatus("Apprentissage en cours…");
      await fetch(NOVA_MEMORY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ conversation_id: convId, messages: msgs.map((m) => ({ role: m.role, content: m.content })) }),
      });
      setNovaStatus("Veille active");
      loadSidePanels();
    } catch (e) { console.error("learning", e); setNovaStatus("Veille active"); }
  }, [loadSidePanels]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: ChatMsg = { role: "user", content: text.trim(), ts: Date.now() };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs); setInput(""); setStreaming(true); setNovaStatus("Analyse en cours…");
    try {
      const { data, error } = await supabase.functions.invoke("nova-brain", {
        body: {
          messages: nextMsgs.map((m) => ({ role: m.role, content: m.content })),
          conversation_id: conversationId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.detail || data.error);
      if (typeof data?.confidence === "number") setConfidence(Math.round(data.confidence * 100));
      const assistantText: string = data?.content ?? "";
      const finalMsgs: ChatMsg[] = [...nextMsgs, { role: "assistant", content: assistantText, ts: Date.now() }];
      setMessages(finalMsgs);
      parseActions(assistantText, finalMsgs.length - 1);
      await persistConversation(finalMsgs);
      setNovaStatus("Veille active");
      if (finalMsgs.length >= 10) triggerLearning(finalMsgs, conversationId);
    } catch (e: any) {
      console.error("nova invoke", e);
      toast.error("Erreur NOVA: " + (e?.message ?? "inconnue"));
      setNovaStatus("Veille active");
    } finally { setStreaming(false); }
  };

  const recordDecision = async (card: ActionCard, approved: boolean) => {
    try {
      await (supabase as any).from("nova_decisions").insert({
        situation: card.action.description ?? card.action.type,
        context: { ctx, action_type: card.action.type, payload: card.action.payload },
        decision_made: `${approved ? "approved" : "rejected"} - ${card.action.type}`,
        reasoning: approved ? "Oldo a approuvé cette action" : "Oldo a rejeté cette action — ne pas re-proposer dans contexte similaire",
        made_by: "oldo",
      });
      // Append to oldo_clone memory
      const title = `Pattern décision: ${card.action.type}`;
      const { data: existing } = await supabase.from("nova_memory")
        .select("id, content").eq("title", title).eq("memory_type", "oldo_clone").maybeSingle();
      const newLine = `${approved ? "✓ Approuve" : "✗ Rejette"} "${card.action.description ?? card.action.type}" (${new Date().toLocaleDateString("fr-CA")})`;
      if (existing) {
        await supabase.from("nova_memory").update({
          content: `${(existing as any).content}\n${newLine}`,
        }).eq("id", (existing as any).id);
      } else {
        await supabase.from("nova_memory").insert({
          memory_type: "oldo_clone", category: "decision_patterns",
          title, content: newLine, importance: 7, source: "decision_learning",
        });
      }
    } catch (e) { console.error("recordDecision", e); }
  };

  const approveAction = async (idx: number) => {
    const card = actions[idx]; if (!card) return;
    setActions((prev) => prev.map((a, i) => i === idx ? { ...a, status: "executing" } : a));
    const { data: inserted } = await supabase.from("nova_actions").insert({
      conversation_id: conversationId, action_type: card.action.type, action_payload: card.action.payload,
      status: "executing", requires_approval: !!card.action.requires_approval, approved_at: new Date().toISOString(),
    }).select("id").single();
    const result = await executeNovaAction(card.action, supabase);
    if (inserted?.id) {
      await supabase.from("nova_actions").update({
        status: result.success ? "completed" : "failed",
        result: result as any, executed_at: new Date().toISOString(),
        error_message: result.success ? null : result.message,
      }).eq("id", inserted.id);
    }
    await recordDecision(card, true);
    setActions((prev) => prev.map((a, i) => i === idx
      ? { ...a, status: result.success ? "done" : "failed", result: result.message } : a));
    toast[result.success ? "success" : "error"](result.message);
    loadSidePanels();
  };

  const rejectAction = async (idx: number) => {
    const card = actions[idx]; if (!card) return;
    setActions((prev) => prev.map((a, i) => i === idx ? { ...a, status: "rejected" } : a));
    await recordDecision(card, false);
    loadSidePanels();
  };

  const newConversation = async () => {
    if (messages.length >= 4 && !learnedThisSessionRef.current) {
      await triggerLearning(messages, conversationId);
    }
    setMessages([]); setActions([]); setConversationId(null);
    setConfidence(null); autoBriefedRef.current = false; learnedThisSessionRef.current = false;
  };

  const loadConversation = async (id: string) => {
    const { data } = await supabase.from("nova_conversations").select("*").eq("id", id).single();
    if (data) {
      setConversationId(id); setMessages((data.messages as any) ?? []); setActions([]);
      learnedThisSessionRef.current = false;
    }
  };

  const togglePin = async (id: string, pinned: boolean) => {
    await (supabase.from("nova_conversations") as any).update({ pinned: !pinned }).eq("id", id);
    loadSidePanels();
  };

  const QUICK_PROMPTS = [
    { label: "📊 Rapport maintenant", text: "Génère un rapport complet de la situation actuelle de Nivra avec MRR, clients, plaintes, agents." },
    { label: "🚀 Lancer campagne", text: "Propose une campagne marketing ciblée basée sur les données actuelles. Quel segment? Quel message? Quel ROI attendu?" },
    { label: "🤖 Contrôler agents", text: "État des 12 agents IA: qui est actif, qui a des problèmes, recommandations d'optimisation." },
    { label: "📞 Qui appeler aujourd'hui?", text: "Donne moi la liste des prospects à appeler aujourd'hui en priorité avec un script personnalisé pour chacun." },
    { label: "⚠️ Alertes critiques", text: "Donne moi toutes les alertes critiques en ce moment: SLA, DLQ emails, plaintes urgentes, problèmes système." },
  ];

  if (adminLoading) return <div className="p-8 text-muted-foreground">Chargement…</div>;
  if (!isAdmin) return <div className="p-8 text-destructive">Accès admin requis.</div>;

  const fmt = (n: number) => new Intl.NumberFormat("fr-CA").format(n);
  const fmt$ = (n: number) => `${fmt(Math.round(n))}$`;
  const ctxAgeSec = Math.floor((Date.now() - ctxAge) / 1000);

  const filteredConvs = convSearch
    ? conversations.filter((c) => (c.title ?? "").toLowerCase().includes(convSearch.toLowerCase()))
    : conversations;

  return (
    <>
      <Helmet><title>NOVA — Digital Brain | Nivra Core</title></Helmet>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="h-[calc(100vh-4rem)] flex flex-col">
        <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-border">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-primary" />
            <TabsList>
              <TabsTrigger value="chat">💬 Conversation</TabsTrigger>
              <TabsTrigger value="intel">🧠 Intelligence</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              {novaStatus}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="relative" title="Notifications">
              <Bell className="h-4 w-4" />
              {pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {pendingCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
          <div className="flex h-full gap-3 p-3 bg-background">
            {/* COCKPIT */}
            <aside className="w-[280px] flex-shrink-0 flex flex-col gap-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold tracking-wide">COCKPIT NIVRA</h2>
                <span className="text-[10px] text-muted-foreground">MAJ {ctxAgeSec}s</span>
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
                      <button key={q.label} onClick={() => sendMessage(q.text)} disabled={streaming}
                        className="w-full text-left text-xs px-3 py-2 rounded-md bg-card hover:bg-primary/10 border border-border transition-colors disabled:opacity-50">
                        {q.label}
                      </button>
                    ))}
                  </div>

                  <div className="pt-3 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                      <History className="h-3 w-3" /> Historique
                    </p>
                    <div className="relative">
                      <Search className="h-3 w-3 absolute left-2 top-2 text-muted-foreground" />
                      <Input value={convSearch} onChange={(e) => setConvSearch(e.target.value)}
                        placeholder="Rechercher…" className="h-7 text-xs pl-7" />
                    </div>
                    {filteredConvs.length === 0 && <p className="text-xs text-muted-foreground">Aucune conversation</p>}
                    {filteredConvs.map((c) => (
                      <div key={c.id} className="flex items-center gap-1 group">
                        <button onClick={() => loadConversation(c.id)}
                          className="flex-1 text-left text-xs px-2 py-1.5 rounded hover:bg-muted truncate">
                          {c.pinned && <Pin className="inline h-2.5 w-2.5 mr-1 text-primary" />}
                          {c.title || "Sans titre"}
                        </button>
                        <button onClick={() => togglePin(c.id, c.pinned)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary p-1"
                          title={c.pinned ? "Désépingler" : "Épingler"}>
                          <Pin className={`h-3 w-3 ${c.pinned ? "fill-primary text-primary" : ""}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </aside>

            {/* CHAT */}
            <main className="flex-1 flex flex-col bg-card rounded-lg border border-border overflow-hidden">
              <header className="px-4 py-3 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent">
                <div>
                  <h1 className="text-base font-bold flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" /> NOVA — Digital Brain
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Données temps réel {ctx?.timestamp ? `· ${ctx.timestamp}` : ""}
                    {confidence !== null && <span className="ml-2">· Confiance: <span className="text-primary font-semibold">{confidence}%</span></span>}
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
                            ? m.content.replace(/<action>[\s\S]*?<\/action>/g, "").trim()
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
                                      <XCircle className="h-3.5 w-3.5 mr-1" /> Refuser
                                    </Button>
                                  </>
                                )}
                                {card.status === "executing" && <Badge><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Exécution…</Badge>}
                                {card.status === "done" && <Badge className="bg-green-600">✓ {card.result}</Badge>}
                                {card.status === "failed" && <Badge variant="destructive">✗ {card.result}</Badge>}
                                {card.status === "rejected" && <Badge variant="secondary">Refusée — NOVA apprend</Badge>}
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
                  <Textarea value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                    placeholder="Parlez ou écrivez à NOVA…" rows={2} disabled={streaming} className="resize-none" />
                  <NovaVoiceInput disabled={streaming} onTranscript={(text) => { setInput(text); setTimeout(() => sendMessage(text), 100); }} />
                  <Button onClick={() => sendMessage(input)} disabled={streaming || !input.trim()} size="lg">
                    {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </main>

            {/* RIGHT */}
            <aside className="w-[260px] flex-shrink-0 flex flex-col gap-3 overflow-hidden">
              <div>
                <h2 className="text-xs font-bold tracking-wide mb-2">ACTIONS RÉCENTES</h2>
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
                  <h2 className="text-xs font-bold tracking-wide">MÉMOIRE NOVA</h2>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditMemory(null); setShowMemoryDialog(true); }}>
                    <Plus className="h-3 w-3 mr-1" /> Ajouter
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-1.5 pr-2">
                    {recentMemories.map((m) => (
                      <Card key={m.id} className="p-2 text-xs cursor-pointer hover:border-primary/50" onClick={() => { setEditMemory(m); setShowMemoryDialog(true); }}>
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
        </TabsContent>

        {/* INTELLIGENCE TAB */}
        <TabsContent value="intel" className="flex-1 overflow-y-auto mt-0 p-4 bg-background">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Learning progress */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <StatTile icon={<Brain className="h-4 w-4" />} label="Apprentissages Nivra"
                value={allMemories.filter((m) => ["company","learned","market"].includes(m.memory_type)).length} />
              <StatTile icon={<Users className="h-4 w-4" />} label="Décisions mémorisées" value={decisions.length} />
              <StatTile icon={<FlaskConical className="h-4 w-4" />} label="Profil Oldo (clone)"
                value={allMemories.filter((m) => m.memory_type === "oldo_clone").length} />
              <StatTile icon={<BarChart3 className="h-4 w-4" />} label="Chaînes de raisonnement" value={reasoningLogs.length} />
            </div>

            {/* Memory by type */}
            <section>
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /> Mémoire NOVA</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {MEMORY_TYPES.map((mt) => {
                  const items = allMemories.filter((m) => m.memory_type === mt);
                  if (items.length === 0) return null;
                  return (
                    <Card key={mt} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-primary">{mt}</h3>
                        <Badge variant="outline">{items.length}</Badge>
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {items.slice(0, 6).map((m) => (
                          <button key={m.id} onClick={() => { setEditMemory(m); setShowMemoryDialog(true); }}
                            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center gap-1">
                            <Pencil className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{m.title}</span>
                          </button>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* Decisions timeline */}
            <section>
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Historique des décisions</h2>
              <Card className="p-3">
                {decisions.length === 0 && <p className="text-xs text-muted-foreground">Aucune décision enregistrée.</p>}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {decisions.map((d) => {
                    const approved = String(d.decision_made).startsWith("approved");
                    return (
                      <div key={d.id} className={`p-2.5 rounded border-l-4 text-xs ${approved ? "border-green-500 bg-green-500/5" : "border-red-500 bg-red-500/5"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold">{d.situation}</span>
                          <Badge variant={approved ? "default" : "destructive"} className="text-[9px]">
                            {approved ? "✓ Approuvé" : "✗ Refusé"}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">{d.reasoning}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(d.created_at).toLocaleString("fr-CA")}</p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </section>

            {/* Reasoning log */}
            <section>
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2"><FlaskConical className="h-4 w-4 text-primary" /> Dernières chaînes de raisonnement</h2>
              <Card className="p-3">
                {reasoningLogs.length === 0 && <p className="text-xs text-muted-foreground">Aucun raisonnement enregistré.</p>}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {reasoningLogs.map((r) => (
                    <div key={r.id} className="p-2.5 rounded bg-muted/30 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold truncate flex-1">{r.user_message?.slice(0, 80) ?? "—"}</span>
                        <Badge variant="outline" className="text-[9px] ml-2">Conf {Math.round((r.confidence ?? 0) * 100)}%</Badge>
                      </div>
                      <pre className="text-[10px] text-muted-foreground overflow-x-auto">{JSON.stringify(r.reasoning_chain, null, 2)}</pre>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(r.created_at).toLocaleString("fr-CA")}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </section>
          </div>
        </TabsContent>
      </Tabs>

      <MemoryDialog open={showMemoryDialog} onClose={() => { setShowMemoryDialog(false); setEditMemory(null); loadSidePanels(); }} memory={editMemory} />
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

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {icon} {label}
      </div>
      <p className="text-2xl font-bold mt-1.5 text-primary">{value}</p>
    </Card>
  );
}

function MemoryDialog({ open, onClose, memory }: { open: boolean; onClose: () => void; memory: any | null }) {
  const [memory_type, setType] = useState("company");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (memory) {
      setType(memory.memory_type); setCategory(memory.category ?? "");
      setTitle(memory.title); setContent(memory.content); setImportance(memory.importance ?? 5);
    } else {
      setType("company"); setCategory(""); setTitle(""); setContent(""); setImportance(5);
    }
  }, [memory, open]);

  const save = async () => {
    if (!category.trim() || !title.trim() || !content.trim()) { toast.error("Catégorie, titre et contenu requis"); return; }
    setSaving(true);
    let error;
    if (memory?.id) {
      ({ error } = await supabase.from("nova_memory").update({ memory_type, category, title, content, importance }).eq("id", memory.id));
    } else {
      ({ error } = await supabase.from("nova_memory").insert({ memory_type, category, title, content, importance }));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(memory?.id ? "Mémoire mise à jour" : "Mémoire ajoutée");
    onClose();
  };

  const remove = async () => {
    if (!memory?.id) return;
    if (!confirm("Supprimer cette mémoire ?")) return;
    await supabase.from("nova_memory").update({ is_active: false }).eq("id", memory.id);
    toast.success("Mémoire désactivée");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{memory?.id ? "Modifier la mémoire" : "Ajouter une mémoire NOVA"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold">Type</label>
            <select value={memory_type} onChange={(e) => setType(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
              {MEMORY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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
        <DialogFooter className="gap-2">
          {memory?.id && <Button variant="destructive" onClick={remove}>Supprimer</Button>}
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? "..." : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
