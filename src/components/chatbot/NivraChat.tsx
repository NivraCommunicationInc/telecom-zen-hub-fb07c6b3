import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Minus, RotateCcw, Loader2, LogIn, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
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

const NivraChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [verifiedClientId, setVerifiedClientId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [humanTakeover, setHumanTakeover] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);
  const sessionPersistedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { language } = useLanguage();

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

  // Listen for global "open chat" events (triggered from Support page, etc.)
  useEffect(() => {
    const handler = () => {
      setIsOpen(true);
      setUnreadCount(0);
    };
    window.addEventListener("nivra:open-chat", handler);
    return () => window.removeEventListener("nivra:open-chat", handler);
  }, []);

  const fr = language === "fr";

  // Welcome message — only set once when chat opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: crypto.randomUUID(),
        role: "assistant",
        content: fr
          ? "Bonjour, bienvenue chez Nivra Télécom. Je suis ici pour vous aider avec vos services, vos commandes ou toute autre question. Comment puis-je vous aider aujourd'hui?"
          : "Hello, welcome to Nivra Telecom. I'm here to help with your services, orders or any other questions. How can I help you today?",
        timestamp: new Date(),
      }]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Subscribe to admin replies and session status changes for this session
  useEffect(() => {
    if (!isOpen) return;
    const channel = supabase
      .channel(`live-chat-${sessionId}`)
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
          setMessages((prev) => [
            ...prev,
            {
              id: r.id,
              role: "assistant",
              content: r.message,
              timestamp: new Date(r.created_at),
            },
          ]);
        }
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
          if (s.status === "human_takeover") {
            setHumanTakeover(true);
          } else if (s.status === "bot_active") {
            setHumanTakeover(false);
            setAgentName(null);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, sessionId, fr]);

  const ensureSessionExists = useCallback(async () => {
    if (sessionPersistedRef.current) return;
    sessionPersistedRef.current = true;
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
        { onConflict: "session_id" }
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
    return messages.slice(1).map(m => ({ role: m.role, content: m.content }));
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setSuggestedActions([]);

    // Persist session row + bump activity so admin can see this visitor live
    await ensureSessionExists();
    await bumpSessionActivity();

    // If admin took over, don't call the bot — visitor message is already
    // persisted into chatbot_logs by the chatbot-jonathan function (which
    // returns immediately on takeover), but the admin must still see it.
    // We log it here too as a safety net via chatbot-jonathan invocation
    // (which short-circuits when status === 'human_takeover').
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

      // If the function reports human takeover, mark UI accordingly and skip the bot bubble
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

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.data.response || (fr ? "Désolé, une erreur s'est produite." : "Sorry, an error occurred."),
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (!isOpen) setUnreadCount(prev => prev + 1);
    } catch (error) {
      console.error("Chatbot error:", error);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fr ? "Désolé, une erreur s'est produite. Veuillez réessayer." : "Sorry, an error occurred. Please try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetConversation = () => {
    setMessages([]);
    setSuggestedActions([]);
    setVerifiedClientId(null);
  };

  const quickActions = fr ? QUICK_ACTIONS_FR : QUICK_ACTIONS_EN;
  const showWelcomePanel = messages.length <= 1 && !isLoading;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(fr ? "fr-CA" : "en-CA", { hour: "2-digit", minute: "2-digit" });
  };

  const renderMarkdown = (content: string) => (
    <ReactMarkdown
      components={{
        a: ({ href, children }) => {
          if (href?.startsWith("/")) {
            return <Link to={href} className="text-accent underline decoration-accent/40 hover:decoration-accent font-medium transition-colors" onClick={() => setIsOpen(false)}>{children}</Link>;
          }
          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-accent/40 hover:decoration-accent">{children}</a>;
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

  return (
    <>
      {/* ── Launcher ── */}
      <button
        onClick={() => { setIsOpen(true); setUnreadCount(0); }}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 pl-4 pr-5 h-12",
          "bg-primary text-primary-foreground rounded-lg",
          "shadow-md hover:shadow-lg transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2",
          isOpen && "scale-0 opacity-0 pointer-events-none"
        )}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        <MessageCircle className="w-[18px] h-[18px]" />
        <span className="text-sm font-medium">{fr ? "Clavardage" : "Chat"}</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 flex items-center justify-center bg-destructive text-destructive-foreground text-[11px] font-bold rounded-full">
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
            // Desktop
            "bottom-6 right-6 w-[380px] rounded-lg",
            // Mobile full-screen
            "max-sm:inset-0 max-sm:w-full max-sm:rounded-none"
          )}
          style={{ height: "min(580px, calc(100dvh - 48px))" }}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-4 h-14 bg-primary text-primary-foreground shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-md bg-primary-foreground/15 flex items-center justify-center text-sm font-bold">
                  N
                </div>
                {/* Online indicator */}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-accent rounded-full border-2 border-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">Nivra</p>
                <p className="text-[11px] text-primary-foreground/70 leading-tight">
                  {fr ? "Support client • En ligne" : "Customer support • Online"}
                </p>
              </div>
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

          {/* ── Auth bar ── */}
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

          {/* ── Messages area ── */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">

            {/* Welcome panel with quick actions */}
            {showWelcomePanel && (
              <div className="px-4 pt-4 pb-2">
                {/* Welcome card */}
                <div className="mb-4">
                  {messages[0] && (
                    <div className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-primary">N</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-muted-foreground mb-1 font-medium">Nivra • {formatTime(messages[0].timestamp)}</p>
                        <div className="text-[13px] text-foreground leading-relaxed">
                          {renderMarkdown(messages[0].content)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick actions */}
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

            {/* Conversation messages (skip first welcome when panel shown) */}
            {!showWelcomePanel && (
              <div className="px-4 py-3 space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={cn("flex gap-2.5", message.role === "user" ? "justify-end" : "justify-start")}>
                    {message.role === "assistant" && (
                      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-primary">N</span>
                      </div>
                    )}
                    <div className="flex flex-col max-w-[78%] min-w-0">
                      <p className={cn(
                        "text-[11px] text-muted-foreground mb-0.5 font-medium",
                        message.role === "user" ? "text-right" : "text-left"
                      )}>
                        {message.role === "assistant" ? "Nivra" : (fr ? "Vous" : "You")} • {formatTime(message.timestamp)}
                      </p>
                      <div className={cn(
                        "px-3 py-2 text-[13px] leading-relaxed",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-lg rounded-br-sm"
                          : "bg-secondary text-foreground border border-border rounded-lg rounded-bl-sm"
                      )}>
                        {message.role === "assistant" ? renderMarkdown(message.content) : message.content}
                      </div>
                    </div>
                    {message.role === "user" && (
                      <div className="w-7 h-7 rounded-md bg-primary/8 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-semibold text-primary">
                          {fr ? "V" : "Y"}
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing indicator */}
                {isLoading && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">N</span>
                    </div>
                    <div className="bg-secondary border border-border rounded-lg rounded-bl-sm px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                        <span className="text-xs text-muted-foreground">{fr ? "Nivra rédige une réponse…" : "Nivra is typing…"}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dynamic suggestions */}
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

          {/* ── Input ── */}
          <div className="border-t border-border px-3 py-2.5 bg-background shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={fr ? "Écrivez votre message…" : "Type your message…"}
                disabled={isLoading}
                rows={1}
                className={cn(
                  "flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-[13px]",
                  "focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40",
                  "placeholder:text-muted-foreground disabled:opacity-50",
                  "max-h-[80px] min-h-[36px]"
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
                  "disabled:opacity-40 disabled:cursor-not-allowed"
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
