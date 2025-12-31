import { useState } from "react";
import React from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  ShoppingCart, 
  Smartphone, 
  Wifi, 
  Tv, 
  Shield, 
  Check,
  ArrowRight,
  ArrowLeft,
  Package,
  AlertCircle,
  User,
  FileCheck,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  CreditCard,
  FileText,
  Receipt,
  Info,
  Phone,
  Mail,
  Building2,
  Truck,
  Wrench,
  Zap,
  ScrollText,
  Download,
  Printer
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format, addDays, addMonths } from "date-fns";
import { fr } from "date-fns/locale";

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
}

interface CreatedOrder {
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
  created_at: string;
}

const categoryIcons: Record<string, any> = {
  Mobile: Smartphone,
  Internet: Wifi,
  TV: Tv,
  Sécurité: Shield,
};

const categoryColors: Record<string, string> = {
  Mobile: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  Internet: "bg-purple-500/20 text-purple-500 border-purple-500/30",
  TV: "bg-pink-500/20 text-pink-500 border-pink-500/30",
  Sécurité: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
};

const ClientNewOrder = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [notes, setNotes] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [installationCredit, setInstallationCredit] = useState(0);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  
  // Appointment scheduling state
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");

  // Fetch available services
  const { data: services, isLoading } = useQuery({
    queryKey: ["available-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true });

      if (error) throw error;
      return data as Service[];
    },
  });

  // Fetch client profile
  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Apply discount code
  const applyDiscountCode = () => {
    if (discountCode.toLowerCase() === "install50" || discountCode.toLowerCase() === "freeinstall") {
      setInstallationCredit(50);
      toast.success("Code promo appliqué! Installation gratuite.");
    } else if (discountCode.toLowerCase() === "install25") {
      setInstallationCredit(25);
      toast.success("Code promo appliqué! 25$ de rabais sur l'installation.");
    } else if (discountCode) {
      toast.error("Code promo invalide");
    }
  };

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");

      const subtotal = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);
      const serviceNames = selectedServices.map(s => s.name).join(", ");
      const categories = [...new Set(selectedServices.map(s => s.category))].join(", ");

      const { data, error } = await supabase.from("orders").insert({
        user_id: user.id,
        client_email: profile?.email || user.email,
        service_type: serviceNames,
        category: categories,
        subtotal: subtotal,
        delivery_fee: 30,
        activation_fee: 25,
        installation_fee: 50,
        installation_credit: installationCredit,
        discount_code: discountCode || null,
        status: "pending",
        created_by: "client",
        notes: notes || null,
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["client-orders-all"] });
      setCreatedOrder(data as CreatedOrder);
      setStep(4); // Go to confirmation step
    },
    onError: (error) => {
      console.error("Order creation error:", error);
      toast.error("Erreur lors de la soumission de la commande");
    },
  });

  const toggleService = (service: Service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        return prev.filter(s => s.id !== service.id);
      }
      // Check if TV is selected without Internet
      if (service.category === "TV") {
        const hasInternet = prev.some(s => s.category === "Internet");
        if (!hasInternet) {
          toast.error("Les forfaits TV nécessitent un service Internet actif");
          return prev;
        }
      }
      return [...prev, service];
    });
  };

  const isSelected = (serviceId: string) => selectedServices.some(s => s.id === serviceId);

  // Calculate totals with fees and taxes
  const subtotal = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);
  const deliveryFee = 30;
  const activationFee = 25;
  const installationFee = Math.max(0, 50 - installationCredit);
  const baseAmount = subtotal + deliveryFee + activationFee + installationFee;
  const tpsAmount = Math.round(baseAmount * 0.05 * 100) / 100;
  const tvqAmount = Math.round(baseAmount * 0.09975 * 100) / 100;
  const totalAmount = baseAmount + tpsAmount + tvqAmount;

  // Group services by category
  const groupedServices = services?.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  // Check if installation appointment is required
  const requiresInstallation = selectedServices.some(s => ["Internet", "TV", "Sécurité"].includes(s.category));

  const handleSubmit = () => {
    if (selectedServices.length === 0) {
      toast.error("Veuillez sélectionner au moins un service");
      return;
    }
    if (!identityConfirmed) {
      toast.error("Veuillez confirmer que vous fournirez une pièce d'identité");
      return;
    }
    if (requiresInstallation && (!selectedDate || !selectedTime)) {
      toast.error("Veuillez sélectionner une date et heure d'installation");
      return;
    }
    if (!termsAccepted) {
      toast.error("Veuillez accepter les termes et conditions");
      return;
    }
    createOrderMutation.mutate();
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Nouvelle commande</h1>
          <p className="text-muted-foreground mt-1">Sélectionnez les services que vous souhaitez commander</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 sm:gap-4">
          {[
            { num: 1, label: "Sélection" },
            { num: 2, label: "Vérification" },
            { num: 3, label: "Confirmation" },
            { num: 4, label: "Terminé" },
          ].map((s, i) => (
            <React.Fragment key={s.num}>
              <div className={`flex items-center gap-2 ${step >= s.num ? "text-cyan-500" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step > s.num ? "bg-emerald-500 text-white" : step === s.num ? "bg-cyan-500 text-white" : "bg-muted"
                }`}>
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <span className="text-xs font-medium hidden md:inline">{s.label}</span>
              </div>
              {i < 3 && (
                <div className="flex-1 h-0.5 bg-muted">
                  <div className={`h-full transition-all ${step > s.num ? "bg-emerald-500 w-full" : step === s.num ? "bg-cyan-500 w-1/2" : "w-0"}`} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Service Selection */}
        {step === 1 && (
          <>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : groupedServices && Object.keys(groupedServices).length > 0 ? (
              <div className="space-y-8">
                {/* TV Requirement Notice */}
                <Card className="bg-amber-500/10 border-amber-500/30">
                  <CardContent className="py-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Note:</strong> Les forfaits TV nécessitent un service Internet actif. 
                      Les forfaits mobiles peuvent être commandés seuls.
                    </p>
                  </CardContent>
                </Card>

                {Object.entries(groupedServices).map(([category, categoryServices]) => {
                  const CategoryIcon = categoryIcons[category] || Package;
                  return (
                    <div key={category}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${categoryColors[category]?.split(' ')[0] || 'bg-muted'}`}>
                          <CategoryIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-foreground">{category}</h2>
                          {category === "TV" && (
                            <p className="text-xs text-amber-500">Requiert Internet</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categoryServices.map((service) => (
                          <Card
                            key={service.id}
                            className={`cursor-pointer transition-all hover:shadow-lg ${
                              isSelected(service.id)
                                ? "border-cyan-500 bg-cyan-500/5 shadow-cyan-500/20"
                                : "border-border hover:border-cyan-500/50"
                            }`}
                            onClick={() => toggleService(service)}
                          >
                            <CardContent className="p-5">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h3 className="font-semibold text-foreground">{service.name}</h3>
                                  <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                                </div>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                  isSelected(service.id)
                                    ? "bg-cyan-500 text-white"
                                    : "border-2 border-muted-foreground/30"
                                }`}>
                                  {isSelected(service.id) && <Check className="w-4 h-4" />}
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <Badge className={categoryColors[category] || "bg-muted"}>
                                  {category}
                                </Badge>
                                <p className="text-lg font-bold text-cyan-500">
                                  {Number(service.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                  <span className="text-xs text-muted-foreground font-normal">/mois</span>
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Aucun service disponible pour le moment</p>
                </CardContent>
              </Card>
            )}

            {/* Selected Services Summary */}
            {selectedServices.length > 0 && (
              <Card className="bg-card border-cyan-500/30 sticky bottom-4">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {selectedServices.length} service{selectedServices.length > 1 ? "s" : ""} sélectionné{selectedServices.length > 1 ? "s" : ""}
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {totalAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        <span className="text-sm text-muted-foreground font-normal"> total</span>
                      </p>
                    </div>
                    <Button variant="hero" size="lg" onClick={() => setStep(2)}>
                      Continuer
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Step 2: Identity Verification & Discount Code */}
        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-cyan-500" />
                    Vérification d'identité
                  </CardTitle>
                  <CardDescription>
                    Une pièce d'identité valide avec photo est requise pour toutes les commandes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Card className="bg-amber-500/10 border-amber-500/30">
                    <CardContent className="py-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-foreground mb-1">Important</p>
                        <p className="text-muted-foreground">
                          Nous n'effectuons aucune vérification de crédit. Une pièce d'identité valide (permis de conduire, passeport, 
                          carte d'assurance maladie) sera demandée lors de la confirmation de votre commande.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex items-start gap-3 p-4 bg-accent/50 rounded-lg">
                    <Checkbox 
                      id="identity-confirm" 
                      checked={identityConfirmed}
                      onCheckedChange={(checked) => setIdentityConfirmed(checked === true)}
                    />
                    <Label htmlFor="identity-confirm" className="text-sm leading-relaxed cursor-pointer">
                      Je confirme que je fournirai une pièce d'identité valide avec photo pour compléter ma commande.
                      Je comprends que mon service ne sera pas activé sans cette vérification.
                    </Label>
                  </div>
                </CardContent>
              </Card>

              {/* Appointment Scheduling - for installation services */}
              {selectedServices.some(s => ["Internet", "TV", "Sécurité"].includes(s.category)) && (
                <Card className="bg-card border-purple-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-500" />
                      Planifier l'installation
                    </CardTitle>
                    <CardDescription>
                      Un technicien se déplacera pour installer vos services. Choisissez une date et une plage horaire.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date préférée</Label>
                        <select
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                        >
                          <option value="">Sélectionner une date</option>
                          {[...Array(14)].map((_, i) => {
                            const date = addDays(new Date(), i + 3);
                            const dayOfWeek = date.getDay();
                            if (dayOfWeek === 0 || dayOfWeek === 6) return null;
                            return (
                              <option key={i} value={format(date, "d MMMM yyyy", { locale: fr })}>
                                {format(date, "EEEE d MMMM yyyy", { locale: fr })}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Plage horaire</Label>
                        <select
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                          value={selectedTime}
                          onChange={(e) => setSelectedTime(e.target.value)}
                        >
                          <option value="">Sélectionner une plage</option>
                          <option value="8h00 - 10h00">8h00 - 10h00 (Matin)</option>
                          <option value="10h00 - 12h00">10h00 - 12h00 (Matin)</option>
                          <option value="13h00 - 15h00">13h00 - 15h00 (Après-midi)</option>
                          <option value="15h00 - 17h00">15h00 - 17h00 (Après-midi)</option>
                        </select>
                      </div>
                    </div>
                    
                    <Card className="bg-blue-500/10 border-blue-500/30">
                      <CardContent className="py-3 flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-muted-foreground">
                          <p>Le technicien vous contactera 30 minutes avant son arrivée.</p>
                          <p>Durée estimée de l'installation: 1 à 2 heures.</p>
                        </div>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Code promotionnel</CardTitle>
                  <CardDescription>Avez-vous un code de réduction pour l'installation?</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Entrez votre code promo"
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value)}
                    />
                    <Button variant="outline" onClick={applyDiscountCode}>
                      Appliquer
                    </Button>
                  </div>
                  {installationCredit > 0 && (
                    <p className="text-sm text-emerald-500 mt-2 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      Crédit de {installationCredit}$ appliqué sur l'installation
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Notes additionnelles</CardTitle>
                  <CardDescription>Ajoutez des informations pour votre commande (adresse de livraison différente, etc.)</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Ex: Livrer à une autre adresse, instructions spéciales..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="bg-card border-cyan-500/30 sticky top-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-cyan-500" />
                    Résumé
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {selectedServices.map((service) => (
                      <div key={service.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{service.name}</span>
                        <span className="text-foreground">{Number(service.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sous-total services</span>
                      <span className="text-foreground">{subtotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frais de livraison (QC)</span>
                      <span className="text-foreground">{deliveryFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frais d'activation</span>
                      <span className="text-foreground">{activationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frais d'installation</span>
                      <span className={installationCredit > 0 ? "text-emerald-500" : "text-foreground"}>
                        {installationCredit > 0 && <span className="line-through text-muted-foreground mr-1">50,00 $</span>}
                        {installationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">TPS (5%)</span>
                      <span className="text-foreground">{tpsAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">TVQ (9.975%)</span>
                      <span className="text-foreground">{tvqAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-foreground">Total</span>
                      <span className="text-2xl font-bold text-cyan-500">
                        {totalAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Taxes incluses</p>
                  </div>

                  <div className="pt-4 space-y-3">
                    <Button
                      variant="hero"
                      className="w-full"
                      size="lg"
                      onClick={() => setStep(3)}
                      disabled={!identityConfirmed}
                    >
                      Réviser et confirmer
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setStep(1)}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Modifier la sélection
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 3: Final Confirmation */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-cyan-500" />
                    Récapitulatif final
                  </CardTitle>
                  <CardDescription>Vérifiez les détails avant de soumettre votre commande</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedServices.map((service) => {
                    const CategoryIcon = categoryIcons[service.category] || Package;
                    return (
                      <div
                        key={service.id}
                        className="flex items-center justify-between p-4 bg-accent/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${categoryColors[service.category]?.split(' ')[0] || 'bg-muted'}`}>
                            <CategoryIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{service.name}</p>
                            <p className="text-sm text-muted-foreground">{service.category}</p>
                          </div>
                        </div>
                        <p className="font-bold text-foreground">
                          {Number(service.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          <span className="text-xs text-muted-foreground font-normal">/mois</span>
                        </p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Informations client</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between p-3 bg-accent/50 rounded-lg">
                    <span className="text-muted-foreground">Nom</span>
                    <span className="text-foreground font-medium">{profile?.full_name || "Non spécifié"}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-accent/50 rounded-lg">
                    <span className="text-muted-foreground">Courriel</span>
                    <span className="text-foreground font-medium">{profile?.email || user?.email}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-accent/50 rounded-lg">
                    <span className="text-muted-foreground">Téléphone</span>
                    <span className="text-foreground font-medium">{profile?.phone || "Non spécifié"}</span>
                  </div>
                  {profile?.client_number && (
                    <div className="flex justify-between p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                      <span className="text-cyan-500">Numéro client</span>
                      <span className="text-cyan-500 font-mono font-bold">{profile.client_number}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {notes && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>Notes additionnelles</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Installation Appointment Summary */}
              {requiresInstallation && selectedDate && selectedTime && (
                <Card className="bg-purple-500/10 border-purple-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-500" />
                      Rendez-vous d'installation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg">
                        <Calendar className="w-4 h-4 text-purple-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Date</p>
                          <p className="font-medium text-foreground">{selectedDate}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg">
                        <Clock className="w-4 h-4 text-purple-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Heure</p>
                          <p className="font-medium text-foreground">{selectedTime}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Terms and Conditions Acceptance */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ScrollText className="w-5 h-5 text-cyan-500" />
                    Termes et conditions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-accent/30 rounded-lg text-sm text-muted-foreground space-y-2 max-h-40 overflow-y-auto">
                    <p><strong>Politique d'annulation:</strong> Vous pouvez annuler en tout temps. Après l'installation, 1 mois de frais sera facturé. Avant 1 mois d'utilisation, les frais d'installation seront facturés.</p>
                    <p><strong>Équipement:</strong> Location gratuite. Retour à vos frais en cas d'annulation. Équipement endommagé: frais applicables.</p>
                    <p><strong>Paiement:</strong> Paiement direct à Nivra. Retard de paiement: 5% de frais supplémentaires.</p>
                    <p><strong>Vérification:</strong> Pièce d'identité avec photo requise. Aucune vérification de crédit effectuée.</p>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 bg-accent/50 rounded-lg border border-cyan-500/30">
                    <Checkbox 
                      id="terms-accept" 
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    />
                    <Label htmlFor="terms-accept" className="text-sm leading-relaxed cursor-pointer">
                      J'ai lu et j'accepte les <a href="/terms" className="text-cyan-500 underline">Conditions d'utilisation</a>, 
                      la <a href="/privacy" className="text-cyan-500 underline">Politique de confidentialité</a>, 
                      et les termes de facturation ci-dessus.
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="bg-card border-cyan-500/30 sticky top-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-cyan-500" />
                    Total de la commande
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sous-total</span>
                      <span>{subtotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Livraison</span>
                      <span>{deliveryFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Activation</span>
                      <span>{activationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Installation</span>
                      <span>{installationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">TPS + TVQ</span>
                      <span>{(tpsAmount + tvqAmount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-foreground">Total à payer</span>
                      <span className="text-2xl font-bold text-cyan-500">
                        {totalAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 space-y-3">
                    <Button
                      variant="hero"
                      className="w-full"
                      size="lg"
                      onClick={handleSubmit}
                      disabled={createOrderMutation.isPending || !termsAccepted || (requiresInstallation && (!selectedDate || !selectedTime))}
                    >
                      {createOrderMutation.isPending ? "Traitement..." : "Confirmer la commande"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setStep(2)}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Retour
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    En confirmant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 4: Professional Order Confirmation */}
        {step === 4 && createdOrder && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Success Banner */}
            <Card className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-emerald-500/30">
              <CardContent className="py-8 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                  Commande confirmée!
                </h2>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  Merci pour votre commande. Vous recevrez un courriel de confirmation sous peu.
                </p>
              </CardContent>
            </Card>

            {/* Order Number & Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-card border-cyan-500/30">
                <CardContent className="py-6 text-center">
                  <Receipt className="w-8 h-8 text-cyan-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Numéro de commande</p>
                  <p className="text-2xl font-mono font-bold text-cyan-500">{createdOrder.order_number}</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="py-6 text-center">
                  <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Date de commande</p>
                  <p className="text-lg font-semibold text-foreground">
                    {format(new Date(createdOrder.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Order Details */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-cyan-500" />
                  Détails de la commande
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {selectedServices.map((service) => {
                    const CategoryIcon = categoryIcons[service.category] || Package;
                    return (
                      <div key={service.id} className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${categoryColors[service.category]?.split(' ')[0] || 'bg-muted'}`}>
                            <CategoryIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{service.name}</p>
                            <p className="text-sm text-muted-foreground">{service.category}</p>
                          </div>
                        </div>
                        <p className="font-bold text-foreground">
                          {Number(service.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          <span className="text-xs text-muted-foreground font-normal">/mois</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Appointment Details - if applicable */}
            {(selectedServices.some(s => ["Internet", "TV", "Sécurité"].includes(s.category)) && selectedDate && selectedTime) && (
              <Card className="bg-card border-purple-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-500" />
                    Rendez-vous d'installation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-lg">
                      <Calendar className="w-5 h-5 text-purple-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Date</p>
                        <p className="font-medium text-foreground">{selectedDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-lg">
                      <Clock className="w-5 h-5 text-purple-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Heure</p>
                        <p className="font-medium text-foreground">{selectedTime}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-lg">
                      <Wrench className="w-5 h-5 text-purple-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Technicien</p>
                        <p className="font-medium text-foreground">Confirmé</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    <Info className="w-4 h-4 inline mr-1" />
                    Le technicien vous contactera 30 minutes avant son arrivée. Assurez-vous qu'un adulte soit présent.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Client Information */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-cyan-500" />
                  Informations du client
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Nom complet</p>
                      <p className="font-medium text-foreground">{profile?.full_name || "Non spécifié"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Courriel</p>
                      <p className="font-medium text-foreground">{profile?.email || user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Téléphone</p>
                      <p className="font-medium text-foreground">{profile?.phone || "À confirmer"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                    <Building2 className="w-4 h-4 text-cyan-500" />
                    <div>
                      <p className="text-xs text-cyan-500">Numéro de client</p>
                      <p className="font-mono font-bold text-cyan-500">{profile?.client_number || "À générer"}</p>
                    </div>
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
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Zap className="w-4 h-4" /> Frais d'activation (unique)
                    </span>
                    <span className="font-medium">{activationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Wrench className="w-4 h-4" /> Frais d'installation
                    </span>
                    <span className={`font-medium ${installationCredit > 0 ? "text-emerald-500" : ""}`}>
                      {installationCredit > 0 && <span className="line-through text-muted-foreground mr-2">50,00 $</span>}
                      {installationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      {installationCredit > 0 && " (rabais appliqué)"}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Sous-total frais</span>
                    <span className="font-medium">{(deliveryFee + activationFee + installationFee).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                  </div>
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

                <Card className="bg-amber-500/10 border-amber-500/30">
                  <CardContent className="py-3 flex items-start gap-2">
                    <CreditCard className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      Le paiement sera requis avant l'activation de vos services. Vous recevrez les instructions de paiement par courriel.
                    </p>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            {/* Monthly Bill Estimate */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-500" />
                  Facturation mensuelle récurrente
                </CardTitle>
                <CardDescription>
                  Estimation de votre facture mensuelle après l'activation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {selectedServices.map((service) => (
                    <div key={service.id} className="flex justify-between py-2">
                      <span className="text-muted-foreground">{service.name}</span>
                      <span className="font-medium">{Number(service.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Sous-total mensuel</span>
                    <span className="font-medium">{subtotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">TPS (5%)</span>
                    <span className="font-medium">{(subtotal * 0.05).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">TVQ (9.975%)</span>
                    <span className="font-medium">{(subtotal * 0.09975).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between py-3 bg-emerald-500/10 rounded-lg px-4 -mx-4">
                    <span className="font-semibold text-foreground">Total mensuel estimé</span>
                    <span className="text-xl font-bold text-emerald-500">
                      {(subtotal * 1.14975).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Prochaine facturation estimée: {format(addMonths(new Date(), 1), "d MMMM yyyy", { locale: fr })}</span>
                </div>
              </CardContent>
            </Card>

            {/* Terms, Conditions & Policies */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScrollText className="w-5 h-5 text-cyan-500" />
                  Termes, conditions et politiques
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-accent/50 rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">Politique d'annulation</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Annulation possible en tout temps</li>
                      <li>• Après installation: 1 mois de frais</li>
                      <li>• Avant 1 mois d'utilisation: frais d'installation dus</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-accent/50 rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">Équipement</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Location d'équipement gratuite</li>
                      <li>• Retour à vos frais en cas d'annulation</li>
                      <li>• Équipement endommagé: frais applicables</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-accent/50 rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">Vérification d'identité</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Pièce d'identité avec photo requise</li>
                      <li>• Aucune vérification de crédit</li>
                      <li>• Aucun bureau de crédit consulté</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-accent/50 rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">Paiement</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Paiement direct à Nivra uniquement</li>
                      <li>• Retard de paiement: 5% de frais</li>
                      <li>• Aucun engagement à long terme</li>
                    </ul>
                  </div>
                </div>

                <Card className="bg-blue-500/10 border-blue-500/30">
                  <CardContent className="py-3 flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      En passant cette commande, vous acceptez nos <a href="/terms" className="text-cyan-500 underline">Conditions d'utilisation</a> et notre <a href="/privacy" className="text-cyan-500 underline">Politique de confidentialité</a>.
                    </p>
                  </CardContent>
                </Card>
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
              <Button variant="outline" size="lg" className="gap-2">
                <Printer className="w-4 h-4" />
                Imprimer la confirmation
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
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientNewOrder;
