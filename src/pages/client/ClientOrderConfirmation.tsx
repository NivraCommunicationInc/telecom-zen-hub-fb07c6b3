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
  Wrench,
  MapPin,
  Copy,
  MessageSquare,
  Smartphone,
  Wifi,
  Tv,
  MonitorPlay,
  Shield,
  User,
  Building,
  Package,
  ExternalLink,
  AlertCircle,
  KeyRound,
  RefreshCw,
  Router,
  Download,
  ScrollText
} from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { COMPANY_CONTACT } from "@/config/company";
import { format, addDays, addMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { portalClient as supabase } from "@/integrations/backend/portalClient";
import { useClientAuth } from "@/hooks/useClientAuth";
import { toast } from "sonner";
import { safePDFDownload } from "@/lib/pdfUtils";

const STATIC_TERMS_PDF = "/documents/Nivra_Telecom_Modalites_de_service_v2026-02-05.pdf";

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
  appointment_notes?: string;
  notes?: string;
  equipment_details?: any;
  router_fee?: number;
  terminal_fee?: number;
  terminal_count?: number;
  delivery_method?: string;
  promo_code?: string;
  promo_discount_amount?: number;
  preauth_discount?: number;
  amount_paid?: number;
  account_id?: string;
  pricing_snapshot?: any;
  // Address fields from order
  shipping_address?: string;
  shipping_city?: string;
  shipping_province?: string;
  shipping_postal_code?: string;
}

interface AccountData {
  id: string;
  account_number: string;
  billing_cycle_day: number;
  billing_cycle_timezone: string;
}

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  service_address: string;
  service_city: string;
  service_province: string;
  service_postal_code: string;
  client_number: string;
  client_pin_hash: string | null;
  pin_is_default: boolean | null;
}

