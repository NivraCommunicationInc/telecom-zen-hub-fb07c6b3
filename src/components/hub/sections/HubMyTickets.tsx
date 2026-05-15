/**
 * HubMyTickets — User's submitted tickets with conversation thread.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Ticket, Send, ArrowLeft } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  open:        "bg-blue-100 text-blue-700",
  in_progress: "bg-violet-100 text-violet-700",
  waiting:     "bg-amber-100 text-amber-700",
  resolved:    "bg-emerald-100 text-emerald-700",
  closed:      "bg-slate-100 text-slate-700",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Ouvert", in_progress: "En cours", waiting: "En attente",
  resolved: "Résolu", closed: "Fermé",
};
const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};
const PRIORITY_LABEL: Record<string, string> = {
  low: "Faible", normal: "Normal", high: "Haute", urgent: "Urgent",
};

export default function HubMyTickets() {
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["hub-my-tickets"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("hub_tickets")
        .select("*")
        .eq("submitted_by", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (openId) return <TicketThread ticketId={openId} onBack={() => setOpenId(null)} />;

  if (!data?.length) {
    return (
      <div className="text-center py-16">
        <Ticket className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Aucun ticket. Soumettez un formulaire pour en créer un.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-3xl">
      {data.map((t: any) => (
        <button
          key={t.id}
          onClick={() => setOpenId(t.id)}
          className="w-full text-left rounded-xl border border-border bg-card p-4 hover:shadow-sm hover:border-violet-300 transition-all"
        >
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="font-mono text-[10px] text-muted-foreground">{t.ticket_number}</span>
            <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${STATUS_COLORS[t.status]}`}>{STATUS_LABEL[t.status]}</span>
            <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${PRIORITY_COLORS[t.priority]}`}>{PRIORITY_LABEL[t.priority]}</span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: fr })}
            </span>
          </div>
          <div className="text-sm font-semibold text-foreground">{t.subject}</div>
          <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{t.description}</div>
        </button>
      ))}
    </div>
  );
}

function TicketThread({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");

  const { data: ticket } = useQuery({
    queryKey: ["hub-ticket", ticketId],
    queryFn: async () => (await supabase.from("hub_tickets").select("*").eq("id", ticketId).maybeSingle()).data,
  });
  const { data: messages = [] } = useQuery({
    queryKey: ["hub-ticket-msgs", ticketId],
    queryFn: async () => (await supabase.from("hub_ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at")).data || [],
  });

  useEffect(() => {
    const ch = supabase
      .channel(`hub-ticket-${ticketId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_ticket_messages", filter: `ticket_id=eq.${ticketId}` }, () => {
        qc.invalidateQueries({ queryKey: ["hub-ticket-msgs", ticketId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, ticketId]);

  const send = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { error } = await supabase.from("hub_ticket_messages").insert({
        ticket_id: ticketId, sender_id: user.id, message: msg, is_internal: false,
      });
      if (error) throw error;
    },
    onSuccess: () => { setMsg(""); qc.invalidateQueries({ queryKey: ["hub-ticket-msgs", ticketId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!ticket) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="max-w-3xl space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à mes tickets
      </button>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="font-mono text-[10px] text-muted-foreground">{ticket.ticket_number}</span>
          <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${STATUS_COLORS[ticket.status]}`}>{STATUS_LABEL[ticket.status]}</span>
          <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${PRIORITY_COLORS[ticket.priority]}`}>{PRIORITY_LABEL[ticket.priority]}</span>
        </div>
        <h3 className="text-base font-bold text-foreground">{ticket.subject}</h3>
        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{ticket.description}</p>
        <p className="text-[11px] text-muted-foreground mt-2">{format(new Date(ticket.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}</p>
      </div>

      <div className="space-y-2">
        {(messages as any[]).map((m: any) => (
          <div key={m.id} className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] text-muted-foreground mb-1">
              {format(new Date(m.created_at), "d MMM HH:mm", { locale: fr })}
            </div>
            <p className="text-sm whitespace-pre-line">{m.message}</p>
          </div>
        ))}
      </div>

      {ticket.status !== "closed" && (
        <div className="rounded-2xl border border-border bg-card p-3">
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            rows={3}
            placeholder="Répondre…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={() => send.mutate()}
              disabled={!msg.trim() || send.isPending}
              className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
