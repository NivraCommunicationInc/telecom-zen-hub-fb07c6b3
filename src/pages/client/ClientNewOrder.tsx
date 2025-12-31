import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Package
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

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");

      const subtotal = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);
      const serviceNames = selectedServices.map(s => s.name).join(", ");
      const categories = [...new Set(selectedServices.map(s => s.category))].join(", ");

      const { error } = await supabase.from("orders").insert({
        user_id: user.id,
        client_email: profile?.email || user.email,
        service_type: serviceNames,
        category: categories,
        subtotal: subtotal,
        delivery_fee: 30,
        activation_fee: 25,
        installation_fee: 50,
        status: "pending",
        created_by: "client",
        notes: notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-orders-all"] });
      toast.success("Commande soumise avec succès!", {
        description: "Notre équipe vous contactera sous peu pour confirmer votre commande.",
      });
      navigate("/portal/orders");
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
      return [...prev, service];
    });
  };

  const isSelected = (serviceId: string) => selectedServices.some(s => s.id === serviceId);

  // Calculate totals with fees and taxes
  const subtotal = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);
  const deliveryFee = 30;
  const activationFee = 25;
  const installationFee = 50;
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
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 ${step >= 1 ? "text-cyan-500" : "text-muted-foreground"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-cyan-500 text-white" : "bg-muted"}`}>
              1
            </div>
            <span className="text-sm font-medium hidden sm:inline">Sélection</span>
          </div>
          <div className="flex-1 h-0.5 bg-muted">
            <div className={`h-full transition-all ${step >= 2 ? "bg-cyan-500 w-full" : "w-0"}`} />
          </div>
          <div className={`flex items-center gap-2 ${step >= 2 ? "text-cyan-500" : "text-muted-foreground"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-cyan-500 text-white" : "bg-muted"}`}>
              2
            </div>
            <span className="text-sm font-medium hidden sm:inline">Confirmation</span>
          </div>
        </div>

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
                {Object.entries(groupedServices).map(([category, categoryServices]) => {
                  const CategoryIcon = categoryIcons[category] || Package;
                  return (
                    <div key={category}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${categoryColors[category]?.split(' ')[0] || 'bg-muted'}`}>
                          <CategoryIcon className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground">{category}</h2>
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
                        <span className="text-sm text-muted-foreground font-normal">/mois</span>
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

        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Récapitulatif de la commande</CardTitle>
                  <CardDescription>Vérifiez les services sélectionnés</CardDescription>
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
                  <CardTitle>Notes additionnelles</CardTitle>
                  <CardDescription>Ajoutez des informations supplémentaires pour votre commande</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Ex: Préférences de livraison, questions, commentaires..."
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
                      <span className="text-foreground">{installationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
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
                      onClick={handleSubmit}
                      disabled={createOrderMutation.isPending}
                    >
                      {createOrderMutation.isPending ? "Traitement..." : "Soumettre la commande"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setStep(1)}
                    >
                      Modifier la sélection
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Notre équipe vous contactera dans les 24-48h pour finaliser votre commande.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientNewOrder;
