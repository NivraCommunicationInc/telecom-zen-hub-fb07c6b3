import { useState, useRef, useMemo } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import {
  DollarSign, Settings, PlusCircle, Users, CreditCard, ArrowRightLeft,
  Scale, Wrench, Send, ArrowLeft, Upload, FileText, CheckCircle, Clock,
  XCircle, AlertCircle, Loader2, Package, ExternalLink, Search,
  ChevronRight, ChevronLeft, MessageSquare, Paperclip,
} from "lucide-react";
import { TicketAttachmentUploader } from "@/components/tickets/TicketAttachmentUploader";
import { TicketAttachmentDisplay } from "@/components/tickets/TicketAttachmentDisplay";
import { AIImproveButton } from "@/components/tickets/AIImproveButton";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { notifyAdmin, getAdminPortalLink } from "@/hooks/useAdminNotification";
import { Checkbox } from "@/components/ui/checkbox";

// ─── Category tiles config (TELUS-style) ─────────────────────────────
const CATEGORY_TILES = [
  { key: "billing", label: "Facturation", icon: DollarSign },
  { key: "change_plan", label: "Changer forfait / service", icon: Settings },
  { key: "add_service", label: "Ajouter produit / service", icon: PlusCircle },
  { key: "update_contacts", label: "Mettre à jour les contacts", icon: Users },
  { key: "payment_issue", label: "Signaler un paiement", icon: CreditCard },
  { key: "transfer", label: "Transférer propriété", icon: ArrowRightLeft },
  { key: "legal_change", label: "Changement légal de nom", icon: Scale },
  { key: "technical", label: "Support technique", icon: Wrench },
] as const;

// Map tile keys to DB categories
const tileToCategoryMap: Record<string, string> = {
  billing: "billing",
  change_plan: "general",
  add_service: "general",
  update_contacts: "general",
  payment_issue: "billing",
  transfer: "other",
  legal_change: "other",
  technical: "technical",
};

const EQUIPMENT_CATEGORIES = ['equipment_issue', 'sim_issue', 'lost_stolen'];

const categoryConfig: Record<string, { label: string; requiresOrder: boolean }> = {
  general: { label: "Question générale", requiresOrder: false },
  billing: { label: "Facturation", requiresOrder: false },
  technical: { label: "Support technique", requiresOrder: false },
  equipment_issue: { label: "Problème d'équipement", requiresOrder: true },
  sim_issue: { label: "Problème de carte SIM", requiresOrder: true },
  lost_stolen: { label: "Appareil perdu/volé", requiresOrder: true },
  other: { label: "Autre", requiresOrder: false },
};

const issueTypeConfig: Record<string, { label: string; category: string }> = {
  equipment_broken: { label: "Équipement défectueux", category: "equipment_issue" },
  equipment_not_working: { label: "Équipement ne fonctionne pas", category: "equipment_issue" },
  equipment_damaged: { label: "Équipement endommagé", category: "equipment_issue" },
  sim_not_working: { label: "SIM ne fonctionne pas", category: "sim_issue" },
  sim_activation: { label: "Problème d'activation SIM", category: "sim_issue" },
  device_lost: { label: "Appareil perdu", category: "lost_stolen" },
  device_stolen: { label: "Appareil volé", category: "lost_stolen" },
};

const SELF_SERVE_LINKS = [
  { label: "Mettre à jour l'adresse de facturation", href: "/portal/profile" },
  { label: "Statut de commande", href: "/portal/orders" },
  { label: "Changer de forfait", href: "/portal/services" },
  { label: "Voir mes factures", href: "/portal/monthly-invoices" },
  { label: "Gérer mes paiements", href: "/portal/payments" },
];

const STATUS_FILTERS = [
  { key: "all", label: "Tous" },
  { key: "open", label: "Ouverts" },
  { key: "in_progress", label: "En cours" },
  { key: "pending", label: "En attente" },
  { key: "resolved", label: "Résolus" },
  { key: "closed", label: "Fermés" },
];

const statusColors: Record<string, string> = {
  open: "bg-teal-100 text-teal-700",
  pending: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  waiting_client: "bg-orange-100 text-orange-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-600",
};

