import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Mail, Send, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface EmailQueueItem {
  id: string;
  event_key: string;
  to_email: string;
  template_key: string;
  template_vars: Record<string, any>;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  provider_message_id: string | null;
  sent_at: string | null;
  created_at: string;
}

const AdminEmailActivity = () => {
  const { user } = useAuth();
  const [emails, setEmails] = useState<EmailQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  const fetchEmails = async () => {
    try {
      const { data, error } = await supabase
        .from("email_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setEmails((data as EmailQueueItem[]) || []);
    } catch (err) {
      console.error("Error fetching emails:", err);
      toast.error("Erreur lors du chargement des emails");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const handleSendTestEmail = async () => {
    if (!user?.email) {
      toast.error("Aucun email utilisateur trouvé");
      return;
    }

    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-email-queue", {
        body: { to_email: user.email },
        headers: {
          "Content-Type": "application/json",
        },
      });

      // The function uses query params for test mode
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-email-queue?test=true`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ to_email: user.email }),
        }
      );

      const result = await response.json();

      if (result.success) {
        toast.success(
          <div className="space-y-1">
            <p className="font-medium">Email de test envoyé!</p>
            <p className="text-sm text-muted-foreground">Destinataire: {result.recipient}</p>
            <p className="text-sm text-muted-foreground">Template: {result.template}</p>
            <p className="text-sm text-muted-foreground">ID Resend: {result.provider_message_id}</p>
          </div>
        );
      } else {
        toast.error(result.error || "Échec de l'envoi");
      }
    } catch (err: any) {
      console.error("Test email error:", err);
      toast.error(err.message || "Erreur lors de l'envoi du test");
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleProcessQueue = async () => {
    setIsProcessingQueue(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-email-queue`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (result.success) {
        toast.success(`${result.processed} emails traités`);
        fetchEmails();
      } else {
        toast.error(result.error || "Échec du traitement");
      }
    } catch (err: any) {
      console.error("Process queue error:", err);
      toast.error(err.message || "Erreur lors du traitement");
    } finally {
      setIsProcessingQueue(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Envoyé</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Échoué</Badge>;
      case "processing":
        return <Badge className="bg-blue-500"><Clock className="w-3 h-3 mr-1" />En cours</Badge>;
      case "queued":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTemplateLabel = (key: string) => {
    const labels: Record<string, string> = {
      order_submitted: "Commande soumise",
      order_processed: "Commande traitée",
      order_shipped: "Commande expédiée",
      order_completed: "Commande terminée",
      order_cancelled: "Commande annulée",
      invoice_created: "Facture créée",
      payment_received: "Paiement reçu",
      invoice_overdue: "Facture en retard",
      payment_failed: "Paiement échoué",
      ticket_created: "Ticket créé",
      ticket_reply: "Réponse ticket",
      appointment_scheduled: "RDV planifié",
      appointment_updated: "RDV modifié",
      appointment_cancelled: "RDV annulé",
      test_email: "Test",
    };
    return labels[key] || key;
  };

  const stats = {
    total: emails.length,
    sent: emails.filter((e) => e.status === "sent").length,
    failed: emails.filter((e) => e.status === "failed").length,
    queued: emails.filter((e) => e.status === "queued").length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Activité Email</h1>
            <p className="text-muted-foreground">Suivi des emails transactionnels envoyés par le système</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchEmails}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Button
              variant="outline"
              onClick={handleProcessQueue}
              disabled={isProcessingQueue}
            >
              <Mail className="w-4 h-4 mr-2" />
              {isProcessingQueue ? "Traitement..." : "Traiter la queue"}
            </Button>
            <Button
              onClick={handleSendTestEmail}
              disabled={isSendingTest}
            >
              <Send className="w-4 h-4 mr-2" />
              {isSendingTest ? "Envoi..." : "Envoyer email test"}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total (derniers 50)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-500">{stats.sent}</div>
              <p className="text-xs text-muted-foreground">Envoyés</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
              <p className="text-xs text-muted-foreground">Échoués</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-500">{stats.queued}</div>
              <p className="text-xs text-muted-foreground">En attente</p>
            </CardContent>
          </Card>
        </div>

        {/* Email Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Derniers emails
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : emails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aucun email dans la queue</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destinataire</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tentatives</TableHead>
                    <TableHead>Erreur</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead>Envoyé le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emails.map((email) => (
                    <TableRow key={email.id}>
                      <TableCell className="font-mono text-sm">{email.to_email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTemplateLabel(email.template_key)}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(email.status)}</TableCell>
                      <TableCell>
                        {email.attempts}/{email.max_attempts}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-red-500 text-sm">
                        {email.last_error || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(email.created_at), "dd MMM HH:mm", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {email.sent_at
                          ? format(new Date(email.sent_at), "dd MMM HH:mm", { locale: fr })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Provider Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Fournisseur:</span>
                <span className="ml-2 font-medium">Resend</span>
              </div>
              <div>
                <span className="text-muted-foreground">Clé API:</span>
                <span className="ml-2 font-medium text-green-500">Configurée</span>
              </div>
              <div>
                <span className="text-muted-foreground">Email expéditeur:</span>
                <span className="ml-2 font-medium">Nivra (via Resend)</span>
              </div>
              <div>
                <span className="text-muted-foreground">Tentatives max:</span>
                <span className="ml-2 font-medium">5 (avec backoff exponentiel)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminEmailActivity;
