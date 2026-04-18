/**
 * MarketingSMSCampaignsPage — Create + view SMS campaigns.
 * Reuses existing sms_campaigns table; sends one-by-one via marketing-send-sms.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Send } from "lucide-react";
import { toast } from "sonner";

type Campaign = {
  id: string;
  message: string;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
  created_at: string;
};

function parseCSV(text: string): string[] {
  return text
    .split(/[\n,;]/)
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter((s) => /^\+?[0-9 .()-]{7,}$/.test(s))
    .map((s) => s.replace(/[^\d+]/g, ""))
    .filter(Boolean);
}

export default function MarketingSMSCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("sms_campaigns").select("*").order("created_at", { ascending: false }).limit(50);
    setCampaigns((data || []) as Campaign[]);
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const numbers = parseCSV(text);
    setRecipients(numbers);
    toast.success(`${numbers.length} numéros importés`);
  };

  const send = async () => {
    if (!message.trim() || recipients.length === 0) {
      return toast.error("Message et destinataires requis");
    }
    setSending(true);
    setProgress({ done: 0, total: recipients.length, failed: 0 });

    const { data: { user } } = await supabase.auth.getUser();
    const { data: campaign } = await supabase.from("sms_campaigns").insert({
      message,
      recipients_count: recipients.length,
      status: "sending",
      sent_by_email: user?.email || null,
    }).select().single();

    let sent = 0, failed = 0;
    for (const to of recipients) {
      try {
        const { data, error } = await supabase.functions.invoke("marketing-send-sms", {
          body: { to, message },
        });
        if (error || (data as any)?.error) failed++;
        else sent++;
      } catch {
        failed++;
      }
      setProgress({ done: sent + failed, total: recipients.length, failed });
      // Throttle ~3/sec to respect OpenPhone rate limits
      await new Promise((r) => setTimeout(r, 350));
    }

    if (campaign?.id) {
      await supabase.from("sms_campaigns").update({
        sent_count: sent, failed_count: failed, status: "sent",
      }).eq("id", campaign.id);
    }

    setSending(false);
    toast.success(`Campagne terminée: ${sent} envoyés, ${failed} échecs`);
    setMessage(""); setRecipients([]);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campagnes SMS</h1>
        <p className="text-sm text-muted-foreground">Importez une liste de numéros et envoyez un SMS à tous via OpenPhone.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Nouvelle campagne</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Message ({message.length}/160)</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={320} placeholder="Salut! Profitez de notre offre Internet sans contrat…" />
          </div>

          <div className="space-y-1.5">
            <Label>Liste de numéros (CSV ou .txt)</Label>
            <div className="flex items-center gap-2">
              <Input ref={fileRef} type="file" accept=".csv,.txt" onChange={onFile} className="max-w-xs" />
              <span className="text-sm text-muted-foreground">{recipients.length} destinataires</span>
            </div>
            <p className="text-xs text-muted-foreground">Format accepté: un numéro par ligne ou séparés par virgule. E.164 recommandé (+15145551234).</p>
          </div>

          {sending && (
            <div className="rounded-md border border-border p-3 text-sm">
              Envoi en cours… {progress.done}/{progress.total} ({progress.failed} échecs)
            </div>
          )}

          <Button onClick={send} disabled={sending || !message.trim() || recipients.length === 0}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Envoyer à {recipients.length} destinataires
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Historique</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement…</div>
          ) : campaigns.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">Aucune campagne</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr><th className="text-left py-2">Date</th><th className="text-left">Message</th><th className="text-right">Total</th><th className="text-right">Envoyés</th><th className="text-right">Échecs</th><th className="text-right">Statut</th></tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="py-2 whitespace-nowrap text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("fr-CA")}</td>
                      <td className="max-w-md truncate">{c.message}</td>
                      <td className="text-right">{c.recipients_count}</td>
                      <td className="text-right text-emerald-600">{c.sent_count}</td>
                      <td className="text-right text-destructive">{c.failed_count}</td>
                      <td className="text-right text-xs">{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
