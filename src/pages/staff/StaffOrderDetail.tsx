/**
 * StaffOrderDetail - Order detail page for staff portal
 * Completely isolated from admin - stays within /staff namespace
 */
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Package, Calendar, MapPin, Phone, Mail, User, FileText, DollarSign } from "lucide-react";
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
  processing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  shipped: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function StaffOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: order, isLoading } = useQuery({
    queryKey: ["staff-order-detail", id],
    queryFn: async () => {
      const { data: orderData, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch profile separately
      let profileData = null;
      if (orderData?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("user_id", orderData.user_id)
          .maybeSingle();
        profileData = profile;
      }

      return { ...orderData, profile: profileData };

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

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <div className="text-center">
          <p className="text-slate-400 mb-4">Commande non trouvée</p>
          <Button onClick={() => navigate("/staff/orders")} variant="outline">
            Retour aux commandes
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
            onClick={() => navigate("/staff/orders")}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Package className="h-6 w-6 text-teal-400" />
              Commande {order.order_number || order.confirmation_number}
            </h1>
            <p className="text-slate-400 text-sm">
              Créée le {format(new Date(order.created_at), "d MMMM yyyy à HH:mm", { locale: fr })}
            </p>
          </div>
          <Badge className={statusColors[order.status] || statusColors.pending}>
            {order.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Client Info */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="h-5 w-5 text-teal-400" />
                Informations Client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-slate-500" />
                <span className="text-slate-300">
                  {order.profile?.full_name || `${order.client_first_name || ""} ${order.client_last_name || ""}`.trim() || "N/A"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className="text-slate-300">{order.profile?.email || order.client_email || "N/A"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-slate-500" />
                <span className="text-slate-300">{order.profile?.phone || order.client_phone || "N/A"}</span>
              </div>
              <Separator className="bg-slate-700" />
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-slate-500 mt-1" />
                <div className="text-slate-300">
                  <p>{order.shipping_address}</p>
                  <p>{order.shipping_city}, {order.shipping_province}</p>
                  <p>{order.shipping_postal_code}</p>
                </div>
              </div>
              {order.user_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/staff/clients/${order.user_id}`)}
                  className="w-full mt-4"
                >
                  Voir le profil client
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Order Details */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-400" />
                Détails de la commande
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Type de service</span>
                <span className="text-white">{order.service_type || order.category || "N/A"}</span>
              </div>
              <Separator className="bg-slate-700" />
              <div className="flex justify-between">
                <span className="text-slate-400">Sous-total</span>
                <span className="text-white">{order.subtotal?.toFixed(2) || "0.00"} $</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">TPS</span>
                <span className="text-white">{order.tps_amount?.toFixed(2) || "0.00"} $</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">TVQ</span>
                <span className="text-white">{order.tvq_amount?.toFixed(2) || "0.00"} $</span>
              </div>
              <Separator className="bg-slate-700" />
              <div className="flex justify-between text-lg font-semibold">
                <span className="text-white">Total</span>
                <span className="text-teal-400">{order.total_amount?.toFixed(2) || "0.00"} $</span>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-white">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300 whitespace-pre-wrap">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
