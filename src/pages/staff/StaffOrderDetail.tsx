/**
 * StaffOrderDetail - Order detail page for staff portal
 * Enhanced with internal notes, contract and invoice PDF access
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, Package, MapPin, Phone, Mail, User, 
  FileText, MessageSquare, Plus, Clock, CreditCard, Send,
  Download, Eye, FileCheck, Receipt, ScrollText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import StaffBackground from "@/components/staff/StaffBackground";
import { StaffSidebar } from "@/components/staff/StaffSidebar";
import {
  generateCanonicalInvoicePDF,
  generateCanonicalContractPDF,
  generateCanonicalReceiptPDF,
  generateCanonicalOrderSummaryPDF,
} from "@/lib/pdf";
import { safePDFOpen } from "@/lib/pdfUtils";
import PDFViewerDialog from "@/components/PDFViewerDialog";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  processing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  paid: "bg-green-500/20 text-green-400 border-green-500/30",
};

interface OrderNote {
  id: string;
  order_id: string;
  body: string;
  created_by_user_id: string;
  created_by_role: string;
  created_by_name: string | null;
  created_at: string;
}

export default function StaffOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: ["current-staff-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return { id: user.id, name: profile?.full_name || "Employé" };
    },
  });

  const { data: order, isLoading } = useQuery({
    queryKey: ["staff-order-detail", id],
    queryFn: async () => {
      const { data: orderData, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      
      let profileData = null;
      if (orderData?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, phone, service_address, service_city, service_postal_code, date_of_birth")
          .eq("user_id", orderData.user_id)
          .maybeSingle();
        profileData = profile;
      }
      return { ...orderData, profile: profileData };
    },
    enabled: !!id,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["staff-order-notes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_internal_notes")
        .select("*")
        .eq("order_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OrderNote[];
    },
    enabled: !!id,
  });

  // Fetch related billing for this order from canonical billing_invoices
  const { data: orderBilling } = useQuery({
    queryKey: ["staff-order-billing", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, total, balance_due, status, due_date, created_at, paid_at")
        .eq("order_id", id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) return [];
      // Map to legacy shape used by template
      return (data || []).map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        amount: inv.total,
        balance_due: inv.balance_due,
        status: inv.status,
        due_date: inv.due_date,
        created_at: inv.created_at,
        paid_at: inv.paid_at,
      }));
    },
    enabled: !!id,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from("order_internal_notes").insert({
        order_id: id,
        body: body.trim(),
        created_by_user_id: currentUser?.id,
        created_by_role: "employee",
        created_by_name: currentUser?.name || "Employé",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note ajoutée");
      setNewNote("");
      setIsAddingNote(false);
      queryClient.invalidateQueries({ queryKey: ["staff-order-notes", id] });
    },
    onError: (error: any) => toast.error(error.message || "Erreur"),
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/staff");
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin") return <Badge className="bg-red-500/20 text-red-400 text-xs">Admin</Badge>;
    if (role === "employee") return <Badge className="bg-blue-500/20 text-blue-400 text-xs">Employé</Badge>;
    return <Badge variant="outline" className="text-xs">{role}</Badge>;
  };

  const getInvoiceIdForOrder = async (): Promise<string | null> => {
    if (!order) return null;
    const { data: billingInvoice } = await supabase
      .from("billing_invoices")
      .select("id")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return billingInvoice?.id || null;
  };

  const handleViewContract = async () => {
    if (!order) return;
    setIsGeneratingPdf("contract");
    try {
      const result = await generateCanonicalContractPDF(supabase, order.related_contract_id || order.id);
      if (result.success && result.blob) {
        safePDFOpen(result.blob, result.filename || `Contrat_${order.order_number}.pdf`);
        toast.success("Contrat ouvert");
      } else {
        toast.error(result.error || "Impossible de générer le contrat");
      }
    } catch (error) {
      console.error("Contract PDF error:", error);
      toast.error("Impossible de générer le contrat");
    } finally {
      setIsGeneratingPdf(null);
    }
  };

  const handleViewInvoice = async () => {
    if (!order) return;
    setIsGeneratingPdf("invoice");
    try {
      const invoiceId = await getInvoiceIdForOrder();
      if (!invoiceId) {
        toast.error("Aucune facture trouvée pour cette commande");
        return;
      }

      const result = await generateCanonicalInvoicePDF(supabase, invoiceId);
      if (result.success && result.blob) {
        safePDFOpen(result.blob, result.filename || "facture.pdf");
        toast.success("Facture ouverte");
      } else {
        toast.error(result.error || "Impossible de générer la facture");
      }
    } catch (error) {
      console.error("Invoice PDF error:", error);
      toast.error("Impossible de générer la facture");
    } finally {
      setIsGeneratingPdf(null);
    }
  };

  const handleViewReceipt = async () => {
    if (!order) return;
    setIsGeneratingPdf("receipt");
    try {
      const invoiceId = await getInvoiceIdForOrder();
      if (!invoiceId) {
        toast.error("Aucune facture trouvée pour cette commande");
        return;
      }

      const result = await generateCanonicalReceiptPDF(supabase, invoiceId);
      if (result.success && result.blob) {
        safePDFOpen(result.blob, result.filename || "recu.pdf");
        toast.success("Reçu ouvert");
      } else {
        toast.error(result.error || "Impossible de générer le reçu");
      }
    } catch (error) {
      console.error("Receipt PDF error:", error);
      toast.error("Impossible de générer le reçu");
    } finally {
      setIsGeneratingPdf(null);
    }
  };

  const handleViewOrderSummary = async () => {
    if (!order) return;
    setIsGeneratingPdf("summary");
    try {
      const result = await generateCanonicalOrderSummaryPDF(supabase, order.id);
      if (result.success && result.blob) {
        safePDFOpen(result.blob, result.filename || "sommaire-commande.pdf");
        toast.success("Sommaire ouvert");
      } else {
        toast.error(result.error || "Impossible de générer le sommaire");
      }
    } catch (error) {
      console.error("Order summary PDF error:", error);
      toast.error("Impossible de générer le sommaire");
    } finally {
      setIsGeneratingPdf(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <div className="animate-pulse text-slate-400">Chargement...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <div className="text-center">
          <p className="text-slate-400 mb-4">Commande non trouvée</p>
          <Button onClick={() => navigate("/staff/orders")} variant="outline">Retour</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex relative">
      <StaffBackground />
      <StaffSidebar onSignOut={handleSignOut} />
      
      <main className="flex-1 p-6 overflow-auto z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/staff/orders")} className="text-slate-400 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <Package className="h-6 w-6 text-teal-400" />
                {order.order_number || order.confirmation_number}
              </h1>
              <p className="text-slate-400 text-sm">{format(new Date(order.created_at), "d MMMM yyyy HH:mm", { locale: fr })}</p>
            </div>
            <Badge className={statusColors[order.status] || statusColors.pending}>{order.status}</Badge>
          </div>
          
          {/* PDF Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleViewContract}
              disabled={isGeneratingPdf === "contract"}
              className="border-teal-500/50 text-teal-400 hover:bg-teal-500/10"
            >
              {isGeneratingPdf === "contract" ? (
                <span className="animate-pulse">Génération...</span>
              ) : (
                <>
                  <FileCheck className="h-4 w-4 mr-2" />
                  Voir Contrat
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleViewInvoice}
              disabled={isGeneratingPdf === "invoice"}
              className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
            >
              {isGeneratingPdf === "invoice" ? (
                <span className="animate-pulse">Génération...</span>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Voir Facture
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleViewReceipt}
              disabled={isGeneratingPdf === "receipt"}
              className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
            >
              {isGeneratingPdf === "receipt" ? (
                <span className="animate-pulse">Génération...</span>
              ) : (
                <>
                  <Receipt className="h-4 w-4 mr-2" />
                  Voir Reçu
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleViewOrderSummary}
              disabled={isGeneratingPdf === "summary"}
              className="border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
            >
              {isGeneratingPdf === "summary" ? (
                <span className="animate-pulse">Génération...</span>
              ) : (
                <>
                  <ScrollText className="h-4 w-4 mr-2" />
                  Voir Sommaire
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardHeader><CardTitle className="text-white flex items-center gap-2"><User className="h-5 w-5 text-teal-400" />Client</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-slate-300">
              <div className="flex items-center gap-2"><User className="h-4 w-4 text-slate-500" />{order.profile?.full_name || order.client_first_name || "N/A"}</div>
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-500" />{order.profile?.email || order.client_email || "N/A"}</div>
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-500" />{order.profile?.phone || order.client_phone || "N/A"}</div>
              <Separator className="bg-slate-700" />
              <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-slate-500 mt-1" /><div>{order.shipping_address}, {order.shipping_city}</div></div>
              {order.user_id && <Button variant="outline" size="sm" onClick={() => navigate(`/staff/clients/${order.user_id}`)} className="w-full">Voir profil client</Button>}
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardHeader><CardTitle className="text-white flex items-center gap-2"><FileText className="h-5 w-5 text-teal-400" />Détails financiers</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between"><span className="text-slate-400">Service</span><span className="text-white">{order.service_type || "N/A"}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Paiement</span><span className="text-white flex items-center gap-1"><CreditCard className="h-3 w-3" />{order.payment_method || "Interac"}</span></div>
              <Separator className="bg-slate-700" />
              <div className="flex justify-between"><span className="text-slate-400">Sous-total</span><span className="text-white">{order.subtotal?.toFixed(2) || "0.00"} $</span></div>
              <div className="flex justify-between"><span className="text-slate-400">TPS (5%)</span><span className="text-white">{order.tps_amount?.toFixed(2) || "0.00"} $</span></div>
              <div className="flex justify-between"><span className="text-slate-400">TVQ (9.975%)</span><span className="text-white">{order.tvq_amount?.toFixed(2) || "0.00"} $</span></div>
              <Separator className="bg-slate-700" />
              <div className="flex justify-between text-lg font-semibold"><span className="text-white">Total</span><span className="text-teal-400">{order.total_amount?.toFixed(2) || "0.00"} $</span></div>
            </CardContent>
          </Card>

          {/* Related Invoices */}
          {orderBilling && orderBilling.length > 0 && (
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-teal-400" />
                  Factures liées ({orderBilling.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {orderBilling.map((bill: any) => (
                    <div 
                      key={bill.id}
                      className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-white font-mono text-sm">{bill.invoice_number || "Facture"}</p>
                        <p className="text-xs text-slate-500">
                          {bill.due_date ? format(new Date(bill.due_date), "d MMM yyyy", { locale: fr }) : "-"}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={statusColors[bill.status] || "bg-slate-500/20 text-slate-400"}>
                          {bill.status}
                        </Badge>
                        <p className="text-teal-400 font-semibold mt-1">{bill.amount?.toFixed(2)} $</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Internal Notes */}
          <Card className={`bg-amber-500/5 border-amber-500/30 ${!orderBilling?.length ? 'lg:col-span-2' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-500" />
                  Notes internes
                  <Badge className="bg-amber-500/20 text-amber-400 text-xs">{notes.length}</Badge>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsAddingNote(!isAddingNote)} className="gap-1">
                  <Plus className="w-3 h-3" />
                  Ajouter
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isAddingNote && (
                <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg space-y-2">
                  <Textarea 
                    placeholder="Écrire une note interne..." 
                    value={newNote} 
                    onChange={(e) => setNewNote(e.target.value)} 
                    rows={3} 
                    className="bg-slate-900/50 border-slate-700 text-white" 
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setIsAddingNote(false); setNewNote(""); }}>Annuler</Button>
                    <Button 
                      size="sm" 
                      onClick={() => addNoteMutation.mutate(newNote)} 
                      disabled={!newNote.trim() || addNoteMutation.isPending} 
                      className="bg-teal-500 hover:bg-teal-600"
                    >
                      <Send className="w-3 h-3 mr-1" />
                      Envoyer
                    </Button>
                  </div>
                </div>
              )}
              {notes.length === 0 ? (
                <p className="text-slate-500 text-center py-4">Aucune note interne</p>
              ) : (
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {notes.map((note) => (
                      <div key={note.id} className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-slate-500" />
                            <span className="text-sm text-slate-300">{note.created_by_name}</span>
                            {getRoleBadge(note.created_by_role)}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            {format(new Date(note.created_at), "d MMM HH:mm", { locale: fr })}
                          </div>
                        </div>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{note.body}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
