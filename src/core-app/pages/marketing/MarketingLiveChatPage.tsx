/**
 * MarketingLiveChatPage — Live chat management for the public site chatbot.
 * Shows all active chatbot sessions in real time, with takeover controls.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Bot, User, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

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

    // Reset unread counter
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
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId]);

  const selected = useMemo(() => sessions.find((s) => s.session_id === selectedId) ?? null, [sessions, selectedId]);

  const handleTakeOver = async () => {
    if (!selected) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("live_chat_sessions")
      .update({
        status: "human_takeover",
        taken_over_by: user.id,
        taken_over_at: new Date().toISOString(),
      })
      .eq("session_id", selected.session_id);
    if (error) toast.error(error.message);
    else toast.success("Vous avez pris la relève");
  };

  const handleGiveBack = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("live_chat_sessions")
      .update({ status: "bot_active", taken_over_by: null, taken_over_at: null })
      .eq("session_id", selected.session_id);
    if (error) toast.error(error.message);
    else toast.success("Conversation rendue au chatbot");
  };

  const handleSendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSending(false);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();
    const adminName = profile
      ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Agent Nivra"
      : "Agent Nivra";

    const { error } = await supabase.from("live_chat_admin_replies").insert({
      session_id: selected.session_id,
      admin_user_id: user.id,
      admin_name: adminName,
      message: reply.trim(),
    });
    if (error) {
      toast.error(error.message);
    } else {
      setReply("");
      await supabase
        .from("live_chat_sessions")
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Chat</h1>
          <p className="text-sm text-muted-foreground">
            Conversations en cours sur le site web — temps réel
          </p>
        </div>
        {waitingCount > 0 && (
          <Badge variant="destructive" className="text-sm">
            <Clock className="mr-1 h-3 w-3" /> {waitingCount} en attente &gt; 2 min
          </Badge>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* Sessions list */}
        <Card className="lg:h-[calc(100vh-200px)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Sessions actives ({sessions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-280px)]">
              {loading ? (
                <div className="p-4 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
              ) : sessions.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Aucune conversation active
                </div>
              ) : (
                <div className="divide-y">
                  {sessions.map((s) => {
                    const ageMin = s.last_visitor_message_at
                      ? Math.floor((Date.now() - +new Date(s.last_visitor_message_at)) / 60_000)
                      : 0;
                    const isWaiting = s.status !== "human_takeover" && ageMin > 2;
                    return (
                      <button
                        key={s.session_id}
                        onClick={() => setSelectedId(s.session_id)}
                        className={`w-full text-left p-3 hover:bg-muted/50 transition ${
                          selectedId === s.session_id ? "bg-muted" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {s.visitor_name || `Visiteur ${s.session_id.slice(0, 6)}`}
                              </span>
                              {s.unread_for_admin > 0 && (
                                <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                                  {s.unread_for_admin}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={s.status === "human_takeover" ? "default" : "secondary"} className="text-[10px]">
                                {s.status === "human_takeover" ? "👤 Humain" : "🤖 Bot"}
                              </Badge>
                              {isWaiting && (
                                <Badge variant="destructive" className="text-[10px]">
                                  <Clock className="h-2.5 w-2.5 mr-0.5" /> {ageMin}min
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
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
          </CardContent>
        </Card>

        {/* Conversation view */}
        <Card className="lg:h-[calc(100vh-200px)] flex flex-col">
          {selected ? (
            <>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {selected.visitor_name || `Visiteur ${selected.session_id.slice(0, 8)}`}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Session : {selected.session_id.slice(0, 16)}…
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {selected.status !== "human_takeover" ? (
                      <Button size="sm" onClick={handleTakeOver}>
                        <User className="h-4 w-4 mr-1" /> Prendre la relève
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={handleGiveBack}>
                        <Bot className="h-4 w-4 mr-1" /> Redonner au bot
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 flex flex-col">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.role === "visitor" ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                            m.role === "visitor"
                              ? "bg-muted"
                              : m.role === "admin"
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary"
                          }`}
                        >
                          <div className="text-[10px] opacity-70 mb-0.5">
                            {m.role === "visitor"
                              ? "Visiteur"
                              : m.role === "admin"
                              ? m.admin_name || "Agent Nivra"
                              : "🤖 Bot"}
                          </div>
                          <div className="whitespace-pre-wrap break-words">{m.content}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {selected.status === "human_takeover" && (
                  <div className="border-t p-3 flex gap-2">
                    <Input
                      placeholder="Réponse en tant que Agent Nivra…"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                      disabled={sending}
                    />
                    <Button onClick={handleSendReply} disabled={sending || !reply.trim()}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Sélectionnez une conversation pour la consulter
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default MarketingLiveChatPage;
