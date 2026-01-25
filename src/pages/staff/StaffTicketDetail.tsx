/**
 * StaffTicketDetail - Ticket detail page for staff portal
 * Completely isolated from admin - stays within /staff namespace
 */
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { ArrowLeft, Ticket, User, Clock, Send, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import StaffBackground from "@/components/staff/StaffBackground";
import { StaffSidebar } from "@/components/staff/StaffSidebar";

const statusColors: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  in_progress: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  resolved: "bg-green-500/20 text-green-400 border-green-500/30",
  closed: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-500/20 text-slate-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  high: "bg-orange-500/20 text-orange-400",
  urgent: "bg-red-500/20 text-red-400",
};

export default function StaffTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [replyContent, setReplyContent] = useState("");

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["staff-ticket-detail", id],
    queryFn: async () => {
      const { data: ticketData, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch profile separately
      let profileData = null;
      if (ticketData?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("user_id", ticketData.user_id)
          .maybeSingle();
        profileData = profile;
      }

      return { ...ticketData, profile: profileData };
    },
    enabled: !!id,
  });

  const { data: replies } = useQuery({
    queryKey: ["staff-ticket-replies", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_replies")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("ticket_replies")
        .insert({
          ticket_id: id!,
          user_id: user.id,
          sender_role: "employee",
          content,
        });

      if (error) throw error;

      // Update ticket status to in_progress if open
      if (ticket?.status === "open") {
        await supabase
          .from("support_tickets")
          .update({ status: "in_progress" })
          .eq("id", id);
      }
    },
    onSuccess: () => {
      toast.success("Réponse envoyée");
      setReplyContent("");
      queryClient.invalidateQueries({ queryKey: ["staff-ticket-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["staff-ticket-replies", id] });
    },
    onError: (error) => {
      toast.error("Erreur lors de l'envoi: " + error.message);
    },
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/staff");
  };

  const handleSendReply = () => {
    if (!replyContent.trim()) {
      toast.error("Le message ne peut pas être vide");
      return;
    }
    replyMutation.mutate(replyContent);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <div className="animate-pulse text-slate-400">Chargement...</div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <div className="text-center">
          <p className="text-slate-400 mb-4">Ticket non trouvé</p>
          <Button onClick={() => navigate("/staff/tickets")} variant="outline">
            Retour aux tickets
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex relative">
      <StaffBackground />
      <StaffSidebar onSignOut={handleSignOut} />
      
      <main className="flex-1 p-6 overflow-auto z-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/staff/tickets")}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Ticket className="h-6 w-6 text-teal-400" />
              {ticket.ticket_number}
            </h1>
            <p className="text-slate-400">{ticket.subject}</p>
          </div>
          <Badge className={statusColors[ticket.status] || statusColors.open}>
            {ticket.status}
          </Badge>
          <Badge className={priorityColors[ticket.priority] || priorityColors.medium}>
            {ticket.priority}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Original Message */}
            <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {ticket.profile?.full_name || ticket.client_email || "Client"}
                  </span>
                  <span className="text-slate-500 font-normal">
                    {format(new Date(ticket.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300 whitespace-pre-wrap">{ticket.description}</p>
              </CardContent>
            </Card>

            {/* Replies */}
            {replies?.map((reply) => (
              <Card
                key={reply.id}
                className={`border-slate-700/50 backdrop-blur-sm ${
                  reply.sender_role === "client" 
                    ? "bg-slate-800/50" 
                    : "bg-teal-900/20 border-teal-700/30"
                }`}
              >
                <CardHeader>
                  <CardTitle className="text-white text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {reply.sender_role === "client" ? "Client" : "Staff"}
                      <Badge variant="outline" className="text-xs">
                        {reply.sender_role}
                      </Badge>
                    </span>
                    <span className="text-slate-500 font-normal">
                      {format(new Date(reply.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 whitespace-pre-wrap">{reply.content}</p>
                </CardContent>
              </Card>
            ))}

            {/* Reply Form */}
            <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white text-sm">Répondre</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Écrivez votre réponse..."
                  className="min-h-[120px] bg-slate-900/50 border-slate-600 text-white"
                />
                <div className="flex justify-between">
                  <Button variant="outline" size="sm" disabled>
                    <Paperclip className="h-4 w-4 mr-2" />
                    Joindre un fichier
                  </Button>
                  <Button 
                    onClick={handleSendReply}
                    disabled={replyMutation.isPending || !replyContent.trim()}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white text-sm">Informations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Catégorie</span>
                  <span className="text-white">{ticket.category || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Créé le</span>
                  <span className="text-white">
                    {format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}
                  </span>
                </div>
                {ticket.user_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/staff/clients/${ticket.user_id}`)}
                    className="w-full mt-4"
                  >
                    Voir le profil client
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
