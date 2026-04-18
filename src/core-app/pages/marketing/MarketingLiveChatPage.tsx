/**
 * MarketingLiveChatPage — Live chat admin (Nivra dark theme).
 * Backend logic preserved: live_chat_sessions + chatbot_logs + live_chat_admin_replies.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Bot, User, Clock, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { MKPage, MKCard, MKCardHeader } from "./_marketing-ui";
import { cn } from "@/lib/utils";

interface ChatSession {
  session_id: string;
  status: string;
  visitor_name: string | null;
  visitor_user_id: string | null;
  current_page: string | null;
  language: string | null;
  taken_over_by: string | null;
  taken_over_at: string | null;
  last_visitor_message_at: string | null;
  last_message_at: string;
  unread_for_admin: number;
  created_at: string;
}

interface ChatMessage {
  id: string;
  role: "visitor" | "bot" | "admin";
  content: string;
  created_at: string;
  admin_name?: string | null;
}

const MarketingLiveChatPage = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadSessions = async () => {
    const { data } = await supabase
      .from("live_chat_sessions")
      .select("*")
      .neq("status", "closed")
      .order("last_message_at", { ascending: false })
      .limit(100);
    setSessions((data ?? []) as ChatSession[]);
    setLoading(false);
  };

  const loadMessages = async (sessionId: string) => {
    const [{ data: logs }, { data: replies }] = await Promise.all([
      supabase
        .from("chatbot_logs")
        .select("id, user_message, bot_response, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
      supabase
        .from("live_chat_admin_replies")
        .select("id, message, admin_name, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
    ]);

    const merged: ChatMessage[] = [];
    (logs ?? []).forEach((l: any) => {
      merged.push({ id: `${l.id}-u`, role: "visitor", content: l.user_message, created_at: l.created_at });
      if (l.bot_response) {
        merged.push({ id: `${l.id}-b`, role: "bot", content: l.bot_response, created_at: l.created_at });
      }
    });
    (replies ?? []).forEach((r: any) =>
      merged.push({ id: r.id, role: "admin", content: r.message, created_at: r.created_at, admin_name: r.admin_name })
    );
    merged.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    setMessages(merged);

    await supabase
      .from("live_chat_sessions")
      .update({ unread_for_admin: 0 })
      .eq("session_id", sessionId);
  };

  useEffect(() => {
    loadSessions();
    const channel = supabase
      .channel("marketing-live-chat")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_chat_sessions" }, () => loadSessions())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chatbot_logs" }, (payload: any) => {
        if (selectedId && payload.new?.session_id === selectedId) loadMessages(selectedId);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_chat_admin_replies" }, (payload: any) => {
        if (selectedId && payload.new?.session_id === selectedId) loadMessages(selectedId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => { if (selectedId) loadMessages(selectedId); }, [selectedId]);

  const selected = useMemo(() => sessions.find((s) => s.session_id === selectedId) ?? null, [sessions, selectedId]);

  const handleTakeOver = async () => {
    if (!selected) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("live_chat_sessions")
      .update({ status: "human_takeover", taken_over_by: user.id, taken_over_at: new Date().toISOString() })
      .eq("session_id", selected.session_id);
    if (error) toast.error(error.message); else toast.success("Vous avez pris la relève");
  };

  const handleGiveBack = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("live_chat_sessions")
      .update({ status: "bot_active", taken_over_by: null, taken_over_at: null })
      .eq("session_id", selected.session_id);
    if (error) toast.error(error.message); else toast.success("Conversation rendue au bot");
  };

  const handleSendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }
    const { data: profile } = await supabase
      .from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle();
    const adminName = profile
      ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Agent Nivra"
      : "Agent Nivra";

    const { error } = await supabase.from("live_chat_admin_replies").insert({
      session_id: selected.session_id,
      admin_user_id: user.id,
      admin_name: adminName,
      message: reply.trim(),
    });
    if (error) toast.error(error.message);
    else {
      setReply("");
      await supabase.from("live_chat_sessions")
        .update({ last_message_at: new Date().toISOString() })
        .eq("session_id", selected.session_id);
    }
    setSending(false);
  };

  const waitingCount = sessions.filter((s) => {
    if (!s.last_visitor_message_at) return false;
    const ageMs = Date.now() - +new Date(s.last_visitor_message_at);
    return s.status !== "human_takeover" && ageMs > 2 * 60_000;
  }).length;

  return (
    <MKPage
      title="Live Chat"
      subtitle="Conversations en cours sur le site web — temps réel"
      actions={
        waitingCount > 0 ? (
          <span
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-[10px] text-xs font-semibold text-white"
            style={{ background: "#EF4444" }}
          >
            <AlertTriangle className="h-3.5 w-3.5" /> {waitingCount} en attente &gt; 2 min
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-[10px] text-xs font-semibold text-white"
            style={{ background: "#10B98122", color: "#10B981" }}
          >
            <span className="h-2 w-2 rounded-full bg-[#10B981]" /> Tout est sous contrôle
          </span>
        )
      }
    >
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* Sessions list */}
        <MKCard className="lg:h-[calc(100vh-220px)] flex flex-col">
          <MKCardHeader title={`Sessions actives · ${sessions.length}`} />
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-4 text-center text-[#888]"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#888]">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Aucune conversation
              </div>
            ) : (
              <div className="divide-y divide-[#1E1E2E]">
                {sessions.map((s) => {
                  const ageMin = s.last_visitor_message_at
                    ? Math.floor((Date.now() - +new Date(s.last_visitor_message_at)) / 60_000) : 0;
                  const isWaiting = s.status !== "human_takeover" && ageMin > 2;
                  const isHuman = s.status === "human_takeover";
                  const isSelected = selectedId === s.session_id;
                  return (
                    <button
                      key={s.session_id}
                      onClick={() => setSelectedId(s.session_id)}
                      className={cn(
                        "w-full text-left p-3 transition",
                        isSelected ? "bg-[#1E1E2E]" : "hover:bg-[#1A1A28]",
                        isWaiting && "border-l-2 border-l-[#EF4444]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">
                              {s.visitor_name || `Visiteur ${s.session_id.slice(0, 6)}`}
                            </span>
                            {s.unread_for_admin > 0 && (
                              <span className="text-[10px] font-bold px-1.5 rounded-full text-white" style={{ background: "#EF4444" }}>
                                {s.unread_for_admin}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                              style={isHuman
                                ? { background: "#7C3AED22", color: "#7C3AED" }
                                : { background: "#1E1E2E", color: "#888" }}
                            >
                              {isHuman ? "👤 Humain" : "🤖 Bot"}
                            </span>
                            {isWaiting && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-0.5"
                                style={{ background: "#EF444422", color: "#EF4444" }}>
                                <Clock className="h-2.5 w-2.5" /> {ageMin}min
                              </span>
                            )}
                          </div>
                          {s.current_page && (
                            <p className="text-[11px] text-[#888] mt-1 truncate">📍 {s.current_page}</p>
                          )}
                          <p className="text-[10px] text-[#888] mt-0.5">
                            {formatDistanceToNow(new Date(s.last_message_at), { addSuffix: true, locale: fr })}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </MKCard>

        {/* Conversation view */}
        <MKCard className="lg:h-[calc(100vh-220px)] flex flex-col">
          {selected ? (
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E1E2E]">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-white truncate">
                    {selected.visitor_name || `Visiteur ${selected.session_id.slice(0, 8)}`}
                  </div>
                  <p className="text-[11px] text-[#888] mt-0.5 font-mono">
                    {selected.session_id.slice(0, 24)}…
                  </p>
                </div>
                <div className="flex gap-2">
                  {selected.status !== "human_takeover" ? (
                    <Button size="sm" onClick={handleTakeOver}
                      className="rounded-[10px] text-white border-0 hover:opacity-90"
                      style={{ background: "#7C3AED" }}>
                      <User className="h-4 w-4 mr-1" /> Prendre la relève
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={handleGiveBack}
                      className="rounded-[10px] border-[#1E1E2E] bg-transparent text-white hover:bg-[#1E1E2E]">
                      <Bot className="h-4 w-4 mr-1" /> Redonner au bot
                    </Button>
                  )}
                </div>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.map((m) => (
                    <div key={m.id} className={cn("flex", m.role === "visitor" ? "justify-start" : "justify-end")}>
                      <div
                        className="max-w-[75%] rounded-[10px] px-3.5 py-2.5 text-sm"
                        style={
                          m.role === "visitor"
                            ? { background: "#1E1E2E", color: "white" }
                            : m.role === "admin"
                              ? { background: "#7C3AED", color: "white" }
                              : { background: "#0D0D1A", color: "white", border: "1px solid #1E1E2E" }
                        }
                      >
                        <div className="text-[10px] opacity-80 mb-1 uppercase tracking-wider font-semibold">
                          {m.role === "visitor"
                            ? "Visiteur"
                            : m.role === "admin"
                              ? `👤 ${m.admin_name || "Agent Nivra"}`
                              : "🤖 Bot Nivra"}
                        </div>
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {selected.status === "human_takeover" && (
                <div className="border-t border-[#1E1E2E] p-3 flex gap-2">
                  <Input
                    placeholder="Réponse en tant que Agent Nivra…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); }
                    }}
                    disabled={sending}
                    className="bg-[#1E1E2E] border-[#1E1E2E] text-white placeholder:text-[#888] rounded-[10px]"
                  />
                  <Button onClick={handleSendReply} disabled={sending || !reply.trim()}
                    className="rounded-[10px] text-white border-0"
                    style={{ background: "#7C3AED" }}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-[#888]">
              Sélectionnez une conversation pour la consulter
            </div>
          )}
        </MKCard>
      </div>
    </MKPage>
  );
};

export default MarketingLiveChatPage;
