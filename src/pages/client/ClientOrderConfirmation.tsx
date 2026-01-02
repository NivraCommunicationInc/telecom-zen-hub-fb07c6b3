import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, 
  Receipt, 
  FileText, 
  CreditCard,
  Clock,
  Calendar,
  ArrowRight,
  Phone,
  Mail,
  Printer,
  CalendarPlus,
  Truck,
  Zap,
  Wrench,
  MapPin,
  Copy,
  MessageSquare,
  Smartphone,
  Wifi,
  Tv,
  MonitorPlay
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface OrderData {
  id: string;
  order_number: string;
  confirmation_number: string;
  service_type: string;
  category: string;
  subtotal: number;
  delivery_fee: number;
  activation_fee: number;
  installation_fee: number;
  installation_credit: number;
  installation_type: string;
  tps_amount: number;
  tvq_amount: number;
  total_amount: number;
  status: string;
  payment_reference: string;
  payment_status: string;
  created_at: string;
  selected_channels?: any[];
  appointment_date?: string;
  notes?: string;
  equipment_details?: any;
}

const ClientOrderConfirmation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orderId = searchParams.get("orderId");

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId || !user?.id) {
        setError("Aucune commande trouvée");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (fetchError) throw fetchError;
        
        if (!data) {
          setError("Commande introuvable");
        } else {
          setOrder(data as OrderData);
        }
      } catch (err) {
        console.error("Error fetching order:", err);
        setError("Erreur lors du chargement de la commande");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, user?.id]);

  const copyOrderNumber = () => {
    if (order?.order_number) {
      navigator.clipboard.writeText(order.order_number);
      toast.success("Numéro de commande copié!");
    }
  };

  const generateICSFile = () => {
    if (!order?.appointment_date || !order) return;
    
    const startDate = new Date(order.appointment_date);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 2);

    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nivra//Installation//FR
