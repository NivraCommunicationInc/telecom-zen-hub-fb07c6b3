import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User, Sparkles, Loader2, LogIn, ShieldCheck, RotateCcw, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  { label: "📦 Voir les forfaits", message: "Quels forfaits offrez-vous?" },
  { label: "🔍 Trouver mon forfait", message: "Aidez-moi à trouver le meilleur forfait pour mes besoins" },
  { label: "📋 Suivre ma commande", message: "Je veux suivre ma commande" },
  { label: "💰 Mon solde", message: "Quel est mon solde de compte?" },
  { label: "💬 Parler à un agent", message: "Je veux parler à un agent humain" },
];

const QUICK_ACTIONS_EN = [
  { label: "📦 View plans", message: "What plans do you offer?" },
  { label: "🔍 Find my plan", message: "Help me find the best plan for my needs" },
  { label: "📋 Track order", message: "I want to track my order" },
  { label: "💰 My balance", message: "What is my account balance?" },
  { label: "💬 Talk to agent", message: "I want to talk to a human agent" },
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
  const [hasNewMessage, setHasNewMessage] = useState(false);
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

  const fr = language === "fr";

  const welcomeMessage = fr
    ? `Bonjour! 👋 Je suis **Nivra**, votre assistant intelligent.

Je peux vous aider à **trouver le meilleur forfait**, suivre une commande, vérifier votre solde ou répondre à vos questions.

${isAuthenticated ? "✅ Vous êtes connecté — j'ai accès à votre dossier." : ""}

Comment puis-je vous aider?`
    : `Hello! 👋 I'm **Nivra**, your smart assistant.

I can help you **find the best plan**, track an order, check your balance or answer your questions.

${isAuthenticated ? "✅ You're logged in — I have access to your account." : ""}

How can I help you?`;

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: crypto.randomUUID(),
        role: "assistant",
        content: welcomeMessage,
        timestamp: new Date(),
      }]);
    }
  }, [isOpen]);

  // Auto-scroll
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

  const getConversationHistory = useCallback(() => {
    return messages
      .filter(m => m.role !== "assistant" || !m.content.includes("Je suis **Nivra**"))
      .map(m => ({ role: m.role, content: m.content }));
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

      if (!isOpen) setHasNewMessage(true);
    } catch (error) {
      console.error("Chatbot error:", error);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fr ? "Désolé, une erreur s'est produite. Réessayez." : "Sorry, an error occurred. Please try again.",
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
  const showQuickActions = messages.length <= 1 && !isLoading;

  const renderMarkdown = (content: string) => (
    <ReactMarkdown
      components={{
        a: ({ href, children }) => {
          if (href?.startsWith('/')) {
            return <Link to={href} className="text-accent underline hover:text-accent/80 font-medium" onClick={() => setIsOpen(false)}>{children}</Link>;
          }
          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent/80">{children}</a>;
        },
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
        h1: ({ children }) => <h3 className="font-bold text-base mb-1">{children}</h3>,
        h2: ({ children }) => <h3 className="font-bold text-sm mb-1">{children}</h3>,
        h3: ({ children }) => <h4 className="font-semibold text-sm mb-1">{children}</h4>,
      }}
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => { setIsOpen(!isOpen); setHasNewMessage(false); }}
        className={cn(
          "fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-lg",
          "bg-accent text-white flex items-center justify-center",
          "hover:scale-110 hover:shadow-xl transition-all duration-300",
          "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2",
          isOpen && "scale-0 opacity-0 pointer-events-none"
        )}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        <MessageCircle className="w-6 h-6" />
        {hasNewMessage && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className={cn(
          "fixed z-50 flex flex-col overflow-hidden bg-background shadow-2xl border border-border",
          // Desktop
          "bottom-5 right-5 w-[400px] rounded-2xl",
          // Mobile: full screen
          "max-sm:inset-0 max-sm:w-full max-sm:rounded-none max-sm:bottom-0 max-sm:right-0"
        )} style={{ height: "min(620px, calc(100dvh - 40px))" }}>

          {/* Header */}
          <div className="bg-accent text-white px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base flex items-center gap-1.5">
                Nivra <Sparkles className="w-4 h-4 text-yellow-300" />
              </h3>
              <p className="text-xs text-white/80 flex items-center gap-1 truncate">
                {isAuthenticated ? (
                  <><ShieldCheck className="w-3 h-3 shrink-0" /> {fr ? "Connecté" : "Logged in"}</>
                ) : verifiedClientId ? (
                  <><ShieldCheck className="w-3 h-3 shrink-0" /> {fr ? "Identité vérifiée" : "Verified"}</>
                ) : (
                  <>{fr ? "En ligne • Assistant intelligent" : "Online • Smart Assistant"}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={resetConversation} className="p-1.5 hover:bg-white/10 rounded-full transition-colors" title={fr ? "Nouvelle conversation" : "New conversation"}>
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Login bar for non-auth users */}
          {!isAuthenticated && !verifiedClientId && (
            <div className="px-3 py-2 bg-muted/60 border-b flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {fr ? "Connectez-vous pour un accès complet" : "Log in for full access"}
              </span>
              <Link to="/portal/auth" onClick={() => setIsOpen(false)}>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 rounded-lg">
                  <LogIn className="w-3 h-3" />
                  {fr ? "Connexion" : "Login"}
                </Button>
              </Link>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex gap-2", message.role === "user" ? "justify-end" : "justify-start")}
              >
                {message.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-accent" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                  message.role === "user"
                    ? "bg-accent text-white rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}>
                  {message.role === "assistant" ? renderMarkdown(message.content) : message.content}
                </div>
                {message.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-accent" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-accent" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1.5 items-center">
                    <span className="text-xs text-muted-foreground mr-1">{fr ? "Nivra écrit" : "Nivra is typing"}</span>
                    <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          {showQuickActions && (
            <div className="px-3 pb-2 shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(action.message)}
                    className="text-xs px-3 py-1.5 bg-accent/8 hover:bg-accent/15 text-accent rounded-full transition-colors border border-accent/15 hover:border-accent/30 font-medium"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic suggested actions from AI */}
          {suggestedActions.length > 0 && !isLoading && (
            <div className="px-3 pb-2 shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {suggestedActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(action.label)}
                    className="text-xs px-3 py-1.5 bg-accent/8 hover:bg-accent/15 text-accent rounded-full transition-colors border border-accent/15"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t p-3 bg-background shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={fr ? "Écrivez votre message..." : "Type your message..."}
                disabled={isLoading}
                rows={1}
                className={cn(
                  "flex-1 resize-none rounded-xl border border-input bg-muted/40 px-3 py-2.5 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50",
                  "placeholder:text-muted-foreground disabled:opacity-50",
                  "max-h-[100px] min-h-[40px]"
                )}
                style={{ height: "40px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "40px";
                  target.style.height = Math.min(target.scrollHeight, 100) + "px";
                }}
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="bg-accent hover:bg-accent/90 rounded-xl h-10 w-10 shrink-0"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground/60 text-center mt-1.5">
              {fr ? "Propulsé par Nivra AI" : "Powered by Nivra AI"}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default NivraChat;
