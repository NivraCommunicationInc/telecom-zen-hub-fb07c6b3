/**
 * AccountCallsDialog — Phase 15
 * Staff telephony console: recent call history, click-to-call (OpenPhone deep link)
 * and manual call log (inbound/outbound + disposition + notes).
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, PhoneIncoming, PhoneOutgoing, ExternalLink } from "lucide-react";
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

interface CallLog {
  id: string;
  phone_number: string;
  direction: string;
  status: string;
  agent_name: string | null;
  message_preview: string | null;
  created_at: string;
}

const DISPOSITION_LABELS: Record<string, string> = {
  answered: "Répondu",
  voicemail: "Boîte vocale",
  no_answer: "Pas de réponse",
  busy: "Occupé",
  wrong_number: "Mauvais numéro",
  callback_requested: "Rappel demandé",
  resolved: "Résolu",
};

export function AccountCallsDialog({ open, onClose, clientUserId, clientName, accountId }: Props) {
  const [tab, setTab] = useState("history");
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [phoneRaw, setPhoneRaw] = useState<string | null>(null);
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [reason, setReason] = useState("");

  // manual log form
  const [direction, setDirection] = useState<"inbound" | "outbound">("outbound");
  const [disposition, setDisposition] = useState("answered");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [logging, setLogging] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [resolve, recent] = await Promise.all([
        supabase.functions.invoke("calls-account-actions", {
          body: { action: "resolve_phone", client_user_id: clientUserId },
        }),
        supabase.functions.invoke("calls-account-actions", {
          body: { action: "list_recent", client_user_id: clientUserId },
        }),
      ]);
      if (resolve.error) throw new Error(resolve.error.message);
      if (recent.error) throw new Error(recent.error.message);
      setPhoneE164((resolve.data as any)?.phone_e164 ?? null);
      setPhoneRaw((resolve.data as any)?.phone_raw ?? null);
      setLogs(((recent.data as any)?.logs ?? []) as CallLog[]);
    } catch (e) {
      toast.error("Erreur de chargement", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && clientUserId) {
      setReason("");
      setNotes("");
      setDuration("");
      setDirection("outbound");
      setDisposition("answered");
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientUserId]);

  const handleInitiate = async () => {
    if (!phoneE164) {
      toast.error("Aucun numéro valide pour ce client");
      return;
    }
    if (!reason.trim()) {
      toast.error("Motif requis pour journaliser l'appel");
      return;
    }
    setInitiating(true);
    try {
      const { data, error } = await supabase.functions.invoke("calls-account-actions", {
        body: {
          action: "initiate_call",
          client_user_id: clientUserId,
          account_id: accountId ?? null,
          reason: reason.trim(),
        },
      });
      if (error) throw new Error(error.message);
      const payload = data as any;
      // Try OpenPhone deep link first, fall back to tel:
      try {
        window.location.href = payload.deep_link;
        setTimeout(() => {
          window.open(payload.web_link, "_blank", "noopener,noreferrer");
        }, 600);
      } catch {
        window.location.href = payload.tel_link;
      }
      toast.success("Appel journalisé", { description: phoneE164 });
      await load();
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setInitiating(false);
    }
  };

  const handleLogManual = async () => {
    if (!reason.trim()) {
      toast.error("Motif requis pour journaliser");
      return;
    }
    setLogging(true);
    try {
      const { error } = await supabase.functions.invoke("calls-account-actions", {
        body: {
          action: "log_manual_call",
          client_user_id: clientUserId,
          account_id: accountId ?? null,
          direction,
          disposition,
          duration_seconds: duration ? Number(duration) : undefined,
          notes: notes.trim(),
          reason: reason.trim(),
        },
      });
      if (error) throw new Error(error.message);
      toast.success("Appel enregistré");
      setNotes("");
      setDuration("");
      await load();
      setTab("history");
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setLogging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Appels & téléphonie — {clientName}
          </DialogTitle>
          <DialogDescription>
            Historique d'appels, click-to-call OpenPhone et journalisation manuelle. Toutes les actions sont auditées.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="history">Historique</TabsTrigger>
            <TabsTrigger value="call">Appeler</TabsTrigger>
            <TabsTrigger value="log">Journaliser</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-2">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : logs.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">Aucun appel enregistré.</div>
            ) : (
              logs.map((l) => (
                <div key={l.id} className="rounded-md border p-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    {l.direction === "inbound"
                      ? <PhoneIncoming className="h-4 w-4 mt-0.5 text-emerald-500" />
                      : <PhoneOutgoing className="h-4 w-4 mt-0.5 text-violet-500" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{l.phone_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.agent_name ?? "—"} · {format(new Date(l.created_at), "PPp", { locale: fr })}
                      </p>
                      {l.message_preview && (
                        <p className="text-xs mt-1 whitespace-pre-wrap">{l.message_preview}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {DISPOSITION_LABELS[l.status] ?? l.status}
                  </Badge>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="call" className="space-y-3">
            <div className="rounded-md border p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Numéro résolu</p>
              <p className="text-sm font-medium">
                {phoneE164 ?? phoneRaw ?? <span className="text-red-500">Aucun numéro enregistré</span>}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Motif de l'appel</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex. Suivi paiement, validation KYC…"
              />
            </div>
            <Button
              onClick={handleInitiate}
              disabled={initiating || !phoneE164}
              className="w-full"
            >
              {initiating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
              Lancer l'appel via OpenPhone
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Ouvre OpenPhone (app desktop si installé, sinon web). L'appel est journalisé dans l'historique
              avec le motif et tracé dans l'audit.
            </p>
          </TabsContent>

          <TabsContent value="log" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select value={direction} onValueChange={(v) => setDirection(v as "inbound" | "outbound")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Sortant</SelectItem>
                    <SelectItem value="inbound">Entrant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Résultat</Label>
                <Select value={disposition} onValueChange={setDisposition}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DISPOSITION_LABELS).map(([k, lbl]) => (
                      <SelectItem key={k} value={k}>{lbl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Durée (secondes, optionnel)</Label>
              <Input type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes d'appel</Label>
              <Textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Résumé de la conversation, prochaines étapes…"
              />
            </div>
            <div className="space-y-2">
              <Label>Motif interne (audit)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Pourquoi cette journalisation manuelle ?"
              />
            </div>
            <Button onClick={handleLogManual} disabled={logging} className="w-full">
              {logging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enregistrer l'appel
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
