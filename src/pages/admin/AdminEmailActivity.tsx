import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Mail, Send, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, ChevronDown, FileText, Shield } from "lucide-react";
import { format, addDays } from "date-fns";
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
  provider_status: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  bounced_at: string | null;
  created_at: string;
}

const TEMPLATE_OPTIONS = [
  { key: "test_email", label: "Test du système", category: "Système" },
  { key: "account_created", label: "Compte créé", category: "Compte" },
  { key: "email_verified", label: "Email vérifié", category: "Compte" },
  { key: "password_reset", label: "Réinitialisation mot de passe", category: "Compte" },
  { key: "order_submitted", label: "Commande soumise", category: "Commande" },
  { key: "order_processed", label: "Commande traitée", category: "Commande" },
  { key: "order_shipped", label: "Commande expédiée", category: "Commande" },
  { key: "order_completed", label: "Commande terminée", category: "Commande" },
  { key: "order_cancelled", label: "Commande annulée", category: "Commande" },
  { key: "shipping_created", label: "Expédition créée", category: "Commande" },
  { key: "invoice_created", label: "Facture créée", category: "Facture" },
  { key: "invoice_overdue", label: "Facture en retard", category: "Facture" },
  { key: "payment_received", label: "Paiement reçu", category: "Paiement" },
  { key: "payment_status_changed", label: "Statut paiement modifié", category: "Paiement" },
  { key: "payment_failed", label: "Paiement échoué", category: "Paiement" },
  { key: "ticket_created", label: "Ticket créé", category: "Support" },
  { key: "ticket_reply", label: "Réponse au ticket", category: "Support" },
  { key: "appointment_scheduled", label: "RDV planifié", category: "Rendez-vous" },
  { key: "appointment_updated", label: "RDV modifié", category: "Rendez-vous" },
  { key: "appointment_cancelled", label: "RDV annulé", category: "Rendez-vous" },
  { key: "contract_ready", label: "Contrat prêt", category: "Contrat" },
  { key: "contract_signed", label: "Contrat signé", category: "Contrat" },
];

