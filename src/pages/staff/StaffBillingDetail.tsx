/**
 * StaffBillingDetail - Billing/Invoice detail page for staff portal
 * Completely isolated from admin - stays within /staff namespace
 * NOW INCLUDES: Payment recording (Interac, cash, manual)
 */
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, DollarSign, User, Calendar, FileText, CreditCard, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";
import { StaffSidebar } from "@/components/staff/StaffSidebar";
import { StaffRecordPaymentDialog } from "@/components/staff/StaffRecordPaymentDialog";

// PREPAID TERMINOLOGY - V2.5 Compliant (no debt language: impayé/dette/overdue)
const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "En attente", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Clock },
  paid: { label: "Payé", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle },
  overdue: { label: "Renouvellement requis", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertTriangle },
  expired: { label: "Expiré (non renouvelé)", color: "bg-red-600/20 text-red-400 border-red-600/30", icon: AlertTriangle },
  void: { label: "Annulé (non-renouvellement)", color: "bg-muted text-muted-foreground border-muted", icon: FileText },
  not_renewed: { label: "Non renouvelé", color: "bg-muted text-muted-foreground border-muted", icon: FileText },
  partial: { label: "Paiement partiel", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: Clock },
  cancelled: { label: "Annulé", color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: FileText },
  suspended: { label: "Suspendu (litige)", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: AlertTriangle },
};

export default function StaffBillingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: invoice, isLoading, refetch } = useQuery({
    queryKey: ["staff-billing-detail", id],
    queryFn: async () => {
      const { data: invoiceData, error } = await supabase
        .from("billing")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch profile separately
      let profileData = null;
      if (invoiceData?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("user_id", invoiceData.user_id)
          .maybeSingle();
        profileData = profile;
      }

      // Fetch payment history
      let payments: any[] = [];
      if (invoiceData?.id) {
        const { data: paymentData } = await supabase
          .from("payments")
          .select("*")
          .eq("billing_id", invoiceData.id)
          .order("created_at", { ascending: false });
        payments = paymentData || [];
      }

      return { ...invoiceData, profile: profileData, payments };
    },
    enabled: !!id,
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/staff");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <div className="animate-pulse text-slate-400">Chargement...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <div className="text-center">
          <p className="text-slate-400 mb-4">Facture non trouvée</p>
          <Button onClick={() => navigate("/staff/billing")} variant="outline">
            Retour à la facturation
          </Button>
        </div>
      </div>
    );
  }

  const balanceDue = Math.max(0, (invoice.amount || 0) - (invoice.amount_paid || 0));
  const status = statusConfig[invoice.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen flex relative">
      <StaffBackground />
      <StaffSidebar onSignOut={handleSignOut} />
      
      <main className="flex-1 p-6 overflow-auto z-10">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/staff/billing")}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <DollarSign className="h-6 w-6 text-teal-400" />
                Facture {invoice.invoice_number}
              </h1>
              <p className="text-slate-400">
                Créée le {format(new Date(invoice.created_at), "d MMMM yyyy", { locale: fr })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={status.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
            {balanceDue > 0 && (
              <StaffRecordPaymentDialog
                billingId={invoice.id}
                userId={invoice.user_id}
                balanceDue={balanceDue}
                invoiceNumber={invoice.invoice_number}
                clientEmail={invoice.profile?.email || invoice.client_email}
                onSuccess={() => refetch()}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Client Info */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="h-5 w-5 text-teal-400" />
                Client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-slate-500 text-sm">Nom</p>
                <p className="text-white font-medium">{invoice.profile?.full_name || "N/A"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">Email</p>
                <p className="text-white">{invoice.profile?.email || invoice.client_email || "N/A"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">Téléphone</p>
                <p className="text-white">{invoice.profile?.phone || "N/A"}</p>
              </div>
              {invoice.user_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/staff/clients/${invoice.user_id}`)}
                  className="w-full mt-4 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Voir le dossier client
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-teal-400" />
                Résumé financier
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Sous-total</span>
                <span className="text-white">{invoice.subtotal?.toFixed(2) || "0.00"} $</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">TPS (5%)</span>
                <span className="text-white">{invoice.tps_amount?.toFixed(2) || "0.00"} $</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">TVQ (9.975%)</span>
                <span className="text-white">{invoice.tvq_amount?.toFixed(2) || "0.00"} $</span>
              </div>
              {invoice.fees && invoice.fees > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Frais</span>
                  <span className="text-white">{invoice.fees?.toFixed(2)} $</span>
                </div>
              )}
              <Separator className="bg-slate-700" />
              <div className="flex justify-between text-lg font-semibold">
                <span className="text-white">Total</span>
                <span className="text-white">{invoice.amount?.toFixed(2) || "0.00"} $</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Montant payé</span>
                <span className="text-emerald-400">{invoice.amount_paid?.toFixed(2) || "0.00"} $</span>
              </div>
              <Separator className="bg-slate-700" />
              <div className="flex justify-between text-lg font-bold">
                <span className="text-white">Solde dû</span>
                <span className={balanceDue > 0 ? "text-red-400" : "text-emerald-400"}>
                  {balanceDue.toFixed(2)} $
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Dates */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-teal-400" />
                Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Date de création</span>
                <span className="text-white">
                  {format(new Date(invoice.created_at), "d MMM yyyy", { locale: fr })}
                </span>
              </div>
              {invoice.due_date && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Date d'échéance</span>
                  <span className={new Date(invoice.due_date) < new Date() && invoice.status !== "paid" ? "text-red-400" : "text-white"}>
                    {format(new Date(invoice.due_date), "d MMM yyyy", { locale: fr })}
                  </span>
                </div>
              )}
              {invoice.paid_at && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Date de paiement</span>
                  <span className="text-emerald-400">
                    {format(new Date(invoice.paid_at), "d MMM yyyy", { locale: fr })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-teal-400" />
                Historique des paiements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.payments && invoice.payments.length > 0 ? (
                <div className="space-y-3">
                  {invoice.payments.map((payment: any) => (
                    <div key={payment.id} className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-white font-medium">{payment.amount?.toFixed(2)} $</p>
                          <p className="text-xs text-slate-500 capitalize">{payment.payment_method || "—"}</p>
                        </div>
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                          {payment.status === "completed" ? "Confirmé" : payment.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>{payment.reference_number || "—"}</span>
                        <span>{format(new Date(payment.created_at), "d MMM yyyy HH:mm", { locale: fr })}</span>
                      </div>
                      {payment.created_by_name && (
                        <p className="text-xs text-slate-500 mt-1">Par: {payment.created_by_name}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-4">Aucun paiement enregistré</p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {invoice.notes && (
            <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-teal-400" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300 whitespace-pre-wrap">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}