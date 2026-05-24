/**
 * AccountCommunicationDialog — Phase 13
 * Staff composer to send a custom/templated email to a client account.
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName: string;
  clientEmail?: string | null;
  accountId?: string | null;
}

interface Template {
  key: string;
  label: string;
  subject: string;
  body: string;
}

export function AccountCommunicationDialog({
  open, onClose, clientUserId, clientName, clientEmail, accountId,
}: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateKey, setTemplateKey] = useState<string>("custom");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingTpl, setLoadingTpl] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingTpl(true);
    supabase.functions
      .invoke("communication-account-actions", {
        body: { action: "list_templates", client_user_id: clientUserId },
      })
      .then(({ data, error }) => {
        if (error) {
          toast.error("Impossible de charger les modèles");
          return;
        }
        const list = (data?.templates ?? []) as Template[];
        setTemplates(list);
        applyTemplate(list, "custom");
      })
      .finally(() => setLoadingTpl(false));
  }, [open, clientUserId]);

  const applyTemplate = (list: Template[], key: string) => {
    const t = list.find((x) => x.key === key);
    setTemplateKey(key);
    setSubject(t?.subject ?? "");
    const rendered = (t?.body ?? "").replace(/\{\{name\}\}/g, clientName || "client");
    setBodyText(rendered);
  };

  const canSend = useMemo(() => {
    return !!clientEmail && subject.trim().length > 0 && bodyText.trim().length > 0;
  }, [clientEmail, subject, bodyText]);

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("communication-account-actions", {
        body: {
          action: "send_email",
          client_user_id: clientUserId,
          client_email: clientEmail,
          client_name: clientName,
          account_id: accountId ?? null,
          template_key: templateKey,
          subject,
          body_text: bodyText,
          reason: reason || null,
        },
      });
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Échec de l'envoi");
      }
      toast.success(data?.already_queued ? "Message déjà en file" : "Message envoyé");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur d'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Communication client</DialogTitle>
          <DialogDescription>
            Envoyer un courriel à {clientName}
            {clientEmail ? ` (${clientEmail})` : ""} via le modèle corporate Nivra.
          </DialogDescription>
        </DialogHeader>

        {!clientEmail && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
            Ce compte n'a pas de courriel enregistré. Mettez à jour le profil avant d'envoyer un message.
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Modèle</Label>
            <Select
              value={templateKey}
              onValueChange={(v) => applyTemplate(templates, v)}
              disabled={loadingTpl || sending}
            >
              <SelectTrigger><SelectValue placeholder="Choisir un modèle…" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sujet</Label>
            <Input
              value={subject}
              maxLength={200}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Sujet du message"
              disabled={sending}
            />
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Contenu du message (paragraphes séparés par une ligne vide)"
              rows={10}
              disabled={sending}
            />
            <p className="text-xs text-muted-foreground">
              Le message est habillé du modèle corporate Nivra (logo, pied de page, mentions légales).
            </p>
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
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>Annuler</Button>
          <Button onClick={handleSend} disabled={!canSend || sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Envoyer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
