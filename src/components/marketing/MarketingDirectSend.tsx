import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Send,
  Search,
  User,
  Mail,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Plus,
  FileText,
  MousePointer,
  MailOpen,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  html_content: string;
  category: string;
  variables: string[];
  is_active: boolean;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  client_number: string | null;
  status: string | null;
}

interface EmailSend {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  failed_at: string | null;
  open_count: number | null;
  click_count: number | null;
  error_message: string | null;
  created_at: string;
  template_id: string | null;
  email_templates?: { name: string }[] | null;
}

interface SelectedRecipient {
  id?: string;
  email: string;
  name: string;
  type: "client" | "manual";
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  queued: { label: "En attente", icon: <Clock className="h-3.5 w-3.5" />, color: "bg-muted text-muted-foreground" },
  sent: { label: "Envoyé", icon: <Send className="h-3.5 w-3.5" />, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  delivered: { label: "Livré", icon: <CheckCircle className="h-3.5 w-3.5" />, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  opened: { label: "Ouvert", icon: <MailOpen className="h-3.5 w-3.5" />, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  clicked: { label: "Cliqué", icon: <MousePointer className="h-3.5 w-3.5" />, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  bounced: { label: "Rebondi", icon: <AlertCircle className="h-3.5 w-3.5" />, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  failed: { label: "Échoué", icon: <XCircle className="h-3.5 w-3.5" />, color: "bg-destructive/10 text-destructive" },
  complained: { label: "Plainte", icon: <AlertCircle className="h-3.5 w-3.5" />, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const CATEGORY_LABELS: Record<string, string> = {
  marketing: "Marketing",
  promotional: "Promotionnel",
  onboarding: "Intégration",
  operational: "Opérationnel",
  newsletter: "Newsletter",
};

const MarketingDirectSend = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("compose");
  
  // Compose state
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<SelectedRecipient[]>([]);
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [subjectOverride, setSubjectOverride] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  // Dialogs
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Client selector state
  const [clientSearch, setClientSearch] = useState("");

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ["email-templates-direct"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("is_active", true)
        .order("category")
        .order("name");
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  // Fetch clients for selector
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-email"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, phone, client_number, status")
        .order("last_name");
      if (error) throw error;
      return data as Client[];
    },
  });

  // Fetch recent sends history
  const { data: recentSends = [], refetch: refetchHistory } = useQuery({
    queryKey: ["direct-email-sends"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_sends")
        .select(`
          id, to_email, to_name, subject, status,
          sent_at, delivered_at, opened_at, clicked_at, bounced_at, failed_at,
          open_count, click_count, error_message, created_at, template_id,
          email_templates(name)
        `)
        .is("campaign_id", null)
        .is("automation_rule_id", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as EmailSend[];
    },
  });

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, categoryFilter]);

  // Filter clients for selector
  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients.slice(0, 50);
    const q = clientSearch.toLowerCase();
    return clients
      .filter(
        (c) =>
          c.email?.toLowerCase().includes(q) ||
          c.first_name?.toLowerCase().includes(q) ||
          c.last_name?.toLowerCase().includes(q) ||
          c.client_number?.toLowerCase().includes(q) ||
          c.phone?.includes(q)
      )
      .slice(0, 50);
  }, [clients, clientSearch]);

