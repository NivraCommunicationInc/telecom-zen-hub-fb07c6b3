/**
 * WorkbenchCommunicationsTab — Email/SMS/notification history + quick send actions
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, MessageSquare, Bell, Send, Loader2 } from "lucide-react";
import { adminClient as supabase } from "@/integrations/backend";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useActivityLog } from "@/hooks/useActivityLog";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  orderId: string;
  orderNumber?: string;
  clientEmail?: string;
}

const QUICK_TEMPLATES = [
  { key: "payment_reminder", label: "Rappel de paiement" },
  { key: "kyc_reminder", label: "Rappel KYC" },
  { key: "appointment_confirmation", label: "Confirmation de RDV" },
  { key: "shipment_notification", label: "Notification d'expédition" },
  { key: "activation_complete", label: "Service activé" },
  { key: "custom", label: "Message personnalisé" },
];

export function WorkbenchCommunicationsTab({ orderId, orderNumber, clientEmail }: Props) {
  const { user } = useAuth();
  const { logActivity } = useActivityLog();
  const queryClient = useQueryClient();
  const [template, setTemplate] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Load notification logs for this order
  const { data: notifications = [] } = useQuery({
    queryKey: ["workbench-notifications", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_notification_logs")
        .select("*")
        .or(`event_id.eq.${orderId},event_number.eq.${orderNumber || "___"}`)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Load internal notes as communication entries
  const { data: notes = [] } = useQuery({
    queryKey: ["workbench-comm-notes", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("entity_id", orderId)
        .in("action", ["internal_note", "send_communication", "send_email", "send_sms"])
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const handleSend = async () => {
    if (!template) return;
    setIsSending(true);
    try {
      const messageContent = template === "custom" ? customMessage : `Template: ${template}`;
      
      // Log the communication action
      await logActivity("send_communication", "order", orderId, {
        template,
        message: messageContent,
        recipient: clientEmail,
      });

      // Queue email if configured
      if (clientEmail) {
        await supabase.from("admin_notification_logs").insert({
          event_type: template,
          event_id: orderId,
          event_number: orderNumber,
          client_email: clientEmail,
          sent_to: clientEmail,
          priority: "normal",
        });
      }

      toast.success("Communication enregistrée ✓");
      setTemplate("");
      setCustomMessage("");
      queryClient.invalidateQueries({ queryKey: ["workbench-notifications", orderId] });
      queryClient.invalidateQueries({ queryKey: ["workbench-comm-notes", orderId] });
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setIsSending(false);
    }
  };

  const allComms = [
    ...notifications.map((n: any) => ({ ...n, type: "notification", source: "email" })),
    ...notes.map((n: any) => ({ ...n, type: "note", source: n.action })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-4">
      {/* Quick send */}
      <div className="border border-border rounded-lg bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" /> Envoyer une communication
        </h3>
        <div className="space-y-3">
          <Select value={template} onValueChange={setTemplate}>
            <SelectTrigger><SelectValue placeholder="Choisir un modèle…" /></SelectTrigger>
            <SelectContent>
              {QUICK_TEMPLATES.map(t => (
                <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {template === "custom" && (
            <Textarea
              placeholder="Message personnalisé…"
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              className="min-h-[80px]"
            />
          )}
          {clientEmail && (
            <p className="text-xs text-muted-foreground">Destinataire: {clientEmail}</p>
          )}
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSend} disabled={!template || isSending || (template === "custom" && !customMessage.trim())}>
              {isSending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
              Envoyer
            </Button>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="border border-border rounded-lg bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" /> Historique ({allComms.length})
        </h3>
        {allComms.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune communication enregistrée</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {allComms.map((c: any, i: number) => (
              <div key={c.id || i} className="p-3 rounded bg-muted/50 border border-border">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {c.type === "notification" ? (
                      <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : c.source === "send_sms" ? (
                      <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : (
                      <Bell className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                    <div>
                      <p className="text-sm text-foreground">
                        {c.event_type || c.action || "Communication"}
                      </p>
                      {c.sent_to && <p className="text-xs text-muted-foreground">→ {c.sent_to}</p>}
                      {c.reason && <p className="text-xs text-muted-foreground">{c.reason}</p>}
                      {c.actor_name && <p className="text-xs text-muted-foreground">Par: {c.actor_name}</p>}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(c.created_at), "dd/MM HH:mm", { locale: fr })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
