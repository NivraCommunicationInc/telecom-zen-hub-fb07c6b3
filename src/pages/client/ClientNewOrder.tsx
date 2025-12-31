import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
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
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string | null>(null);

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
      setCreatedOrderNumber(data.order_number);
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

  const handleSubmit = () => {
    if (selectedServices.length === 0) {
      toast.error("Veuillez sélectionner au moins un service");
      return;
    }
    if (!identityConfirmed) {
      toast.error("Veuillez confirmer que vous fournirez une pièce d'identité");
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
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{notes}</p>
                  </CardContent>
                </Card>
              )}
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
                      disabled={createOrderMutation.isPending}
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

        {/* Step 4: Order Confirmation */}
        {step === 4 && (
          <div className="max-w-2xl mx-auto">
            <Card className="bg-card border-emerald-500/30">
              <CardContent className="py-12 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                  Commande soumise avec succès!
                </h2>
                <p className="text-muted-foreground mb-6">
                  Notre équipe vous contactera dans les 24-48h pour finaliser votre commande et procéder à la vérification d'identité.
                </p>

                {createdOrderNumber && (
                  <Card className="bg-accent/50 border-cyan-500/30 mb-6">
                    <CardContent className="py-6">
                      <p className="text-sm text-muted-foreground mb-2">Numéro de confirmation</p>
                      <p className="text-3xl font-mono font-bold text-cyan-500">{createdOrderNumber}</p>
                      <p className="text-xs text-muted-foreground mt-2">Conservez ce numéro pour le suivi de votre commande</p>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-3">
                  <Button variant="hero" size="lg" onClick={() => navigate("/portal/orders")}>
                    Voir mes commandes
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => navigate("/portal")}>
                    Retour au tableau de bord
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ClientLayout>
  );
};

// Need React import for Fragment
import React from "react";

export default ClientNewOrder;
