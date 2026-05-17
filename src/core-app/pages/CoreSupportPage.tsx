/**
 * CoreSupportPage — Full Telecom Support Console
 * Client tickets + Internal tickets with tab separation
 */
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Headphones, Search, MessageSquare, Clock, CheckCircle, XCircle, AlertCircle,
  User, Send, ArrowLeft, Flag, Tag, UserCog, FileText, Phone, Mail,
  Calendar, Hash, RefreshCcw, Star, Pause, Shield, Plus, Eye, AlertTriangle,
  Building, Lock,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-[#64748B]/20 text-[#94A3B8]" },
  open: { label: "Ouvert", color: "bg-blue-500/15 text-blue-400" },
  in_progress: { label: "En cours", color: "bg-amber-500/15 text-amber-400" },
  on_hold: { label: "En pause", color: "bg-purple-500/15 text-purple-400" },
  ai_replied: { label: "IA a répondu", color: "bg-sky-500/15 text-sky-400" },
  escalated: { label: "Escalade — Action requise", color: "bg-red-500/15 text-red-400" },
  human_replied: { label: "Répondu", color: "bg-emerald-500/15 text-emerald-400" },
  resolved: { label: "Résolu", color: "bg-emerald-500/15 text-emerald-400" },
  closed: { label: "Fermé", color: "bg-[#64748B]/20 text-[#64748B]" },
  cancelled: { label: "Annulé", color: "bg-red-500/15 text-red-400" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Basse", color: "text-[#94A3B8]" },
  normal: { label: "Normale", color: "text-blue-400" },
  medium: { label: "Moyenne", color: "text-amber-400" },
  high: { label: "Haute", color: "text-orange-400" },
  urgent: { label: "Urgente", color: "text-red-400" },
  vip: { label: "VIP", color: "text-yellow-400" },
};

const categoryConfig: Record<string, string> = {
  billing: "Facturation",
  installation: "Installation",
  equipment: "Équipement",
  equipment_issue: "Problème d'équipement",
  sim_issue: "Problème de SIM",
  lost_stolen: "Appareil perdu/volé",
  sim_lost: "SIM/Téléphone perdu",
  plan_pause: "Pause de forfait",
  number_change: "Changement de numéro",
  id_verification: "Vérification d'identité",
  general: "Support général",
  technical: "Technique",
  internal: "Interne",
  operations: "Opérations",
  hr: "Ressources humaines",
  it: "Informatique",
};

export default function CoreSupportPage() {
  const queryClient = useQueryClient();
  // Realtime: refresh ticket lists and conversations on any DB change
  usePortalRealtime(
    ["support_tickets", "ticket_replies"],
    [["core-support-tickets"], ["core-ticket-replies"], ["core-ticket-messages"]],
  );
  const [ticketScope, setTicketScope] = useState<"client" | "internal">("client");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"conversation" | "details" | "notes">("conversation");
  const [replyContent, setReplyContent] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  const [newTicket, setNewTicket] = useState({
    client_email: "", subject: "", description: "", priority: "normal", category: "general", is_internal: false, assigned_to: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id) setCurrentUserId(user.id);
    });
  }, []);

  // ═══ QUERIES ═══
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["core-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const userIds = [...new Set((data || []).map((t: any) => t.user_id).filter(Boolean))];
      if (userIds.length === 0) return data || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, phone, client_number")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return (data || []).map((t: any) => ({ ...t, profile: profileMap.get(t.user_id) || null }));
    },
  });

  // Staff list for assignment
  const { data: staffList = [] } = useQuery({
    queryKey: ["core-staff-list"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_users").select("user_id, is_active").eq("is_active", true);
      if (!data || data.length === 0) return [];
      const ids = data.map((a: any) => a.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids);
      return profiles || [];
    },
  });

  const { data: replies = [] } = useQuery({
    queryKey: ["core-ticket-replies", selectedTicket?.id],
    enabled: !!selectedTicket?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("ticket_replies").select("*").eq("ticket_id", selectedTicket.id).order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["core-ticket-messages", selectedTicket?.id],
    enabled: !!selectedTicket?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("support_ticket_messages").select("*").eq("ticket_id", selectedTicket.id).order("created_at", { ascending: true });
      if (error) return [];
      return data || [];
    },
  });

  // ═══ MUTATIONS ═══
  const updateTicketMutation = useMutation({
    mutationFn: async (updates: { ticketId: string; [key: string]: any }) => {
      const { ticketId, ...updateData } = updates;
      updateData.updated_at = new Date().toISOString();
      const { error } = await supabase.from("support_tickets").update(updateData).eq("id", ticketId);
      if (error) throw error;
      return { ticketId, ...updateData };
    },
    onSuccess: (data) => {
      if (selectedTicket?.id === data.ticketId) setSelectedTicket((prev: any) => ({ ...prev, ...data }));
      queryClient.invalidateQueries({ queryKey: ["core-support-tickets"] });
      toast.success("Ticket mis à jour");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const addReplyMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { error } = await supabase.from("ticket_replies").insert({
        ticket_id: selectedTicket?.id, user_id: user.id, content, is_admin: true, sender_role: "admin",
      });
      if (error) throw error;
      if (["open", "pending"].includes(selectedTicket?.status)) {
        await supabase.from("support_tickets").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", selectedTicket.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-ticket-replies"] });
      queryClient.invalidateQueries({ queryKey: ["core-support-tickets"] });
      toast.success("Réponse envoyée");
      setReplyContent("");
    },
    onError: () => toast.error("Erreur lors de l'envoi"),
  });

  const createTicketMutation = useMutation({
    mutationFn: async (ticket: typeof newTicket) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      let userId = user.id;
      let ownerUserId = user.id;

      if (!ticket.is_internal) {
        // Client ticket: look up client
        const { data: profile } = await supabase.from("profiles").select("user_id, email, full_name").eq("email", ticket.client_email.toLowerCase()).maybeSingle();
        if (!profile) throw new Error("Client non trouvé avec cet email");
        userId = profile.user_id;
        ownerUserId = profile.user_id;
      }

      const insertData: any = {
        user_id: userId,
        owner_user_id: ownerUserId,
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority,
        category: ticket.is_internal ? ticket.category : ticket.category,
        created_by_user_id: user.id,
        created_by_role: "admin",
        status: "open",
      };

      if (!ticket.is_internal) {
        insertData.client_email = ticket.client_email;
      }

      // Store internal flag in internal_notes metadata
      if (ticket.is_internal) {
        insertData.internal_notes = `[TICKET INTERNE] Créé par l'équipe.\n${ticket.assigned_to ? `Assigné à: ${ticket.assigned_to}` : ""}`;
        insertData.client_email = null;
      }

      const { data, error } = await supabase.from("support_tickets").insert(insertData).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-support-tickets"] });
      toast.success("Ticket créé");
      setCreateOpen(false);
      setNewTicket({ client_email: "", subject: "", description: "", priority: "normal", category: "general", is_internal: false, assigned_to: "" });
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de la création"),
  });

  // ═══ FILTERING ═══
  const scopedTickets = useMemo(() => {
    if (ticketScope === "internal") {
      return tickets.filter((t: any) => t.internal_notes?.startsWith("[TICKET INTERNE]") || ["internal", "operations", "hr", "it"].includes(t.category));
    }
    return tickets.filter((t: any) => !t.internal_notes?.startsWith("[TICKET INTERNE]") && !["internal", "operations", "hr", "it"].includes(t.category));
  }, [tickets, ticketScope]);

  const filtered = useMemo(() => {
    return scopedTickets.filter((t: any) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (categoryFilter !== "all" && (t.category || "general") !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.ticket_number?.toLowerCase().includes(q) ||
          t.subject?.toLowerCase().includes(q) ||
          t.profile?.full_name?.toLowerCase().includes(q) ||
          t.profile?.email?.toLowerCase().includes(q) ||
          t.profile?.client_number?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [scopedTickets, search, statusFilter, priorityFilter, categoryFilter]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(statusConfig).forEach((s) => { counts[s] = scopedTickets.filter((t: any) => t.status === s).length; });
    return counts;
  }, [scopedTickets]);

  // ═══ TICKET DETAIL VIEW ═══
  if (selectedTicket) {
    const allMessages = [
      ...replies.map((r: any) => ({ ...r, type: "reply" })),
      ...messages.map((m: any) => ({ ...m, content: m.message, is_admin: m.sender_type === "admin", type: "message" })),
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelectedTicket(null)} className="flex items-center gap-1.5 text-[13px] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors">
            <ArrowLeft className="h-4 w-4" /> Retour aux tickets
          </button>
          <span className="font-mono text-[12px] text-[#38BDF8]">{selectedTicket.ticket_number || `#${selectedTicket.id?.slice(0, 8)}`}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          <div className="space-y-4">
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
              <h2 className="text-[15px] font-semibold text-[#F8FAFC] mb-1">{selectedTicket.subject}</h2>
              <p className="text-[11px] text-[#94A3B8]">
                Créé le {selectedTicket.created_at ? format(new Date(selectedTicket.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr }) : "—"}
              </p>

              <div className="flex gap-1 mt-4 border-b border-[hsl(220,15%,14%)]">
                {(["conversation", "details", "notes"] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 text-[12px] font-medium rounded-t-md transition-colors ${
                      activeTab === tab ? "bg-[hsl(220,15%,14%)] text-emerald-400 border border-[hsl(220,15%,18%)] border-b-transparent -mb-px" : "text-[#94A3B8] hover:text-[#CBD5E1]"
                    }`}>
                    {tab === "conversation" ? "Conversation" : tab === "details" ? "Détails" : "Notes internes"}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                {activeTab === "conversation" && (
                  <div className="space-y-4">
                    {selectedTicket.related_order_reference && (
                      <div className="p-2.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[12px] text-blue-400 flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5" /> Commande: <strong>{selectedTicket.related_order_reference}</strong>
                      </div>
                    )}
                    <div className="p-3 rounded-md bg-[hsl(220,15%,14%)] border-l-2 border-blue-500">
                      <div className="flex items-center gap-2 mb-1.5">
                        <User className="h-3.5 w-3.5 text-[#94A3B8]" />
                        <span className="text-[12px] font-medium text-[#F8FAFC]">{selectedTicket.profile?.full_name || "Créateur"}</span>
                        <span className="text-[10px] text-[#64748B]">{selectedTicket.created_at ? format(new Date(selectedTicket.created_at), "d MMM HH:mm", { locale: fr }) : ""}</span>
                      </div>
                      <p className="text-[12px] text-[#CBD5E1] whitespace-pre-wrap">{selectedTicket.description}</p>
                    </div>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {allMessages.length === 0 ? (
                        <p className="text-[12px] text-[#64748B] text-center py-6">Aucune réponse pour le moment</p>
                      ) : (
                        allMessages.map((r: any, i: number) => (
                          <div key={r.id || i} className={`p-3 rounded-md text-[12px] ${r.is_admin ? "bg-emerald-500/10 border border-emerald-500/20 ml-6" : "bg-[hsl(220,15%,14%)] mr-6"}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-[10px] font-medium uppercase ${r.is_admin ? "text-emerald-400" : "text-[#94A3B8]"}`}>{r.is_admin ? "Support Nivra" : "Client"}</span>
                              <span className="text-[10px] text-[#64748B]">{r.created_at ? format(new Date(r.created_at), "d MMM HH:mm", { locale: fr }) : ""}</span>
                            </div>
                            <p className="text-[#CBD5E1] whitespace-pre-wrap">{r.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                    {!["closed", "cancelled"].includes(selectedTicket.status) ? (
                      <div className="space-y-3 pt-3 border-t border-[hsl(220,15%,14%)]">
                        <textarea placeholder="Tapez votre réponse…" value={replyContent} onChange={(e) => setReplyContent(e.target.value)} rows={3}
                          className="w-full rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] p-3 focus:outline-none focus:border-emerald-500/50 resize-none" />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => { addReplyMutation.mutate(replyContent); updateTicketMutation.mutate({ ticketId: selectedTicket.id, status: "resolved" }); }}
                            disabled={!replyContent.trim() || addReplyMutation.isPending}
                            className="h-8 px-3 rounded-md bg-[hsl(220,15%,16%)] text-[#CBD5E1] border border-[hsl(220,15%,20%)] text-[12px] font-medium hover:text-[#F8FAFC] transition-colors flex items-center gap-1.5 disabled:opacity-50">
                            <CheckCircle className="h-3.5 w-3.5" /> Répondre et résoudre
                          </button>
                          <button onClick={() => addReplyMutation.mutate(replyContent)} disabled={!replyContent.trim() || addReplyMutation.isPending}
                            className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                            <Send className="h-3.5 w-3.5" /> Envoyer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-md bg-[hsl(220,15%,14%)] text-center">
                        <p className="text-[12px] text-[#64748B]">Ticket {selectedTicket.status === "closed" ? "fermé" : "annulé"}</p>
                        <button onClick={() => updateTicketMutation.mutate({ ticketId: selectedTicket.id, status: "open" })}
                          className="mt-2 h-7 px-3 rounded-md bg-[hsl(220,15%,18%)] text-[#CBD5E1] text-[11px] font-medium hover:text-[#F8FAFC] transition-colors">
                          <RefreshCcw className="h-3 w-3 inline mr-1" /> Réouvrir
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "details" && (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["N° ticket", selectedTicket.ticket_number || `#${selectedTicket.id?.slice(0, 8)}`],
                      ["Catégorie", categoryConfig[selectedTicket.category || "general"] || selectedTicket.category],
                      ["Priorité", priorityConfig[selectedTicket.priority]?.label || selectedTicket.priority],
                      ["Statut", statusConfig[selectedTicket.status]?.label || selectedTicket.status],
                      ["Créé le", selectedTicket.created_at ? format(new Date(selectedTicket.created_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"],
                      ["Mis à jour", selectedTicket.updated_at ? format(new Date(selectedTicket.updated_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"],
                      ["Créé par", selectedTicket.created_by_role === "admin" ? "Admin" : "Client"],
                      ["Commande liée", selectedTicket.related_order_reference || "—"],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider">{label}</p>
                        <p className="text-[12px] text-[#F8FAFC] font-medium mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "notes" && (
                  <div className="space-y-3">
                    <textarea placeholder="Notes internes (visibles uniquement par l'équipe)…" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={6}
                      className="w-full rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] p-3 focus:outline-none focus:border-emerald-500/50 resize-none" />
                    <button onClick={() => updateTicketMutation.mutate({ ticketId: selectedTicket.id, internal_notes: internalNotes })} disabled={updateTicketMutation.isPending}
                      className="h-8 px-3 rounded-md bg-[hsl(220,15%,16%)] text-[#CBD5E1] border border-[hsl(220,15%,20%)] text-[12px] font-medium hover:text-[#F8FAFC] transition-colors flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Sauvegarder
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
              <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Client</h3>
              <div className="space-y-2 text-[12px]">
                <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-[#64748B]" /><span className="text-[#F8FAFC]">{selectedTicket.profile?.full_name || "—"}</span></div>
                <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-[#64748B]" /><span className="text-[#CBD5E1]">{selectedTicket.profile?.email || selectedTicket.client_email || "—"}</span></div>
                <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-[#64748B]" /><span className="text-[#CBD5E1]">{selectedTicket.profile?.phone || "—"}</span></div>
                {selectedTicket.profile?.client_number && (
                  <div className="flex items-center gap-2"><Hash className="h-3.5 w-3.5 text-[#64748B]" /><span className="font-mono text-[#38BDF8]">{selectedTicket.profile.client_number}</span></div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
              <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Gestion</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-[#64748B] uppercase">Statut</label>
                  <select value={selectedTicket.status} onChange={(e) => { setSelectedTicket({ ...selectedTicket, status: e.target.value }); updateTicketMutation.mutate({ ticketId: selectedTicket.id, status: e.target.value }); }}
                    className="w-full h-8 mt-1 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[12px] text-[#F8FAFC] px-2 focus:outline-none">
                    {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[#64748B] uppercase">Priorité</label>
                  <select value={selectedTicket.priority || "normal"} onChange={(e) => { setSelectedTicket({ ...selectedTicket, priority: e.target.value }); updateTicketMutation.mutate({ ticketId: selectedTicket.id, priority: e.target.value }); }}
                    className="w-full h-8 mt-1 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[12px] text-[#F8FAFC] px-2 focus:outline-none">
                    {Object.entries(priorityConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[#64748B] uppercase">Catégorie</label>
                  <select value={selectedTicket.category || "general"} onChange={(e) => { setSelectedTicket({ ...selectedTicket, category: e.target.value }); updateTicketMutation.mutate({ ticketId: selectedTicket.id, category: e.target.value }); }}
                    className="w-full h-8 mt-1 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[12px] text-[#F8FAFC] px-2 focus:outline-none">
                    {Object.entries(categoryConfig).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-1.5">
              <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Actions rapides</h3>
              {[
                { label: "Résoudre", status: "resolved", color: "bg-emerald-600 text-white" },
                { label: "Mettre en pause", status: "on_hold", color: "bg-purple-600/20 text-purple-400 border border-purple-500/30" },
                { label: "Fermer", status: "closed", color: "bg-[hsl(220,15%,16%)] text-[#CBD5E1] border border-[hsl(220,15%,20%)]" },
              ].map((action) => (
                <button key={action.status} onClick={() => updateTicketMutation.mutate({ ticketId: selectedTicket.id, status: action.status })}
                  className={`w-full h-7 rounded-md text-[11px] font-medium transition-colors ${action.color}`}>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══ TICKET LIST VIEW ═══
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F8FAFC]">Centre de support</h1>
          <p className="text-xs text-[#94A3B8]">{stats.open || 0} ouverts • {stats.in_progress || 0} en cours • {scopedTickets.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setCreateOpen(true); setNewTicket({ ...newTicket, is_internal: ticketScope === "internal" }); }}
            className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> {ticketScope === "internal" ? "Ticket interne" : "Créer un ticket"}
          </button>
          <Headphones className="h-5 w-5 text-emerald-400" />
        </div>
      </div>

      {/* Scope tabs: Client / Internal */}
      <div className="flex gap-1.5 border-b border-[hsl(220,15%,16%)] pb-0">
        {([
          { id: "client" as const, label: "Tickets clients", icon: User, count: tickets.filter((t: any) => !t.internal_notes?.startsWith("[TICKET INTERNE]") && !["internal", "operations", "hr", "it"].includes(t.category)).length },
          { id: "internal" as const, label: "Tickets internes", icon: Building, count: tickets.filter((t: any) => t.internal_notes?.startsWith("[TICKET INTERNE]") || ["internal", "operations", "hr", "it"].includes(t.category)).length },
        ]).map((tab) => (
          <button key={tab.id} onClick={() => { setTicketScope(tab.id); setSearch(""); setStatusFilter("all"); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-t-md transition-colors ${
              ticketScope === tab.id
                ? "bg-[hsl(220,20%,11%)] text-emerald-400 border border-[hsl(220,15%,16%)] border-b-transparent -mb-px"
                : "text-[#94A3B8] hover:text-[#CBD5E1]"
            }`}>
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            <span className="text-[10px] text-[#64748B]">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        {Object.entries(statusConfig).map(([key, { label }]) => (
          <button key={key} onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
            className={`rounded-lg border p-2.5 text-left transition-colors ${statusFilter === key ? "border-emerald-500/30 bg-emerald-600/10" : "border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)]"}`}>
            <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider">{label}</span>
            <p className="text-lg font-bold text-[#F8FAFC] mt-0.5">{stats[key] || 0}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ticket, sujet, client, email…"
            className="w-full h-8 pl-8 pr-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50" />
        </div>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[12px] text-[#CBD5E1] focus:outline-none">
          <option value="all">Toutes priorités</option>
          {Object.entries(priorityConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[12px] text-[#CBD5E1] focus:outline-none">
          <option value="all">Toutes catégories</option>
          {Object.entries(categoryConfig).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["Ticket", ticketScope === "internal" ? "Créateur" : "Client", "Sujet", "Catégorie", "Priorité", "Statut", "Créé le"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(220,15%,14%)]">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-3 py-3"><div className="h-4 bg-[hsl(220,15%,14%)] rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-[#64748B]">Aucun ticket trouvé</td></tr>
              ) : (
                filtered.map((t: any) => {
                  const st = statusConfig[t.status] || { label: t.status, color: "text-[#94A3B8]" };
                  const pr = priorityConfig[t.priority] || { label: "—", color: "text-[#94A3B8]" };
                  return (
                    <tr key={t.id} onClick={() => { setSelectedTicket(t); setInternalNotes(t.internal_notes || ""); setActiveTab("conversation"); }}
                      className="hover:bg-[hsl(220,15%,13%)] cursor-pointer transition-colors">
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#38BDF8]">{t.ticket_number || t.id?.slice(0, 8)}</td>
                      <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">{t.profile?.full_name || "—"}</td>
                      <td className="px-3 py-2.5 text-[#CBD5E1] max-w-[200px] truncate">{t.subject || "—"}</td>
                      <td className="px-3 py-2.5 text-[#CBD5E1]">{categoryConfig[t.category || "general"] || t.category || "—"}</td>
                      <td className="px-3 py-2.5"><span className={`text-[11px] font-medium ${pr.color}`}>{pr.label}</span></td>
                      <td className="px-3 py-2.5"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${st.color}`}>{st.label}</span></td>
                      <td className="px-3 py-2.5 text-[#94A3B8]">{t.created_at ? format(new Date(t.created_at), "dd MMM HH:mm", { locale: fr }) : "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Ticket Dialog */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[#F8FAFC]">{newTicket.is_internal ? "Créer un ticket interne" : "Créer un ticket client"}</h2>
              <button onClick={() => setCreateOpen(false)} className="text-[#64748B] hover:text-[#F8FAFC]"><XCircle className="h-5 w-5" /></button>
            </div>

            {/* Type toggle */}
            <div className="flex gap-2">
              <button onClick={() => setNewTicket({ ...newTicket, is_internal: false })}
                className={`flex-1 h-9 rounded-md text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  !newTicket.is_internal ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "text-[#94A3B8] border border-[hsl(220,15%,18%)]"
                }`}>
                <User className="h-3.5 w-3.5" /> Ticket client
              </button>
              <button onClick={() => setNewTicket({ ...newTicket, is_internal: true })}
                className={`flex-1 h-9 rounded-md text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  newTicket.is_internal ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-[#94A3B8] border border-[hsl(220,15%,18%)]"
                }`}>
                <Building className="h-3.5 w-3.5" /> Ticket interne
              </button>
            </div>

            <div className="space-y-3">
              {!newTicket.is_internal && (
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Email du client *</label>
                  <input value={newTicket.client_email} onChange={(e) => setNewTicket({ ...newTicket, client_email: e.target.value })} placeholder="client@example.com"
                    className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50" />
                </div>
              )}
              {newTicket.is_internal && (
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Assigner à (optionnel)</label>
                  <select value={newTicket.assigned_to} onChange={(e) => setNewTicket({ ...newTicket, assigned_to: e.target.value })}
                    className="w-full h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-[#F8FAFC] focus:outline-none">
                    <option value="">Non assigné</option>
                    {staffList.map((s: any) => <option key={s.user_id} value={s.full_name || s.email}>{s.full_name || s.email}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Sujet *</label>
                <input value={newTicket.subject} onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })} placeholder="Sujet du ticket"
                  className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50" />
              </div>
              <div>
                <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Description *</label>
                <textarea value={newTicket.description} onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })} placeholder="Description…" rows={4}
                  className="w-full rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] p-3 focus:outline-none focus:border-emerald-500/50 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Priorité</label>
                  <select value={newTicket.priority} onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                    className="w-full h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-[#F8FAFC] focus:outline-none">
                    {Object.entries(priorityConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Catégorie</label>
                  <select value={newTicket.category} onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                    className="w-full h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-[#F8FAFC] focus:outline-none">
                    {Object.entries(categoryConfig)
                      .filter(([k]) => newTicket.is_internal ? ["internal", "operations", "hr", "it", "general", "technical"].includes(k) : !["internal", "operations", "hr", "it"].includes(k))
                      .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setCreateOpen(false)} className="h-8 px-3 rounded-md bg-[hsl(220,15%,16%)] text-[#CBD5E1] text-[12px] font-medium hover:text-[#F8FAFC] transition-colors">Annuler</button>
              <button onClick={() => createTicketMutation.mutate(newTicket)}
                disabled={(!newTicket.is_internal && !newTicket.client_email) || !newTicket.subject || !newTicket.description || createTicketMutation.isPending}
                className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50">
                Créer le ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
