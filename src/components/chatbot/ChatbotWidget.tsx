import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User, Sparkles, Loader2, LogIn, ShieldCheck, Headphones, UserCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  isAgent?: boolean;
  agentName?: string | null;
}

const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [verifiedClientId, setVerifiedClientId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isWaitingForAgent, setIsWaitingForAgent] = useState(false);
  const [isHumanActive, setIsHumanActive] = useState(false);
  const agentPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAdminMsgIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { language } = useLanguage();

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session?.user);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Demander un agent humain ──────────────────────────────────────────────
  const requestHumanAgent = async () => {
    if (isWaitingForAgent || isHumanActive) return;
    setIsWaitingForAgent(true);

    const waitMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: language === "fr"
        ? "⏳ Un agent va vous rejoindre sous peu. Votre conversation est en cours de transfert…"
        : "⏳ An agent will join you shortly. Your conversation is being transferred…",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, waitMsg]);

    try {
      // Créer/mettre à jour la session dans live_chat_sessions
      await supabase.from("live_chat_sessions" as any).upsert({
        session_id: sessionId,
        status: "waiting",
        language,
        last_message_at: new Date().toISOString(),
        unread_for_admin: 1,
      }, { onConflict: "session_id" });

      // Copier les 8 derniers messages dans live_chat_messages
      const toSync = messages.filter(m => m.content && !m.content.includes("Je suis Nivra")).slice(-8);
      for (const msg of toSync) {
        await supabase.from("live_chat_messages" as any).insert({
          session_id: sessionId,
          role: msg.role === "user" ? "visitor" : "bot",
          content: msg.content.slice(0, 2000),
        }).then(() => {}, () => {});
      }
    } catch (e) {
      console.warn("[Chat] session creation failed:", e);
    }

    // Démarrer le polling pour les réponses de l'agent
    startAgentPolling();
  };

  const startAgentPolling = () => {
    if (agentPollRef.current) return;
    agentPollRef.current = setInterval(async () => {
      try {
        const query = supabase
          .from("live_chat_messages" as any)
          .select("id, role, content, admin_name, created_at")
          .eq("session_id", sessionId)
          .eq("role", "admin")
          .order("created_at", { ascending: true });

        if (lastAdminMsgIdRef.current) {
          query.gt("created_at", lastAdminMsgIdRef.current);
        }

        const { data: adminMsgs } = await query.limit(10);

        if (adminMsgs?.length) {
          // Vérifier si la session est maintenant en mode human_takeover
          setIsHumanActive(true);
          setIsWaitingForAgent(false);

          for (const msg of adminMsgs as any[]) {
            if (msg.id !== lastAdminMsgIdRef.current) {
              lastAdminMsgIdRef.current = msg.created_at;
              setMessages(prev => {
                if (prev.some(m => m.id === msg.id)) return prev;
                return [...prev, {
                  id: msg.id,
                  role: "assistant" as const,
                  content: msg.content,
                  timestamp: new Date(msg.created_at),
                  isAgent: true,
                  agentName: msg.admin_name,
                }];
              });
            }
          }
        }
      } catch (e) { /* non-fatal */ }
    }, 4000);
  };

  // Arrêter le polling quand le chat se ferme
  useEffect(() => {
    if (!isOpen && agentPollRef.current) {
      clearInterval(agentPollRef.current);
      agentPollRef.current = null;
    }
  }, [isOpen]);

  const welcomeMessage = language === "fr"
    ? `Bonjour! Je suis Nivra, votre assistant virtuel. Je peux vous aider à:

• 📦 Suivre vos commandes
• 📅 Gérer vos rendez-vous
• 🧾 Consulter vos factures et solde
• 🎫 Créer des tickets support
• ℹ️ Répondre à vos questions

${isAuthenticated ? "✅ Vous êtes connecté, j'ai accès à vos informations." : "🔒 Pour accéder à vos données personnelles, connectez-vous ou vérifiez votre identité."}

Comment puis-je vous aider?`
    : `Hello! I'm Nivra, your virtual assistant. I can help you with:

• 📦 Track your orders
• 📅 Manage your appointments
• 🧾 View your invoices and balance
• 🎫 Create support tickets
• ℹ️ Answer your questions

${isAuthenticated ? "✅ You are logged in, I have access to your information." : "🔒 To access your personal data, please log in or verify your identity."}

How can I help you?`;

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: welcomeMessage,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length, welcomeMessage]);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Build conversation history for context
  const getConversationHistory = useCallback(() => {
    return messages
      .filter(m => !m.content.includes("Je suis Nivra") && !m.content.includes("I'm Nivra"))
      .map(m => ({
        role: m.role,
        content: m.content
      }));
  }, [messages]);

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!overrideText) setInput("");
    setIsLoading(true);

    // Mode agent humain — on sauvegarde dans live_chat_messages, pas de bot
    if (isHumanActive) {
      try {
        await supabase.from("live_chat_messages" as any).insert({
          session_id: sessionId,
          role: "visitor",
          content: userMessage.content.slice(0, 2000),
        });
        await supabase.from("live_chat_sessions" as any).update({
          last_message_at: new Date().toISOString(),
          unread_for_admin: 1,
        }).eq("session_id", sessionId);
      } catch (e) { /* non-fatal */ }
      setIsLoading(false);
      return;
    }

    try {
      const response = await supabase.functions.invoke("chatbot-jonathan", {
        body: {
          message: userMessage.content,
          sessionId,
          language,
          conversationHistory: getConversationHistory(),
          verifiedClientId,
        },
      });

      if (response.error) throw response.error;

      const data = response.data ?? {};

      if (data.verifiedClientId && !verifiedClientId) {
        setVerifiedClientId(data.verifiedClientId);
      }

      if (data.humanTakeover) {
        setIsHumanActive(true);
        setIsWaitingForAgent(false);
        startAgentPolling();
        supabase.from("live_chat_messages" as any).insert({
          session_id: sessionId, role: "visitor", content: userMessage.content.slice(0, 2000),
        }).then(() => {}, () => {});
        setIsLoading(false);
        return;
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response || (language === "fr"
          ? "Désolé, je n'ai pas pu traiter votre demande."
          : "Sorry, I couldn't process your request."),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chatbot error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: language === "fr"
            ? "Désolé, une erreur s'est produite. Veuillez réessayer."
            : "Sorry, an error occurred. Please try again.",
          timestamp: new Date(),
        },
      ]);
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

  // Quick action suggestions
  const quickActions = language === "fr" 
    ? [
        { label: "Mes commandes", message: "Je veux voir mes commandes" },
        { label: "Mon solde", message: "Quel est mon solde de compte?" },
        { label: "Rendez-vous", message: "Quels sont mes prochains rendez-vous?" },
      ]
    : [
        { label: "My orders", message: "I want to see my orders" },
        { label: "My balance", message: "What is my account balance?" },
        { label: "Appointments", message: "What are my upcoming appointments?" },
      ];

  const handleQuickAction = (message: string) => {
    sendMessage(message);
  };

  // Render message content with markdown and link support
  const renderMessageContent = (content: string) => {
    return (
      <ReactMarkdown
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith('/')) {
              return (
                <Link 
                  to={href} 
                  className="text-accent underline hover:text-accent/80"
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
                className="text-accent underline hover:text-accent/80"
              >
                {children}
              </a>
            );
          },
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg",
          "bg-gradient-to-br from-accent to-accent/80 text-white flex items-center justify-center",
          "hover:scale-105 hover:shadow-xl transition-all duration-300",
          "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
          isOpen && "rotate-90"
        )}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className={cn(
            "fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)]",
            "bg-background border border-border rounded-2xl shadow-2xl",
            "flex flex-col overflow-hidden",
            "animate-in slide-in-from-bottom-4 fade-in duration-300"
          )}
          style={{ height: "550px" }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-accent to-accent/90 text-white px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold flex items-center gap-2">
                {isHumanActive ? (language === "fr" ? "Agent Nivra" : "Nivra Agent") : "Nivra"}
                {!isHumanActive && <Sparkles className="w-4 h-4 text-yellow-300" />}
                {isHumanActive && <UserCheck className="w-4 h-4 text-green-300" />}
              </h3>
              <p className="text-xs text-white/80 flex items-center gap-1">
                {isHumanActive ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    {language === "fr" ? "Agent en ligne" : "Agent online"}
                  </>
                ) : isWaitingForAgent ? (
                  <>
                    <Clock className="w-3 h-3" />
                    {language === "fr" ? "En attente d'un agent…" : "Waiting for an agent…"}
                  </>
                ) : isAuthenticated ? (
                  <>
                    <ShieldCheck className="w-3 h-3" />
                    {language === "fr" ? "Connecté" : "Logged in"}
                  </>
                ) : verifiedClientId ? (
                  <>
                    <ShieldCheck className="w-3 h-3" />
                    {language === "fr" ? "Identité vérifiée" : "Identity verified"}
                  </>
                ) : (
                  language === "fr" ? "Assistant intelligent" : "Smart Assistant"
                )}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Login prompt for non-authenticated users */}
          {!isAuthenticated && !verifiedClientId && (
            <div className="px-4 py-2 bg-muted/50 border-b flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {language === "fr" 
                  ? "Connectez-vous pour un accès complet" 
                  : "Log in for full access"}
              </span>
              <Link to="/portal/auth" onClick={() => setIsOpen(false)}>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <LogIn className="w-3 h-3" />
                  {language === "fr" ? "Connexion" : "Login"}
                </Button>
              </Link>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                      message.isAgent ? "bg-green-100" : "bg-accent/10"
                    )}>
                      {message.isAgent
                        ? <Headphones className="w-4 h-4 text-green-600" />
                        : <Bot className="w-4 h-4 text-accent" />
                      }
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5 max-w-[80%]">
                    {message.isAgent && message.agentName && (
                      <span className="text-[10px] text-green-600 font-medium pl-1">
                        {message.agentName}
                      </span>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm",
                        message.role === "user"
                          ? "bg-accent text-white rounded-br-md"
                          : message.isAgent
                          ? "bg-green-50 border border-green-200 text-foreground rounded-bl-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      )}
                    >
                      {message.role === "assistant"
                        ? renderMessageContent(message.content)
                        : message.content
                      }
                    </div>
                  </div>
                  {message.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4 text-accent" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-accent" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Quick Actions - show only when few messages */}
          {messages.length <= 2 && !isLoading && (
            <div className="px-4 pb-2">
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickAction(action.message)}
                    className="text-xs px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-full transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t p-4 bg-background/50 backdrop-blur-sm space-y-2">
            {!isHumanActive && !isWaitingForAgent && (
              <button
                type="button"
                onClick={requestHumanAgent}
                className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-accent transition-colors py-1"
              >
                <Headphones className="w-3.5 h-3.5" />
                {language === "fr" ? "Parler à un agent humain" : "Talk to a human agent"}
              </button>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isHumanActive
                    ? (language === "fr" ? "Message à l'agent…" : "Message to agent…")
                    : (language === "fr" ? "Écrivez votre message..." : "Type your message...")
                }
                disabled={isLoading}
                className="flex-1 bg-muted/50 border-0 focus-visible:ring-accent"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="bg-accent hover:bg-accent/90"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;