const statusLabels: Record<string, string> = {
  open: "Ouvert",
  pending: "En attente",
  in_progress: "En cours",
  waiting_client: "En attente du client",
  resolved: "Résolu",
  closed: "Fermé",
};

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50];

// ─── Main Component ───────────────────────────────────────────────────
const ClientTickets = () => {
  const { user } = useClientAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // UI state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [consent, setConsent] = useState(false);

  // Create ticket form
  const [newTicket, setNewTicket] = useState({
    subject: "",
    description: "",
    priority: "normal",
    category: "general",
    issue_type: "",
    related_order_id: "",
  });
  const [replyContent, setReplyContent] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Queries ──────────────────────────────────────────────────
  const { data: canonicalData, isLoading } = useCanonicalClientData(user?.id);
  const tickets = canonicalData?.supportTickets || [];
  const profile = canonicalData?.profile;
  const clientOrders = canonicalData?.orders || [];
  const replies = (canonicalData?.ticketReplies || [])
    .filter((reply: any) => reply.ticket_id === selectedTicket?.id)
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // ─── Filtered & paginated tickets ─────────────────────────────
  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    let result = [...tickets];

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((t: any) => t.status === statusFilter);
    }

    // Search by ticket number
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((t: any) =>
        (t.ticket_number && t.ticket_number.toLowerCase().includes(q)) ||
        (t.subject && t.subject.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a: any, b: any) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortOrder === "desc" ? db - da : da - db;
    });

    return result;
  }, [tickets, statusFilter, searchQuery, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / itemsPerPage));
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ─── Mutations ────────────────────────────────────────────────
  const createTicketMutation = useMutation({
    mutationFn: async (ticket: typeof newTicket) => {
      let relatedOrderReference = null;
      if (ticket.related_order_id) {
        const orderData = clientOrders.find((order: any) => order.id === ticket.related_order_id);
        relatedOrderReference = orderData?.order_number || ticket.related_order_id;
      }

      const { data, error } = await portalSupabase
        .from("support_tickets")
        .insert({
          user_id: user?.id,
          owner_user_id: user?.id,
          subject: ticket.subject,
          description: ticket.description,
          priority: ticket.priority,
          category: ticket.category,
          issue_type: ticket.issue_type || null,
          related_order_id: ticket.related_order_id || null,
          related_order_reference: relatedOrderReference,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["client-tickets-all"] });
      queryClient.invalidateQueries({ queryKey: ["canonical-client-data", user?.id] });
      toast({ title: "Demande créée avec succès", description: `ID: ${data.ticket_number || data.id.slice(0, 8)}` });
      setCreateDialogOpen(false);
      setConsent(false);

      notifyAdmin({
        event_type: "new_ticket",
        event_id: data.id,
        event_number: data.ticket_number,
        client_name: profile?.full_name || user?.email,
        client_email: user?.email,
        client_phone: profile?.phone,
        summary: newTicket.subject,
        details: {
          "Sujet": newTicket.subject,
          "Catégorie": categoryConfig[newTicket.category]?.label || newTicket.category,
          "Priorité": newTicket.priority === "high" ? "Urgente" : "Normale",
        },
        priority: newTicket.priority as "normal" | "high" | "urgent",
        admin_portal_link: getAdminPortalLink(`/admin/tickets?ticket=${data.ticket_number}`),
      });

      setNewTicket({ subject: "", description: "", priority: "normal", category: "general", issue_type: "", related_order_id: "" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  const addReplyMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user?.id) throw new Error("Vous devez être connecté pour répondre");
      if (!selectedTicket?.id) throw new Error("Aucun ticket sélectionné");
      if (!content.trim()) throw new Error("Le message ne peut pas être vide");

      const { data, error } = await portalSupabase
        .from("ticket_replies")
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          content: content.trim(),
          is_admin: false,
          sender_role: "client",
        })
        .select()
        .single();

      if (error) {
        if (error.code === "42501") throw new Error("Permission refusée");
        if (error.code === "23503") throw new Error("Ce ticket n'existe plus");
        throw new Error(error.message || "Erreur lors de l'envoi");
      }

      notifyAdmin({
        event_type: "ticket_reply",
        event_id: selectedTicket.id,
        event_number: selectedTicket.ticket_number,
        client_name: profile?.full_name || user?.email,
        client_email: user?.email,
        summary: `Nouvelle réponse sur ${selectedTicket.ticket_number}`,
        details: { "Message": content.substring(0, 100) },
        priority: "normal",
        admin_portal_link: getAdminPortalLink(`/admin/tickets?ticket=${selectedTicket.ticket_number}`),
      }).catch(() => {});

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-replies"] });
      queryClient.invalidateQueries({ queryKey: ["client-tickets-all"] });
      queryClient.invalidateQueries({ queryKey: ["canonical-client-data", user?.id] });
      toast({ title: "Réponse envoyée" });
      setReplyContent("");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // ─── File upload handler ──────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user?.id || !selectedTicket) return;
    setUploadingFiles(true);
    try {
      const uploadedFiles: any[] = [];
      for (const file of Array.from(files)) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
          toast({ title: "Type non supporté", description: "JPG, PNG, HEIC, PDF uniquement", variant: "destructive" });
          continue;
        }
        if (file.size > 15 * 1024 * 1024) {
          toast({ title: "Fichier trop volumineux", description: "Max 15 Mo", variant: "destructive" });
          continue;
        }
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `${user.id}/${selectedTicket.id}/${fileName}`;
        const { error: uploadError } = await portalSupabase.storage
          .from("ticket-id-uploads")
          .upload(filePath, file);
        if (uploadError) throw uploadError;
        uploadedFiles.push({
          url: filePath,
          filename: file.name,
          mime: file.type,
          size: file.size,
          uploaded_at: new Date().toISOString(),
          uploaded_by: user.id,
        });
      }
      if (uploadedFiles.length > 0) {
        const existingFiles = (selectedTicket.id_files as any[]) || [];
        const { error: updateError } = await portalSupabase
          .from("support_tickets")
          .update({
            id_files: [...existingFiles, ...uploadedFiles],
            id_verification_status: 'received',
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedTicket.id);
        if (updateError) throw updateError;
        setSelectedTicket((prev: any) => ({
          ...prev,
          id_files: [...existingFiles, ...uploadedFiles],
          id_verification_status: 'received',
        }));
        queryClient.invalidateQueries({ queryKey: ["client-tickets-all"] });
        queryClient.invalidateQueries({ queryKey: ["canonical-client-data", user?.id] });
        toast({ title: "Fichier(s) téléversé(s)" });
      }
    } catch (error: any) {
      toast({ title: "Erreur téléversement", description: error.message, variant: "destructive" });
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── Open create dialog from category tile ────────────────────
  const openFromTile = (tileKey: string) => {
    const tileConfig = CATEGORY_TILES.find(t => t.key === tileKey);
    const dbCategory = tileToCategoryMap[tileKey] || "general";
    setNewTicket({
      subject: tileConfig?.label || "",
      description: "",
      priority: "normal",
      category: dbCategory,
      issue_type: "",
      related_order_id: "",
    });
    setConsent(false);
    setCreateDialogOpen(true);
  };

  // ═══════════════════════════════════════════════════════════════
  // TICKET DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════
  if (selectedTicket) {
    const idFiles = (selectedTicket.id_files as any[]) || [];

    return (
      <ClientLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <button onClick={() => setSelectedTicket(null)} className="hover:text-foreground transition-colors">
              Demandes de support
            </button>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">
              #{selectedTicket.ticket_number || selectedTicket.id.slice(0, 8)}
            </span>
          </nav>

          {/* Ticket header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{selectedTicket.subject}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                ID: {selectedTicket.ticket_number || selectedTicket.id.slice(0, 8)} ·{" "}
                Créé le {format(new Date(selectedTicket.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
              </p>
            </div>
            <Badge className={`${statusColors[selectedTicket.status] || "bg-slate-100 text-slate-600"} text-sm px-3 py-1`}>
              {statusLabels[selectedTicket.status] || selectedTicket.status}
            </Badge>
          </div>

          {/* Related order */}
          {selectedTicket.related_order_reference && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Package className="w-4 h-4 text-blue-600" />
                Commande concernée: <strong>{selectedTicket.related_order_reference}</strong>
              </div>
              <Link to="/portal/orders">
                <Button variant="ghost" size="sm">
                  <ExternalLink className="w-3 h-3 mr-1" /> Voir
                </Button>
              </Link>
            </div>
          )}

          {/* Original description */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-2">Description initiale</p>
            <p className="text-slate-800 whitespace-pre-wrap">{selectedTicket.description}</p>
          </div>

          {/* ID Upload Section */}
          {selectedTicket.requires_id_upload && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-600" />
                    Documents d'identité requis
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {idFiles.length > 0 && (
                  <div className="space-y-2">
                    {idFiles.map((file: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-white rounded border text-sm">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="flex-1 truncate">{file.filename}</span>
                        <span className="text-xs text-slate-500">
                          {format(new Date(file.uploaded_at), "d MMM HH:mm", { locale: fr })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {selectedTicket.id_verification_status !== 'verified' &&
                 selectedTicket.id_verification_status !== 'rejected' && (
                  <div className="border-2 border-dashed border-amber-300 rounded-lg p-6 text-center hover:border-amber-400 transition-colors bg-white">
                    <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.heic,.pdf" multiple onChange={handleFileUpload} className="hidden" id="id-file-upload" />
                    <label htmlFor="id-file-upload" className="cursor-pointer">
                      {uploadingFiles ? (
                        <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto" />
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                          <p className="text-sm font-medium text-slate-700">Cliquez pour téléverser</p>
                          <p className="text-xs text-slate-500 mt-1">JPG, PNG, HEIC, PDF · Max 15 Mo</p>
                        </>
                      )}
                    </label>
                  </div>
                )}
                {selectedTicket.id_verification_status === 'verified' && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-sm text-emerald-700">
                    <CheckCircle className="w-5 h-5" /> Identité vérifiée avec succès.
                  </div>
                )}
                {selectedTicket.id_verification_status === 'rejected' && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200 text-sm text-red-700">
                    <XCircle className="w-5 h-5" /> Documents refusés. Veuillez contacter le support.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Message timeline */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Conversation</h2>
            <div className="space-y-3">
              {replies && replies.length > 0 ? (
                replies.map((reply: any) => (
                  <div
                    key={reply.id}
                    className={`p-4 rounded-lg border ${
                      reply.is_admin
                        ? "bg-blue-50 border-blue-200 ml-0 sm:ml-6"
                        : "bg-white border-slate-200 mr-0 sm:mr-6"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-semibold ${reply.is_admin ? "text-blue-700" : "text-slate-700"}`}>
                        {reply.is_admin ? "Support Nivra" : "Vous"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {format(new Date(reply.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                      </span>
                    </div>
                    <p className="text-slate-800 whitespace-pre-wrap text-sm">{reply.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune réponse pour le moment.
                </p>
              )}
            </div>
          </div>

          {/* Attachments */}
          {selectedTicket.id_files && (selectedTicket.id_files as any[]).length > 0 && (
            <TicketAttachmentDisplay attachments={selectedTicket.id_files as any[]} />
          )}

          {/* Reply form or reopen CTA */}
          {selectedTicket.status === "resolved" || selectedTicket.status === "closed" ? (
            <div className="text-center py-6 border-t border-slate-200">
              <p className="text-sm text-muted-foreground mb-3">
                Cette demande est {statusLabels[selectedTicket.status]?.toLowerCase()}.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  // Reopen by adding a reply (which signals admin to reopen)
                  setReplyContent("Je souhaite rouvrir cette demande.");
                }}
              >
                Rouvrir la demande
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <Textarea
                placeholder="Écrivez votre réponse..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="min-h-[100px] bg-white"
                disabled={addReplyMutation.isPending}
              />
              <TicketAttachmentUploader
                ticketId={selectedTicket.id}
                uploaderId={user?.id || ""}
                onFilesUploaded={() => {
                  queryClient.invalidateQueries({ queryKey: ["ticket-attachments", selectedTicket.id] });
                }}
                maxFiles={5}
                maxSizeMB={50}
                disabled={addReplyMutation.isPending}
              />
              <div className="flex items-center justify-between gap-2">
                <AIImproveButton
                  message={replyContent}
                  onApply={(improved) => setReplyContent(improved)}
                  context="ticket_reply"
                  tone="professional"
                  disabled={!replyContent.trim() || replyContent.length < 10}
                />
                <Button
                  onClick={() => addReplyMutation.mutate(replyContent)}
                  disabled={!replyContent.trim() || addReplyMutation.isPending}
                  className="bg-slate-900 hover:bg-slate-800 text-white"
                >
                  {addReplyMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Envoyer
                </Button>
              </div>
            </div>
          )}

          {/* Back button */}
          <Button variant="ghost" onClick={() => setSelectedTicket(null)} className="mt-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour aux demandes
          </Button>
        </div>
      </ClientLayout>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN LIST VIEW (TELUS-style)
  // ═══════════════════════════════════════════════════════════════
  return (
    <ClientLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/portal" className="hover:text-foreground transition-colors">Aperçu</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">Demandes de support</span>
        </nav>

        {/* ─── Header ──────────────────────────────────────────── */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Envoyer une demande de support</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Envoyez une demande et nous vous répondrons dans un délai de 2 jours ouvrables.
            Consultez nos articles d'aide pour résoudre rapidement votre problème.
          </p>
        </div>

        {/* ─── Self-serve links ────────────────────────────────── */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-sm text-slate-600 mb-3">
            Pour mieux vous servir, les actions suivantes sont disponibles en libre-service :
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
            {SELF_SERVE_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline py-1 flex items-center gap-1"
              >
                • {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ─── Category tiles ─────────────────────────────────── */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-3">J'ai besoin de...</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CATEGORY_TILES.map((tile) => {
              const Icon = tile.icon;
              return (
                <button
                  key={tile.key}
                  onClick={() => openFromTile(tile.key)}
                  className="flex flex-col items-center justify-center gap-2 p-5 rounded-lg border border-slate-200 bg-white hover:border-slate-400 hover:shadow-sm transition-all text-center group"
                >
                  <Icon className="w-7 h-7 text-slate-500 group-hover:text-slate-700 transition-colors" />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 leading-tight">
                    {tile.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── All requests section ───────────────────────────── */}
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Toutes les demandes</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Suivez toutes vos demandes et requêtes.
            </p>
          </div>

          {/* Status filter chips */}
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((sf) => (
              <button
                key={sf.key}
                onClick={() => { setStatusFilter(sf.key); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  statusFilter === sf.key
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                }`}
              >
                {sf.label}
              </button>
            ))}
          </div>

          {/* Search + Sort controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Rechercher par ID ou sujet..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-10 bg-white"
              />
            </div>
            <Select value={sortOrder} onValueChange={(v: "desc" | "asc") => setSortOrder(v)}>
              <SelectTrigger className="w-full sm:w-48 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Plus récent</SelectItem>
                <SelectItem value="asc">Plus ancien</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tickets table (desktop) / cards (mobile) */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : paginatedTickets.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden md:block border border-slate-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide px-4 py-3">ID Demande</th>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide px-4 py-3">Sujet</th>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide px-4 py-3">Créé le</th>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide px-4 py-3">Dernière mise à jour</th>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide px-4 py-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedTickets.map((ticket: any) => (
                      <tr
                        key={ticket.id}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedTicket(ticket)}
                      >
                        <td className="px-4 py-3">
                          <span className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                            {ticket.ticket_number || ticket.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">
                          {ticket.subject}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {format(new Date(ticket.created_at), "yyyy-MM-dd")}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {format(new Date(ticket.updated_at || ticket.created_at), "yyyy-MM-dd")}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`${statusColors[ticket.status] || "bg-slate-100 text-slate-600"} text-xs font-medium`}>
                            {statusLabels[ticket.status] || ticket.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {paginatedTickets.map((ticket: any) => (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className="p-4 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-blue-600 font-medium text-sm">
                        {ticket.ticket_number || ticket.id.slice(0, 8)}
                      </span>
                      <Badge className={`${statusColors[ticket.status] || "bg-slate-100"} text-xs shrink-0`}>
                        {statusLabels[ticket.status] || ticket.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-slate-800 line-clamp-1">{ticket.subject}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>Créé: {format(new Date(ticket.created_at), "yyyy-MM-dd")}</span>
                      <span>MAJ: {format(new Date(ticket.updated_at || ticket.created_at), "yyyy-MM-dd")}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>Afficher</span>
                    <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                      <SelectTrigger className="w-20 h-8 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEMS_PER_PAGE_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span>par page</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-slate-600 px-3">
                      Page {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 bg-white border border-slate-200 rounded-lg">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-1">Aucune demande trouvée</p>
              <p className="text-sm text-slate-400">
                {searchQuery || statusFilter !== "all"
                  ? "Essayez de modifier vos filtres."
                  : "Cliquez sur une catégorie ci-dessus pour créer votre première demande."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Create Ticket Modal ══════════════════════════════════ */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) setConsent(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Créer une demande de support</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Category */}
            <div>
              <Label className="text-sm font-medium">Catégorie *</Label>
              <Select
                value={newTicket.category}
                onValueChange={(v) => setNewTicket({ ...newTicket, category: v, issue_type: "", related_order_id: "" })}
              >
                <SelectTrigger className="bg-white mt-1">
                  <SelectValue placeholder="Sélectionnez une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Issue Type (equipment only) */}
            {EQUIPMENT_CATEGORIES.includes(newTicket.category) && (
              <div>
                <Label className="text-sm font-medium">Type de problème *</Label>
                <Select value={newTicket.issue_type} onValueChange={(v) => setNewTicket({ ...newTicket, issue_type: v })}>
                  <SelectTrigger className="bg-white mt-1">
                    <SelectValue placeholder="Sélectionnez" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(issueTypeConfig)
                      .filter(([_, c]) => c.category === newTicket.category)
                      .map(([key, c]) => (
                        <SelectItem key={key} value={key}>{c.label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Related order (equipment only) */}
            {EQUIPMENT_CATEGORIES.includes(newTicket.category) && (
              <div>
                <Label className="text-sm font-medium">Commande concernée *</Label>
                {clientOrders && clientOrders.length > 0 ? (
                  <Select value={newTicket.related_order_id} onValueChange={(v) => setNewTicket({ ...newTicket, related_order_id: v })}>
                    <SelectTrigger className="bg-white mt-1">
                      <SelectValue placeholder="Sélectionnez la commande" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientOrders.map((order: any) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.order_number || order.id.slice(0, 8)} - {order.service_type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3 mt-1">
                    Aucune commande trouvée.
                  </p>
                )}
              </div>
            )}

            {/* Subject */}
            <div>
              <Label className="text-sm font-medium">Sujet *</Label>
              <Select
                value={newTicket.subject}
                onValueChange={(v) => setNewTicket({ ...newTicket, subject: v })}
              >
                <SelectTrigger className="bg-white mt-1">
                  <SelectValue placeholder="Sélectionnez un sujet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Facturation">Facturation</SelectItem>
                  <SelectItem value="Chaînes TV">Chaînes TV</SelectItem>
                  <SelectItem value="Support général">Support général</SelectItem>
                  <SelectItem value="Problème technique">Problème technique</SelectItem>
                  <SelectItem value="Équipement">Équipement</SelectItem>
                  <SelectItem value="Annulation">Annulation</SelectItem>
                  <SelectItem value="Autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div>
              <Label className="text-sm font-medium">Priorité</Label>
              <Select value={newTicket.priority} onValueChange={(v) => setNewTicket({ ...newTicket, priority: v })}>
                <SelectTrigger className="bg-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <Label className="text-sm font-medium">Description *</Label>
              <Textarea
                placeholder="Décrivez votre problème en détail..."
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                rows={5}
                className="bg-white mt-1"
              />
            </div>

            {/* Consent */}
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(c) => setConsent(!!c)}
                className="mt-0.5"
              />
              <label htmlFor="consent" className="text-xs text-slate-600 leading-relaxed cursor-pointer">
                Je comprends que je ne dois <strong>jamais</strong> inclure de données sensibles
                (pièce d'identité, numéros de carte, mots de passe) dans ce formulaire.
              </label>
            </div>

            {/* Submit */}
            <Button
              className="w-full bg-slate-900 hover:bg-slate-800 text-white"
              onClick={() => createTicketMutation.mutate(newTicket)}
              disabled={
                !newTicket.subject.trim() ||
                !newTicket.description.trim() ||
                !consent ||
                (EQUIPMENT_CATEGORIES.includes(newTicket.category) && !newTicket.related_order_id) ||
                (EQUIPMENT_CATEGORIES.includes(newTicket.category) && !newTicket.issue_type) ||
                createTicketMutation.isPending
              }
            >
              {createTicketMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Créer la demande
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
};

export default ClientTickets;
