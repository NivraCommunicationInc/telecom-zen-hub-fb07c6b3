/**
 * FieldSalesNewSale - Mobile-optimized new sale form for field sales
 * Handles customer info, service selection, payment, and appointment booking
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
  Calendar, Check, Loader2, MapPin, Phone, Mail
} from "lucide-react";
import StaffBackground from "@/components/staff/StaffBackground";
import { FieldSalesNav } from "@/components/field-sales/FieldSalesNav";
import { useOfflineSync } from "@/hooks/useOfflineSync";

const customerSchema = z.object({
  full_name: z.string().min(2, "Nom requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(10, "Téléphone invalide"),
  service_address: z.string().min(5, "Adresse requise"),
  service_city: z.string().min(2, "Ville requise"),
  service_postal_code: z.string().min(6, "Code postal requis"),
});

const serviceSchema = z.object({
  service_type: z.enum(["internet", "tv", "mobile", "bundle"]),
  plan_name: z.string().min(1, "Plan requis"),
  monthly_price: z.number().min(0),
  notes: z.string().optional(),
});

const paymentSchema = z.object({
  payment_method: z.enum(["interac", "paypal", "deferred"]),
  payment_reference: z.string().optional(),
});

type CustomerData = z.infer<typeof customerSchema>;
type ServiceData = z.infer<typeof serviceSchema>;
type PaymentData = z.infer<typeof paymentSchema>;

const STEPS = ["Client", "Service", "Paiement", "Confirmation"];

const SERVICE_PLANS = {
  internet: [
    { name: "Internet 100 Mbps", price: 49.99 },
    { name: "Internet 300 Mbps", price: 69.99 },
    { name: "Internet 1 Gbps", price: 99.99 },
  ],
  tv: [
    { name: "TV Essentiel", price: 29.99 },
    { name: "TV Premium", price: 49.99 },
    { name: "TV Ultimate", price: 79.99 },
  ],
  mobile: [
    { name: "Mobile 5 Go", price: 35.00 },
    { name: "Mobile 15 Go", price: 45.00 },
    { name: "Mobile Illimité", price: 60.00 },
  ],
  bundle: [
    { name: "Duo Internet + TV", price: 89.99 },
    { name: "Trio Complet", price: 129.99 },
  ],
};

export default function FieldSalesNewSale() {
  const navigate = useNavigate();
  const { saveSale, isOnline } = useOfflineSync();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [serviceData, setServiceData] = useState<ServiceData | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);

  const customerForm = useForm<CustomerData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      service_address: "",
      service_city: "",
      service_postal_code: "",
    },
  });

  const serviceForm = useForm<ServiceData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      service_type: "internet",
      plan_name: "",
      monthly_price: 0,
      notes: "",
    },
  });

  const paymentForm = useForm<PaymentData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      payment_method: "interac",
      payment_reference: "",
    },
  });

  const selectedServiceType = serviceForm.watch("service_type");

  const handleCustomerSubmit = (data: CustomerData) => {
    setCustomerData(data);
    setCurrentStep(1);
  };

  const handleServiceSubmit = (data: ServiceData) => {
    setServiceData(data);
    setCurrentStep(2);
  };

  const handlePaymentSubmit = (data: PaymentData) => {
    setPaymentData(data);
    setCurrentStep(3);
  };

  const handleFinalSubmit = async () => {
    if (!customerData || !serviceData || !paymentData) return;

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Session expirée");
        navigate("/field-sales");
        return;
      }

      // Calculate totals with taxes
      const subtotal = serviceData.monthly_price;
      const tps = subtotal * 0.05;
      const tvq = subtotal * 0.09975;
      const total = subtotal + tps + tvq;

      const saleData = {
        salesperson_id: session.user.id,
        customer_name: customerData.full_name,
        customer_email: customerData.email,
        customer_phone: customerData.phone,
        service_address: customerData.service_address,
        service_city: customerData.service_city,
        service_postal_code: customerData.service_postal_code,
        service_type: serviceData.service_type,
        plan_name: serviceData.plan_name,
        monthly_price: serviceData.monthly_price,
        total_amount: total,
        payment_method: paymentData.payment_method,
        payment_reference: paymentData.payment_reference || null,
        payment_status: paymentData.payment_method === "deferred" ? "pending" : "confirmed",
        notes: serviceData.notes || null,
        sync_status: isOnline ? "synced" : "pending",
      };

      await saveSale(saleData);
      
      toast.success(
        isOnline 
          ? "Vente enregistrée avec succès!" 
          : "Vente sauvegardée localement (sync automatique)"
      );
      navigate("/field-sales/dashboard");
    } catch (error) {
      console.error("Error saving sale:", error);
      toast.error("Erreur lors de l'enregistrement");
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

  return (
    <div className="min-h-screen relative pb-24">
      <StaffBackground />
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-white">Nouvelle Vente</h1>
              <p className="text-xs text-slate-400">Étape {currentStep + 1} sur {STEPS.length}</p>
            </div>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center gap-2 mt-4">
            {STEPS.map((step, index) => (
              <div key={step} className="flex-1">
                <div 
                  className={`h-1 rounded-full transition-colors ${
                    index <= currentStep 
                      ? "bg-orange-500" 
                      : "bg-slate-700"
                  }`}
                />
                <p className={`text-[10px] mt-1 text-center ${
                  index <= currentStep ? "text-orange-400" : "text-slate-500"
                }`}>
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="p-4 relative z-10">
        {/* Step 1: Customer Info */}
        {currentStep === 0 && (
          <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
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
                        <FormLabel className="text-slate-300">Nom complet</FormLabel>
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
                          <FormLabel className="text-slate-300">
                            <Mail className="h-3 w-3 inline mr-1" />
                            Email
                          </FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="email"
                              placeholder="email@example.com"
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
                          <FormLabel className="text-slate-300">
                            <Phone className="h-3 w-3 inline mr-1" />
                            Téléphone
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
                    name="service_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">
                          <MapPin className="h-3 w-3 inline mr-1" />
                          Adresse de service
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
                          <FormLabel className="text-slate-300">Ville</FormLabel>
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
                          <FormLabel className="text-slate-300">Code postal</FormLabel>
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
                    className="w-full bg-orange-500 hover:bg-orange-400 text-white"
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
          <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-400" />
                Sélection du Service
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...serviceForm}>
                <form onSubmit={serviceForm.handleSubmit(handleServiceSubmit)} className="space-y-4">
                  <FormField
                    control={serviceForm.control}
                    name="service_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">Type de service</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="grid grid-cols-2 gap-2"
                          >
                            {[
                              { value: "internet", label: "Internet" },
                              { value: "tv", label: "Télévision" },
                              { value: "mobile", label: "Mobile" },
                              { value: "bundle", label: "Forfait" },
                            ].map((option) => (
                              <div key={option.value}>
                                <RadioGroupItem
                                  value={option.value}
                                  id={option.value}
                                  className="peer sr-only"
                                />
                                <label
                                  htmlFor={option.value}
                                  className="flex items-center justify-center p-3 rounded-lg border border-slate-600 bg-slate-800/50 text-slate-300 cursor-pointer transition-all peer-data-[state=checked]:border-orange-500 peer-data-[state=checked]:bg-orange-500/10 peer-data-[state=checked]:text-orange-400"
                                >
                                  {option.label}
                                </label>
                              </div>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={serviceForm.control}
                    name="plan_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">Plan</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            {SERVICE_PLANS[selectedServiceType]?.map((plan) => (
                              <button
                                key={plan.name}
                                type="button"
                                onClick={() => {
                                  serviceForm.setValue("plan_name", plan.name);
                                  serviceForm.setValue("monthly_price", plan.price);
                                }}
                                className={`w-full p-3 rounded-lg border text-left transition-all ${
                                  field.value === plan.name
                                    ? "border-orange-500 bg-orange-500/10"
                                    : "border-slate-600 bg-slate-800/50 hover:border-slate-500"
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-white font-medium">{plan.name}</span>
                                  <span className="text-orange-400 font-bold">{plan.price.toFixed(2)} $/mois</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={serviceForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">Notes (optionnel)</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Notes spéciales pour cette vente..."
                            className="bg-slate-800/50 border-slate-600 text-white resize-none"
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full bg-orange-500 hover:bg-orange-400 text-white"
                    disabled={!serviceForm.watch("plan_name")}
                  >
                    Continuer
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Payment */}
        {currentStep === 2 && (
          <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-orange-400" />
                Méthode de Paiement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...paymentForm}>
                <form onSubmit={paymentForm.handleSubmit(handlePaymentSubmit)} className="space-y-4">
                  {/* Order Summary */}
                  {serviceData && (
                    <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-600 space-y-2">
                      <h3 className="text-white font-medium">{serviceData.plan_name}</h3>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between text-slate-400">
                          <span>Mensuel</span>
                          <span>{serviceData.monthly_price.toFixed(2)} $</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>TPS (5%)</span>
                          <span>{(serviceData.monthly_price * 0.05).toFixed(2)} $</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>TVQ (9.975%)</span>
                          <span>{(serviceData.monthly_price * 0.09975).toFixed(2)} $</span>
                        </div>
                        <div className="flex justify-between text-white font-bold pt-2 border-t border-slate-600">
                          <span>Total</span>
                          <span className="text-orange-400">
                            {(serviceData.monthly_price * 1.14975).toFixed(2)} $
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <FormField
                    control={paymentForm.control}
                    name="payment_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">Mode de paiement</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="space-y-2"
                          >
                            {[
                              { value: "interac", label: "Virement Interac", desc: "Référence requise" },
                              { value: "paypal", label: "PayPal", desc: "Confirmation par client" },
                              { value: "deferred", label: "Paiement différé", desc: "Client paie plus tard" },
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
                                  <div>
                                    <p className="text-white font-medium">{option.label}</p>
                                    <p className="text-xs text-slate-400">{option.desc}</p>
                                  </div>
                                  <div className="w-4 h-4 rounded-full border-2 border-slate-500 peer-data-[state=checked]:border-orange-500 peer-data-[state=checked]:bg-orange-500" />
                                </label>
                              </div>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {paymentForm.watch("payment_method") === "interac" && (
                    <FormField
                      control={paymentForm.control}
                      name="payment_reference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300">Référence Interac</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Numéro de confirmation"
                              className="bg-slate-800/50 border-slate-600 text-white"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {paymentForm.watch("payment_method") === "paypal" && (
                    <FormField
                      control={paymentForm.control}
                      name="payment_reference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300">ID Transaction PayPal</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="ID de transaction"
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
                    className="w-full bg-orange-500 hover:bg-orange-400 text-white"
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
        {currentStep === 3 && customerData && serviceData && paymentData && (
          <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Check className="h-5 w-5 text-orange-400" />
                Confirmation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Summary */}
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-600">
                <h4 className="text-sm text-slate-400 mb-2">Client</h4>
                <p className="text-white font-medium">{customerData.full_name}</p>
                <p className="text-sm text-slate-300">{customerData.email}</p>
                <p className="text-sm text-slate-300">{customerData.phone}</p>
                <p className="text-sm text-slate-400 mt-2">
                  {customerData.service_address}, {customerData.service_city} {customerData.service_postal_code}
                </p>
              </div>

              {/* Service Summary */}
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-600">
                <h4 className="text-sm text-slate-400 mb-2">Service</h4>
                <p className="text-white font-medium">{serviceData.plan_name}</p>
                <p className="text-orange-400 font-bold">
                  {(serviceData.monthly_price * 1.14975).toFixed(2)} $/mois (taxes incl.)
                </p>
                {serviceData.notes && (
                  <p className="text-sm text-slate-400 mt-2 italic">"{serviceData.notes}"</p>
                )}
              </div>

              {/* Payment Summary */}
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-600">
                <h4 className="text-sm text-slate-400 mb-2">Paiement</h4>
                <p className="text-white font-medium capitalize">
                  {paymentData.payment_method === "interac" && "Virement Interac"}
                  {paymentData.payment_method === "paypal" && "PayPal"}
                  {paymentData.payment_method === "deferred" && "Paiement différé"}
                </p>
                {paymentData.payment_reference && (
                  <p className="text-sm text-slate-300">Réf: {paymentData.payment_reference}</p>
                )}
                <p className={`text-sm mt-1 ${
                  paymentData.payment_method === "deferred" 
                    ? "text-amber-400" 
                    : "text-emerald-400"
                }`}>
                  {paymentData.payment_method === "deferred" ? "⏳ En attente" : "✓ Confirmé"}
                </p>
              </div>

              {!isOnline && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-amber-200 text-sm">
                    📴 Mode hors-ligne - La vente sera synchronisée automatiquement
                  </p>
                </div>
              )}

              <Button 
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-lg"
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
            </CardContent>
          </Card>
        )}
      </main>

      <FieldSalesNav />
    </div>
  );
}