BEGIN:VEVENT
UID:${order.order_number}@nivra.ca
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:Installation Nivra - ${order.order_number}
DESCRIPTION:Installation de vos services Nivra.\\nCommande: ${order.order_number}\\nServices: ${order.service_type}
LOCATION:Votre domicile
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nivra-installation-${order.order_number}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parse notes to extract service address and phone
  const parseNotes = (notes: string | undefined) => {
    if (!notes) return { address: null, phone: null };
    const addressMatch = notes.match(/\*\*Adresse de service:\*\*\n([^\n]+)/);
    const phoneMatch = notes.match(/\*\*Téléphone client:\*\* ([^\n]+)/);
    return {
      address: addressMatch ? addressMatch[1] : null,
      phone: phoneMatch ? phoneMatch[1] : null,
    };
  };

  if (loading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
        </div>
      </ClientLayout>
    );
  }

  if (error || !order) {
    return (
      <ClientLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-bold text-foreground mb-4">{error || "Erreur"}</h2>
          <Button onClick={() => navigate("/portal/orders")}>
            Voir mes commandes
          </Button>
        </div>
      </ClientLayout>
    );
  }

  const services = order.service_type.split(", ");
  const { address: serviceAddress, phone: clientPhone } = parseNotes(order.notes);
  const deliveryFee = order.delivery_fee || 0;
  const activationFee = order.activation_fee ?? 0;
  const installationFee = order.installation_fee || 0;
  const tpsAmount = order.tps_amount || 0;
  const tvqAmount = order.tvq_amount || 0;
  const totalAmount = order.total_amount || 0;
  const oneTimeFees = deliveryFee + activationFee + installationFee;
  const monthlyRecurring = order.subtotal || 0;

  // Determine next step content
  const getNextStepContent = () => {
    if (order.installation_type === "technician") {
      if (order.appointment_date) {
        return {
          icon: Calendar,
          title: "Rendez-vous confirmé",
          description: `Installation prévue le ${format(new Date(order.appointment_date), "d MMMM yyyy", { locale: fr })}`,
          color: "emerald"
        };
      }
      return {
        icon: Phone,
        title: "Contact sous 2-24h",
        description: "Un agent vous contactera pour confirmer votre rendez-vous d'installation.",
        color: "cyan"
      };
    }
    return {
      icon: Truck,
      title: "Livraison en cours",
      description: "Votre équipement sera expédié sous 24-78 heures ouvrables.",
      color: "purple"
    };
  };

  const nextStep = getNextStepContent();
  const NextStepIcon = nextStep.icon;

  return (
    <ClientLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header - Commande confirmée */}
        <Card className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-emerald-500/30">
          <CardContent className="py-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <div className="text-center md:text-left flex-1">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Commande confirmée
                  </h2>
                  <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
                    En traitement
                  </Badge>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                  <span className="text-xl font-mono font-bold text-cyan-500">{order.order_number}</span>
                  <Button variant="ghost" size="sm" onClick={copyOrderNumber} className="h-8 w-8 p-0">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(order.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Step Banner */}
        <Card className={`bg-${nextStep.color}-500/10 border-${nextStep.color}-500/30`}>
          <CardContent className="py-4 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full bg-${nextStep.color}-500/20 flex items-center justify-center flex-shrink-0`}>
              <NextStepIcon className={`w-6 h-6 text-${nextStep.color}-500`} />
            </div>
            <div>
              <p className={`font-semibold text-${nextStep.color}-500`}>{nextStep.title}</p>
              <p className="text-sm text-muted-foreground">{nextStep.description}</p>
            </div>
          </CardContent>
        </Card>

        {/* Order Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column - Service Details */}
          <div className="space-y-6">
            {/* Adresse de service */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-cyan-500" />
                  Adresse de service
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground">{serviceAddress || "Non spécifiée"}</p>
                {clientPhone && (
                  <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {clientPhone}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Services sélectionnés */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-500" />
                  Services mensuels
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {services.map((service, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-foreground">{service}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Équipement inclus */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-purple-500" />
                  Équipement inclus
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>Équipement attribué selon les règles du forfait.</p>
                <p className="mt-1 text-xs">Visible dans les détails de la commande.</p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Financial Summary */}
          <div className="space-y-6">
            {/* Frais uniques */}
            <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-cyan-500" />
                  Frais uniques (aujourd'hui)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Livraison</span>
                    <span>{deliveryFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                  </div>
                )}
                {activationFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Activation</span>
                    <span>{activationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                  </div>
                )}
                {installationFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Installation</span>
                    <span>{installationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TPS (5%)</span>
                  <span>{tpsAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TVQ (9.975%)</span>
                  <span>{tvqAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-cyan-500/30 font-bold">
                  <span className="text-cyan-500">Total dû aujourd'hui</span>
                  <span className="text-cyan-500">{totalAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                </div>
              </CardContent>
            </Card>

            {/* Mensuel récurrent */}
            <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-500" />
                  Mensuel récurrent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Services mensuels</span>
                  <span>{monthlyRecurring.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-purple-500/30 font-bold">
                  <span className="text-purple-500">Total mensuel (+ taxes)</span>
                  <span className="text-purple-500">{(monthlyRecurring * 1.14975).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center">
          <Button variant="outline" size="lg" className="gap-2" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            Imprimer
          </Button>
          {order.appointment_date && (
            <Button variant="outline" size="lg" className="gap-2" onClick={generateICSFile}>
              <CalendarPlus className="w-4 h-4" />
              Ajouter au calendrier
            </Button>
          )}
          <Button variant="outline" size="lg" className="gap-2" onClick={() => navigate("/portal/tickets/new")}>
            <MessageSquare className="w-4 h-4" />
            Ouvrir un billet
          </Button>
          <Button variant="hero" size="lg" onClick={() => navigate("/portal/orders")} className="gap-2">
            Voir mes commandes
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Contact Info */}
        <Card className="bg-card border-border">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                1-888-NIVRA
              </span>
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                support@nivra.ca
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Lun-Ven 9h-18h
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ClientOrderConfirmation;
