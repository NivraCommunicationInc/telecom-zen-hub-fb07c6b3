import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle,
  X,
  Send,
  Minus,
  RotateCcw,
  Loader2,
  LogIn,
  ChevronRight,
  Paperclip,
  FileText,
  Smile,
  CheckCheck,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  uploadChatAttachment,
  getChatAttachmentSignedUrl,
  isImageType,
  isPdfType,
  validateChatFile,
} from "@/lib/chatAttachments";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isHumanAgent?: boolean;
  agentName?: string;
  attachmentUrl?: string;
  attachmentPath?: string;
  attachmentName?: string;
  attachmentType?: string;
  seenByAdmin?: boolean;
}

interface SuggestedAction {
  label: string;
  action: string;
}

const QUICK_ACTIONS_FR = [
  { icon: "📦", label: "Magasiner les forfaits", message: "Quels forfaits offrez-vous?" },
  { icon: "📋", label: "Suivre une commande", message: "Je veux suivre ma commande" },
  { icon: "💳", label: "Vérifier mon solde", message: "Quel est mon solde de compte?" },
  { icon: "👤", label: "Parler à un agent", message: "Je veux parler à un agent humain" },
];

const QUICK_ACTIONS_EN = [
  { icon: "📦", label: "Shop plans", message: "What plans do you offer?" },
  { icon: "📋", label: "Track an order", message: "I want to track my order" },
  { icon: "💳", label: "Check my balance", message: "What is my account balance?" },
  { icon: "👤", label: "Talk to an agent", message: "I want to talk to a human agent" },
];

const EMOJIS = ["😀", "😊", "👍", "🙏", "❤️", "😂", "🎉", "✅", "❓", "👋", "💬", "📞"];

const SESSION_TTL_MS = 20 * 60 * 1000; // 20 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000; // warn 2 min before close
const STORAGE_KEY = "nivra_chat_session_v2";

interface PersistedSession {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
}

const loadPersistedSession = (): PersistedSession | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (new Date(parsed.expiresAt) <= new Date()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const persistSession = (sessionId: string) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      sessionId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }),
  );
};

const NivraChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => {
    const persisted = loadPersistedSession();
    return persisted?.sessionId ?? crypto.randomUUID();
  });
  const [verifiedClientId, setVerifiedClientId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [humanTakeover, setHumanTakeover] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [adminTyping, setAdminTyping] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const sessionPersistedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adminTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { language } = useLanguage();
  const fr = language === "fr";

  /* ─────────── Auth ─────────── */
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session?.user);
    };
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthenticated(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  /* ─────────── Global "open chat" bus ─────────── */
  useEffect(() => {
    const handler = () => {
      setIsOpen(true);
      setUnreadCount(0);
    };
    window.addEventListener("nivra:open-chat", handler);
    return () => window.removeEventListener("nivra:open-chat", handler);
  }, []);

  /* ─────────── Helpers ─────────── */
  const formatTime = (date: Date) =>
    date.toLocaleTimeString(fr ? "fr-CA" : "en-CA", { hour: "2-digit", minute: "2-digit" });

  const persistMessageRow = useCallback(
    async (row: {
      role: "visitor" | "bot" | "admin";
      content?: string | null;
      attachment_url?: string | null;
      attachment_path?: string | null;
      attachment_name?: string | null;
      attachment_type?: string | null;
      attachment_size?: number | null;
    }) => {
      try {
        await supabase.from("live_chat_messages").insert({
          session_id: sessionId,
          ...row,
        });
      } catch (e) {
        console.warn("[NivraChat] persist message failed", e);
      }
    },
    [sessionId],
  );

  /* ─────────── Load history on mount (resume session) ─────────── */
  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      const persisted = loadPersistedSession();
      if (!persisted) {
        // Fresh session — write welcome lazily on open
        return;
      }
      const { data, error } = await supabase
        .from("live_chat_messages")
        .select("*")
        .eq("session_id", persisted.sessionId)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error || !data || cancelled) return;
      if (data.length === 0) return;

      // Refresh signed URLs for any stored attachments (signed URL TTL = 1h)
      const restored: Message[] = await Promise.all(
        data.map(async (m: any) => {
          let attachmentUrl: string | undefined = m.attachment_url ?? undefined;
          if (m.attachment_path) {
            const fresh = await getChatAttachmentSignedUrl(m.attachment_path);
            if (fresh) attachmentUrl = fresh;
          }
          return {
            id: m.id,
            role: m.role === "visitor" ? "user" : "assistant",
            content: m.content ?? "",
            timestamp: new Date(m.created_at),
            isHumanAgent: m.role === "admin",
            agentName: m.admin_name ?? undefined,
            attachmentUrl,
            attachmentPath: m.attachment_path ?? undefined,
            attachmentName: m.attachment_name ?? undefined,
            attachmentType: m.attachment_type ?? undefined,
            seenByAdmin: !!m.admin_seen_at,
          } as Message;
        }),
      );

      if (cancelled) return;
      setMessages(restored);
      // Detect takeover state from session row
      const { data: sess } = await supabase
        .from("live_chat_sessions")
        .select("status")
        .eq("session_id", persisted.sessionId)
        .maybeSingle();
      if (sess?.status === "human_takeover") setHumanTakeover(true);
    };
    loadHistory();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─────────── Welcome message (only if no history) ─────────── */
  useEffect(() => {
    if (isOpen && messages.length === 0 && !sessionClosed) {
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fr
            ? "Bonjour, bienvenue chez Nivra Télécom. Je suis ici pour vous aider avec vos services, vos commandes ou toute autre question. Comment puis-je vous aider aujourd'hui?"
            : "Hello, welcome to Nivra Telecom. I'm here to help with your services, orders or any other questions. How can I help you today?",
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length, fr, sessionClosed]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading, adminTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  /* ─────────── Realtime: admin replies, session status, message updates (read receipts), typing ─────────── */
  useEffect(() => {
    const channel = supabase
      .channel(`admin-replies-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_chat_admin_replies",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: any) => {
          const r = payload.new;
          setHumanTakeover(true);
          setAgentName(r.admin_name || (fr ? "Agent Nivra" : "Nivra Agent"));
          setAdminTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              id: r.id,
              role: "assistant",
              content: r.message,
              timestamp: new Date(r.created_at),
              isHumanAgent: true,
              agentName: r.admin_name || undefined,
            },
          ]);
          if (!isOpen) setUnreadCount((prev) => prev + 1);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: any) => {
          const m = payload.new;
          if (m.role !== "admin") return; // visitor/bot messages are added optimistically
          // de-dupe with already added admin reply rows
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [
              ...prev,
              {
                id: m.id,
                role: "assistant",
                content: m.content || "",
                timestamp: new Date(m.created_at),
                isHumanAgent: true,
                agentName: m.admin_name || undefined,
                attachmentUrl: m.attachment_url || undefined,
                attachmentPath: m.attachment_path || undefined,
                attachmentName: m.attachment_name || undefined,
                attachmentType: m.attachment_type || undefined,
              },
            ];
          });
          setHumanTakeover(true);
          if (!isOpen) setUnreadCount((prev) => prev + 1);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: any) => {
          const m = payload.new;
          if (!m.admin_seen_at) return;
          setMessages((prev) =>
            prev.map((x) => (x.id === m.id ? { ...x, seenByAdmin: true } : x)),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_chat_sessions",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: any) => {
          const s = payload.new;
          if (s.status === "human_takeover") setHumanTakeover(true);
          else if (s.status === "bot_active") {
            setHumanTakeover(false);
            setAgentName(null);
          }
        },
      )
      .on("broadcast", { event: "admin_typing" }, (payload: any) => {
        if (payload.payload?.typing) {
          setAdminTyping(true);
          if (adminTypingTimeoutRef.current) clearTimeout(adminTypingTimeoutRef.current);
          adminTypingTimeoutRef.current = setTimeout(() => setAdminTyping(false), 4000);
        } else {
          setAdminTyping(false);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (adminTypingTimeoutRef.current) clearTimeout(adminTypingTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, fr]);

  /* ─────────── 20-minute inactivity timeout ─────────── */
  const closeSessionForInactivity = useCallback(async () => {
    setSessionClosed(true);
    setShowInactivityWarning(false);
    localStorage.removeItem(STORAGE_KEY);
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fr
          ? "Cette conversation a été fermée après 20 minutes d'inactivité. Écrivez-nous pour démarrer une nouvelle conversation."
          : "This conversation was closed after 20 minutes of inactivity. Send us a message to start a new one.",
        timestamp: new Date(),
      },
    ]);
    try {
      await supabase
        .from("live_chat_sessions")
        .update({ status: "closed" })
        .eq("session_id", sessionId);
    } catch {}
  }, [sessionId, fr]);

  const resetInactivityTimer = useCallback(() => {
    if (sessionClosed) return;
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setShowInactivityWarning(false);
    warningTimerRef.current = setTimeout(
      () => setShowInactivityWarning(true),
      SESSION_TTL_MS - WARNING_BEFORE_MS,
    );
    inactivityTimerRef.current = setTimeout(closeSessionForInactivity, SESSION_TTL_MS);
  }, [closeSessionForInactivity, sessionClosed]);

  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, []);

  /* ─────────── Session row management ─────────── */
  const ensureSessionExists = useCallback(async () => {
    if (sessionPersistedRef.current) return;
    sessionPersistedRef.current = true;
    persistSession(sessionId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const profile = session?.user
        ? await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", session.user.id)
            .maybeSingle()
        : { data: null as any };
      await supabase.from("live_chat_sessions").upsert(
        {
          session_id: sessionId,
          status: "bot_active",
          visitor_user_id: session?.user?.id ?? null,
          visitor_name: profile.data?.full_name ?? null,
          visitor_email: profile.data?.email ?? null,
          current_page: typeof window !== "undefined" ? window.location.pathname : null,
          language,
          last_message_at: new Date().toISOString(),
          last_visitor_message_at: new Date().toISOString(),
          unread_for_admin: 1,
        },
        { onConflict: "session_id" },
      );
    } catch (e) {
      console.warn("[NivraChat] session upsert failed", e);
    }
  }, [sessionId, language]);

  const bumpSessionActivity = useCallback(async () => {
    try {
      await supabase
        .from("live_chat_sessions")
        .update({
          last_message_at: new Date().toISOString(),
          last_visitor_message_at: new Date().toISOString(),
          unread_for_admin: humanTakeover ? 1 : 0,
        })
        .eq("session_id", sessionId);
    } catch {}
  }, [sessionId, humanTakeover]);

  const getConversationHistory = useCallback(() => {
    return messages.slice(1).map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  /* ─────────── Sending ─────────── */
  const sendMessage = async (text?: string) => {
    if (sessionClosed) {
      // Fresh session
      const newId = crypto.randomUUID();
      setSessionId(newId);
      sessionPersistedRef.current = false;
      setSessionClosed(false);
      setMessages([]);
      setHumanTakeover(false);
      setAgentName(null);
      // continue on next tick — re-call after state update
      setTimeout(() => sendMessage(text), 0);
      return;
    }

    const messageText = (text ?? input).trim();
    if (!messageText || isLoading) return;

    const userMsgId = crypto.randomUUID();
    const userMessage: Message = {
      id: userMsgId,
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setSuggestedActions([]);
    resetInactivityTimer();

    await ensureSessionExists();
    persistSession(sessionId);
    await bumpSessionActivity();
    await persistMessageRow({ role: "visitor", content: messageText });

    try {
      const response = await supabase.functions.invoke("chatbot-jonathan", {
        body: {
          message: messageText,
          sessionId,
          language,
          conversationHistory: getConversationHistory(),
          verifiedClientId,
        },
      });

      if (response.error) throw response.error;

      if (response.data?.humanTakeover) {
        setHumanTakeover(true);
        setIsLoading(false);
        return;
      }

      if (response.data.verifiedClientId && !verifiedClientId) {
        setVerifiedClientId(response.data.verifiedClientId);
      }

      if (response.data.suggestedActions) {
        setSuggestedActions(response.data.suggestedActions);
      }

      const botContent =
        response.data.response ||
        (fr ? "Désolé, une erreur s'est produite." : "Sorry, an error occurred.");

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: botContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      await persistMessageRow({ role: "bot", content: botContent });

      if (!isOpen) setUnreadCount((prev) => prev + 1);
    } catch (error) {
      console.error("Chatbot error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fr
            ? "Désolé, une erreur s'est produite. Veuillez réessayer."
            : "Sorry, an error occurred. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  /* ─────────── File attachment ─────────── */
  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so same file can be re-picked
    if (!file) return;
    const v = validateChatFile(file);
    if (!v.ok) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: v.error || (fr ? "Fichier non supporté" : "Unsupported file"),
          timestamp: new Date(),
        },
      ]);
      return;
    }
    setUploading(true);
    resetInactivityTimer();
    await ensureSessionExists();
    persistSession(sessionId);
    const uploaded = await uploadChatAttachment(sessionId, "visitor", file);
    setUploading(false);
    if (!uploaded) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fr ? "Échec du téléversement." : "Upload failed.",
          timestamp: new Date(),
        },
      ]);
      return;
    }
    const localId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: localId,
        role: "user",
        content: "",
        timestamp: new Date(),
        attachmentUrl: uploaded.url,
        attachmentPath: uploaded.path,
        attachmentName: uploaded.name,
        attachmentType: uploaded.type,
      },
    ]);
    await bumpSessionActivity();
    await persistMessageRow({
      role: "visitor",
      content: null,
      attachment_url: uploaded.url,
      attachment_path: uploaded.path,
      attachment_name: uploaded.name,
      attachment_type: uploaded.type,
      attachment_size: uploaded.size,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetConversation = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    localStorage.removeItem(STORAGE_KEY);
    sessionPersistedRef.current = false;
    setSessionId(crypto.randomUUID());
    setMessages([]);
    setSuggestedActions([]);
    setVerifiedClientId(null);
    setHumanTakeover(false);
    setAgentName(null);
    setSessionClosed(false);
    setShowInactivityWarning(false);
  };

  const insertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const quickActions = fr ? QUICK_ACTIONS_FR : QUICK_ACTIONS_EN;
  const showWelcomePanel = messages.length <= 1 && !isLoading;

  const renderMarkdown = (content: string) => (
    <ReactMarkdown
      components={{
        a: ({ href, children }) => {
          if (href?.startsWith("/")) {
            return (
              <Link
                to={href}
                className="text-accent underline decoration-accent/40 hover:decoration-accent font-medium transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {children}
              </Link>
            );
          }
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-accent/40 hover:decoration-accent"
            >
              {children}
            </a>
          );
        },
        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        h1: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
        h2: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
        h3: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
      }}
    >
      {content}
    </ReactMarkdown>
  );

  const renderAttachment = (msg: Message) => {
    if (!msg.attachmentUrl) return null;
    if (isImageType(msg.attachmentType)) {
      return (
        <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block mt-1">
          <img
            src={msg.attachmentUrl}
            alt={msg.attachmentName || "attachment"}
            className="rounded-md max-w-[200px] max-h-[200px] object-cover border border-border"
            loading="lazy"
          />
        </a>
      );
    }
    if (isPdfType(msg.attachmentType)) {
      return (
        <a
          href={msg.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex items-center gap-2 px-3 py-2 bg-background/40 border border-border/40 rounded-md hover:bg-background/60 transition-colors"
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span className="text-xs truncate">{msg.attachmentName || "document.pdf"}</span>
        </a>
      );
    }
    return (
      <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline mt-1 block">
        {msg.attachmentName || (fr ? "Pièce jointe" : "Attachment")}
      </a>
    );
  };

  return (
    <>
      {/* ── Launcher ── */}
      <button
        onClick={() => {
          setIsOpen(true);
          setUnreadCount(0);
        }}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 pl-4 pr-5 h-12",
          "bg-primary text-primary-foreground rounded-lg",
          "shadow-md hover:shadow-lg transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2",
          isOpen && "scale-0 opacity-0 pointer-events-none",
        )}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        <MessageCircle className="w-[18px] h-[18px]" />
        <span className="text-sm font-medium">{fr ? "Clavardage" : "Chat"}</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 flex items-center justify-center bg-destructive text-destructive-foreground text-[11px] font-bold rounded-full animate-in zoom-in">
            {unreadCount}
          </span>
        )}
      </button>

      {/* ── Chat Window ── */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-50 flex flex-col bg-background border border-border overflow-hidden",
            "shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
            "bottom-6 right-6 w-[380px] rounded-lg",
            "max-sm:inset-0 max-sm:w-full max-sm:rounded-none",
          )}
          style={{ height: "min(580px, calc(100dvh - 48px))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-14 bg-primary text-primary-foreground shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-md bg-primary-foreground/15 flex items-center justify-center text-sm font-bold">
                  N
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-accent rounded-full border-2 border-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">
                  {humanTakeover ? agentName || (fr ? "Agent Nivra" : "Nivra Agent") : "Nivra"}
                </p>
                <p className="text-[11px] text-primary-foreground/70 leading-tight">
                  {humanTakeover
                    ? fr
                      ? "Agent humain en ligne"
                      : "Live human agent"
                    : fr
                    ? "Support client • En ligne"
                    : "Customer support • Online"}
                </p>
              </div>
              {humanTakeover && (
                <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-foreground/20 text-primary-foreground">
                  LIVE
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={resetConversation}
                className="p-2 hover:bg-primary-foreground/10 rounded-md transition-colors"
                title={fr ? "Nouvelle conversation" : "New conversation"}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-primary-foreground/10 rounded-md transition-colors"
                title={fr ? "Réduire" : "Minimize"}
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-primary-foreground/10 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Inactivity warning */}
          {showInactivityWarning && !sessionClosed && (
            <div className="px-4 py-2 bg-amber-100 border-b border-amber-200 text-amber-900 text-xs">
              {fr
                ? "Cette conversation se fermera dans 2 minutes en raison d'inactivité."
                : "This conversation will close in 2 minutes due to inactivity."}
            </div>
          )}

          {/* Auth bar */}
          {!isAuthenticated && !verifiedClientId && (
            <div className="flex items-center justify-between px-4 py-2 bg-secondary border-b border-border shrink-0">
              <span className="text-xs text-muted-foreground">
                {fr ? "Connectez-vous pour accéder à votre compte" : "Log in to access your account"}
              </span>
              <Link to="/portal/auth" onClick={() => setIsOpen(false)}>
                <button className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                  <LogIn className="w-3 h-3" />
                  {fr ? "Connexion" : "Login"}
                </button>
              </Link>
            </div>
          )}

          {/* Messages area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
            {showWelcomePanel && (
              <div className="px-4 pt-4 pb-2">
                <div className="mb-4">
                  {messages[0] && (
                    <div className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-primary">N</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-muted-foreground mb-1 font-medium">
                          Nivra • {formatTime(messages[0].timestamp)}
                        </p>
                        <div className="text-[13px] text-foreground leading-relaxed">
                          {renderMarkdown(messages[0].content)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                    {fr ? "Actions rapides" : "Quick actions"}
                  </p>
                  {quickActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(action.message)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-[13px] font-medium text-foreground bg-background border border-border rounded-md hover:bg-secondary hover:border-border/80 transition-colors group"
                    >
                      <span className="text-base">{action.icon}</span>
                      <span className="flex-1">{action.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!showWelcomePanel && (
              <div className="px-4 py-3 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-200",
                      message.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {message.role === "assistant" && (
                      <div
                        className={cn(
                          "w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                          message.isHumanAgent
                            ? "bg-[#7C3AED]/15 ring-2 ring-[#7C3AED]/30"
                            : "bg-primary/10",
                        )}
                      >
                        <span
                          className={cn(
                            "text-xs font-bold",
                            message.isHumanAgent ? "text-[#7C3AED]" : "text-primary",
                          )}
                        >
                          N
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col max-w-[78%] min-w-0">
                      <p
                        className={cn(
                          "text-[11px] text-muted-foreground mb-0.5 font-medium",
                          message.role === "user" ? "text-right" : "text-left",
                        )}
                      >
                        {message.role === "assistant"
                          ? message.isHumanAgent
                            ? `${message.agentName || (fr ? "Agent Nivra" : "Nivra Agent")} • ${formatTime(message.timestamp)}`
                            : `Nivra • ${formatTime(message.timestamp)}`
                          : `${fr ? "Vous" : "You"} • ${formatTime(message.timestamp)}`}
                      </p>
                      <div
                        className={cn(
                          "px-3 py-2 text-[13px] leading-relaxed",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground rounded-lg rounded-br-sm"
                            : message.isHumanAgent
                            ? "bg-[#7C3AED]/10 text-foreground border border-[#7C3AED]/30 rounded-lg rounded-bl-sm"
                            : "bg-secondary text-foreground border border-border rounded-lg rounded-bl-sm",
                        )}
                      >
                        {message.content && (message.role === "assistant"
                          ? renderMarkdown(message.content)
                          : <span className="whitespace-pre-wrap break-words">{message.content}</span>)}
                        {renderAttachment(message)}
                      </div>
                      {message.role === "user" && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 text-right flex items-center justify-end gap-0.5">
                          {message.seenByAdmin ? (
                            <>
                              <CheckCheck className="w-3 h-3 text-[#7C3AED]" />
                              <span className="text-[#7C3AED]">{fr ? "Vu" : "Seen"}</span>
                            </>
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </p>
                      )}
                    </div>
                    {message.role === "user" && (
                      <div className="w-7 h-7 rounded-md bg-primary/8 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-semibold text-primary">{fr ? "V" : "Y"}</span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Bot typing */}
                {isLoading && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">N</span>
                    </div>
                    <div className="bg-secondary border border-border rounded-lg rounded-bl-sm px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                        <span className="text-xs text-muted-foreground">
                          {fr ? "Nivra rédige une réponse…" : "Nivra is typing…"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Admin typing indicator */}
                {adminTyping && !isLoading && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="w-7 h-7 rounded-md bg-[#7C3AED]/15 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-[#7C3AED]">N</span>
                    </div>
                    <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/30 rounded-lg rounded-bl-sm px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#7C3AED]">
                          {fr ? "Agent Nivra est en train d'écrire" : "Nivra Agent is typing"}
                        </span>
                        <span className="flex gap-0.5">
                          <span className="w-1 h-1 bg-[#7C3AED] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1 h-1 bg-[#7C3AED] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1 h-1 bg-[#7C3AED] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Suggestions */}
          {suggestedActions.length > 0 && !isLoading && !showWelcomePanel && (
            <div className="px-4 pb-2 shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {suggestedActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(action.label)}
                    className="text-xs px-3 py-1.5 text-accent font-medium border border-accent/20 rounded-md hover:bg-accent/5 transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Emoji picker */}
          {showEmoji && (
            <div className="border-t border-border px-3 py-2 bg-background flex flex-wrap gap-1 shrink-0">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="text-lg w-8 h-8 flex items-center justify-center hover:bg-secondary rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border px-3 py-2.5 bg-background shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
              onChange={handleFilePicked}
              className="hidden"
            />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex items-end gap-1.5"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || isLoading}
                className="h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-40 transition-colors"
                title={fr ? "Joindre un fichier" : "Attach a file"}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setShowEmoji((v) => !v)}
                className="h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary transition-colors"
                title={fr ? "Emojis" : "Emojis"}
              >
                <Smile className="w-4 h-4" />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  resetInactivityTimer();
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  sessionClosed
                    ? fr
                      ? "Écrivez pour démarrer une nouvelle conversation…"
                      : "Type to start a new conversation…"
                    : fr
                    ? "Écrivez votre message…"
                    : "Type your message…"
                }
                disabled={isLoading}
                rows={1}
                className={cn(
                  "flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-[13px]",
                  "focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40",
                  "placeholder:text-muted-foreground disabled:opacity-50",
                  "max-h-[80px] min-h-[36px]",
                )}
                style={{ height: "36px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "36px";
                  target.style.height = Math.min(target.scrollHeight, 80) + "px";
                }}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className={cn(
                  "h-9 w-9 flex items-center justify-center rounded-md shrink-0 transition-colors",
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default NivraChat;