const ClientOrderConfirmation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useClientAuth();
  const { data: siteSettings } = useSiteSettings();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use site_settings as source of truth, COMPANY_CONTACT as fallback
  const supportPhone = siteSettings?.support_phone || COMPANY_CONTACT.supportPhoneDisplay;
  const supportEmail = siteSettings?.support_email || COMPANY_CONTACT.supportEmailDisplay;
  const businessHours = siteSettings?.business_hours || COMPANY_CONTACT.supportHours;

  const orderId = searchParams.get("orderId");

  useEffect(() => {
    const fetchData = async () => {
      if (!orderId || !user?.id) {
        setError("Aucune commande trouvée");
        setLoading(false);
        return;
      }

      try {
        // Fetch order, account, and profile in parallel
        const [orderRes, profileRes, accountRes] = await Promise.all([
          supabase
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("full_name, email, phone, service_address, service_city, service_province, service_postal_code, client_number, client_pin_hash, pin_is_default")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("accounts")
            .select("id, account_number, billing_cycle_day, billing_cycle_timezone")
            .eq("client_id", user.id)
            .maybeSingle()
        ]);

        if (orderRes.error) throw orderRes.error;
        
        if (!orderRes.data) {
          setError("Commande introuvable");
        } else {
          setOrder(orderRes.data as OrderData);
        }
        
        if (profileRes.data) {
          setProfile(profileRes.data as ProfileData);
        }
        
        if (accountRes.data) {
          setAccount(accountRes.data as AccountData);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Erreur lors du chargement de la commande");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orderId, user?.id]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié!`);
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
LOCATION:${profile?.service_address || "Votre domicile"}
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

  // Parse notes to extract port-in details
  const parsePortInDetails = (notes: string | undefined) => {
    if (!notes) return null;
    const portInMatch = notes.match(/\*\*Transfert de numéro.*?\*\*/);
    const numberMatch = notes.match(/Numéro à transférer:\s*([^\n]+)/);
    const providerMatch = notes.match(/Fournisseur actuel:\s*([^\n]+)/);
    const accountMatch = notes.match(/Numéro de compte:\s*([^\n]+)/);
    
    if (numberMatch || notes.includes("Transfert de numéro")) {
      return {
        number: numberMatch ? numberMatch[1] : null,
        provider: providerMatch ? providerMatch[1] : null,
        accountNumber: accountMatch ? accountMatch[1] : null,
      };
    }
    return null;
  };

  // Parse equipment from notes
  const parseEquipment = (order: OrderData) => {
    const equipment = [];
    const services = order.service_type?.toLowerCase() || "";
    
    if (services.includes("internet") || services.includes("tv") || services.includes("télé")) {
      equipment.push({ 
        name: "Nivra Born Wifi Router", 
        quantity: 1, 
        fee: order.router_fee || 60,
        type: "router"
      });
    }
    
    if (services.includes("tv") || services.includes("télé")) {
      equipment.push({ 
        name: "Nivra 4K Smart Terminal", 
        quantity: order.terminal_count || 1, 
        fee: order.terminal_fee || 50,
        type: "terminal"
      });
    }
    
    if (services.includes("mobile") || services.includes("cellulaire")) {
      // Count mobile lines from notes or default to 1
      const mobileMatch = order.notes?.match(/(\d+)\s*ligne/i);
      const lineCount = mobileMatch ? parseInt(mobileMatch[1]) : 1;
      equipment.push({ 
        name: "Carte SIM physique", 
        quantity: lineCount, 
        fee: 25 * lineCount,
        type: "sim"
      });
    }
    
    return equipment;
  };

  // Calculate billing dates based on order creation date (activation date)
  // For prepaid services, billing cycle = day the service was activated
  const getBillingInfo = () => {
    // Use order creation date as the billing cycle day for prepaid services
    const orderCreatedDate = new Date(order?.created_at || new Date());
    const activationDay = orderCreatedDate.getDate();
    
    // If account has a billing_cycle_day set, use it; otherwise use order creation day
    const billCycleDay = account?.billing_cycle_day || activationDay;
    
    const today = new Date();
    let nextBillingDate = new Date(today.getFullYear(), today.getMonth(), billCycleDay);
    
    // Handle months with fewer days (e.g., billing day 31 in February)
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    if (billCycleDay > lastDayOfMonth) {
      nextBillingDate = new Date(today.getFullYear(), today.getMonth(), lastDayOfMonth);
    }
    
    if (nextBillingDate <= today) {
      const nextMonth = today.getMonth() + 1;
      const nextYear = nextMonth > 11 ? today.getFullYear() + 1 : today.getFullYear();
      const adjustedMonth = nextMonth > 11 ? 0 : nextMonth;
      const lastDayNextMonth = new Date(nextYear, adjustedMonth + 1, 0).getDate();
      const adjustedDay = Math.min(billCycleDay, lastDayNextMonth);
      nextBillingDate = new Date(nextYear, adjustedMonth, adjustedDay);
    }
    
    return {
      cycleDay: billCycleDay,
      nextBillingDate,
      activationDay // Store the actual activation day
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
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-4">{error || "Erreur"}</h2>
          <Button onClick={() => navigate("/portal/orders")}>
            Voir mes commandes
          </Button>
        </div>
      </ClientLayout>
    );
  }

  const services = order.service_type?.split(", ") || [];
  const portInDetails = parsePortInDetails(order.notes);
  const equipment = parseEquipment(order);
  const billingInfo = getBillingInfo();
  const hasPinConfigured = profile?.client_pin_hash !== null && profile?.client_pin_hash !== undefined;
  const pinIsDefault = profile?.pin_is_default === true;
  
  // Get address - prefer order shipping address, fallback to profile
  const serviceAddress = order.shipping_address || profile?.service_address || "";
  const serviceCity = order.shipping_city || profile?.service_city || "";
  const serviceProvince = order.shipping_province || profile?.service_province || "QC";
  const servicePostalCode = order.shipping_postal_code || profile?.service_postal_code || "";
  const hasValidAddress = serviceAddress && serviceCity;
  
  // ===== CANONICAL PRICING: All monetary values from pricing_snapshot =====
  // The pricing_snapshot is the server-approved pricing object saved at order creation.
  // No client-side recalculation is permitted.
  const ps = order.pricing_snapshot;
  const hasSnapshot = !!ps;
  
  // One-time fees (from order columns — these are individual line items for display)
  const deliveryFee = order.delivery_fee ?? 0;
  const activationFee = order.activation_fee ?? 0;
  const installationFee = Math.max(0, (order.installation_fee || 0) - (order.installation_credit || 0));
  const routerFee = order.router_fee ?? 0;
  const terminalFee = order.terminal_fee ?? 0;
  const simFee = equipment.find(e => e.type === "sim")?.fee || 0;
  const preauthDiscount = order.preauth_discount || 0;
  
  // ===== All totals from pricing_snapshot (canonical) =====
  const monthlyRecurringGross = hasSnapshot ? Number(ps.recurring_subtotal) : (order.subtotal ?? 0);
  // CRITICAL FIX: discount_total_combined may include equipment/delivery discounts
  // that do NOT reduce the monthly recurring amount. Only subtract welcome_discount
  // and service-specific promo discounts from the monthly recurring.
  const promoApplied = hasSnapshot ? ps.promo_applied : null;
  const promoAppliesToServices = promoApplied?.applies_to?.services === true;
  const serviceOnlyDiscount = hasSnapshot
    ? (promoAppliesToServices ? Number(ps.promo_discount ?? 0) : 0) + Number(ps.welcome_discount ?? 0)
    : (order.promo_discount_amount ?? 0);
  const monthlyRecurringNet = Math.max(0, monthlyRecurringGross - serviceOnlyDiscount);
  const oneTimeSubtotal = hasSnapshot ? Number(ps.one_time_subtotal) : (deliveryFee + activationFee + installationFee + routerFee + terminalFee + simFee);
  const promoDiscount = hasSnapshot ? Number(ps.discount_total_combined) : (order.promo_discount_amount ?? 0);
  
  // Taxes and total — use order.total_amount as authoritative (set from RPC at commit time)
  // If amount_paid > 0 (PayPal captured), use that as the definitive "total paid"
  const tpsAmount = hasSnapshot ? Number(ps.tps_amount) : (order.tps_amount ?? 0);
  const tvqAmount = hasSnapshot ? Number(ps.tvq_amount) : (order.tvq_amount ?? 0);
  // CRITICAL FIX: "Total payé" uses pricing_snapshot.grand_total (from compute_checkout_pricing RPC)
  // as the authoritative total, since the order trigger recalculates total_amount without all discounts.
  // Fallback: order.amount_paid (actual captured amount) > order.total_amount
  const totalAmount = hasSnapshot ? Number(ps.grand_total) : (order.amount_paid ?? order.total_amount ?? 0);
  
  // Future monthly total — use standard QC tax rates
  const monthlyTps = Math.round(monthlyRecurringNet * 0.05 * 100) / 100;
  const monthlyTvq = Math.round(monthlyRecurringNet * 0.09975 * 100) / 100;
  const monthlyWithTaxes = Math.round((monthlyRecurringNet + monthlyTps + monthlyTvq) * 100) / 100;

  // Determine fulfillment type
  const isDeliveryOnly = order.installation_type === "auto" || order.delivery_method?.toLowerCase().includes("livraison");
  const hasAppointment = !!order.appointment_date;

  return (
    <ClientLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-8">
        {/* ===== HEADER SECTION ===== */}
        <Card className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-emerald-500/30 overflow-hidden">
          <CardContent className="py-8 relative">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-display text-2xl font-bold text-foreground">
                    Commande confirmée
                  </h1>
                  <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
                    {order.status === "pending" ? "Reçue" : "En traitement"}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Numéro de commande</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono font-bold text-cyan-500">{order.order_number}</span>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(order.order_number, "Numéro")} className="h-6 w-6 p-0">
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-muted-foreground">Numéro de compte</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono font-bold text-foreground">
                        {account?.account_number || profile?.client_number || "En création"}
                      </span>
                      {(account?.account_number || profile?.client_number) && (
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(account?.account_number || profile?.client_number || "", "Compte")} className="h-6 w-6 p-0">
                          <Copy className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-muted-foreground">Date & heure</span>
                    <p className="font-medium text-foreground mt-1">
                      {format(new Date(order.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-muted-foreground">Référence paiement</span>
                    <p className="font-mono text-foreground mt-1">
                      {order.payment_reference || "—"}
                    </p>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground pt-2">
                  Merci. Votre commande a été reçue. Vous recevrez une confirmation par courriel/SMS.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== KEY INFO TILES ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-card border">
            <CardContent className="py-4 text-center">
              <MapPin className="w-5 h-5 text-cyan-500 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Adresse de service</p>
              <p className="text-sm font-medium text-foreground line-clamp-2 mt-1">
                {hasValidAddress ? `${serviceAddress}, ${serviceCity}` : "Non spécifiée"}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-card border">
            <CardContent className="py-4 text-center">
              <Phone className="w-5 h-5 text-cyan-500 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Téléphone</p>
              <p className="text-sm font-medium text-foreground mt-1">
                {profile?.phone || "—"}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-card border">
            <CardContent className="py-4 text-center">
              <Calendar className="w-5 h-5 text-purple-500 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Cycle facturation</p>
              <p className="text-sm font-medium text-foreground mt-1">
                {billingInfo.cycleDay}e jour du mois
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-card border">
            <CardContent className="py-4 text-center">
              <FileText className="w-5 h-5 text-purple-500 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Prochaine facture</p>
              <p className="text-sm font-medium text-foreground mt-1">
                {format(billingInfo.nextBillingDate, "d MMM yyyy", { locale: fr })}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-card border">
            <CardContent className="py-4 text-center">
              <CreditCard className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Dépôt préautorisé</p>
              <p className="text-sm font-medium text-foreground mt-1">
                {(preauthDiscount > 0 ? `-${preauthDiscount.toFixed(0)}$` : "—")}
              </p>
              {preauthDiscount > 0 && (
                <p className="text-[10px] text-muted-foreground">Remboursable</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== MAIN CONTENT GRID ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN - Services & Fees */}
          <div className="lg:col-span-2 space-y-6">
            {/* Services (Monthly/Recurring) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-500" />
                  Détails de la commande
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ═══ SECTION A: Services mensuels (récurrent) ═══ */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Services mensuels (récurrent)
                  </h4>
                  <div className="space-y-2">
                    {services.map((service, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-foreground">{service}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="flex justify-between font-medium">
                    <span>Sous-total mensuel</span>
                    <span>{monthlyRecurringGross.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                  </div>
                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-sm text-emerald-500 mt-1">
                      <span>Rabais {order.promo_code ? `(${order.promo_code})` : "nouveau client"}</span>
                      <span>-{promoDiscount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  )}
                  {serviceOnlyDiscount > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Net mensuel après rabais</span>
                      <span>{monthlyRecurringNet.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>TPS (5%) + TVQ (9.975%)</span>
                    <span>+{(monthlyTps + monthlyTvq).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t border-purple-500/30">
                    <span className="text-purple-500">Total mensuel estimé</span>
                    <span className="text-purple-500">{monthlyWithTaxes.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                {/* ═══ SECTION B: Frais uniques ═══ */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Frais uniques
                  </h4>
                  <div className="space-y-2 text-sm">
                    {activationFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frais d'activation</span>
                        <span>{activationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {deliveryFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frais de livraison</span>
                        <span>{deliveryFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {installationFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frais d'installation</span>
                        <span>{installationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {routerFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Routeur Nivra Born Wifi</span>
                        <span>{routerFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {terminalFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Terminal(s) Nivra 4K (×{order.terminal_count || 1})</span>
                        <span>{terminalFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {simFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Carte(s) SIM physique (×{equipment.find(e => e.type === "sim")?.quantity || 1})</span>
                        <span>{simFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    
                    <Separator className="my-2" />
                    
                    <div className="flex justify-between font-medium">
                      <span className="text-foreground">Total frais uniques</span>
                      <span>{oneTimeSubtotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                {/* ═══ SECTION C: Paiement aujourd'hui ═══ */}
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Paiement aujourd'hui
                  </h4>
                  <div className="space-y-2 text-sm">
                    {oneTimeSubtotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frais uniques</span>
                        <span>{oneTimeSubtotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Services 1er mois</span>
                      <span>{monthlyRecurringGross.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    {promoDiscount > 0 && (
                      <div className="flex justify-between text-emerald-500">
                        <span>Rabais {order.promo_code ? `(${order.promo_code})` : "nouveau client"}</span>
                        <span>-{promoDiscount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {promoDiscount > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Net 1er mois après rabais</span>
                        <span>{monthlyRecurringNet.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
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
                    
                    <div className="flex justify-between font-bold text-lg pt-3 border-t border-cyan-500/30">
                      <span className="text-cyan-500">Total payé</span>
                      <span className="text-cyan-500">{totalAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Installation / Delivery Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {isDeliveryOnly ? (
                    <Truck className="w-4 h-4 text-purple-500" />
                  ) : (
                    <Wrench className="w-4 h-4 text-cyan-500" />
                  )}
                  {isDeliveryOnly ? "Livraison" : "Installation / Livraison"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasAppointment ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Rendez-vous confirmé</p>
                        <p className="text-lg font-bold text-emerald-500">
                          {format(new Date(order.appointment_date!), "EEEE d MMMM yyyy", { locale: fr })}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Heure: {format(new Date(order.appointment_date!), "HH:mm", { locale: fr })} (créneau de 2h)
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{serviceAddress}, {serviceCity}, {serviceProvince} {servicePostalCode}</span>
                      </div>
                      {order.appointment_notes && (
                        <p className="text-sm text-muted-foreground">
                          Notes: {order.appointment_notes}
                        </p>
                      )}
                    </div>
                  </div>
                ) : isDeliveryOnly ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <Truck className="w-6 h-6 text-purple-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Livraison en cours de préparation</p>
                        <p className="text-sm text-muted-foreground">
                          Délai estimé: 24–72 heures ouvrables
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Méthode: {order.delivery_method || "Livraison standard Québec"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{serviceAddress}, {serviceCity}, {serviceProvince} {servicePostalCode}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-6 h-6 text-cyan-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Contact sous 2 à 24 h</p>
                      <p className="text-sm text-muted-foreground">
                        Un agent vous contactera pour confirmer votre rendez-vous d'installation.
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        {serviceAddress}, {serviceCity}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Port-in Section (if applicable) */}
            {portInDetails && (
              <Card className="border-amber-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-500" />
                    Transfert de numéro (portabilité)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                        À traiter
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      {portInDetails.number && (
                        <div>
                          <p className="text-muted-foreground">Numéro à transférer</p>
                          <p className="font-mono font-medium">{portInDetails.number}</p>
                        </div>
                      )}
                      {portInDetails.provider && (
                        <div>
                          <p className="text-muted-foreground">Fournisseur actuel</p>
                          <p className="font-medium">{portInDetails.provider}</p>
                        </div>
                      )}
                      {portInDetails.accountNumber && (
                        <div>
                          <p className="text-muted-foreground">Numéro de compte</p>
                          <p className="font-mono font-medium">{portInDetails.accountNumber}</p>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                      La portabilité est généralement complétée dans un délai de 2 à 48 h.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT COLUMN - Equipment, Security, Billing */}
          <div className="space-y-6">
            {/* Equipment Included */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-500" />
                  Équipement inclus
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {equipment.length > 0 ? equipment.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      {item.type === "router" && <Router className="w-5 h-5 text-cyan-500" />}
                      {item.type === "terminal" && <Tv className="w-5 h-5 text-purple-500" />}
                      {item.type === "sim" && <Smartphone className="w-5 h-5 text-blue-500" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity > 1 ? `×${item.quantity} • ` : ""}
                        {item.fee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </p>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">Aucun équipement requis</p>
                )}
                
                <Separator className="my-3" />
                
                <div className="text-xs text-muted-foreground">
                  <p>Mode de fulfillment:</p>
                  <Badge variant="outline" className="mt-1">
                    {isDeliveryOnly ? "Livraison" : hasAppointment ? "Installation technicien" : "En attente"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Account Security (PIN) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  Sécurité du compte
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasPinConfigured ? "bg-emerald-500/20" : "bg-amber-500/20"}`}>
                    <KeyRound className={`w-5 h-5 ${hasPinConfigured ? "text-emerald-500" : "text-amber-500"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {hasPinConfigured 
                        ? (pinIsDefault ? "PIN temporaire configuré" : "PIN configuré") 
                        : "PIN non configuré"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Méthode: PIN à 4 chiffres
                    </p>
                  </div>
                </div>
                
                {hasPinConfigured && !pinIsDefault && (
                  <p className="text-xs text-muted-foreground bg-emerald-500/10 rounded p-2">
                    Votre PIN personnel a été enregistré dans votre profil.
                  </p>
                )}
                
                {hasPinConfigured && pinIsDefault && (
                  <p className="text-xs text-amber-600 bg-amber-500/10 rounded p-2">
                    Nous vous recommandons de modifier votre PIN temporaire.
                  </p>
                )}
                
                {!hasPinConfigured && (
                  <p className="text-xs text-amber-600 bg-amber-500/10 rounded p-2">
                    Veuillez configurer un PIN pour sécuriser votre compte.
                  </p>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full gap-2"
                  onClick={() => navigate("/portal/profile")}
                >
                  <KeyRound className="w-4 h-4" />
                  {hasPinConfigured ? "Modifier mon PIN" : "Configurer mon PIN"}
                </Button>
              </CardContent>
            </Card>

            {/* Billing */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-cyan-500" />
                  Facturation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cycle de facturation</span>
                    <span className="font-medium">{billingInfo.cycleDay}e du mois</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prochaine facture</span>
                    <span className="font-medium">{format(billingInfo.nextBillingDate, "d MMM yyyy", { locale: fr })}</span>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Les factures sont générées automatiquement chaque mois selon vos services actifs.
                </p>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full gap-2"
                  onClick={() => navigate("/portal/invoices")}
                >
                  <FileText className="w-4 h-4" />
                  Voir mes factures
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ===== DOCUMENTS SECTION ===== */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-purple-500" />
              Documents de commande
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Terms/Modalités PDF */}
              <div className="p-4 bg-muted/50 rounded-lg border border-border hover:border-purple-500/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <ScrollText className="w-5 h-5 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">Modalités de service</p>
                    <p className="text-xs text-muted-foreground">Version 2026-02-05</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-1.5 w-full"
                      onClick={() => {
                        // Download static PDF from public folder
                        const link = document.createElement("a");
                        link.href = STATIC_TERMS_PDF;
                        link.download = `Modalites-Service-Nivra-${order.order_number}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        toast.success("Modalités de service téléchargées");
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Télécharger PDF
                    </Button>
                  </div>
                </div>
              </div>

              {/* Contract PDF link */}
              <div className="p-4 bg-muted/50 rounded-lg border border-border hover:border-cyan-500/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">Contrat de services</p>
                    <p className="text-xs text-muted-foreground">Accord client</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-1.5 w-full"
                      onClick={() => navigate("/portal/contracts")}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Voir mes contrats
                    </Button>
                  </div>
                </div>
              </div>

              {/* Invoice link */}
              <div className="p-4 bg-muted/50 rounded-lg border border-border hover:border-emerald-500/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Receipt className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">Factures</p>
                    <p className="text-xs text-muted-foreground">Historique de paiements</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-1.5 w-full"
                      onClick={() => navigate("/portal/invoices")}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Voir mes factures
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== ACTION BUTTONS ===== */}
        <Card className="bg-muted/30">
          <CardContent className="py-6">
            <div className="flex flex-wrap gap-3 justify-center">
              <Button variant="outline" size="lg" className="gap-2" onClick={() => navigate(`/portal/orders`)}>
                <FileText className="w-4 h-4" />
                Voir ma commande
              </Button>
              
              <Button variant="outline" size="lg" className="gap-2" onClick={() => navigate("/portal")}>
                <User className="w-4 h-4" />
                Voir mon compte
              </Button>
              
              <Button variant="outline" size="lg" className="gap-2" onClick={() => window.print()}>
                <Printer className="w-4 h-4" />
                Imprimer
              </Button>
              
              {hasAppointment && (
                <Button variant="outline" size="lg" className="gap-2" onClick={generateICSFile}>
                  <CalendarPlus className="w-4 h-4" />
                  Ajouter au calendrier
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="lg" 
                className="gap-2" 
                onClick={() => navigate(`/portal/tickets?order=${order.order_number}`)}
              >
                <MessageSquare className="w-4 h-4" />
                Ouvrir un billet
              </Button>
              
              <Button variant="hero" size="lg" onClick={() => navigate("/portal")} className="gap-2">
                Continuer
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ===== CONTACT INFO FOOTER ===== */}
        <Card className="bg-card border">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground">
              <a href={`tel:+1${supportPhone.replace(/[^+\d]/g, '')}`} className="flex items-center gap-2 hover:text-foreground transition-colors">
                <Phone className="w-4 h-4" />
                {supportPhone}
              </a>
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {supportEmail}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {businessHours}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ClientOrderConfirmation;
