import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft,
  Clock,
  Plus,
  Loader2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { formatPhoneDisplay } from "@/lib/phoneUtils";
import { cn } from "@/lib/utils";

interface Thread {
  phone_number: string;
  last_message: string;
  last_message_at: string;
  direction: string;
  message_count: number;
  unread_count: number;
}

interface SMSThreadsListProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedPhone: string | null;
  onSelectPhone: (phone: string) => void;
  onNewConversation: () => void;
}

const SMSThreadsList = ({
  searchQuery,
  onSearchChange,
  selectedPhone,
  onSelectPhone,
  onNewConversation,
}: SMSThreadsListProps) => {
  const queryClient = useQueryClient();

  // Fetch conversation threads (grouped by phone number)
  const { data: threads, isLoading } = useQuery({
    queryKey: ["sms-threads"],
    queryFn: async () => {
      // Get all SMS logs grouped by phone number
      const { data, error } = await supabase
        .from("telephony_logs")
        .select("*")
        .eq("action", "sms")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching threads:", error);
        return [];
      }

      // Group by phone number and get latest message
      const threadMap = new Map<string, Thread>();
      
      data?.forEach((log: any) => {
        const phone = log.phone_number;
        if (!phone) return;

        if (!threadMap.has(phone)) {
          threadMap.set(phone, {
            phone_number: phone,
            last_message: log.message_preview || "",
            last_message_at: log.created_at,
            direction: log.direction,
            message_count: 1,
            unread_count: log.direction === "inbound" && !log.read_at ? 1 : 0,
          });
        } else {
          const thread = threadMap.get(phone)!;
          thread.message_count++;
          if (log.direction === "inbound" && !log.read_at) {
            thread.unread_count++;
          }
        }
      });

      return Array.from(threadMap.values()).sort(
        (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );
    },
  });

  // Subscribe to realtime updates for new messages
  useEffect(() => {
    const channel = supabase
      .channel("sms-threads-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "telephony_logs",
          filter: "action=eq.sms",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["sms-threads"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filter threads by search query
  const filteredThreads = threads?.filter((thread) => {
    if (!searchQuery) return true;
    return (
      thread.phone_number.includes(searchQuery) ||
      thread.last_message.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="h-full flex flex-col">
      {/* Search and New Button */}
      <div className="p-4 border-b space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button size="icon" onClick={onNewConversation}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Threads List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredThreads && filteredThreads.length > 0 ? (
          <div className="divide-y">
            {filteredThreads.map((thread) => {
              const isSelected = selectedPhone === thread.phone_number;
              const isIncoming = thread.direction === "inbound" || thread.direction === "incoming";
              
              return (
                <button
                  key={thread.phone_number}
                  onClick={() => onSelectPhone(thread.phone_number)}
                  className={cn(
                    "w-full text-left p-4 hover:bg-accent/50 transition-colors",
                    isSelected && "bg-accent"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      isIncoming ? "bg-emerald-500/10" : "bg-cyan-500/10"
                    )}>
                      {isIncoming ? (
                        <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 text-cyan-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium font-mono text-sm truncate">
                          {formatPhoneDisplay(thread.phone_number)}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDistanceToNow(new Date(thread.last_message_at), { 
                            addSuffix: false, 
                            locale: fr 
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {thread.last_message || "(Pas de contenu)"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {thread.message_count} msg
                        </Badge>
                        {thread.unread_count > 0 && (
                          <Badge variant="default" className="text-xs bg-emerald-500">
                            {thread.unread_count} nouveau{thread.unread_count > 1 ? "x" : ""}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">Aucune conversation</p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery ? "Aucun résultat pour cette recherche" : "Envoyez votre premier SMS"}
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default SMSThreadsList;
