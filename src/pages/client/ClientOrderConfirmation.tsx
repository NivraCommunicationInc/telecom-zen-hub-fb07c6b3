import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Wrench
} from "lucide-react";
import { format, addMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface OrderData {
  id: string;
  order_number: string;
  service_type: string;
  category: string;
  subtotal: number;
  delivery_fee: number;
  activation_fee: number;
  installation_fee: number;
  installation_credit: number;
  tps_amount: number;
  tvq_amount: number;
  total_amount: number;
  status: string;
  payment_reference: string;
  payment_status: string;
  created_at: string;
  selected_channels?: any[];
  appointment_date?: string;
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
  const deliveryFee = order.delivery_fee || 0;
  const activationFee = order.activation_fee ?? 0;
  const installationFee = order.installation_fee || 0;
  const tpsAmount = order.tps_amount || 0;
  const tvqAmount = order.tvq_amount || 0;
  const totalAmount = order.total_amount || 0;

  return (
    <ClientLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Success Banner */}
        <Card className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-emerald-500/30">
          <CardContent className="py-8 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              Commande soumise!
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Merci pour votre commande. Votre commande est en attente d'approbation par notre équipe.
            </p>
          </CardContent>
        </Card>

        {/* Pending Approval Notice */}
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="py-4 flex items-center gap-3">
            <Clock className="w-6 h-6 text-amber-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-600">Commande en attente d'approbation</p>
              <p className="text-sm text-muted-foreground">
                Notre équipe examinera votre commande et vous contactera sous peu pour confirmer les prochaines étapes.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Order Numbers & References */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-cyan-500/30">
            <CardContent className="py-6 text-center">
              <Receipt className="w-8 h-8 text-cyan-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Numéro de confirmation</p>
              <p className="text-xl font-mono font-bold text-cyan-500">
                {`CONF-${order.id.slice(0, 8).toUpperCase()}`}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="py-6 text-center">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Numéro de commande</p>
              <p className="text-xl font-mono font-bold text-foreground">
                {order.order_number}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-emerald-500/30">
            <CardContent className="py-6 text-center">
              <CreditCard className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Référence de paiement</p>
              <p className="text-lg font-mono font-bold text-emerald-500">
                {order.payment_reference || "En attente"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Order Details */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-500" />
              Détails de la commande
            </CardTitle>
            <CardDescription>
              Commande passée le {format(new Date(order.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground mb-2">Services commandés</h4>
              <div className="space-y-2">
                {services.map((service, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    {service}
                  </div>
                ))}
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h4 className="font-medium text-foreground mb-2">Statut</h4>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-500 text-sm font-medium">
                  En attente d'approbation
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* First Invoice / Payment Summary */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-cyan-500" />
              Première facture - Frais initiaux
            </CardTitle>
            <CardDescription>
              Montant dû avant l'activation de vos services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Truck className="w-4 h-4" /> Frais de livraison (Québec)
                </span>
                <span className="font-medium">{deliveryFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
              </div>
              {activationFee > 0 && (
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Frais d'activation (unique)
                  </span>
                  <span className="font-medium">{activationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Wrench className="w-4 h-4" /> Frais d'installation
                </span>
                <span className="font-medium">{installationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
              </div>
              <Separator />
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">TPS (5%)</span>
                <span className="font-medium">{tpsAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">TVQ (9.975%)</span>
                <span className="font-medium">{tvqAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
              </div>
              <Separator />
              <div className="flex justify-between py-3 bg-accent/50 rounded-lg px-4 -mx-4">
                <span className="font-semibold text-foreground">Total première facture</span>
                <span className="text-xl font-bold text-cyan-500">{totalAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-cyan-500" />
              Prochaines étapes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-cyan-500 font-bold">1</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Confirmation par courriel</p>
                  <p className="text-sm text-muted-foreground">Vous recevrez un courriel de confirmation avec tous les détails dans les prochaines minutes.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-cyan-500 font-bold">2</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Vérification d'identité</p>
                  <p className="text-sm text-muted-foreground">Notre équipe vous contactera pour la vérification d'identité dans les 24-48h.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-cyan-500 font-bold">3</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Paiement des frais initiaux</p>
                  <p className="text-sm text-muted-foreground">Une fois l'identité vérifiée, vous recevrez les instructions pour le paiement.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-500 font-bold">4</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Installation et activation</p>
                  <p className="text-sm text-muted-foreground">Votre installation sera planifiée et vos services activés.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="outline" size="lg" className="gap-2" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            Imprimer la confirmation
          </Button>
          {order.appointment_date && (
            <Button variant="outline" size="lg" className="gap-2" onClick={generateICSFile}>
              <CalendarPlus className="w-4 h-4" />
              Ajouter au calendrier
            </Button>
          )}
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
