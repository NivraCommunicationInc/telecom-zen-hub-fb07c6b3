/**
 * AccountSmsDialog — Phase 14
 * Staff composer to send SMS to a client via OpenPhone + recent SMS log.
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Phone, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName: string;
  accountId?: string | null;
}

interface Template { key: string; label: string; body: string }
interface SmsLog {
  id: string; phone_number: string; direction: string;
  message_preview: string; status: string; agent_name: string | null;
  created_at: string;
}

const MAX_CHARS = 480;

export function AccountSmsDialog({ open, onClose, clientUserId, clientName, accountId }: Props) {
  const [tab, setTab] = useState("compose");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateKey, setTemplateKey] = useState("custom");
  const [message, setMessage] = useState("");
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [phoneRaw, setPhoneRaw] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const [resolve, recent] = await Promise.all([
        supabase.functions.invoke("sms-account-actions", {
          body: { action: "resolve_phone", client_user_id: clientUserId },
        }),
        supabase.functions.invoke("sms-account-actions", {
          body: { action: "list_recent", client_user_id: clientUserId },
        }),
      ]);
      if (resolve.error) throw new Error(resolve.error.message);
      setTemplates(resolve.data?.templates ?? []);
      setPhoneE164(resolve.data?.phone_e164 ?? null);
      setPhoneRaw(resolve.data?.phone_raw ?? null);
      if (!message) applyTemplate(resolve.data?.templates ?? [], "custom");
      setLogs(recent.data?.logs ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de charger les SMS");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientUserId]);

  const applyTemplate = (list: Template[], key: string) => {
    setTemplateKey(key);
    const t = list.find((x) => x.key === key);
    setMessage(t?.body ?? "");
  };

  const canSend = useMemo(
    () => !!phoneE164 && message.trim().length > 0 && message.length <= MAX_CHARS,
    [phoneE164, message]
  );

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("sms-account-actions", {
        body: {
          action: "send_sms",
          client_user_id: clientUserId,
          account_id: accountId ?? null,
          template_key: templateKey,
          message,
          reason: reason || null,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Échec d'envoi");
      const skipped = data?.result?.skipped;
      toast.success(skipped ? `SMS ignoré : ${data?.result?.reason ?? "déjà envoyé"}` : "SMS envoyé");
      setMessage("");
      setReason("");
      await loadOverview();
      setTab("history");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur d'envoi");
    } finally {
      setSending(false);
    }
  };

  const statusBadge = (s: string) => {
    const variant = s === "sent" ? "default" : s === "failed" ? "destructive" : "secondary";
    return <Badge variant={variant as any} className="text-[10px]">{s}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>SMS client</DialogTitle>
          <DialogDescription>
            Envoyer un SMS à {clientName} via OpenPhone et consulter l'historique récent.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />
          {loading ? "Chargement du numéro…"
            : phoneE164
              ? <>Numéro : <span className="font-mono text-foreground">{phoneE164}</span></>
              : <span className="text-amber-500">Aucun numéro mobile enregistré {phoneRaw ? `(brut : ${phoneRaw})` : ""}</span>
          }
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="compose">Composer</TabsTrigger>
            <TabsTrigger value="history">Historique ({logs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4">
            <div className="space-y-2">
              <Label>Modèle</Label>
              <Select value={templateKey} onValueChange={(v) => applyTemplate(templates, v)} disabled={sending}>
                <SelectTrigger><SelectValue placeholder="Choisir un modèle…" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
                rows={6}
                placeholder="Contenu du SMS"
                disabled={sending}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Texte brut · 1 SMS ≈ 160 caractères</span>
                <span className={message.length > 320 ? "text-amber-500" : ""}>{message.length} / {MAX_CHARS}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motif interne (optionnel)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Pour audit — ex. suivi ticket #1234"
                disabled={sending}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={sending}>Annuler</Button>
              <Button onClick={handleSend} disabled={!canSend || sending}>
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Envoyer le SMS
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-2">
            {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>}
            {!loading && logs.length === 0 && (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                <MessageSquare className="h-5 w-5 mx-auto mb-2 opacity-50" />
                Aucun SMS récent pour ce client.
              </div>
            )}
            <div className="max-h-80 overflow-y-auto space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="rounded-md border p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{format(new Date(l.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })} · {l.direction}</span>
                    {statusBadge(l.status)}
                  </div>
                  <div className="text-foreground whitespace-pre-wrap">{l.message_preview}</div>
                  <div className="text-xs text-muted-foreground font-mono">{l.phone_number} · {l.agent_name ?? "—"}</div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
