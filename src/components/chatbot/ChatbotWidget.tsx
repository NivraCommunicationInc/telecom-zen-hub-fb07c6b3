import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User, Sparkles, Loader2, LogIn, ShieldCheck } from "lucide-react";
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
}

const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [verifiedClientId, setVerifiedClientId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

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

      // Update verified client ID if returned
      if (response.data.verifiedClientId && !verifiedClientId) {
        setVerifiedClientId(response.data.verifiedClientId);
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.data.response || (language === "fr" 
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
    setInput(message);
    setTimeout(() => sendMessage(), 100);
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
                Nivra
                <Sparkles className="w-4 h-4 text-yellow-300" />
              </h3>
              <p className="text-xs text-white/80 flex items-center gap-1">
                {isAuthenticated ? (
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
              <Link to="/auth" onClick={() => setIsOpen(false)}>
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
                    <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-accent" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                      message.role === "user"
                        ? "bg-accent text-white rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    )}
                  >
                    {message.role === "assistant" 
                      ? renderMessageContent(message.content)
                      : message.content
                    }
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
          <div className="border-t p-4 bg-background/50 backdrop-blur-sm">
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
                  language === "fr" ? "Écrivez votre message..." : "Type your message..."
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
