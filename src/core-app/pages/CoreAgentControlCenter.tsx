/**
 * CoreAgentControlCenter — Mission control for all Nivra AI agents.
 *
 * Realtime dashboard:
 *  - 12 agent cards with health gauge, status dot, force/pause/logs
 *  - Live terminal subscribed to agent_events (Supabase Realtime)
 *  - 24h activity timeline chart
 *  - Stats dashboard with success/failure bars and event distribution
 *  - Right-side detail drawer per agent with config + run history
 *  - Dedicated Sales Assignment tab (Agent 12)
 *
 * Admin-only (gated by CoreProtectedRoute adminOnly).
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import {
  Activity, Cpu, Play, Pause, Terminal as TerminalIcon,
  RefreshCw, Trash2, ArrowRight, AlertTriangle, CheckCircle2,
  Zap, Sparkles, Mail, X, Filter,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type AgentStatus = "active" | "paused" | "error" | "disabled";
type EventType =
  | "info" | "success" | "warning" | "error" | "critical"
  | "action" | "gemini_call" | "email_sent" | "auto_fix" | "escalation";

interface AgentRow {
  agent_name: string;
  display_name: string;
  description: string | null;
  function_name: string;
  cron_schedule: string | null;
  status: AgentStatus;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  consecutive_failures: number;
  total_runs: number;
  total_successes: number;
  total_failures: number;
  avg_execution_ms: number;
  health_score: number;
}

interface AgentEvent {
  id: string;
  agent_name: string;
  event_type: EventType;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface AgentRun {
  id: string;
  agent_name: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: "running" | "success" | "failed" | "timeout" | "skipped";
  actions_taken: number;
  items_processed: number;
  summary: string | null;
  gemini_used: boolean;
}

const TYPE_COLOR: Record<EventType, string> = {
  info: "text-blue-400",
  success: "text-green-400",
  warning: "text-yellow-400",
  error: "text-red-400",
  critical: "text-red-600 font-bold",
  action: "text-violet-400",
  gemini_call: "text-cyan-400",
  email_sent: "text-emerald-400",
  auto_fix: "text-fuchsia-400",
  escalation: "text-orange-400",
};

const STATUS_DOT: Record<AgentStatus, string> = {
  active: "bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.7)]",
  paused: "bg-gray-500",
  error: "bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]",
  disabled: "bg-zinc-700",
};

const AGENT_PALETTE = [
  "#a78bfa", "#22d3ee", "#34d399", "#fbbf24", "#f87171", "#f472b6",
  "#60a5fa", "#facc15", "#fb923c", "#4ade80", "#c084fc", "#2dd4bf",
];

function fmtAgo(iso: string | null): string {
  if (!iso) return "jamais";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} j`;
}

function nextRunMin(schedule: string | null, lastRun: string | null): string {
  if (!schedule || !lastRun) return "—";
  const s = schedule.trim();
  let intervalMin = 60;
  if (s.startsWith("*/")) intervalMin = Number(s.split(" ")[0].slice(2)) || 60;
  else if (s.startsWith("0 *")) intervalMin = 60;
  else if (s.match(/^0 \*\/\d/)) intervalMin = Number(s.split(" ")[1].slice(2)) * 60;
  else if (s.match(/^0 \d+ \* \* \*/)) intervalMin = 1440;
  else if (s.match(/^0 \d+ \* \* \d/)) intervalMin = 7 * 1440;
  const next = new Date(lastRun).getTime() + intervalMin * 60_000;
  const diff = Math.round((next - Date.now()) / 60_000);
  if (diff <= 0) return "imminent";
  return `${diff} min`;
}