  // Group templates by category
  const templatesByCategory = useMemo(() => {
    const grouped: Record<string, EmailTemplate[]> = {};
    filteredTemplates.forEach((t) => {
      const cat = t.category || "other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    });
    return grouped;
  }, [filteredTemplates]);

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) throw new Error("Aucun template sélectionné");
      if (selectedRecipients.length === 0) throw new Error("Aucun destinataire");

      const clientIds = selectedRecipients
        .filter((r) => r.type === "client" && r.id)
        .map((r) => r.id!);

      // For manual emails, we need to handle them differently
      const manualEmails = selectedRecipients.filter((r) => r.type === "manual");

      // Send to clients via the marketing email function
      if (clientIds.length > 0) {
        const { data, error } = await supabase.functions.invoke("send-marketing-email", {
          body: {
            template_id: selectedTemplate.id,
            client_ids: clientIds,
            subject_override: subjectOverride || null,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

      // Send to manual emails
      for (const recipient of manualEmails) {
        const { data, error } = await supabase.functions.invoke("send-marketing-email", {
          body: {
            template_id: selectedTemplate.id,
            test_email: recipient.email,
            subject_override: subjectOverride || null,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Log manual send
        await supabase.from("email_sends").insert({
          template_id: selectedTemplate.id,
          to_email: recipient.email,
          to_name: recipient.name,
          subject: subjectOverride || selectedTemplate.subject,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      }

      return { sent: selectedRecipients.length };
    },
    onSuccess: (data) => {
      toast.success(`${data.sent} email(s) envoyé(s) avec succès`);
      queryClient.invalidateQueries({ queryKey: ["direct-email-sends"] });
      resetForm();
      setShowConfirm(false);
      setActiveTab("history");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSelectedTemplate(null);
    setSelectedRecipients([]);
    setSubjectOverride("");
    setManualEmail("");
    setManualName("");
  };

  const addManualRecipient = () => {
    if (!manualEmail || !manualEmail.includes("@")) {
      toast.error("Email invalide");
      return;
    }
    if (selectedRecipients.some((r) => r.email === manualEmail)) {
      toast.error("Ce destinataire est déjà ajouté");
      return;
    }
    setSelectedRecipients((prev) => [
      ...prev,
      { email: manualEmail, name: manualName || manualEmail, type: "manual" },
    ]);
    setManualEmail("");
    setManualName("");
  };

  const toggleClient = (client: Client) => {
    const exists = selectedRecipients.some((r) => r.id === client.id);
    if (exists) {
      setSelectedRecipients((prev) => prev.filter((r) => r.id !== client.id));
    } else {
      setSelectedRecipients((prev) => [
        ...prev,
        {
          id: client.id,
          email: client.email,
          name: `${client.first_name} ${client.last_name}`.trim(),
          type: "client",
        },
      ]);
    }
  };

  const removeRecipient = (email: string) => {
    setSelectedRecipients((prev) => prev.filter((r) => r.email !== email));
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.queued;
    return (
      <Badge variant="outline" className={`${config.color} flex items-center gap-1`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="compose" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Composer
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Template Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">1. Choisir un template</CardTitle>
                <CardDescription>Sélectionnez le modèle d'email à envoyer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    {Object.entries(templatesByCategory).map(([category, temps]) => (
                      <div key={category}>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          {CATEGORY_LABELS[category] || category}
                        </p>
                        <div className="space-y-2">
                          {temps.map((template) => (
                            <div
                              key={template.id}
                              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                selectedTemplate?.id === template.id
                                  ? "border-primary bg-primary/5"
                                  : "hover:bg-muted/50"
                              }`}
                              onClick={() => setSelectedTemplate(template)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{template.name}</p>
                                  <p className="text-sm text-muted-foreground truncate">
                                    {template.subject}
                                  </p>
                                </div>
                                {selectedTemplate?.id === template.id && (
                                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {filteredTemplates.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        Aucun template trouvé
                      </p>
                    )}
                  </div>
                </ScrollArea>

                {selectedTemplate && (
                  <div className="pt-4 border-t space-y-3">
                    <div>
                      <Label>Sujet (optionnel - remplacer)</Label>
                      <Input
                        value={subjectOverride}
                        onChange={(e) => setSubjectOverride(e.target.value)}
                        placeholder={selectedTemplate.subject}
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowPreview(true)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Prévisualiser
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recipients */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">2. Destinataires</CardTitle>
                <CardDescription>Sélectionnez les clients ou ajoutez des emails</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add from clients */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowClientSelector(true)}
                >
                  <User className="h-4 w-4 mr-2" />
                  Sélectionner des clients
                </Button>

                {/* Manual email input */}
                <div className="space-y-2">
                  <Label>Ou ajouter un email manuellement</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="nom@exemple.com"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      type="email"
                    />
                    <Input
                      placeholder="Nom (optionnel)"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-40"
                    />
                    <Button variant="outline" size="icon" onClick={addManualRecipient}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Selected recipients list */}
                <div className="space-y-2">
                  <Label>
                    Destinataires sélectionnés ({selectedRecipients.length})
                  </Label>
                  <ScrollArea className="h-[200px] border rounded-lg p-2">
                    {selectedRecipients.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8 text-sm">
                        Aucun destinataire sélectionné
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedRecipients.map((recipient) => (
                          <div
                            key={recipient.email}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {recipient.type === "client" ? (
                                <User className="h-4 w-4 text-primary flex-shrink-0" />
                              ) : (
                                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{recipient.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {recipient.email}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              onClick={() => removeRecipient(recipient.email)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                {/* Send button */}
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!selectedTemplate || selectedRecipients.length === 0}
                  onClick={() => setShowConfirm(true)}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer ({selectedRecipients.length})
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Historique des envois directs</CardTitle>
                <CardDescription>Suivi des emails envoyés individuellement</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchHistory()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {recentSends.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">
                      Aucun envoi direct récent
                    </p>
                  ) : (
                    recentSends.map((send) => (
                      <div
                        key={send.id}
                        className="p-4 rounded-lg border hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium truncate">{send.to_name || send.to_email}</p>
                              {getStatusBadge(send.status)}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {send.to_email}
                            </p>
                            <p className="text-sm mt-1">
                              <span className="text-muted-foreground">Sujet:</span> {send.subject}
                            </p>
                            {send.email_templates?.[0]?.name && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Template: {send.email_templates[0].name}
                              </p>
                            )}
                          </div>
                          <div className="text-right text-sm text-muted-foreground flex-shrink-0">
                            <p>
                              {format(new Date(send.created_at), "d MMM yyyy", { locale: fr })}
                            </p>
                            <p className="text-xs">
                              {format(new Date(send.created_at), "HH:mm", { locale: fr })}
                            </p>
                            {(send.open_count ?? 0) > 0 && (
                              <p className="text-xs text-primary mt-1">
                                {send.open_count} ouverture(s)
                              </p>
                            )}
                            {(send.click_count ?? 0) > 0 && (
                              <p className="text-xs text-accent-foreground">
                                {send.click_count} clic(s)
                              </p>
                            )}
                          </div>
                        </div>
                        {send.error_message && (
                          <p className="text-sm text-destructive mt-2 bg-destructive/10 p-2 rounded">
                            Erreur: {send.error_message}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Client Selector Dialog */}
      <Dialog open={showClientSelector} onOpenChange={setShowClientSelector}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sélectionner des clients</DialogTitle>
            <DialogDescription>
              Recherchez et sélectionnez les clients destinataires
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email, téléphone..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[400px] border rounded-lg p-2">
              {filteredClients.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucun client trouvé
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredClients.map((client) => {
                    const isSelected = selectedRecipients.some((r) => r.id === client.id);
                    return (
                      <div
                        key={client.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                        }`}
                        onClick={() => toggleClient(client)}
                      >
                        <Checkbox checked={isSelected} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">
                            {client.first_name} {client.last_name}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="truncate">{client.email}</span>
                            {client.client_number && (
                              <Badge variant="outline" className="text-xs">
                                #{client.client_number}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {client.status && (
                          <Badge variant="secondary" className="text-xs">
                            {client.status}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            <p className="text-sm text-muted-foreground">
              {selectedRecipients.filter((r) => r.type === "client").length} client(s) sélectionné(s)
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClientSelector(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Prévisualisation: {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              Sujet: {subjectOverride || selectedTemplate?.subject}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] border rounded-lg">
            {selectedTemplate?.html_content && (
              <iframe
                srcDoc={selectedTemplate.html_content}
                className="w-full h-[500px] bg-white"
                title="Email Preview"
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Confirm Send Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'envoi</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point d'envoyer cet email à {selectedRecipients.length} destinataire(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p>
                <span className="text-muted-foreground">Template:</span>{" "}
                <span className="font-medium">{selectedTemplate?.name}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Sujet:</span>{" "}
                <span className="font-medium">{subjectOverride || selectedTemplate?.subject}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Destinataires:</span>{" "}
                <span className="font-medium">{selectedRecipients.length}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>Cette action est irréversible. Les emails seront envoyés immédiatement.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Annuler
            </Button>
            <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
              {sendMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Confirmer l'envoi
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketingDirectSend;
