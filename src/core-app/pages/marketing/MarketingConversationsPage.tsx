/**
 * MarketingConversationsPage — OpenPhone SMS conversations management.
 *
 * Features:
 *  - Realtime list of all SMS conversations (from marketing_conversations)
 *  - Detail view with full message thread (from telephony_logs)
 *  - Auto language badges (FR/EN/HT/ES/IT/PT)
 *  - Status chips (AI active, human takeover, waiting, sale closed)
 *  - "Prendre la relève" / "Redonner à l'IA" toggle
 *  - "Vente conclue" with sale amount
 *  - Discount panel — admin can manually log a discount offered (5/mo, 10/mo, free install)
 *  - Live updates via Supabase Realtime on marketing_conversations + telephony_logs
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Send,
  Bot,
  Hand,
  Search,
  Languages,
  CheckCircle2,
  Tag,
  MessageSquare,
  Phone as PhoneIcon,
} from "lucide-react";
import { toast } from "sonner";

type Conversation = {
  id: string;
  phone_number: string;
  client_name: string | null;
  detected_language: string;
  status: string;
  ai_enabled: boolean;
  discount_offered: string | null;
  discount_accepted: boolean;
  sale_closed: boolean;
  sale_amount: number | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  message_count: number;
};

type Message = {
  id: string;
  direction: string;
  message_preview: string | null;
  created_at: string;
  agent_name: string | null;
};

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  ai_active: { label: "🤖 IA active", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  human_takeover: { label: "✋ Humain", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  waiting: { label: "⚠️ Attente", cls: "bg-orange-500/15 text-orange-700 border-orange-500/30" },
  sale_closed: { label: "✅ Vente", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  unresponsive: { label: "💤 Inactive", cls: "bg-muted text-muted-foreground border-border" },
};

const LANG_FLAGS: Record<string, string> = {
  fr: "🇫🇷 FR",
  en: "🇬🇧 EN",
  ht: "🇭🇹 HT",
  es: "🇪🇸 ES",
  it: "🇮🇹 IT",
  pt: "🇵🇹 PT",
};

const DISCOUNT_OPTIONS = [
  { key: "none", label: "Aucun rabais", desc: "Pas d'offre encore" },
  { key: "5_per_month", label: "5 $/mois × 24", desc: "Économie 120 $" },
  { key: "10_per_month", label: "10 $/mois × 24", desc: "Économie 240 $" },
  { key: "free_installation", label: "Installation gratuite", desc: "Dernier recours" },
] as const;

function formatPhone(raw: string | null) {
  if (!raw) return "—";
  const d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

export default function MarketingConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [closingSaleAmount, setClosingSaleAmount] = useState("");

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from("marketing_conversations")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) {
      toast.error("Erreur de chargement");
      return;
    }
    setConversations((data || []) as Conversation[]);
  };

  const loadMessages = async (conv: Conversation) => {
    const { data } = await supabase
      .from("telephony_logs")
      .select("id, direction, message_preview, created_at, agent_name")
      .eq("marketing_conversation_id", conv.id)
      .eq("action", "sms")
      .order("created_at", { ascending: true })
      .limit(200);
    setMessages((data || []) as Message[]);
  };

  useEffect(() => {
    loadConversations().finally(() => setLoading(false));
    const channel = supabase
      .channel("marketing-conversations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_conversations" }, () =>
        loadConversations()
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "telephony_logs" }, (payload: any) => {
        if (selected && payload.new?.marketing_conversation_id === selected.id) {
          loadMessages(selected);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected) loadMessages(selected);
  }, [selected?.id]);

  // Keep `selected` in sync when realtime updates the underlying conversation
  useEffect(() => {
    if (!selected) return;
    const fresh = conversations.find((c) => c.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        (c.phone_number || "").toLowerCase().includes(q) ||
        (c.client_name || "").toLowerCase().includes(q) ||
        (c.last_message_preview || "").toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const toggleAI = async (conv: Conversation) => {
    const next = !conv.ai_enabled;
    const { error } = await supabase
      .from("marketing_conversations")
      .update({ ai_enabled: next, status: next ? "ai_active" : "human_takeover" })
      .eq("id", conv.id);
    if (error) return toast.error("Erreur");
    toast.success(next ? "IA réactivée" : "Reprise humaine — l'IA ne répondra plus");
  };

  const markSaleClosed = async (conv: Conversation) => {
    const amount = parseFloat(closingSaleAmount.replace(",", ".")) || null;
    const { error } = await supabase
      .from("marketing_conversations")
      .update({
        sale_closed: true,
        status: "sale_closed",
        discount_accepted: true,
        sale_amount: amount,
      })
      .eq("id", conv.id);
    if (error) return toast.error("Erreur");
    setClosingSaleAmount("");
    toast.success(`Vente conclue${amount ? ` (${amount.toFixed(2)} $)` : ""}`);
  };

  const setDiscount = async (conv: Conversation, key: string) => {
    const { error } = await supabase
      .from("marketing_conversations")
      .update({ discount_offered: key === "none" ? null : key })
      .eq("id", conv.id);
    if (error) return toast.error("Erreur");
    toast.success(
      key === "none" ? "Rabais retiré" : `Rabais offert: ${DISCOUNT_OPTIONS.find((d) => d.key === key)?.label}`
    );
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-send-sms", {
        body: { to: selected.phone_number, message: reply.trim(), conversation_id: selected.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("SMS envoyé");
      setReply("");
      loadMessages(selected);
    } catch (e: any) {
      toast.error(e?.message || "Échec envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conversations OpenPhone</h1>
        <p className="text-sm text-muted-foreground">
          Toutes les conversations SMS — détection auto de langue, agent IA, et reprise humaine.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr_280px] gap-4">
        {/* ── Conversations list ── */}
        <Card className="h-[calc(100vh-220px)] flex flex-col">
          <CardHeader className="pb-2 space-y-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {filtered.length} conversation{filtered.length > 1 ? "s" : ""}
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8"
                placeholder="Rechercher numéro, nom, message…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="overflow-y-auto flex-1 space-y-1 px-2">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement…
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-10">Aucune conversation</div>
            ) : (
              filtered.map((c) => {
                const badge = STATUS_BADGES[c.status] || STATUS_BADGES.ai_active;
                const isActive = selected?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`w-full text-left p-2 rounded-md transition-colors ${
                      isActive ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">
                        {c.client_name || formatPhone(c.phone_number)}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {LANG_FLAGS[c.detected_language] || c.detected_language}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {c.last_message_preview || "—"}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
                      {c.discount_offered && c.discount_offered !== "none" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 border border-purple-500/30">
                          🎁 {DISCOUNT_OPTIONS.find((d) => d.key === c.discount_offered)?.label || c.discount_offered}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* ── Conversation thread ── */}
        <Card className="h-[calc(100vh-220px)] flex flex-col">
          {!selected ? (
            <CardContent className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Sélectionnez une conversation
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-2 border-b border-border">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="text-base">{selected.client_name || formatPhone(selected.phone_number)}</CardTitle>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <PhoneIcon className="h-3 w-3" />
                      <span>{formatPhone(selected.phone_number)}</span>
                      <Separator orientation="vertical" className="h-3" />
                      <Languages className="h-3 w-3" />
                      <span>{LANG_FLAGS[selected.detected_language]}</span>
                      <Separator orientation="vertical" className="h-3" />
                      <span>{selected.message_count} messages</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant={selected.ai_enabled ? "secondary" : "default"}
                      onClick={() => toggleAI(selected)}
                    >
                      {selected.ai_enabled ? (
                        <>
                          <Hand className="h-3.5 w-3.5 mr-1" /> Prendre la relève
                        </>
                      ) : (
                        <>
                          <Bot className="h-3.5 w-3.5 mr-1" /> Redonner à l'IA
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto py-3 space-y-2">
                {messages.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">Aucun message</div>
                ) : (
                  messages.map((m) => {
                    const isOutbound = m.direction === "outbound";
                    const isAI = m.agent_name === "AI Sales Agent";
                    return (
                      <div key={m.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                            isOutbound ? "bg-primary text-primary-foreground" : "bg-secondary"
                          }`}
                        >
                          <div className="whitespace-pre-wrap break-words">{m.message_preview}</div>
                          <div
                            className={`text-[10px] mt-1 ${
                              isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}
                          >
                            {new Date(m.created_at).toLocaleString("fr-CA", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                            {m.agent_name && ` · ${isAI ? "🤖 IA" : m.agent_name}`}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
              <div className="border-t border-border p-3 space-y-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={
                    selected.ai_enabled
                      ? "L'IA répond automatiquement. Désactivez-la (« Prendre la relève ») pour répondre manuellement."
                      : "Votre réponse…"
                  }
                  rows={2}
                  disabled={selected.ai_enabled}
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{reply.length}/320</span>
                  <Button size="sm" onClick={sendReply} disabled={sending || !reply.trim() || selected.ai_enabled}>
                    {sending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Send className="h-3.5 w-3.5 mr-1" />
                    )}
                    Envoyer
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* ── Right panel: discount + sale closing ── */}
        <Card className="h-[calc(100vh-220px)] flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="h-4 w-4" /> Rabais & vente
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-y-auto flex-1 space-y-4">
            {!selected ? (
              <p className="text-xs text-muted-foreground">Sélectionnez une conversation pour gérer les rabais.</p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Cliquez pour offrir un rabais (suit la stratégie d'escalade Nivra).
                  </div>
                  {DISCOUNT_OPTIONS.map((d) => {
                    const active = (selected.discount_offered || "none") === d.key;
                    return (
                      <button
                        key={d.key}
                        onClick={() => setDiscount(selected, d.key)}
                        className={`w-full text-left p-2.5 rounded-md border transition-colors ${
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-secondary"
                        }`}
                      >
                        <div className="text-sm font-medium flex items-center justify-between">
                          <span>{d.label}</span>
                          {active && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{d.desc}</div>
                      </button>
                    );
                  })}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Conclure la vente
                  </div>
                  {selected.sale_closed ? (
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                      <div className="flex items-center gap-2 text-emerald-700 font-medium">
                        <CheckCircle2 className="h-4 w-4" /> Vente conclue
                      </div>
                      {selected.sale_amount && (
                        <div className="text-xs text-emerald-700/80 mt-1">
                          Montant: {Number(selected.sale_amount).toFixed(2)} $
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Montant en $ (optionnel)"
                        value={closingSaleAmount}
                        onChange={(e) => setClosingSaleAmount(e.target.value)}
                      />
                      <Button size="sm" className="w-full" onClick={() => markSaleClosed(selected)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marquer comme vendu
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
