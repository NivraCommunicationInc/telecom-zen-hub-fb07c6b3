/**
 * StaffBillingDetail - Billing/Invoice detail page for staff portal
 * Completely isolated from admin - stays within /staff namespace
 */
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, DollarSign, User, Calendar, FileText, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";
import { StaffSidebar } from "@/components/staff/StaffSidebar";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  paid: "bg-green-500/20 text-green-400 border-green-500/30",
  overdue: "bg-red-500/20 text-red-400 border-red-500/30",
  partial: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  cancelled: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export default function StaffBillingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: invoice, isLoading } = useQuery({
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

      return { ...invoiceData, profile: profileData };
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

  const balanceDue = (invoice.amount || 0) - (invoice.amount_paid || 0);

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
            onClick={() => navigate("/staff/billing")}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-teal-400" />
              Facture {invoice.invoice_number}
            </h1>
            <p className="text-slate-400">
              Créée le {format(new Date(invoice.created_at), "d MMMM yyyy", { locale: fr })}
            </p>
          </div>
          <Badge className={statusColors[invoice.status] || statusColors.pending}>
            {invoice.status}
          </Badge>
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
                <p className="text-white">{invoice.profile?.full_name || "N/A"}</p>
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
                  className="w-full mt-4"
                >
                  Voir le profil client
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
                <span className="text-green-400">{invoice.amount_paid?.toFixed(2) || "0.00"} $</span>
              </div>
              <Separator className="bg-slate-700" />
              <div className="flex justify-between text-lg font-semibold">
                <span className="text-white">Solde dû</span>
                <span className={balanceDue > 0 ? "text-red-400" : "text-green-400"}>
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
                  <span className="text-white">
                    {format(new Date(invoice.due_date), "d MMM yyyy", { locale: fr })}
                  </span>
                </div>
              )}
              {invoice.paid_at && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Date de paiement</span>
                  <span className="text-green-400">
                    {format(new Date(invoice.paid_at), "d MMM yyyy", { locale: fr })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {invoice.notes && (
            <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
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