export default function CoreAgentControlCenter() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [now, setNow] = useState(new Date());
  const [pauseScroll, setPauseScroll] = useState(false);
  const [filterAgent, setFilterAgent] = useState<string>("__all");
  const [filterType, setFilterType] = useState<string>("__all");
  const [selected, setSelected] = useState<AgentRow | null>(null);
  const [selectedRuns, setSelectedRuns] = useState<AgentRun[]>([]);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const termRef = useRef<HTMLDivElement | null>(null);

  const loadAll = useCallback(async () => {
    const [agentsRes, eventsRes, runsRes] = await Promise.all([
      supabase.from("agent_registry").select("*").order("agent_name"),
      supabase.from("agent_events").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("agent_runs").select("*").order("started_at", { ascending: false }).limit(500),
    ]);
    setAgents((agentsRes.data as AgentRow[]) ?? []);
    setEvents((eventsRes.data as AgentEvent[]) ?? []);
    setRuns((runsRes.data as AgentRun[]) ?? []);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    const r = setInterval(loadAll, 30_000);
    return () => { clearInterval(t); clearInterval(r); };
  }, [loadAll]);

  useEffect(() => {
    const ch = supabase
      .channel("agent-control-center")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_events" }, (payload) => {
        setEvents((prev) => [payload.new as AgentEvent, ...prev].slice(0, 500));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_runs" }, () => {
        supabase.from("agent_runs").select("*").order("started_at", { ascending: false }).limit(500)
          .then(({ data }) => setRuns((data as AgentRun[]) ?? []));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "agent_registry" }, (payload) => {
        setAgents((prev) => prev.map((a) => a.agent_name === (payload.new as AgentRow).agent_name ? (payload.new as AgentRow) : a));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (pauseScroll) return;
    if (termRef.current) termRef.current.scrollTop = 0;
  }, [events, pauseScroll]);

  const globalHealth = agents.length
    ? Math.round(agents.reduce((s, a) => s + (a.health_score ?? 0), 0) / agents.length)
    : 100;
  const activeCount = agents.filter((a) => a.status === "active").length;
  const runningCount = runs.filter((r) => r.status === "running").length;
  const errorCount = agents.filter((a) => a.status === "error" || a.health_score < 50).length;

  const filteredEvents = useMemo(() => events.filter((e) =>
    (filterAgent === "__all" || e.agent_name === filterAgent) &&
    (filterType === "__all" || e.event_type === filterType)
  ), [events, filterAgent, filterType]);

  async function invokeAgent(agent: AgentRow) {
    setRunning((s) => ({ ...s, [agent.agent_name]: true }));
    try {
      const { error } = await supabase.functions.invoke(agent.function_name, { body: { triggered_by: "manual" } });
      if (error) throw error;
      toast({ title: `Agent lancé`, description: agent.display_name });
      await loadAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setRunning((s) => ({ ...s, [agent.agent_name]: false }));
    }
  }

  async function togglePause(agent: AgentRow) {
    const next: AgentStatus = agent.status === "paused" ? "active" : "paused";
    const { error } = await supabase.from("agent_registry").update({ status: next }).eq("agent_name", agent.agent_name);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: next === "paused" ? "Agent en pause" : "Agent réactivé" }); await loadAll(); }
  }

  async function pauseAll() {
    const anyActive = agents.some((a) => a.status === "active");
    const next: AgentStatus = anyActive ? "paused" : "active";
    const { error } = await supabase.from("agent_registry").update({ status: next }).in("agent_name", agents.map((a) => a.agent_name));
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: next === "paused" ? "Tous les agents en pause" : "Tous les agents réactivés" }); await loadAll(); }
  }

  async function forceScanAll() {
    toast({ title: "Scan global lancé", description: `Invocation de ${agents.filter((a) => a.status !== "disabled").length} agent(s)` });
    await Promise.allSettled(agents.filter((a) => a.status !== "disabled").map((a) =>
      supabase.functions.invoke(a.function_name, { body: { triggered_by: "global_scan" } })
    ));
    await loadAll();
  }

  async function openDetail(agent: AgentRow) {
    setSelected(agent);
    const { data } = await supabase.from("agent_runs").select("*").eq("agent_name", agent.agent_name).order("started_at", { ascending: false }).limit(50);
    setSelectedRuns((data as AgentRun[]) ?? []);
  }

  // Activity chart 24h
  const activityData = useMemo(() => {
    const buckets: Record<string, Record<string, number>> = {};
    const since = Date.now() - 24 * 3600_000;
    for (let i = 0; i < 24; i++) {
      const d = new Date(since + i * 3600_000);
      buckets[d.getUTCHours().toString().padStart(2, "0") + "h"] = {};
    }
    events.forEach((e) => {
      const t = new Date(e.created_at).getTime();
      if (t < since) return;
      const k = new Date(t).getUTCHours().toString().padStart(2, "0") + "h";
      if (!buckets[k]) buckets[k] = {};
      buckets[k][e.agent_name] = (buckets[k][e.agent_name] ?? 0) + 1;
    });
    return Object.entries(buckets).map(([h, vals]) => ({ hour: h, ...vals }));
  }, [events]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const todayRuns = runs.filter((r) => new Date(r.started_at).getTime() >= todayMs);
    const totalActions = todayRuns.reduce((s, r) => s + (r.actions_taken ?? 0), 0);
    const emailsSent = events.filter((e) => e.event_type === "email_sent" && new Date(e.created_at).getTime() >= todayMs).length;
    const autoFixed = events.filter((e) => e.event_type === "auto_fix" && new Date(e.created_at).getTime() >= todayMs).length;
    const geminiCalls = events.filter((e) => e.event_type === "gemini_call").length;
    return { totalActions, emailsSent, autoFixed, geminiCalls };
  }, [runs, events]);

  const successFailData = useMemo(() =>
    agents.map((a) => ({ name: a.agent_name, succès: a.total_successes ?? 0, échecs: a.total_failures ?? 0 }))
  , [agents]);

  const eventDist = useMemo(() => {
    const m = new Map<string, number>();
    events.forEach((e) => m.set(e.event_type, (m.get(e.event_type) ?? 0) + 1));
    return Array.from(m.entries()).map(([k, v]) => ({ name: k, value: v }));
  }, [events]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6">
      <Helmet>
        <title>Centre IA — Contrôle des Agents | Nivra Core</title>
        <meta name="description" content="Centre de contrôle en temps réel des agents IA Nivra Telecom." />
      </Helmet>

      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="h-8 w-8 text-violet-400" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Centre de Contrôle — Agents IA Nivra</h1>
            <p className="text-sm text-zinc-400">{now.toLocaleString("fr-CA", { dateStyle: "full", timeStyle: "medium" })}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2">
            <div className={cn("text-3xl font-extrabold tabular-nums", globalHealth >= 75 ? "text-green-400" : globalHealth >= 50 ? "text-orange-400" : "text-red-500")}>
              {globalHealth}
            </div>
            <div className="text-xs text-zinc-400">
              <div>Santé globale</div>
              <div>{activeCount} actif · {runningCount} en cours · {errorCount} erreur</div>
            </div>
          </div>
          <Button onClick={forceScanAll} variant="default" className="bg-violet-600 hover:bg-violet-500 text-white">
            <RefreshCw className="mr-2 h-4 w-4" /> Forcer scan global
          </Button>
          <Button onClick={pauseAll} variant="outline" className="border-zinc-700 text-zinc-100 hover:bg-zinc-800">
            <Pause className="mr-2 h-4 w-4" /> Pause / Reprendre tous
          </Button>
        </div>
      </div>

      <Tabs defaultValue="agents" className="space-y-6">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="terminal">Terminal live</TabsTrigger>
          <TabsTrigger value="activity">Activité 24h</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
          <TabsTrigger value="sales">Assignation Ventes</TabsTrigger>
        </TabsList>

        {/* AGENT GRID */}
        <TabsContent value="agents" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {agents.map((a) => {
              const isRunning = runs.find((r) => r.agent_name === a.agent_name && r.status === "running");
              const dotKey: AgentStatus = isRunning ? "active" : (a.status as AgentStatus);
              return (
                <Card key={a.agent_name} className="bg-zinc-900/70 border-zinc-800 hover:border-violet-600/50 transition-all cursor-pointer" onClick={() => openDetail(a)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("inline-block h-3 w-3 rounded-full shrink-0", STATUS_DOT[dotKey])} />
                        <CardTitle className="text-base font-bold text-zinc-100 truncate">{a.display_name}</CardTitle>
                      </div>
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-[10px]">
                        {a.agent_name}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-500 line-clamp-2">{a.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-zinc-400">Score santé</span>
                        <span className={cn("font-bold tabular-nums", a.health_score >= 75 ? "text-green-400" : a.health_score >= 50 ? "text-orange-400" : "text-red-400")}>
                          {a.health_score}/100
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className={cn("h-full transition-all", a.health_score >= 75 ? "bg-green-500" : a.health_score >= 50 ? "bg-orange-500" : "bg-red-500")}
                          style={{ width: `${a.health_score}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-zinc-500">Dernier:</span> <span className="text-zinc-200">{fmtAgo(a.last_run_at)}</span></div>
                      <div><span className="text-zinc-500">Prochain:</span> <span className="text-zinc-200">{nextRunMin(a.cron_schedule, a.last_run_at)}</span></div>
                      <div><span className="text-zinc-500">Succès:</span> <span className="text-green-400">{a.total_successes}</span></div>
                      <div><span className="text-zinc-500">Échecs:</span> <span className="text-red-400">{a.total_failures}</span></div>
                    </div>
                    {a.last_error_message ? (
                      <div className="rounded border border-red-900/40 bg-red-950/30 p-2 text-[11px] text-red-300 line-clamp-2">
                        {a.last_error_message}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="border-violet-700/60 text-violet-300 hover:bg-violet-900/30 h-8 text-xs" disabled={!!running[a.agent_name]} onClick={() => invokeAgent(a)}>
                        <Play className="mr-1 h-3 w-3" /> Forcer
                      </Button>
                      <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-8 text-xs" onClick={() => togglePause(a)}>
                        <Pause className="mr-1 h-3 w-3" /> {a.status === "paused" ? "Reprendre" : "Pause"}
                      </Button>
                      <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-8 text-xs" onClick={() => openDetail(a)}>
                        <TerminalIcon className="mr-1 h-3 w-3" /> Logs
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* TERMINAL */}
        <TabsContent value="terminal">
          <Card className="bg-black border-zinc-800">
            <CardHeader className="border-b border-zinc-900 flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TerminalIcon className="h-4 w-4 text-violet-400" />
                <CardTitle className="text-sm text-zinc-200">Terminal live · {filteredEvents.length} événements</CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 rounded px-2 py-1">
                  <option value="__all">Tous les agents</option>
                  {agents.map((a) => <option key={a.agent_name} value={a.agent_name}>{a.agent_name}</option>)}
                </select>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 rounded px-2 py-1">
                  <option value="__all">Tous les types</option>
                  {Object.keys(TYPE_COLOR).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-7 text-xs" onClick={() => setPauseScroll((p) => !p)}>
                  {pauseScroll ? <Play className="mr-1 h-3 w-3" /> : <Pause className="mr-1 h-3 w-3" />} {pauseScroll ? "Reprendre" : "Pause"}
                </Button>
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-7 text-xs" onClick={() => setEvents([])}>
                  <Trash2 className="mr-1 h-3 w-3" /> Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div ref={termRef} className="font-mono text-xs h-[60vh] overflow-y-auto bg-black p-3 leading-relaxed">
                {filteredEvents.length === 0 ? (
                  <div className="text-zinc-600 italic">En attente d'événements…</div>
                ) : filteredEvents.map((e) => (
                  <div key={e.id} className={cn("whitespace-pre-wrap break-words", TYPE_COLOR[e.event_type] ?? "text-zinc-300")}>
                    [{new Date(e.created_at).toLocaleTimeString("fr-CA", { hour12: false })}] [{e.agent_name}] [{e.event_type}] {e.message}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIVITY */}
        <TabsContent value="activity">
          <Card className="bg-zinc-900/70 border-zinc-800">
            <CardHeader><CardTitle className="text-zinc-100">Activité par agent — dernières 24 h</CardTitle></CardHeader>
            <CardContent>
              <div style={{ width: "100%", height: 400 }}>
                <ResponsiveContainer>
                  <AreaChart data={activityData}>
                    <XAxis dataKey="hour" stroke="#a1a1aa" />
                    <YAxis stroke="#a1a1aa" />
                    <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46" }} />
                    <Legend />
                    {agents.map((a, i) => (
                      <Area key={a.agent_name} type="monotone" dataKey={a.agent_name} stackId="1" stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]} fill={AGENT_PALETTE[i % AGENT_PALETTE.length]} fillOpacity={0.35} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* STATS */}
        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Actions aujourd'hui" value={stats.totalActions} icon={<Zap className="h-5 w-5 text-violet-400" />} />
            <StatCard label="Emails envoyés" value={stats.emailsSent} icon={<Mail className="h-5 w-5 text-emerald-400" />} />
            <StatCard label="Auto-corrigés" value={stats.autoFixed} icon={<Sparkles className="h-5 w-5 text-fuchsia-400" />} />
            <StatCard label="Appels Gemini" value={stats.geminiCalls} icon={<Cpu className="h-5 w-5 text-cyan-400" />} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-zinc-900/70 border-zinc-800">
              <CardHeader><CardTitle className="text-zinc-100">Succès vs Échecs (cumulé)</CardTitle></CardHeader>
              <CardContent>
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={successFailData}>
                      <XAxis dataKey="name" stroke="#a1a1aa" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={70} />
                      <YAxis stroke="#a1a1aa" />
                      <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46" }} />
                      <Legend />
                      <Bar dataKey="succès" fill="#34d399" />
                      <Bar dataKey="échecs" fill="#f87171" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/70 border-zinc-800">
              <CardHeader><CardTitle className="text-zinc-100">Distribution des événements</CardTitle></CardHeader>
              <CardContent>
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={eventDist} dataKey="value" nameKey="name" outerRadius={100}>
                        {eventDist.map((_, i) => <Cell key={i} fill={AGENT_PALETTE[i % AGENT_PALETTE.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SALES */}
        <TabsContent value="sales">
          <SalesAssignmentPanel />
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-zinc-950 text-zinc-100 border-zinc-800 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-violet-400" /> {selected?.display_name}
              <Badge variant="outline" className="border-zinc-700 text-zinc-400">{selected?.agent_name}</Badge>
            </DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Info label="Fonction" value={selected.function_name} />
                <Info label="Cron" value={selected.cron_schedule ?? "—"} />
                <Info label="Statut" value={selected.status} />
                <Info label="Santé" value={`${selected.health_score}/100`} />
                <Info label="Dernier succès" value={fmtAgo(selected.last_success_at)} />
                <Info label="Dernière erreur" value={fmtAgo(selected.last_error_at)} />
              </div>
              {selected.last_error_message ? (
                <div className="rounded border border-red-900/40 bg-red-950/30 p-3 text-xs text-red-300">{selected.last_error_message}</div>
              ) : null}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase text-zinc-400">Derniers runs ({selectedRuns.length})</div>
                <ScrollArea className="h-64 rounded border border-zinc-800">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-900 text-zinc-400 sticky top-0">
                      <tr><th className="text-left p-2">Début</th><th className="text-left p-2">Durée</th><th className="text-left p-2">Statut</th><th className="text-left p-2">Actions</th><th className="text-left p-2">Résumé</th></tr>
                    </thead>
                    <tbody>
                      {selectedRuns.map((r) => (
                        <tr key={r.id} className="border-t border-zinc-900">
                          <td className="p-2 text-zinc-300">{new Date(r.started_at).toLocaleString("fr-CA")}</td>
                          <td className="p-2 text-zinc-400 tabular-nums">{r.duration_ms ?? "—"}ms</td>
                          <td className="p-2"><Badge variant="outline" className={cn("border-zinc-700", r.status === "success" ? "text-green-400" : r.status === "failed" ? "text-red-400" : r.status === "running" ? "text-yellow-400" : "text-zinc-400")}>{r.status}</Badge></td>
                          <td className="p-2 text-zinc-300">{r.actions_taken}</td>
                          <td className="p-2 text-zinc-400 truncate max-w-[260px]">{r.summary ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-2">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-zinc-200 truncate">{value}</div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="bg-zinc-900/70 border-zinc-800">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="rounded-lg bg-zinc-800/70 p-2">{icon}</div>
        <div>
          <div className="text-2xl font-bold tabular-nums text-zinc-100">{value}</div>
          <div className="text-xs text-zinc-400">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function SalesAssignmentPanel() {
  const [unassigned, setUnassigned] = useState<Array<Record<string, unknown>>>([]);
  const [recentCommissions, setRecentCommissions] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const [u, c] = await Promise.all([
        supabase.from("field_sales_orders").select("id, local_id, customer_name, customer_city, created_at").is("salesperson_id", null).gte("created_at", since).limit(50),
        supabase.from("sales_commissions").select("id, commission_amount, sale_amount, status, salesperson_id, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
      ]);
      setUnassigned((u.data ?? []) as Array<Record<string, unknown>>);
      setRecentCommissions((c.data ?? []) as Array<Record<string, unknown>>);
    })();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="bg-zinc-900/70 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-zinc-100 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-400" /> Ventes non assignées (24h)</CardTitle>
          <Badge variant="outline" className="border-orange-700 text-orange-300">{unassigned.length}</Badge>
        </CardHeader>
        <CardContent>
          {unassigned.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">Aucune vente non assignée. ✓</p>
          ) : (
            <ScrollArea className="h-72">
              <table className="w-full text-xs">
                <thead className="text-zinc-400"><tr><th className="text-left p-2">Réf.</th><th className="text-left p-2">Client</th><th className="text-left p-2">Ville</th><th className="text-left p-2">Date</th></tr></thead>
                <tbody>
                  {unassigned.map((o) => (
                    <tr key={String(o.id)} className="border-t border-zinc-900">
                      <td className="p-2 text-zinc-300">{String(o.local_id ?? o.id).slice(0, 12)}</td>
                      <td className="p-2 text-zinc-200">{String(o.customer_name ?? "—")}</td>
                      <td className="p-2 text-zinc-400">{String(o.customer_city ?? "—")}</td>
                      <td className="p-2 text-zinc-500">{new Date(String(o.created_at)).toLocaleString("fr-CA")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      <Card className="bg-zinc-900/70 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-zinc-100 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Commissions créées (24h)</CardTitle>
          <Badge variant="outline" className="border-emerald-700 text-emerald-300">{recentCommissions.length}</Badge>
        </CardHeader>
        <CardContent>
          {recentCommissions.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">Aucune commission créée récemment.</p>
          ) : (
            <ScrollArea className="h-72">
              <table className="w-full text-xs">
                <thead className="text-zinc-400"><tr><th className="text-left p-2">Vente</th><th className="text-left p-2">Commission</th><th className="text-left p-2">Statut</th><th className="text-left p-2">Date</th></tr></thead>
                <tbody>
                  {recentCommissions.map((c) => (
                    <tr key={String(c.id)} className="border-t border-zinc-900">
                      <td className="p-2 text-zinc-300 tabular-nums">{Number(c.sale_amount ?? 0).toFixed(2)} $</td>
                      <td className="p-2 text-emerald-300 tabular-nums">{Number(c.commission_amount ?? 0).toFixed(2)} $</td>
                      <td className="p-2"><Badge variant="outline" className="border-zinc-700 text-zinc-300">{String(c.status)}</Badge></td>
                      <td className="p-2 text-zinc-500">{new Date(String(c.created_at)).toLocaleString("fr-CA")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
