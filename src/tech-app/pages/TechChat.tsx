/**
 * TechChat — Threads de conversation (dispatch, client, équipe).
 */
import { useEffect, useMemo, useState } from "react";
import { Send, Radio, User, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TechHeader from "../components/TechHeader";

type Channel = "dispatch" | "client" | "team";

const CHANNELS: { id: Channel; label: string; icon: any; hint: string }[] = [
  { id: "dispatch", label: "Dispatch", icon: Radio, hint: "Nivra Core" },
  { id: "client", label: "Client", icon: User, hint: "Mission active" },
  { id: "team", label: "Équipe", icon: Users, hint: "Techniciens" },
];

export default function TechChat() {
  const [channel, setChannel] = useState<Channel>("dispatch");
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    supabase
      .from("messages")
      .select("id, sender_id, recipient_id, content, created_at, message_type")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setMessages((data ?? []).reverse());
        setLoading(false);
      });
  }, [userId, channel]);

  async function send() {
    if (!text.trim() || !userId) return;
    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        sender_id: userId,
        content: text.trim(),
        message_type: channel,
      } as any);
      if (error) throw error;
      setText("");
      toast.success("Envoyé");
    } catch (e: any) {
      toast.error(e.message || "Envoi échoué");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-60px-72px-env(safe-area-inset-bottom))]">
      <TechHeader title="Chat" subtitle="Dispatch · Client · Équipe" />

      <div className="px-3 pt-3 flex gap-2">
        {CHANNELS.map((c) => {
          const Icon = c.icon;
          const active = channel === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setChannel(c.id)}
              className="flex-1 h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors"
              style={{
                background: active ? "#18181b" : "#fff",
                color: active ? "#fbbf24" : "#18181b",
                border: `1px solid ${active ? "#18181b" : "#e4e4e7"}`,
              }}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-black italic uppercase leading-none">{c.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-zinc-500 text-sm py-10">Aucun message.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === userId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[75%] px-3 py-2 rounded-2xl text-[13px]"
                  style={{
                    background: mine ? "#18181b" : "#fff",
                    color: mine ? "#fafafa" : "#18181b",
                    border: mine ? "none" : "1px solid #e4e4e7",
                  }}
                >
                  {m.content}
                  <div className={`text-[9px] mt-0.5 ${mine ? "text-zinc-400" : "text-zinc-500"}`}>
                    {new Date(m.created_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-2 border-t border-zinc-200 bg-white flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message…"
          className="flex-1 h-11 px-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[14px]"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="h-11 w-11 rounded-xl flex items-center justify-center disabled:opacity-50"
          style={{ background: "#fbbf24", color: "#18181b" }}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
