/**
 * MarketingLiveChatPage — Live chat admin (Nivra dark theme).
 * Backend logic preserved: live_chat_sessions + chatbot_logs + live_chat_admin_replies + live_chat_messages.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageCircle,
  Send,
  Bot,
  User,
  Clock,
  Loader2,
  AlertTriangle,
  Paperclip,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { MKPage, MKCard, MKCardHeader } from "./_marketing-ui";
import { cn } from "@/lib/utils";
import {
  uploadChatAttachment,
  getChatAttachmentSignedUrl,
  isImageType,
  isPdfType,
  validateChatFile,
} from "@/lib/chatAttachments";

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
  attachment_url?: string | null;
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
}

const MarketingLiveChatPage = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const refreshAttachmentUrls = async (msgs: ChatMessage[]): Promise<ChatMessage[]> => {
    const out: ChatMessage[] = [];
    for (const m of msgs) {
      if (m.attachment_path) {
        const fresh = await getChatAttachmentSignedUrl(m.attachment_path);
        out.push({ ...m, attachment_url: fresh ?? m.attachment_url ?? null });
      } else {
        out.push(m);
      }
    }
    return out;
  };

  const loadMessages = async (sessionId: string) => {
    // Prefer the canonical live_chat_messages table; fall back to legacy logs/replies if empty.
    const { data: canon } = await supabase
      .from("live_chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    let merged: ChatMessage[] = [];

    if (canon && canon.length > 0) {
      merged = canon.map((m: any) => ({
        id: m.id,
        role: m.role as "visitor" | "bot" | "admin",
        content: m.content ?? "",
        created_at: m.created_at,
        admin_name: m.admin_name ?? null,
        attachment_url: m.attachment_url ?? null,
        attachment_path: m.attachment_path ?? null,
        attachment_name: m.attachment_name ?? null,
        attachment_type: m.attachment_type ?? null,
      }));
    } else {
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

      (logs ?? []).forEach((l: any) => {
        merged.push({
          id: `${l.id}-u`,
          role: "visitor",
          content: l.user_message,
          created_at: l.created_at,
        });
        if (l.bot_response) {
          merged.push({
            id: `${l.id}-b`,
            role: "bot",
            content: l.bot_response,
            created_at: l.created_at,
          });
        }
      });
      (replies ?? []).forEach((r: any) =>
        merged.push({
          id: r.id,
          role: "admin",
          content: r.message,
          created_at: r.created_at,
          admin_name: r.admin_name,
        }),
      );
      merged.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    }

    const withFreshUrls = await refreshAttachmentUrls(merged);
    setMessages(withFreshUrls);

    // Mark visitor messages as seen by admin (read receipts)
    const unseenVisitorIds = (canon ?? [])
      .filter((m: any) => m.role === "visitor" && !m.admin_seen_at)
      .map((m: any) => m.id);
    if (unseenVisitorIds.length > 0) {
      await supabase
        .from("live_chat_messages")
        .update({ admin_seen_at: new Date().toISOString() })
        .in("id", unseenVisitorIds);
    }

    await supabase
      .from("live_chat_sessions")
      .update({ unread_for_admin: 0 })
      .eq("session_id", sessionId);
  };

  useEffect(() => {
    loadSessions();
    const channel = supabase
      .channel("marketing-live-chat")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_chat_sessions" }, () =>
        loadSessions(),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chatbot_logs" }, (payload: any) => {
        if (selectedId && payload.new?.session_id === selectedId) loadMessages(selectedId);
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_chat_admin_replies" },
        (payload: any) => {
          if (selectedId && payload.new?.session_id === selectedId) loadMessages(selectedId);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_chat_messages" },
        (payload: any) => {
          if (selectedId && payload.new?.session_id === selectedId) loadMessages(selectedId);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId]);

  // Typing broadcast channel scoped to selected session
  useEffect(() => {
    if (!selectedId) return;
    const ch = supabase.channel(`admin-replies-${selectedId}`);
    ch.subscribe();
    typingChannelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      typingChannelRef.current = null;
    };
  }, [selectedId]);

  const broadcastTyping = (typing: boolean) => {
    if (!typingChannelRef.current) return;
    typingChannelRef.current.send({
      type: "broadcast",
      event: "admin_typing",
      payload: { typing },
    });
  };

  const handleReplyChange = (val: string) => {
    setReply(val);
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    if (val.trim().length > 0) {
      broadcastTyping(true);
      typingDebounceRef.current = setTimeout(() => broadcastTyping(false), 2500);
    } else {
      broadcastTyping(false);
    }
  };

  const selected = useMemo(
    () => sessions.find((s) => s.session_id === selectedId) ?? null,
    [sessions, selectedId],
  );

  const handleTakeOver = async () => {
    if (!selected) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
    else toast.success("Conversation rendue au bot");
  };

  const sendAdminMessage = async (opts: {
    content?: string;
    attachment?: {
      url: string;
      path: string;
      name: string;
      type: string;
      size: number;
    };
  }) => {
    if (!selected) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();
    const adminName = profile
      ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Agent Nivra"
      : "Agent Nivra";

    // 1. legacy admin_replies (kept for backward compat — text only)
    if (opts.content && opts.content.trim()) {
      const { error } = await supabase.from("live_chat_admin_replies").insert({
        session_id: selected.session_id,
        admin_user_id: user.id,
        admin_name: adminName,
        message: opts.content.trim(),
      });
      if (error) {
        toast.error(error.message);
        return;
      }
    }

    // 2. canonical live_chat_messages row (carries attachments)
    await supabase.from("live_chat_messages").insert({
      session_id: selected.session_id,
      role: "admin",
      content: opts.content?.trim() || null,
      admin_user_id: user.id,
      admin_name: adminName,
      attachment_url: opts.attachment?.url ?? null,
      attachment_path: opts.attachment?.path ?? null,
      attachment_name: opts.attachment?.name ?? null,
      attachment_type: opts.attachment?.type ?? null,
      attachment_size: opts.attachment?.size ?? null,
    });

    await supabase
      .from("live_chat_sessions")
      .update({ last_message_at: new Date().toISOString() })
      .eq("session_id", selected.session_id);
  };

  const handleSendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    broadcastTyping(false);
    await sendAdminMessage({ content: reply.trim() });
    setReply("");
    setSending(false);
  };

  const handleAdminFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected) return;
    const v = validateChatFile(file);
    if (!v.ok) {
      toast.error(v.error || "Fichier non supporté");
      return;
    }
    setUploading(true);
    const uploaded = await uploadChatAttachment(selected.session_id, "admin", file);
    setUploading(false);
    if (!uploaded) {
      toast.error("Échec du téléversement");
      return;
    }
    await sendAdminMessage({ attachment: uploaded });
  };

  const waitingCount = sessions.filter((s) => {
    if (!s.last_visitor_message_at) return false;
    const ageMs = Date.now() - +new Date(s.last_visitor_message_at);
    return s.status !== "human_takeover" && ageMs > 2 * 60_000;
  }).length;

  const renderMsgAttachment = (m: ChatMessage) => {
    if (!m.attachment_url) return null;
    if (isImageType(m.attachment_type)) {
      return (
        <a
          href={m.attachment_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-1.5"
        >
          <img
            src={m.attachment_url}
            alt={m.attachment_name || "attachment"}
            className="rounded-md max-w-[200px] max-h-[200px] object-cover border border-white/20"
            loading="lazy"
          />
        </a>
      );
    }
    if (isPdfType(m.attachment_type)) {
      return (
        <a
          href={m.attachment_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-2 px-2.5 py-1.5 bg-black/30 border border-white/15 rounded-md text-xs hover:bg-black/40 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          <span className="truncate max-w-[180px]">{m.attachment_name || "document.pdf"}</span>
        </a>
      );
    }
    return (
      <a
        href={m.attachment_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 inline-flex items-center gap-1.5 text-xs underline"
      >
        <ImageIcon className="w-3.5 h-3.5" />
        {m.attachment_name || "Pièce jointe"}
      </a>
    );
  };

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
              <div className="p-4 text-center text-[#888]">
                <Loader2 className="h-5 w-5 animate-spin inline" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#888]">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Aucune conversation
              </div>
            ) : (
              <div className="divide-y divide-[#1E1E2E]">
                {sessions.map((s) => {
                  const ageMin = s.last_visitor_message_at
                    ? Math.floor((Date.now() - +new Date(s.last_visitor_message_at)) / 60_000)
                    : 0;
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
                        isWaiting && "border-l-2 border-l-[#EF4444]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">
                              {s.visitor_name || `Visiteur ${s.session_id.slice(0, 6)}`}
                            </span>
                            {s.unread_for_admin > 0 && (
                              <span
                                className="text-[10px] font-bold px-1.5 rounded-full text-white"
                                style={{ background: "#EF4444" }}
                              >
                                {s.unread_for_admin}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                              style={
                                isHuman
                                  ? { background: "#7C3AED22", color: "#7C3AED" }
                                  : { background: "#1E1E2E", color: "#888" }
                              }
                            >
                              {isHuman ? "👤 Humain" : "🤖 Bot"}
                            </span>
                            {isWaiting && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-0.5"
                                style={{ background: "#EF444422", color: "#EF4444" }}
                              >
                                <Clock className="h-2.5 w-2.5" /> {ageMin}min
                              </span>
                            )}
                          </div>
                          {s.current_page && (
                            <p className="text-[11px] text-[#888] mt-1 truncate">📍 {s.current_page}</p>
                          )}
                          <p className="text-[10px] text-[#888] mt-0.5">
                            {formatDistanceToNow(new Date(s.last_message_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
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
                    <Button
                      size="sm"
                      onClick={handleTakeOver}
                      className="rounded-[10px] text-white border-0 hover:opacity-90"
                      style={{ background: "#7C3AED" }}
                    >
                      <User className="h-4 w-4 mr-1" /> Prendre la relève
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGiveBack}
                      className="rounded-[10px] border-[#1E1E2E] bg-transparent text-white hover:bg-[#1E1E2E]"
                    >
                      <Bot className="h-4 w-4 mr-1" /> Redonner au bot
                    </Button>
                  )}
                </div>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex animate-in fade-in slide-in-from-bottom-1 duration-200",
                        m.role === "visitor" ? "justify-start" : "justify-end",
                      )}
                    >
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
                        {m.content && <div className="whitespace-pre-wrap break-words">{m.content}</div>}
                        {renderMsgAttachment(m)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {selected.status === "human_takeover" && (
                <div className="border-t border-[#1E1E2E] p-3 flex gap-2 items-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                    onChange={handleAdminFile}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || sending}
                    className="rounded-[10px] border-[#1E1E2E] bg-transparent text-white hover:bg-[#1E1E2E] shrink-0"
                    title="Joindre un fichier"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  </Button>
                  <Input
                    placeholder="Réponse en tant que Agent Nivra…"
                    value={reply}
                    onChange={(e) => handleReplyChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                    disabled={sending}
                    className="bg-[#1E1E2E] border-[#1E1E2E] text-white placeholder:text-[#888] rounded-[10px]"
                  />
                  <Button
                    onClick={handleSendReply}
                    disabled={sending || !reply.trim()}
                    className="rounded-[10px] text-white border-0 shrink-0"
                    style={{ background: "#7C3AED" }}
                  >
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
