/**
 * CoreEmailActivityPage — Email activity log & queue management.
 * Mirrors old admin AdminEmailActivity.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mail, Search, RefreshCcw, Eye, Send, Clock, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  sent: "bg-emerald-500/20 text-emerald-400",
  delivered: "bg-emerald-500/20 text-emerald-400",
  failed: "bg-red-500/20 text-red-400",
  bounced: "bg-red-500/20 text-red-400",
  queued: "bg-blue-500/20 text-blue-400",
};

export default function CoreEmailActivityPage() {
  const [tab, setTab] = useState("queue");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: queueEmails = [], isLoading: loadingQueue } = useQuery({
    queryKey: ["core-email-queue", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("email_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: dispatches = [], isLoading: loadingDispatches } = useQuery({
    queryKey: ["core-email-dispatches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automatic_email_dispatches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: notifLogs = [], isLoading: loadingNotifLogs } = useQuery({
    queryKey: ["core-admin-notif-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_notification_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_queue")
        .update({ status: "pending", attempts: 0 })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Email remis en file d'attente");
      queryClient.invalidateQueries({ queryKey: ["core-email-queue"] });
    },
  });

  const filtered = queueEmails.filter((e: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.to_email?.toLowerCase().includes(q) ||
      e.subject?.toLowerCase().includes(q) ||
      e.template_key?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-emerald-400" />
          <h1 className="text-lg font-semibold text-white">Activité Email</h1>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["core-email-queue"] })}
          className="border-[hsl(220,15%,20%)] text-[hsl(220,10%,60%)] hover:text-white"
        >
          <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Actualiser
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,18%)]">
          <TabsTrigger value="queue">File d'attente ({queueEmails.length})</TabsTrigger>
          <TabsTrigger value="dispatches">Dispatches auto ({dispatches.length})</TabsTrigger>
          <TabsTrigger value="notifications">Notifs admin ({notifLogs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(220,10%,40%)]" />
              <Input
                placeholder="Rechercher par email, sujet, template…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white text-xs"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="sent">Envoyé</SelectItem>
                <SelectItem value="failed">Échoué</SelectItem>
                <SelectItem value="queued">En file</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[hsl(220,15%,12%)]">
                <tr className="text-[hsl(220,10%,50%)]">
                  <th className="text-left p-2.5 font-medium">Destinataire</th>
                  <th className="text-left p-2.5 font-medium">Sujet</th>
                  <th className="text-left p-2.5 font-medium">Template</th>
                  <th className="text-left p-2.5 font-medium">Statut</th>
                  <th className="text-left p-2.5 font-medium">Date</th>
                  <th className="text-right p-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                {loadingQueue ? (
                  <tr><td colSpan={6} className="text-center py-8 text-[hsl(220,10%,40%)]">Chargement…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-[hsl(220,10%,40%)]">Aucun email</td></tr>
                ) : (
                  filtered.map((email: any) => (
                    <tr key={email.id} className="hover:bg-[hsl(220,15%,12%)]">
                      <td className="p-2.5 text-white font-mono">{email.to_email}</td>
                      <td className="p-2.5 text-[hsl(220,10%,70%)] max-w-[200px] truncate">{email.subject || "—"}</td>
                      <td className="p-2.5"><Badge variant="outline" className="text-[10px]">{email.template_key || "custom"}</Badge></td>
                      <td className="p-2.5">
                        <Badge className={`text-[10px] ${STATUS_COLORS[email.status] || "bg-gray-500/20 text-gray-400"}`}>
                          {email.status}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-[hsl(220,10%,50%)]">
                        {email.created_at ? format(new Date(email.created_at), "dd MMM HH:mm", { locale: fr }) : "—"}
                      </td>
                      <td className="p-2.5 text-right space-x-1">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setSelectedEmail(email)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        {email.status === "failed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] text-yellow-400"
                            onClick={() => retryMutation.mutate(email.id)}
                          >
                            <RefreshCcw className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="dispatches" className="space-y-3">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[hsl(220,15%,12%)]">
                <tr className="text-[hsl(220,10%,50%)]">
                  <th className="text-left p-2.5 font-medium">Événement</th>
                  <th className="text-left p-2.5 font-medium">Scope</th>
                  <th className="text-left p-2.5 font-medium">Template</th>
                  <th className="text-left p-2.5 font-medium">Version</th>
                  <th className="text-left p-2.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                {loadingDispatches ? (
                  <tr><td colSpan={5} className="text-center py-8 text-[hsl(220,10%,40%)]">Chargement…</td></tr>
                ) : dispatches.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-[hsl(220,10%,40%)]">Aucun dispatch</td></tr>
                ) : (
                  dispatches.map((d: any) => (
                    <tr key={d.id} className="hover:bg-[hsl(220,15%,12%)]">
                      <td className="p-2.5 text-white">{d.event_type}</td>
                      <td className="p-2.5"><Badge variant="outline" className="text-[10px]">{d.event_scope}</Badge></td>
                      <td className="p-2.5 text-[hsl(220,10%,70%)] font-mono">{d.template_key}</td>
                      <td className="p-2.5 text-[hsl(220,10%,50%)]">{d.event_version}</td>
                      <td className="p-2.5 text-[hsl(220,10%,50%)]">
                        {d.created_at ? format(new Date(d.created_at), "dd MMM HH:mm", { locale: fr }) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-3">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[hsl(220,15%,12%)]">
                <tr className="text-[hsl(220,10%,50%)]">
                  <th className="text-left p-2.5 font-medium">Type</th>
                  <th className="text-left p-2.5 font-medium">Client</th>
                  <th className="text-left p-2.5 font-medium">Envoyé à</th>
                  <th className="text-left p-2.5 font-medium">Priorité</th>
                  <th className="text-left p-2.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                {loadingNotifLogs ? (
                  <tr><td colSpan={5} className="text-center py-8 text-[hsl(220,10%,40%)]">Chargement…</td></tr>
                ) : notifLogs.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-[hsl(220,10%,40%)]">Aucune notification</td></tr>
                ) : (
                  notifLogs.map((n: any) => (
                    <tr key={n.id} className="hover:bg-[hsl(220,15%,12%)]">
                      <td className="p-2.5 text-white">{n.event_type}</td>
                      <td className="p-2.5 text-[hsl(220,10%,70%)]">{n.client_name || n.client_email || "—"}</td>
                      <td className="p-2.5 text-[hsl(220,10%,70%)] font-mono">{n.sent_to || "—"}</td>
                      <td className="p-2.5">
                        <Badge className={`text-[10px] ${n.priority === "high" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>
                          {n.priority || "normal"}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-[hsl(220,10%,50%)]">
                        {n.created_at ? format(new Date(n.created_at), "dd MMM HH:mm", { locale: fr }) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Email detail dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Détail email</DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-[hsl(220,10%,50%)]">À :</span> <span className="text-white font-mono">{selectedEmail.to_email}</span></div>
                <div><span className="text-[hsl(220,10%,50%)]">Statut :</span> <Badge className={`text-[10px] ml-1 ${STATUS_COLORS[selectedEmail.status] || ""}`}>{selectedEmail.status}</Badge></div>
                <div><span className="text-[hsl(220,10%,50%)]">Template :</span> <span className="text-white">{selectedEmail.template_key || "—"}</span></div>
                <div><span className="text-[hsl(220,10%,50%)]">Tentatives :</span> <span className="text-white">{selectedEmail.attempts ?? 0}</span></div>
              </div>
              <div>
                <span className="text-[hsl(220,10%,50%)]">Sujet :</span>
                <p className="text-white mt-1">{selectedEmail.subject || "—"}</p>
              </div>
              {selectedEmail.error_message && (
                <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
                  <span className="text-red-400">Erreur : </span>
                  <span className="text-red-300">{selectedEmail.error_message}</span>
                </div>
              )}
              <div>
                <span className="text-[hsl(220,10%,50%)]">Créé :</span>
                <span className="text-white ml-1">
                  {selectedEmail.created_at ? format(new Date(selectedEmail.created_at), "PPpp", { locale: fr }) : "—"}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
