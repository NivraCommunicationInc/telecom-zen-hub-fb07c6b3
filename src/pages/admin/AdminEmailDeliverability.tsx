import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Send, CheckCircle2, XCircle, AlertTriangle, Mail, ExternalLink, Copy, Eye, MousePointer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface EmailQueueRecord {
  id: string;
  event_key: string;
  to_email: string;
  template_key: string;
  status: string;
  provider_message_id: string | null;
  provider_status: string | null;
  from_email: string | null;
  subject: string | null;
  resend_response: Record<string, any> | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  last_error: string | null;
  attempts: number;
}

interface EmailEvent {
  id: string;
  message_id: string;
  event_type: string;
  raw: Record<string, any>;
  created_at: string;
}

// Status badge component
const StatusBadge = ({ status }: { status: string | null }) => {
  if (!status) return <Badge variant="outline">—</Badge>;
  
  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon?: any }> = {
    queued: { variant: "outline", label: "En attente" },
    pending: { variant: "outline", label: "En attente" },
    processing: { variant: "secondary", label: "Traitement..." },
    sent: { variant: "secondary", label: "Envoyé", icon: Mail },
    delivered: { variant: "default", label: "Livré", icon: CheckCircle2 },
    opened: { variant: "default", label: "Ouvert", icon: Eye },
    clicked: { variant: "default", label: "Cliqué", icon: MousePointer },
    bounced: { variant: "destructive", label: "Bounce", icon: XCircle },
    complained: { variant: "destructive", label: "Plainte", icon: AlertTriangle },
    failed: { variant: "destructive", label: "Échec", icon: XCircle },
  };
  
  const config = statusConfig[status] || { variant: "outline" as const, label: status };
  const Icon = config.icon;
  
  return (
    <Badge variant={config.variant} className="gap-1">
      {Icon && <Icon className="w-3 h-3" />}
      {config.label}
    </Badge>
  );
};

