/**
 * FieldSalesNewSale - Professional mobile-optimized new sale form
 * Uses real site offers, proper billing calculations, and correct DB schema
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  ArrowLeft, ArrowRight, User, Package, CreditCard, 
  Check, Loader2, MapPin, Phone, Mail, Calendar,
  FileText, ShoppingCart, Building
} from "lucide-react";
import StaffBackground from "@/components/staff/StaffBackground";
import { FieldSalesNav } from "@/components/field-sales/FieldSalesNav";
import { ServiceSelector } from "@/components/field-sales/ServiceSelector";
import { SelectedService, calculateFieldSalesTotals } from "@/hooks/useFieldSalesOffers";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Customer schema
const customerSchema = z.object({
  full_name: z.string().min(2, "Nom requis (min 2 caractères)"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(10, "Téléphone invalide (min 10 chiffres)"),
  date_of_birth: z.string().optional(),
  service_address: z.string().min(5, "Adresse requise"),
  service_city: z.string().min(2, "Ville requise"),
  service_postal_code: z.string().min(6, "Code postal requis"),
});

// Payment schema
const paymentSchema = z.object({
  payment_method: z.enum(["interac", "paypal", "deferred"]),
  payment_reference: z.string().optional(),
});

type CustomerData = z.infer<typeof customerSchema>;
type PaymentData = z.infer<typeof paymentSchema>;

const STEPS = [
  { key: "client", label: "Client", icon: User },
  { key: "services", label: "Services", icon: Package },
  { key: "payment", label: "Paiement", icon: CreditCard },
  { key: "confirm", label: "Confirmation", icon: Check },
];

export default function FieldSalesNewSale() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline] = useState(navigator.onLine);
  
  // Form state
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [notes, setNotes] = useState("");

  const customerForm = useForm<CustomerData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      date_of_birth: "",
      service_address: "",
      service_city: "",
      service_postal_code: "",
    },
  });

  const paymentForm = useForm<PaymentData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      payment_method: "interac",
      payment_reference: "",
    },
  });

  // Step handlers
  const handleCustomerSubmit = (data: CustomerData) => {
    setCustomerData(data);
    setCurrentStep(1);
  };

  const handleServicesNext = () => {
    if (selectedServices.length === 0) {
      toast.error("Sélectionnez au moins un service");
      return;
    }
    setCurrentStep(2);
  };

  const handlePaymentSubmit = (data: PaymentData) => {
    setPaymentData(data);
    setCurrentStep(3);
  };

  const handleFinalSubmit = async () => {
    if (!customerData || selectedServices.length === 0 || !paymentData) return;

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Session expirée");
        navigate("/field-sales");
        return;
      }

      const totals = calculateFieldSalesTotals(selectedServices);

      // Build services JSON array for the DB
      const servicesJson = selectedServices.map(s => ({
        offer_id: s.offerId,
        name: s.name,
        category: s.category,
        price_monthly: s.priceMonthly,
        price_setup: s.priceSetup,
        quantity: s.quantity,
      }));

      // Insert into field_sales_orders with correct schema
      const { data: order, error } = await supabase
        .from("field_sales_orders")
        .insert({
          salesperson_id: session.user.id,
          customer_name: customerData.full_name,
          customer_email: customerData.email,
          customer_phone: customerData.phone,
          customer_address: customerData.service_address,
          customer_city: customerData.service_city,
          customer_postal_code: customerData.service_postal_code,
          customer_date_of_birth: customerData.date_of_birth || null,
          services: servicesJson,
          total_amount: totals.total,
          payment_method: paymentData.payment_method,
          payment_reference: paymentData.payment_reference || null,
          payment_status: paymentData.payment_method === "deferred" ? "pending" : "confirmed",
          internal_notes: notes || null,
          sync_status: "synced",
          synced_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Error saving sale:", error);
        throw error;
      }

      toast.success("Vente enregistrée avec succès!", {
        description: `Montant: ${totals.total.toFixed(2)} $`,
      });
      navigate("/field-sales/dashboard");
    } catch (error: any) {
      console.error("Error saving sale:", error);
      toast.error("Erreur lors de l'enregistrement", {
        description: error.message || "Veuillez réessayer",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate("/field-sales/dashboard");
    }
  };

  const totals = calculateFieldSalesTotals(selectedServices);

  return (
    <div className="min-h-screen relative pb-24">
      <StaffBackground />
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              className="text-slate-400 hover:text-white shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-white">Nouvelle Vente</h1>
              <p className="text-xs text-slate-400">
                {STEPS[currentStep].label} • Étape {currentStep + 1}/{STEPS.length}
              </p>
            </div>
            {!isOnline && (
              <span className="text-xs text-amber-400 bg-amber-500/20 px-2 py-1 rounded">
                Hors ligne
              </span>
            )}
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center gap-1 mt-3">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <div key={step.key} className="flex-1 flex flex-col items-center">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-all ${
                      isActive 
                        ? "bg-orange-500 text-white" 
                        : isCompleted 
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                  </div>
                  <span className={`text-[10px] ${isActive ? "text-orange-400" : "text-slate-500"}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="p-4 relative z-10">
        {/* Step 1: Customer Info */}
        {currentStep === 0 && (
          <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <User className="h-5 w-5 text-orange-400" />
                Informations Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...customerForm}>
                <form onSubmit={customerForm.handleSubmit(handleCustomerSubmit)} className="space-y-4">
                  <FormField
                    control={customerForm.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300 text-sm">Nom complet légal *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Jean Tremblay"
                            className="bg-slate-800/50 border-slate-600 text-white"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={customerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300 text-sm">
                            <Mail className="h-3 w-3 inline mr-1" />
                            Email *
                          </FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="email"
                              placeholder="email@exemple.com"
                              className="bg-slate-800/50 border-slate-600 text-white"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={customerForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300 text-sm">
                            <Phone className="h-3 w-3 inline mr-1" />
                            Téléphone *
                          </FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="tel"
                              placeholder="514-555-1234"
                              className="bg-slate-800/50 border-slate-600 text-white"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={customerForm.control}
                    name="date_of_birth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300 text-sm">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          Date de naissance
                        </FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="date"
                            className="bg-slate-800/50 border-slate-600 text-white"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={customerForm.control}
                    name="service_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300 text-sm">
                          <MapPin className="h-3 w-3 inline mr-1" />
                          Adresse de service *
                        </FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="123 rue Principale"
                            className="bg-slate-800/50 border-slate-600 text-white"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={customerForm.control}
                      name="service_city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300 text-sm">
                            <Building className="h-3 w-3 inline mr-1" />
                            Ville *
                          </FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Montréal"
                              className="bg-slate-800/50 border-slate-600 text-white"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={customerForm.control}
                      name="service_postal_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300 text-sm">Code postal *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="H1A 1A1"
                              className="bg-slate-800/50 border-slate-600 text-white uppercase"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white"
                  >
                    Continuer
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Service Selection */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <Package className="h-5 w-5 text-orange-400" />
                  Sélection des Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ServiceSelector 
                  selectedServices={selectedServices}
                  onServicesChange={setSelectedServices}
                />
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
              <CardContent className="pt-4">
                <label className="text-slate-300 text-sm block mb-2">
                  <FileText className="h-3 w-3 inline mr-1" />
                  Notes internes (optionnel)
                </label>
                <Textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes spéciales, demandes particulières..."
                  className="bg-slate-800/50 border-slate-600 text-white resize-none"
                  rows={2}
                />
              </CardContent>
            </Card>

            <Button 
              onClick={handleServicesNext}
              disabled={selectedServices.length === 0}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white disabled:opacity-50"
            >
              Continuer ({selectedServices.length} service{selectedServices.length > 1 ? "s" : ""})
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 3: Payment */}
        {currentStep === 2 && (
          <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <CreditCard className="h-5 w-5 text-orange-400" />
                Paiement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...paymentForm}>
                <form onSubmit={paymentForm.handleSubmit(handlePaymentSubmit)} className="space-y-4">
                  {/* Order Summary */}
                  <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-600 space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-medium">Résumé de la commande</span>
                      <ShoppingCart className="h-4 w-4 text-orange-400" />
                    </div>
                    
                    {selectedServices.map(s => (
                      <div key={s.offerId} className="flex justify-between text-sm">
                        <span className="text-slate-300">
                          {s.name} {s.quantity > 1 && `x${s.quantity}`}
                        </span>
                        <span className="text-slate-400">{(s.priceMonthly * s.quantity).toFixed(2)} $/mois</span>
                      </div>
                    ))}
                    
                    <div className="border-t border-slate-600 pt-2 mt-2 space-y-1">
                      <div className="flex justify-between text-sm text-slate-400">
                        <span>Sous-total mensuel</span>
                        <span>{totals.monthlySubtotal.toFixed(2)} $</span>
                      </div>
                      {totals.activationFee > 0 && (
                        <div className="flex justify-between text-sm text-slate-400">
                          <span>Frais d'activation</span>
                          <span>{totals.activationFee.toFixed(2)} $</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm text-slate-400">
                        <span>TPS (5%)</span>
                        <span>{totals.tps.toFixed(2)} $</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-400">
                        <span>TVQ (9.975%)</span>
                        <span>{totals.tvq.toFixed(2)} $</span>
                      </div>
                      <div className="flex justify-between text-white font-bold pt-2 border-t border-slate-600">
                        <span>Total à payer</span>
                        <span className="text-orange-400">{totals.total.toFixed(2)} $</span>
                      </div>
                    </div>
                  </div>

                  <FormField
                    control={paymentForm.control}
                    name="payment_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300 text-sm">Mode de paiement</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="space-y-2"
                          >
                            {[
                              { value: "interac", label: "Virement Interac", desc: "Support@nivratelecom.ca", icon: "💳" },
                              { value: "paypal", label: "PayPal", desc: "Confirmation requise", icon: "🅿️" },
                              { value: "deferred", label: "Paiement différé", desc: "Client paie plus tard", icon: "⏳" },
                            ].map((option) => (
                              <div key={option.value}>
                                <RadioGroupItem
                                  value={option.value}
                                  id={`payment-${option.value}`}
                                  className="peer sr-only"
                                />
                                <label
                                  htmlFor={`payment-${option.value}`}
                                  className="flex items-center justify-between p-4 rounded-lg border border-slate-600 bg-slate-800/50 cursor-pointer transition-all peer-data-[state=checked]:border-orange-500 peer-data-[state=checked]:bg-orange-500/10"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-xl">{option.icon}</span>
                                    <div>
                                      <p className="text-white font-medium">{option.label}</p>
                                      <p className="text-xs text-slate-400">{option.desc}</p>
                                    </div>
                                  </div>
                                </label>
                              </div>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {(paymentForm.watch("payment_method") === "interac" || paymentForm.watch("payment_method") === "paypal") && (
                    <FormField
                      control={paymentForm.control}
                      name="payment_reference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300 text-sm">
                            Référence de paiement
                          </FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder={paymentForm.watch("payment_method") === "interac" ? "Numéro de confirmation Interac" : "ID transaction PayPal"}
                              className="bg-slate-800/50 border-slate-600 text-white"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white"
                  >
                    Continuer
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Confirmation */}
        {currentStep === 3 && customerData && paymentData && (
          <div className="space-y-4">
            <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <Check className="h-5 w-5 text-emerald-400" />
                  Confirmation de la Vente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Customer Summary */}
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-600">
                  <h4 className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                    <User className="h-3 w-3" /> Client
                  </h4>
                  <p className="text-white font-medium">{customerData.full_name}</p>
                  <p className="text-sm text-slate-300">{customerData.email}</p>
                  <p className="text-sm text-slate-300">{customerData.phone}</p>
                  <p className="text-sm text-slate-400 mt-2">
                    {customerData.service_address}, {customerData.service_city} {customerData.service_postal_code}
                  </p>
                </div>

                {/* Services Summary */}
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-600">
                  <h4 className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                    <Package className="h-3 w-3" /> Services ({selectedServices.length})
                  </h4>
                  {selectedServices.map(s => (
                    <div key={s.offerId} className="flex justify-between items-center py-1">
                      <span className="text-white">
                        {s.name} {s.quantity > 1 && <span className="text-slate-400">x{s.quantity}</span>}
                      </span>
                      <span className="text-orange-400 font-medium">
                        {(s.priceMonthly * s.quantity).toFixed(2)} $/mois
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-slate-600 pt-2 mt-2">
                    <div className="flex justify-between text-white font-bold">
                      <span>Total 1ère facture</span>
                      <span className="text-orange-400">{totals.total.toFixed(2)} $</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Récurrent: {totals.recurringMonthly.toFixed(2)} $/mois
                    </p>
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-600">
                  <h4 className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Paiement
                  </h4>
                  <p className="text-white font-medium">
                    {paymentData.payment_method === "interac" && "💳 Virement Interac"}
                    {paymentData.payment_method === "paypal" && "🅿️ PayPal"}
                    {paymentData.payment_method === "deferred" && "⏳ Paiement différé"}
                  </p>
                  {paymentData.payment_reference && (
                    <p className="text-sm text-slate-300">Réf: {paymentData.payment_reference}</p>
                  )}
                  <p className={`text-sm mt-1 ${
                    paymentData.payment_method === "deferred" 
                      ? "text-amber-400" 
                      : "text-emerald-400"
                  }`}>
                    {paymentData.payment_method === "deferred" ? "⏳ En attente de paiement" : "✓ Paiement confirmé"}
                  </p>
                </div>

                {notes && (
                  <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-600">
                    <h4 className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Notes
                    </h4>
                    <p className="text-sm text-slate-300 italic">"{notes}"</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button 
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="w-full h-14 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-lg shadow-xl shadow-emerald-500/30"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  Confirmer la Vente
                </>
              )}
            </Button>

            <p className="text-xs text-center text-slate-500">
              {format(new Date(), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </p>
          </div>
        )}
      </main>

      <FieldSalesNav />
    </div>
  );
}
