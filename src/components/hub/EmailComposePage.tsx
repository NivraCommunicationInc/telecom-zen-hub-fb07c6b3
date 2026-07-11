/**
 * EmailComposePage — Internal staff email composer (Core/Employee).
 * Sends a violet-branded internal_email_compose template via email_queue.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Send, X, Loader2, Search } from "lucide-react";
import { enqueueCommunication } from "@/lib/enqueueCommunication";

interface RecipientOption { user_id: string; full_name: string | null; email: string; }

export default function EmailComposePage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<RecipientOption[]>([]);
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [cc, setCc] = useState<RecipientOption[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [target, setTarget] = useState<"to" | "cc">("to");

  const runSearch = async (q: string) => {
    setSearch(q);
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10);
    setResults((data as any) || []);
    setSearching(false);
  };

  const addRecipient = (r: RecipientOption) => {
    const list = target === "to" ? recipients : cc;
    if (list.find(x => x.user_id === r.user_id)) return;
    if (target === "to") setRecipients([...recipients, r]);
    else setCc([...cc, r]);
    setSearch(""); setResults([]);
  };

  const send = async () => {
    if (recipients.length === 0) { toast.error("Aucun destinataire"); return; }
    if (!subject.trim() || !message.trim()) { toast.error("Sujet et message requis"); return; }
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: meProf } = await supabase.from("profiles").select("full_name").eq("user_id", user?.id || "").maybeSingle();
      const senderName = (meProf as any)?.full_name || "Équipe Nivra";
      const all = [...recipients, ...cc];
      const messageDigest = subject.trim().slice(0, 40) + ":" + message.trim().length;
      for (const r of all) {
        await enqueueCommunication({
          channel: "email",
          templateKey: "internal_email_compose",
          recipient: r.email,
          idempotencyKey: `internal-compose:${user?.id ?? "anon"}:${r.user_id ?? r.email}:${messageDigest}`,
          templateVars: {
            client_name: r.full_name || "Collègue",
            subject,
            message_html: message.replace(/\n/g, "<br/>"),
            sender_name: senderName,
          },
        });
      }
      toast.success(`Courriel envoyé à ${all.length} destinataire(s)`);
      setRecipients([]); setCc([]); setSubject(""); setMessage("");
    } catch (e: any) {
      toast.error(e.message || "Erreur d'envoi");
    } finally {
      setSending(false);
    }
  };

  const Chip = ({ r, onRemove }: { r: RecipientOption; onRemove: () => void }) => (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-800 px-2 py-1 text-[11px] font-medium">
      {r.full_name || r.email}
      <button onClick={onRemove} className="hover:bg-violet-200 rounded-full p-0.5"><X className="h-3 w-3" /></button>
    </span>
  );

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-9 w-9 rounded-xl bg-violet-600 flex items-center justify-center">
          <Mail className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">Envoyer un courriel</h1>
          <p className="text-[11px] text-muted-foreground">Communication interne et externe — gabarit Nivra Telecom</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
        {/* Recipients */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Destinataires</label>
          <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
            {recipients.map((r) => <Chip key={r.user_id} r={r} onRemove={() => setRecipients(recipients.filter(x => x.user_id !== r.user_id))} />)}
          </div>
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cc</label>
          <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
            {cc.map((r) => <Chip key={r.user_id} r={r} onRemove={() => setCc(cc.filter(x => x.user_id !== r.user_id))} />)}
          </div>
        </div>

        {/* Search */}
        <div>
          <div className="flex gap-2 mb-1.5">
            <button onClick={() => setTarget("to")} className={`min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-full text-[11px] font-semibold ${target === "to" ? "bg-violet-600 text-white" : "bg-secondary text-muted-foreground"}`}>Ajouter à : Destinataires</button>
            <button onClick={() => setTarget("cc")} className={`min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-full text-[11px] font-semibold ${target === "cc" ? "bg-violet-600 text-white" : "bg-secondary text-muted-foreground"}`}>Cc</button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="Rechercher par nom ou email…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          {searching && <div className="text-[11px] text-muted-foreground mt-1">Recherche…</div>}
          {results.length > 0 && (
            <div className="mt-1.5 rounded-lg border border-border bg-background divide-y divide-border max-h-48 overflow-auto">
              {results.map((r) => (
                <button key={r.user_id} onClick={() => addRecipient(r)} className="w-full text-left px-3 py-2 hover:bg-secondary text-sm min-h-[44px]">
                  <div className="font-semibold">{r.full_name || "(sans nom)"}</div>
                  <div className="text-[11px] text-muted-foreground">{r.email}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Subject */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Objet</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full mt-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>

        {/* Message */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Message</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} className="w-full mt-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-sans" />
          <p className="text-[10px] text-muted-foreground mt-1">Le pied de page (support@nivra-telecom.ca · nivra-telecom.ca · Québec, Canada) est ajouté automatiquement.</p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={send}
            disabled={sending || recipients.length === 0 || !subject.trim() || !message.trim()}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-full bg-violet-600 text-white text-sm font-bold disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