const AdminEmailActivity = () => {
  const { user } = useAuth();
  const [emails, setEmails] = useState<EmailQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testRecipient, setTestRecipient] = useState("nivratelecom@gmail.com");

  // Template test modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("test_email");
  const [templateRecipient, setTemplateRecipient] = useState("nivratelecom@gmail.com");
  const [varsOpen, setVarsOpen] = useState(false);
  const [templateVars, setTemplateVars] = useState({
    order_number: "CMD-1001",
    invoice_number: "FAC-2001",
    ticket_number: "TCK-3001",
    contract_number: "CTR-4001",
    amount: "49.99",
    currency: "CAD",
    status: "Confirmed",
    scheduled_at: addDays(new Date(), 1).toISOString(),
    tracking_number: "TRK-123456",
    portal_path: "/client",
  });

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

  const openTestModal = () => {
    setShowTestModal(true);
  };

  const handleSendTestEmail = async () => {
    if (!testRecipient || !testRecipient.includes("@")) {
      toast.error("Veuillez entrer une adresse email valide");
      return;
    }

    setIsSendingTest(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-email-queue?test=true`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ to_email: testRecipient }),
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
        setShowTestModal(false);
        fetchEmails();
      } else {
        const errorMsg = result.error || "";
        if (errorMsg.includes("testing emails") || errorMsg.includes("verify a domain")) {
          toast.error(
            <div className="space-y-1">
              <p className="font-medium">Resend mode test</p>
              <p className="text-sm">Vous ne pouvez envoyer qu'à nivratelecom@gmail.com tant qu'un domaine n'est pas vérifié.</p>
            </div>
          );
        } else {
          toast.error(result.error || "Échec de l'envoi");
        }
      }
    } catch (err: any) {
      console.error("Test email error:", err);
      toast.error(err.message || "Erreur lors de l'envoi du test");
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSendTemplateTest = async () => {
    if (!templateRecipient || !templateRecipient.includes("@")) {
      toast.error("Veuillez entrer une adresse email valide");
      return;
    }

    setIsSendingTemplate(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-template-test`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            recipient: templateRecipient,
            template_key: selectedTemplate,
            variables: {
              ...templateVars,
              amount: parseFloat(templateVars.amount) || 0,
            },
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        toast.success(
          <div className="space-y-1">
            <p className="font-medium">Email de template envoyé!</p>
            <p className="text-sm text-muted-foreground">Destinataire: {result.recipient}</p>
            <p className="text-sm text-muted-foreground">Template: {result.template_key}</p>
            <p className="text-sm text-muted-foreground">ID Resend: {result.provider_id}</p>
          </div>
        );
        setShowTemplateModal(false);
        fetchEmails();
      } else {
        const errorMsg = result.error || "";
        if (errorMsg.includes("testing emails") || errorMsg.includes("verify a domain")) {
          toast.error(
            <div className="space-y-1">
              <p className="font-medium">Resend mode test</p>
              <p className="text-sm">Vous ne pouvez envoyer qu'à nivratelecom@gmail.com tant qu'un domaine n'est pas vérifié.</p>
            </div>
          );
        } else {
          toast.error(result.error || "Échec de l'envoi");
        }
      }
    } catch (err: any) {
      console.error("Template test error:", err);
      toast.error(err.message || "Erreur lors de l'envoi du template");
    } finally {
      setIsSendingTemplate(false);
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
    const template = TEMPLATE_OPTIONS.find((t) => t.key === key);
    return template?.label || key;
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
              variant="outline"
              onClick={openTestModal}
              disabled={isSendingTest}
            >
              <Send className="w-4 h-4 mr-2" />
              Envoyer email test
            </Button>
            <Button
              onClick={() => setShowTemplateModal(true)}
              disabled={isSendingTemplate}
            >
              <FileText className="w-4 h-4 mr-2" />
              Tester un template
            </Button>
          </div>
        </div>

        {/* Simple Test Email Modal */}
        <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Envoyer un email de test</DialogTitle>
              <DialogDescription>
                En mode test Resend, seul nivratelecom@gmail.com peut recevoir des emails.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="test-recipient">Email destinataire</Label>
                <Input
                  id="test-recipient"
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="nivratelecom@gmail.com"
                />
                <p className="text-xs text-muted-foreground">
                  Après vérification de domaine, vous pourrez envoyer à d'autres adresses.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTestModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleSendTestEmail} disabled={isSendingTest}>
                <Send className="w-4 h-4 mr-2" />
                {isSendingTest ? "Envoi..." : "Envoyer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Template Test Modal */}
        <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Tester un template</DialogTitle>
              <DialogDescription>
                Sélectionnez un template et personnalisez les variables pour tester le rendu.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Template Selector */}
              <div className="space-y-2">
                <Label htmlFor="template-select">Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un template" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_OPTIONS.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        <span className="text-muted-foreground text-xs mr-2">[{t.category}]</span>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Recipient */}
              <div className="space-y-2">
                <Label htmlFor="template-recipient">Destinataire</Label>
                <Input
                  id="template-recipient"
                  type="email"
                  value={templateRecipient}
                  onChange={(e) => setTemplateRecipient(e.target.value)}
                  placeholder="nivratelecom@gmail.com"
                />
              </div>

              {/* Variables (Collapsible) */}
              <Collapsible open={varsOpen} onOpenChange={setVarsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    Variables
                    <ChevronDown className={`w-4 h-4 transition-transform ${varsOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">order_number</Label>
                      <Input
                        value={templateVars.order_number}
                        onChange={(e) => setTemplateVars({ ...templateVars, order_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">invoice_number</Label>
                      <Input
                        value={templateVars.invoice_number}
                        onChange={(e) => setTemplateVars({ ...templateVars, invoice_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">ticket_number</Label>
                      <Input
                        value={templateVars.ticket_number}
                        onChange={(e) => setTemplateVars({ ...templateVars, ticket_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">contract_number</Label>
                      <Input
                        value={templateVars.contract_number}
                        onChange={(e) => setTemplateVars({ ...templateVars, contract_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">amount</Label>
                      <Input
                        value={templateVars.amount}
                        onChange={(e) => setTemplateVars({ ...templateVars, amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">status</Label>
                      <Input
                        value={templateVars.status}
                        onChange={(e) => setTemplateVars({ ...templateVars, status: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">tracking_number</Label>
                      <Input
                        value={templateVars.tracking_number}
                        onChange={(e) => setTemplateVars({ ...templateVars, tracking_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">portal_path</Label>
                      <Input
                        value={templateVars.portal_path}
                        onChange={(e) => setTemplateVars({ ...templateVars, portal_path: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">scheduled_at (ISO)</Label>
                    <Input
                      value={templateVars.scheduled_at}
                      onChange={(e) => setTemplateVars({ ...templateVars, scheduled_at: e.target.value })}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTemplateModal(false)}>
                Annuler
              </Button>
              <Button onClick={handleSendTemplateTest} disabled={isSendingTemplate}>
                <Send className="w-4 h-4 mr-2" />
                {isSendingTemplate ? "Envoi..." : "Envoyer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                    <TableHead>Livraison</TableHead>
                    <TableHead>Provider ID</TableHead>
                    <TableHead>Erreur</TableHead>
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
                        {email.bounced_at ? (
                          <Badge variant="destructive" className="text-xs">Bounce</Badge>
                        ) : email.opened_at ? (
                          <Badge className="bg-green-600 text-xs">Ouvert</Badge>
                        ) : email.delivered_at ? (
                          <Badge className="bg-blue-500 text-xs">Livré</Badge>
                        ) : email.provider_status ? (
                          <Badge variant="secondary" className="text-xs">{email.provider_status}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[120px] truncate">
                        {email.provider_message_id || "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-red-500 text-sm">
                        {email.last_error || "-"}
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
              Configuration Fournisseur
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
                <span className="ml-2 font-medium">notifications@nivratelecom.ca</span>
              </div>
              <div>
                <span className="text-muted-foreground">Tentatives max:</span>
                <span className="ml-2 font-medium">5 (avec backoff exponentiel)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Anti-Spam Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Configuration Anti-Spam (Délivrabilité)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                Ces configurations doivent être vérifiées dans le dashboard Resend et les DNS du domaine pour éviter que les emails atterrissent en spam.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">SPF Record</span>
                    <Badge variant="outline" className="text-xs">DNS TXT</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Autorise les serveurs Resend à envoyer pour nivratelecom.ca
                  </p>
                  <code className="text-xs bg-muted p-2 rounded block break-all">
                    v=spf1 include:amazonses.com ~all
                  </code>
                </div>
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">DKIM</span>
                    <Badge variant="outline" className="text-xs">DNS CNAME</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Signature cryptographique pour valider l'authenticité
                  </p>
                  <code className="text-xs bg-muted p-2 rounded block">
                    Configuré via Resend Dashboard
                  </code>
                </div>
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">DMARC</span>
                    <Badge variant="outline" className="text-xs">DNS TXT</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Politique de rapport et traitement des échecs
                  </p>
                  <code className="text-xs bg-muted p-2 rounded block break-all">
                    v=DMARC1; p=none; rua=mailto:dmarc@nivratelecom.ca
                  </code>
                </div>
              </div>
              <div className="mt-4 p-3 rounded border border-yellow-500/50 bg-yellow-500/10">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-500">Protocole de test recommandé:</p>
                    <ul className="text-muted-foreground mt-1 space-y-1 list-disc list-inside">
                      <li>Envoyer test à Gmail + Outlook</li>
                      <li>Vérifier inbox ET spam</li>
                      <li>Ouvrir "Show Original" pour voir les headers (SPF/DKIM/DMARC pass/fail)</li>
                      <li>Si spam: vérifier enregistrements DNS</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminEmailActivity;
