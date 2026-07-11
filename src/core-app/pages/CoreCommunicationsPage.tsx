/**
 * CoreCommunicationsPage — Module 46 (D46-A)
 *
 * Single unified Communications workspace. Merges the legacy
 * CoreCommunicationEmailPage + CoreCommunicationSMSPage into one screen
 * with tabs. The "Nouvelle communication" button navigates to the
 * canonical composer (EmailComposePage), which is the only frontend
 * entry point that writes through rpc_communication_enqueue.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, MessageSquare, Bell, Plus, Send } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function CoreCommunicationsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("email");

  const { data: emails = [] } = useQuery({
    queryKey: ["core-comm-email-queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_queue" as any)
        .select("id, to_email, template_key, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data as any[]) || [];
    },
  });

  const { data: sms = [] } = useQuery({
    queryKey: ["core-comm-sms-queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sms_queue" as any)
        .select("id, to_phone, message, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data as any[]) || [];
    },
  });

  const { data: notifs = [] } = useQuery({
    queryKey: ["core-comm-notif-outbox"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notification_outbox" as any)
        .select("id, to_email, event_type, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data as any[]) || [];
    },
  });

  const statusBadge = (s: string) => (
    <Badge
      className={
        s === "sent" || s === "delivered"
          ? "bg-emerald-600/15 text-emerald-400 border-0"
          : s === "failed" || s === "dlq"
            ? "bg-rose-600/15 text-rose-400 border-0"
            : "bg-amber-500/15 text-amber-400 border-0"
      }
    >
      {s}
    </Badge>
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">
            Communications
          </h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">
            Historique unifié — Email, SMS, Notifications
          </p>
        </div>
        <Button
          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          onClick={() => navigate("/core/email/compose")}
        >
          <Plus className="w-4 h-4" /> Nouvelle communication
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,20%)]">
          <TabsTrigger value="email" className="gap-2">
            <Mail className="w-4 h-4" /> Email
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquare className="w-4 h-4" /> SMS
          </TabsTrigger>
          <TabsTrigger value="notif" className="gap-2">
            <Bell className="w-4 h-4" /> Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-2">
          {emails.length === 0 ? (
            <div className="text-center py-12 text-[hsl(var(--core-text-label))]">
              Aucun email récent
            </div>
          ) : (
            emails.map((e: any) => (
              <div
                key={e.id}
                className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-[hsl(var(--core-text-primary))]">{e.to_email}</p>
                  <p className="text-xs text-[hsl(var(--core-text-label))]">
                    {e.template_key} · {format(new Date(e.created_at), "d MMM HH:mm", { locale: fr })}
                  </p>
                </div>
                {statusBadge(e.status)}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="sms" className="space-y-2">
          {sms.length === 0 ? (
            <div className="text-center py-12 text-[hsl(var(--core-text-label))]">
              Aucun SMS récent
            </div>
          ) : (
            sms.map((m: any) => (
              <div
                key={m.id}
                className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between"
              >
                <div className="min-w-0 pr-3">
                  <p className="text-sm text-[hsl(var(--core-text-primary))]">{m.to_phone}</p>
                  <p className="text-xs text-[hsl(var(--core-text-secondary))] line-clamp-1">
                    {m.message}
                  </p>
                </div>
                {statusBadge(m.status)}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="notif" className="space-y-2">
          {notifs.length === 0 ? (
            <div className="text-center py-12 text-[hsl(var(--core-text-label))]">
              Aucune notification
            </div>
          ) : (
            notifs.map((n: any) => (
              <div
                key={n.id}
                className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-[hsl(var(--core-text-primary))]">{n.to_email}</p>
                  <p className="text-xs text-[hsl(var(--core-text-label))]">
                    {n.event_type} · {format(new Date(n.created_at), "d MMM HH:mm", { locale: fr })}
                  </p>
                </div>
                {statusBadge(n.status)}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      <div className="pt-2 text-xs text-muted-foreground">
        <Send className="inline w-3 h-3 mr-1 -mt-0.5" />
        Toute nouvelle communication passe par la gateway canonique{" "}
        <code>rpc_communication_enqueue</code>.
      </div>
    </div>
  );
}
