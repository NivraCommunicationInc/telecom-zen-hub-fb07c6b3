import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  ArrowLeft, 
  Phone,
  User,
  Clock,
  RefreshCw
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { formatPhoneDisplay, toE164 } from "@/lib/phoneUtils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface SMSConversationViewProps {
  selectedPhone: string | null;
  onBack: () => void;
}

interface Message {
  id: string;
  phone_number: string;
  direction: string;
  message_preview: string;
  created_at: string;
  agent_name?: string;
  status?: string;
}

const SMSConversationView = ({ selectedPhone, onBack }: SMSConversationViewProps) => {
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch conversation messages for selected phone
  const { data: messages, isLoading, refetch } = useQuery({
    queryKey: ["sms-conversation", selectedPhone],
    queryFn: async () => {
      if (!selectedPhone) return [];

      const { data, error } = await supabase
        .from("telephony_logs")
        .select("*")
        .eq("action", "sms")
        .eq("phone_number", selectedPhone)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching conversation:", error);
        return [];
      }

      return data as Message[];
    },
    enabled: !!selectedPhone,
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!selectedPhone) return;

    const channel = supabase
      .channel(`sms-${selectedPhone}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "telephony_logs",
          filter: `phone_number=eq.${selectedPhone}`,
        },
        (payload) => {
          console.log("New message received:", payload);
          queryClient.invalidateQueries({ queryKey: ["sms-conversation", selectedPhone] });
          queryClient.invalidateQueries({ queryKey: ["sms-threads"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedPhone, queryClient]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send SMS mutation
  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;
      
      if (!token) throw new Error("Non authentifié");

      const e164 = toE164(selectedPhone!);
      if (!e164) throw new Error("Numéro de téléphone invalide");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openphone-sms`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: e164,
            text: text.trim(),
            agentName: user?.email,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'envoi");
      return data;
    },
    onSuccess: () => {
      setNewMessage("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["sms-threads"] });
    },
    onError: (err: Error) => {
      toast.error("Erreur", { description: err.message });
    },
  });

  const handleSend = () => {
    if (!newMessage.trim() || !selectedPhone) return;
    sendMutation.mutate(newMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatMessageDate = (date: Date) => {
    if (isToday(date)) return format(date, "HH:mm", { locale: fr });
    if (isYesterday(date)) return `Hier ${format(date, "HH:mm", { locale: fr })}`;
    return format(date, "d MMM HH:mm", { locale: fr });
  };

  // Group messages by date
  const groupedMessages = messages?.reduce((groups: Record<string, Message[]>, msg) => {
    const date = format(new Date(msg.created_at), "yyyy-MM-dd");
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Aujourd'hui";
    if (isYesterday(date)) return "Hier";
    return format(date, "EEEE d MMMM", { locale: fr });
  };

  if (!selectedPhone) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Sélectionnez une conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
        <Button variant="ghost" size="icon" onClick={onBack} className="lg:hidden">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-medium font-mono">{formatPhoneDisplay(selectedPhone)}</p>
          <p className="text-sm text-muted-foreground">
            {messages?.length || 0} messages
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages && messages.length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedMessages || {}).map(([date, msgs]) => (
              <div key={date}>
                <div className="flex items-center justify-center my-4">
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {formatDateHeader(date)}
                  </span>
                </div>
                <div className="space-y-2">
                  {msgs.map((msg) => {
                    const isOutgoing = msg.direction === "outbound" || msg.direction === "outgoing";
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          isOutgoing ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-4 py-2 space-y-1",
                            isOutgoing
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted rounded-bl-md"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.message_preview || "(Pas de contenu)"}
                          </p>
                          <div className={cn(
                            "flex items-center gap-2 text-xs",
                            isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            <span>{formatMessageDate(new Date(msg.created_at))}</span>
                            {isOutgoing && msg.agent_name && (
                              <>
                                <span>•</span>
                                <span>{msg.agent_name.split("@")[0]}</span>
                              </>
                            )}
                            {msg.status && (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-[10px] px-1.5 py-0",
                                  isOutgoing && "border-primary-foreground/30 text-primary-foreground/70"
                                )}
                              >
                                {msg.status === "sent" ? "Envoyé" : 
                                 msg.status === "delivered" ? "Livré" :
                                 msg.status === "received" ? "Reçu" : msg.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <p>Aucun message dans cette conversation</p>
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            placeholder="Tapez votre message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sendMutation.isPending}
            className="flex-1"
            maxLength={1600}
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMutation.isPending}
            size="icon"
          >
            {sendMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {newMessage.length}/1600
        </p>
      </div>
    </div>
  );
};

export default SMSConversationView;
