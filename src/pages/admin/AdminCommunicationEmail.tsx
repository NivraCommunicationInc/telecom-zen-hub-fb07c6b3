import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Send, 
  Users, 
  Mail, 
  Plus, 
  Trash2, 
  Search, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Eye,
  Clock,
  RefreshCw,
  UserPlus
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Client {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  status?: string;
}

interface DirectEmail {
  id: string;
  subject: string;
  message: string;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
  created_at: string;
  sent_at?: string;
  sent_by_email?: string;
}

const AdminCommunicationEmail = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("compose");
  
  // Compose state
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [manualEmails, setManualEmails] = useState<string[]>([]);
  const [newManualEmail, setNewManualEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectAllClients, setSelectAllClients] = useState(false);
  
  // Dialog states
  const [isClientSelectorOpen, setIsClientSelectorOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isConfirmSendOpen, setIsConfirmSendOpen] = useState(false);

  // Fetch all clients from admin portal (profiles + user_roles)
  const { data: clients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ["clients-for-email"],
    queryFn: async () => {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, user_id, email, first_name, last_name, phone")
        .not("email", "is", null)
        .neq("email", "")
        .order("first_name");

      if (profilesError) {
        console.error("[AdminCommunicationEmail] Error fetching clients:", profilesError);
        throw profilesError;
      }

      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) {
        console.error("[AdminCommunicationEmail] Error fetching user roles:", rolesError);
        throw rolesError;
      }

      const rolesMap = new Map((rolesData || []).map((r: any) => [r.user_id, r.role]));

      // Only show "client" users (default to client when role missing)
      const rows = (profilesData || [])
        .map((p: any) => ({
          id: p.id,
          email: p.email,
          first_name: p.first_name,
          last_name: p.last_name,
          phone: p.phone,
          status: rolesMap.get(p.user_id) || "client",
        }))
        .filter((p: any) => (p.status || "client") === "client");

      console.log("[AdminCommunicationEmail] Loaded clients:", rows.length);
      return rows as Client[];
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Auto-update when new clients are created/imported
  useEffect(() => {
    const channel = supabase
      .channel("admin-communication-email-clients")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => queryClient.invalidateQueries({ queryKey: ["clients-for-email"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles" },
        () => queryClient.invalidateQueries({ queryKey: ["clients-for-email"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch email history
  const { data: emailHistory = [], isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ["direct-email-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_emails" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as DirectEmail[];
    },
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      // Combine selected client emails and manual emails
      const clientEmails = selectedClients.map(c => ({
        email: c.email,
        name: `${c.first_name} ${c.last_name}`.trim(),
        client_id: c.id
      }));
      
      const manualEmailsList = manualEmails.map(email => ({
        email,
        name: email.split("@")[0],
        client_id: null
      }));

      const allRecipients = [...clientEmails, ...manualEmailsList];

      if (allRecipients.length === 0) {
        throw new Error("Aucun destinataire sélectionné");
      }

      if (!subject.trim()) {
        throw new Error("Le sujet est requis");
      }

      if (!message.trim()) {
        throw new Error("Le message est requis");
      }

      const { data, error } = await supabase.functions.invoke("send-communication-email", {
        body: {
          subject,
          message,
          recipients: allRecipients,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Email envoyé à ${data.sent} destinataire(s)`, {
        description: data.failed > 0 ? `${data.failed} échec(s)` : undefined,
      });
      // Reset form
      setSubject("");
      setMessage("");
      setSelectedClients([]);
      setManualEmails([]);
      setSelectAllClients(false);
      setIsConfirmSendOpen(false);
      // Refresh history
      queryClient.invalidateQueries({ queryKey: ["direct-email-history"] });
    },
    onError: (error: Error) => {
      toast.error("Erreur lors de l'envoi", { description: error.message });
    },
  });

  // Filter clients for search
  const filteredClients = clients.filter(client => {
    const query = searchQuery.toLowerCase();
    return (
      client.email?.toLowerCase().includes(query) ||
      client.first_name?.toLowerCase().includes(query) ||
      client.last_name?.toLowerCase().includes(query) ||
      client.phone?.includes(query)
    );
  });

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    setSelectAllClients(checked);
    if (checked) {
      setSelectedClients(clients);
    } else {
      setSelectedClients([]);
    }
  };

  // Toggle client selection
  const toggleClientSelection = (client: Client) => {
    const isSelected = selectedClients.some(c => c.id === client.id);
    if (isSelected) {
      setSelectedClients(prev => prev.filter(c => c.id !== client.id));
      setSelectAllClients(false);
    } else {
      setSelectedClients(prev => [...prev, client]);
      if (selectedClients.length + 1 === clients.length) {
        setSelectAllClients(true);
      }
    }
  };

  // Add manual email
  const handleAddManualEmail = () => {
    const email = newManualEmail.trim().toLowerCase();
    console.log("[handleAddManualEmail] Adding email:", email);
    
    if (!email) {
      toast.error("Veuillez entrer un email");
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Format d'email invalide");
      return;
    }

    if (manualEmails.includes(email)) {
      toast.error("Cet email est déjà ajouté");
      return;
    }

    // Check if already in selected clients
    if (selectedClients.some(c => c.email?.toLowerCase() === email)) {
      toast.error("Ce client est déjà sélectionné");
      return;
    }

    console.log("[handleAddManualEmail] Adding to manualEmails:", [...manualEmails, email]);
    setManualEmails(prev => {
      const newList = [...prev, email];
      console.log("[handleAddManualEmail] Updated list:", newList);
      return newList;
    });
    setNewManualEmail("");
    toast.success(`Email "${email}" ajouté aux destinataires`);
  };

  // Remove manual email
  const handleRemoveManualEmail = (email: string) => {
    setManualEmails(prev => prev.filter(e => e !== email));
  };

  // Get total recipients count
  const totalRecipients = selectedClients.length + manualEmails.length;

  // Status badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Envoyé</Badge>;
      case "sending":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">En cours</Badge>;
      case "failed":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Échec</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Mail className="w-8 h-8 text-primary" />
              Communication Email
            </h1>
            <p className="text-muted-foreground mt-1">
              Envoyez des emails directement à vos clients
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="compose" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Composer
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Historique
            </TabsTrigger>
          </TabsList>

          {/* Compose Tab */}
          <TabsContent value="compose" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Email Composer */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Nouveau message</CardTitle>
                    <CardDescription>
                      Rédigez votre email. Il sera envoyé à tous les destinataires sélectionnés.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Sujet *</Label>
                      <Input
                        id="subject"
                        placeholder="Ex: Information importante concernant votre service"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message *</Label>
                      <Textarea
                        id="message"
                        placeholder="Nivra Télécom&#10;1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5&#10;Lun–Ven : 9 h – 22 h · Sam–Dim : 9 h – 20 h&#10;Support : Support@nivratelecom.com&#10;© 2026 Nivra Télécom&#10;Confidentialité  •  Conditions"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={12}
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        Variables disponibles: {"{{client_name}}"}, {"{{client_email}}"}
                      </p>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setIsPreviewOpen(true)}
                        disabled={!subject || !message}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Aperçu
                      </Button>
                      <Button
                        onClick={() => setIsConfirmSendOpen(true)}
                        disabled={totalRecipients === 0 || !subject || !message || sendEmailMutation.isPending}
                      >
                        {sendEmailMutation.isPending ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Envoyer ({totalRecipients})
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recipients Panel */}
              <div className="space-y-4">
                {/* Selected Recipients Summary */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Destinataires ({totalRecipients})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Client selector button */}
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setIsClientSelectorOpen(true)}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Sélectionner des clients ({selectedClients.length})
                    </Button>

                    {/* Manual email input */}
                    <div className="space-y-2">
                      <Label>Ajouter un email manuellement</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="email@exemple.com"
                          value={newManualEmail}
                          onChange={(e) => setNewManualEmail(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddManualEmail();
                            }
                          }}
                        />
                        <Button size="icon" variant="outline" onClick={handleAddManualEmail}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Manual emails list */}
                    {manualEmails.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Emails manuels</Label>
                        <div className="flex flex-wrap gap-2">
                          {manualEmails.map(email => (
                            <Badge key={email} variant="secondary" className="flex items-center gap-1">
                              {email}
                              <button
                                onClick={() => handleRemoveManualEmail(email)}
                                className="ml-1 hover:text-destructive"
                              >
                                <XCircle className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Selected clients preview */}
                    {selectedClients.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">
                            Clients sélectionnés ({selectedClients.length})
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedClients([]);
                              setSelectAllClients(false);
                            }}
                            className="h-6 text-xs text-destructive hover:text-destructive"
                          >
                            Tout effacer
                          </Button>
                        </div>
                        <ScrollArea className="h-32">
                          <div className="space-y-1">
                            {selectedClients.slice(0, 10).map(client => (
                              <div
                                key={client.id}
                                className="flex items-center justify-between text-sm p-1 rounded hover:bg-muted"
                              >
                                <span className="truncate">
                                  {client.first_name} {client.last_name}
                                </span>
                                <button
                                  onClick={() => toggleClientSelection(client)}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <XCircle className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            {selectedClients.length > 10 && (
                              <p className="text-xs text-muted-foreground text-center py-1">
                                + {selectedClients.length - 10} autres
                              </p>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    )}

                    {totalRecipients === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Aucun destinataire</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Historique des envois</CardTitle>
                    <CardDescription>
                      Consultez l'historique de vos emails envoyés
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchHistory()}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualiser
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                    Chargement...
                  </div>
                ) : emailHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Aucun email envoyé</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Sujet</TableHead>
                        <TableHead>Destinataires</TableHead>
                        <TableHead>Envoyés</TableHead>
                        <TableHead>Échecs</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailHistory.map((email) => (
                        <TableRow key={email.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(email.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {email.subject}
                          </TableCell>
                          <TableCell>{email.recipients_count}</TableCell>
                          <TableCell>
                            <span className="text-green-600">{email.sent_count}</span>
                          </TableCell>
                          <TableCell>
                            <span className={email.failed_count > 0 ? "text-red-600" : ""}>
                              {email.failed_count}
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(email.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Client Selector Dialog */}
      <Dialog open={isClientSelectorOpen} onOpenChange={setIsClientSelectorOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Sélectionner des clients</DialogTitle>
            <DialogDescription>
              Choisissez les clients qui recevront votre email
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, email, téléphone..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 py-2 border-b">
              <Checkbox
                id="select-all"
                checked={selectAllClients}
                onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
              />
              <Label htmlFor="select-all" className="text-sm font-medium">
                Sélectionner tous les clients ({clients.length})
              </Label>
            </div>

            <ScrollArea className="h-[400px]">
              {isLoadingClients ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                  Chargement des clients...
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Aucun client trouvé</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredClients.map(client => {
                    const isSelected = selectedClients.some(c => c.id === client.id);
                    return (
                      <div
                        key={client.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
                        }`}
                        onClick={() => toggleClientSelection(client)}
                      >
                        <Checkbox checked={isSelected} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {client.first_name} {client.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {client.email}
                          </p>
                        </div>
                        {client.status && (
                          <Badge variant="outline" className="text-xs">
                            {client.status}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClientSelectorOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => setIsClientSelectorOpen(false)}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirmer ({selectedClients.length} sélectionnés)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Aperçu de l'email</DialogTitle>
            <DialogDescription>
              Voici à quoi ressemblera votre email
            </DialogDescription>
          </DialogHeader>
          
          <div className="border rounded-lg p-6 bg-slate-900 border-slate-700 space-y-4">
            <div className="border-b pb-4">
              <p className="text-sm text-muted-foreground">De: Nivra Télécom &lt;communication@nivratelecom.com&gt;</p>
              <p className="text-sm text-muted-foreground">À: {totalRecipients} destinataire(s)</p>
              <p className="font-semibold mt-2">{subject || "(Aucun sujet)"}</p>
            </div>
            <div className="whitespace-pre-wrap text-sm">
              {message || "(Aucun message)"}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Send Dialog */}
      <Dialog open={isConfirmSendOpen} onOpenChange={setIsConfirmSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'envoi</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point d'envoyer cet email à {totalRecipients} destinataire(s).
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm"><strong>Sujet:</strong> {subject}</p>
              <p className="text-sm"><strong>Destinataires:</strong></p>
              <ul className="text-sm text-muted-foreground ml-4 list-disc">
                <li>{selectedClients.length} client(s) sélectionné(s)</li>
                {manualEmails.length > 0 && (
                  <li>{manualEmails.length} email(s) manuel(s)</li>
                )}
              </ul>
            </div>
            
            <div className="flex items-start gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="text-sm">
                Cette action est irréversible. Les emails seront envoyés immédiatement.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmSendOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => sendEmailMutation.mutate()}
              disabled={sendEmailMutation.isPending}
            >
              {sendEmailMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Envoyer maintenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminCommunicationEmail;