// DNS Checklist component
const DNSChecklist = () => {
  const domain = "nivratelecom.ca";
  
  const dnsRecords = [
    {
      type: "DKIM",
      name: `resend._domainkey.${domain}`,
      recordType: "TXT",
      description: "Authentifie les emails envoyés via Resend",
      howTo: "Allez dans Resend Dashboard > Domains > Vérifiez les enregistrements DNS",
    },
    {
      type: "SPF",
      name: domain,
      recordType: "TXT",
      value: "v=spf1 include:_spf.resend.com ~all",
      description: "Autorise les serveurs Resend à envoyer pour votre domaine",
      howTo: "Ajoutez un seul enregistrement SPF qui inclut _spf.resend.com",
    },
    {
      type: "DMARC",
      name: `_dmarc.${domain}`,
      recordType: "TXT",
      value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@nivratelecom.ca",
      description: "Politique de rejet pour les emails non authentifiés",
      howTo: "Créez un enregistrement _dmarc avec votre politique",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          Checklist DNS — Délivrabilité Email
        </CardTitle>
        <CardDescription>
          Vérifiez que tous les enregistrements DNS sont correctement configurés pour éviter les problèmes de livraison.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {dnsRecords.map((record) => (
          <div key={record.type} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{record.recordType}</Badge>
                <span className="font-medium">{record.type}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => {
                navigator.clipboard.writeText(record.name);
                toast.success("Nom copié!");
              }}>
                <Copy className="w-4 h-4 mr-1" />
                Copier
              </Button>
            </div>
            <p className="text-sm font-mono bg-muted p-2 rounded">{record.name}</p>
            {record.value && (
              <p className="text-xs font-mono bg-muted/50 p-2 rounded text-muted-foreground">{record.value}</p>
            )}
            <p className="text-sm text-muted-foreground">{record.description}</p>
            <p className="text-xs text-muted-foreground">
              <strong>Comment vérifier:</strong> {record.howTo}
            </p>
          </div>
        ))}
        
        <div className="pt-4 border-t">
          <Button variant="outline" asChild>
            <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Ouvrir Resend Dashboard
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const AdminEmailDeliverability = () => {
  const queryClient = useQueryClient();
  const [testEmail, setTestEmail] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<EmailQueueRecord | null>(null);

  // Fetch last 200 emails from email_queue
  const { data: emails, isLoading: emailsLoading, refetch: refetchEmails } = useQuery({
    queryKey: ["email-deliverability-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      
      if (error) throw error;
      return data as EmailQueueRecord[];
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch email events
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["email-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as EmailEvent[];
    },
    refetchInterval: 30000,
  });

  // Send test email mutation
  const sendTestMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke("process-email-queue", {
        body: { action: "send_test", to_email: email },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Email test envoyé à ${testEmail}`, {
        description: `ID: ${data.provider_message_id}`,
      });
      refetchEmails();
    },
    onError: (error: any) => {
      toast.error("Échec de l'envoi", {
        description: error.message,
      });
    },
  });

  // Stats calculation
  const stats = {
    total: emails?.length || 0,
    sent: emails?.filter(e => e.status === "sent").length || 0,
    delivered: emails?.filter(e => e.provider_status === "delivered" || e.delivered_at).length || 0,
    opened: emails?.filter(e => e.provider_status === "opened" || e.opened_at).length || 0,
    bounced: emails?.filter(e => e.provider_status === "bounced" || e.bounced_at).length || 0,
    failed: emails?.filter(e => e.status === "failed").length || 0,
  };

  const deliveryRate = stats.sent > 0 ? ((stats.delivered / stats.sent) * 100).toFixed(1) : "—";
  const openRate = stats.delivered > 0 ? ((stats.opened / stats.delivered) * 100).toFixed(1) : "—";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Email Deliverability</h1>
            <p className="text-muted-foreground">Diagnostic et suivi de la livraison des emails</p>
          </div>
          <Button onClick={() => refetchEmails()} disabled={emailsLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${emailsLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total (200 derniers)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-primary">{stats.sent}</div>
              <p className="text-xs text-muted-foreground">Envoyés</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-emerald-600">{stats.delivered}</div>
              <p className="text-xs text-muted-foreground">Livrés ({deliveryRate}%)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-violet-600">{stats.opened}</div>
              <p className="text-xs text-muted-foreground">Ouverts ({openRate}%)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-600">{stats.bounced}</div>
              <p className="text-xs text-muted-foreground">Bounce</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-destructive">{stats.failed}</div>
              <p className="text-xs text-muted-foreground">Échecs</p>
            </CardContent>
          </Card>
        </div>

        {/* Test Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Envoyer un email test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="test-email">Adresse email de test</Label>
                <Input
                  id="test-email"
                  type="email"
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </div>
              <Button
                onClick={() => sendTestMutation.mutate(testEmail)}
                disabled={!testEmail || sendTestMutation.isPending}
              >
                {sendTestMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Envoyer test
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="emails">
          <TabsList>
            <TabsTrigger value="emails">Emails envoyés ({stats.total})</TabsTrigger>
            <TabsTrigger value="events">Événements webhook ({events?.length || 0})</TabsTrigger>
            <TabsTrigger value="dns">Checklist DNS</TabsTrigger>
          </TabsList>

          <TabsContent value="emails" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Destinataire</TableHead>
                        <TableHead>Sujet</TableHead>
                        <TableHead>Statut Queue</TableHead>
                        <TableHead>Statut Resend</TableHead>
                        <TableHead>Resend ID</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailsLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : emails?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Aucun email trouvé
                          </TableCell>
                        </TableRow>
                      ) : (
                        emails?.map((email) => (
                          <TableRow key={email.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(email.created_at), "dd MMM HH:mm", { locale: fr })}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate" title={email.to_email}>
                              {email.to_email}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate" title={email.subject || undefined}>
                              {email.subject || email.template_key}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={email.status} />
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={email.provider_status} />
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {email.provider_message_id ? (
                                <span title={email.provider_message_id}>
                                  {email.provider_message_id.substring(0, 12)}...
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedEmail(email)}
                              >
                                Détails
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Message ID</TableHead>
                        <TableHead>Données</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventsLoading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : events?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Aucun événement webhook reçu
                          </TableCell>
                        </TableRow>
                      ) : (
                        events?.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(event.created_at), "dd MMM HH:mm:ss", { locale: fr })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{event.event_type}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {event.message_id?.substring(0, 16)}...
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              <pre className="text-xs bg-muted p-1 rounded overflow-hidden">
                                {JSON.stringify(event.raw?.data || event.raw, null, 1).substring(0, 100)}...
                              </pre>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dns" className="mt-4">
            <DNSChecklist />
          </TabsContent>
        </Tabs>

        {/* Email Details Modal */}
        {selectedEmail && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedEmail(null)}>
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <CardTitle>Détails de l'email</CardTitle>
                <CardDescription>{selectedEmail.id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Destinataire</Label>
                    <p>{selectedEmail.to_email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Expéditeur</Label>
                    <p>{selectedEmail.from_email || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Sujet</Label>
                    <p>{selectedEmail.subject || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Template</Label>
                    <p>{selectedEmail.template_key}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Statut Queue</Label>
                    <p><StatusBadge status={selectedEmail.status} /></p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Statut Resend</Label>
                    <p><StatusBadge status={selectedEmail.provider_status} /></p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Créé le</Label>
                    <p>{format(new Date(selectedEmail.created_at), "PPpp", { locale: fr })}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Envoyé le</Label>
                    <p>{selectedEmail.sent_at ? format(new Date(selectedEmail.sent_at), "PPpp", { locale: fr }) : "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Livré le</Label>
                    <p>{selectedEmail.delivered_at ? format(new Date(selectedEmail.delivered_at), "PPpp", { locale: fr }) : "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Ouvert le</Label>
                    <p>{selectedEmail.opened_at ? format(new Date(selectedEmail.opened_at), "PPpp", { locale: fr }) : "—"}</p>
                  </div>
                </div>
                
                {selectedEmail.last_error && (
                  <div>
                    <Label className="text-muted-foreground">Dernière erreur</Label>
                    <p className="text-red-600 bg-red-50 p-2 rounded text-sm">{selectedEmail.last_error}</p>
                  </div>
                )}

                <div>
                  <Label className="text-muted-foreground">Resend Message ID</Label>
                  <p className="font-mono text-xs bg-muted p-2 rounded break-all">
                    {selectedEmail.provider_message_id || "—"}
                  </p>
                </div>

                {selectedEmail.resend_response && (
                  <div>
                    <Label className="text-muted-foreground">Réponse Resend (JSON)</Label>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
                      {JSON.stringify(selectedEmail.resend_response, null, 2)}
                    </pre>
                  </div>
                )}

                <Button variant="outline" className="w-full" onClick={() => setSelectedEmail(null)}>
                  Fermer
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminEmailDeliverability;
