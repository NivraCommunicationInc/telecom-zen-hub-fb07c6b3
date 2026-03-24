/**
 * Quote Checkout Page — Dedicated form for clients to complete their info after accepting a quote.
 * Accessible via /quote-checkout?token=XXX (no login required).
 * 
 * TWO-PHASE FLOW:
 * Phase 1: Client fills KYC form → submits → edge function creates order + invoice
 * Phase 2: PayPal button appears → client pays → order confirmed automatically
 * 
 * For Interac: saves data, staff handles manually.
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { NIVRA } from "@/lib/pdf/companyInfo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { backendClient } from "@/integrations/backend/client";
import { validateDob, MIN_AGE_TELECOM } from "@/lib/validation/dob";
import { validateCanadianPhone, formatCanadianPhone } from "@/components/checkout/CheckoutPhoneField";
import { validateCanadianPostalCode, formatPostalCode } from "@/components/checkout/CheckoutServiceAddress";
import PayPalButton from "@/components/payment/PayPalButton";
import { toast } from "sonner";
import {
  User, MapPin, CreditCard, CheckCircle, ShieldCheck, ArrowRight,
  FileText, Loader2, Lock, Phone, Mail, Calendar, Home
} from "lucide-react";

const PROVINCES = [
  { value: "QC", label: "Québec" },
  { value: "ON", label: "Ontario" },
  { value: "AB", label: "Alberta" },
  { value: "BC", label: "Colombie-Britannique" },
  { value: "MB", label: "Manitoba" },
  { value: "NB", label: "Nouveau-Brunswick" },
  { value: "NL", label: "Terre-Neuve-et-Labrador" },
  { value: "NS", label: "Nouvelle-Écosse" },
  { value: "PE", label: "Île-du-Prince-Édouard" },
  { value: "SK", label: "Saskatchewan" },
];

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  paymentMethod: "interac" | "paypal";
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

export default function QuoteCheckout() {
  const [searchParams] = useSearchParams();
  const checkoutToken = searchParams.get("token");

  const [quote, setQuote] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 2: after form submit, show PayPal
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [awaitingPayment, setAwaitingPayment] = useState(false);

  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dob: "",
    address: "",
    city: "",
    province: "QC",
    postalCode: "",
    paymentMethod: "paypal",
    acceptTerms: false,
    acceptPrivacy: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!checkoutToken) {
      setError("Lien de finalisation invalide.");
      setLoading(false);
      return;
    }
    loadQuote();
  }, [checkoutToken]);

  const loadQuote = async () => {
    try {
      const { data: q, error: qErr } = await supabase
        .from("quotes" as any)
        .select("*")
        .eq("checkout_token", checkoutToken!)
        .maybeSingle();

      if (qErr || !q) {
        setError("Soumission introuvable ou lien invalide.");
        setLoading(false);
        return;
      }

      if (q.status === "checkout_completed" || q.status === "converted") {
        setCompleted(true);
        setQuote(q);
        setLoading(false);
        return;
      }

      if (!["accepted_pending_checkout", "checkout_in_progress"].includes(q.status)) {
        setError("Cette soumission n'est pas dans un état permettant la finalisation.");
        setLoading(false);
        return;
      }

      // Pre-fill from prospect data
      if (q.is_prospect) {
        const nameParts = (q.prospect_name || "").split(" ");
        setForm(prev => ({
          ...prev,
          firstName: nameParts[0] || "",
          lastName: nameParts.slice(1).join(" ") || "",
          email: q.prospect_email || "",
          phone: q.prospect_phone || "",
        }));
      } else if (q.customer_user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, phone, address, city, province, postal_code, date_of_birth")
          .eq("user_id", q.customer_user_id)
          .maybeSingle();
        if (profile) {
          const nameParts = (profile.full_name || "").split(" ");
          setForm(prev => ({
            ...prev,
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            email: profile.email || "",
            phone: profile.phone || "",
            dob: profile.date_of_birth || "",
            address: profile.address || "",
            city: profile.city || "",
            province: profile.province || "QC",
            postalCode: profile.postal_code || "",
          }));
        }
      }

      // Mark checkout in progress
      if (q.status === "accepted_pending_checkout") {
        await supabase.from("quotes" as any).update({ status: "checkout_in_progress" }).eq("id", q.id);
      }

      setQuote(q);

      const { data: l } = await supabase
        .from("quote_lines" as any)
        .select("*")
        .eq("quote_id", q.id)
        .order("created_at", { ascending: true });
      setLines(l || []);
    } catch {
      setError("Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.firstName.trim()) newErrors.firstName = "Requis";
    if (!form.lastName.trim()) newErrors.lastName = "Requis";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) newErrors.email = "Courriel invalide";
    if (!validateCanadianPhone(form.phone)) newErrors.phone = "Téléphone invalide";
    if (!form.dob) {
      newErrors.dob = "Requis";
    } else {
      const dobResult = validateDob(form.dob);
      if (!dobResult.isValid) newErrors.dob = dobResult.error?.fr || "Date invalide";
    }
    if (!form.address.trim()) newErrors.address = "Requis";
    if (!form.city.trim()) newErrors.city = "Requis";
    if (!form.province) newErrors.province = "Requis";
    if (!validateCanadianPostalCode(form.postalCode)) newErrors.postalCode = "Code postal invalide";
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) newErrors.pin = "NIP à 4 chiffres requis";
    if (pin !== pinConfirm) newErrors.pinConfirm = "Les NIP ne correspondent pas";
    if (!form.acceptTerms) newErrors.acceptTerms = "Vous devez accepter les conditions";
    if (!form.acceptPrivacy) newErrors.acceptPrivacy = "Vous devez accepter la politique";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !quote) return;
    setSubmitting(true);

    try {
      const checkoutData = {
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        phone: formatCanadianPhone(form.phone),
        dob: form.dob,
        address: form.address,
        city: form.city,
        province: form.province,
        postal_code: formatPostalCode(form.postalCode),
      };

      if (form.paymentMethod === "paypal") {
        // PHASE 1: Create order + invoice via edge function, then show PayPal
        const { data, error: fnErr } = await supabase.functions.invoke("quote-checkout-finalize", {
          body: {
            quote_id: quote.id,
            checkout_data: checkoutData,
            payment_method: "paypal",
          },
        });

        if (fnErr) throw new Error(fnErr.message || "Erreur serveur");
        if (data?.error) throw new Error(data.error);

        // Set up PIN (non-blocking)
        try {
          if (quote.customer_user_id) {
            await backendClient.rpc("hash_client_pin" as any, {
              p_user_id: quote.customer_user_id,
              p_raw_pin: pin,
            });
          }
        } catch { /* non-blocking */ }

        // Transition to Phase 2: show PayPal button
        setInvoiceId(data.invoice_id);
        setOrderId(data.order_id);
        setOrderNumber(data.order_number);
        setTotalAmount(data.total);
        setAwaitingPayment(true);
        toast.success("Commande créée ! Procédez au paiement PayPal.");
      } else {
        // INTERAC: Save data only, staff handles manually
        await supabase
          .from("quotes" as any)
          .update({
            status: "checkout_completed",
            checkout_completed_at: new Date().toISOString(),
            prospect_name: `${form.firstName} ${form.lastName}`.trim(),
            prospect_email: form.email,
            prospect_phone: formatCanadianPhone(form.phone),
            checkout_data: {
              ...checkoutData,
              payment_method: "interac",
              completed_at: new Date().toISOString(),
            },
          })
          .eq("id", quote.id);

        await supabase.from("quote_events" as any).insert({
          quote_id: quote.id,
          event_type: "checkout_completed",
          actor_role: "client",
          message: `Checkout complété (Interac). En attente de traitement.`,
        });

        // PIN setup
        try {
          if (quote.customer_user_id) {
            await backendClient.rpc("hash_client_pin" as any, {
              p_user_id: quote.customer_user_id,
              p_raw_pin: pin,
            });
          }
        } catch { /* non-blocking */ }

        setCompleted(true);
        toast.success("Informations enregistrées !");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la finalisation");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayPalSuccess = (captureId: string) => {
    console.log("[QuoteCheckout] PayPal capture success:", captureId);
    // Update quote status
    if (quote?.id) {
      supabase
        .from("quotes" as any)
        .update({ status: "converted" })
        .eq("id", quote.id)
        .then(() => {
          // Update order payment status
          if (orderId) {
            supabase
              .from("orders")
              .update({
                payment_status: "paid",
                payment_reference: captureId,
                status: "confirmed",
              })
              .eq("id", orderId);
          }
        });
    }
    setCompleted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">Erreur</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
        <Card className="max-w-lg w-full mx-4 border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-emerald-600 mx-auto" />
            <h2 className="text-2xl font-bold text-emerald-600">
              {form.paymentMethod === "paypal" ? "Paiement confirmé !" : "Informations reçues !"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {form.paymentMethod === "paypal"
                ? "Votre paiement a été traité avec succès. Votre commande est confirmée et notre équipe procédera à l'activation de vos services."
                : "Vos informations ont été enregistrées avec succès. Notre équipe traitera votre dossier et créera votre commande dans les plus brefs délais."
              }
            </p>
            {orderNumber && (
              <p className="text-sm font-medium">Numéro de commande : <span className="font-bold">{orderNumber}</span></p>
            )}
            <p className="text-xs text-muted-foreground">
              Vous serez contacté par courriel ou téléphone pour les prochaines étapes.
            </p>
            <div className="pt-4">
              <p className="text-[10px] text-muted-foreground">{NIVRA.tradeName} · {NIVRA.email}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // PHASE 2: PayPal payment step
  if (awaitingPayment && invoiceId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">N</span>
            </div>
            <div>
              <p className="font-bold text-sm">{NIVRA.tradeName}</p>
              <p className="text-[10px] text-muted-foreground">Paiement — {quote?.quote_number}</p>
            </div>
            <Badge variant="outline" className="ml-auto">
              <Lock className="h-3 w-3 mr-1" /> Sécurisé
            </Badge>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-12 space-y-6">
          <Card className="border-primary/10 bg-primary/5">
            <CardContent className="pt-6 text-center space-y-2">
              <CheckCircle className="h-10 w-10 text-emerald-600 mx-auto" />
              <h2 className="text-lg font-bold">Informations confirmées</h2>
              <p className="text-sm text-muted-foreground">
                Votre commande <strong>{orderNumber}</strong> est prête. Complétez le paiement pour confirmer.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Paiement PayPal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total à payer</span>
                <span className="text-xl font-bold">{totalAmount.toFixed(2)} $</span>
              </div>
              <Separator />
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-muted-foreground mb-4">
                  Payez de façon sécurisée avec votre compte PayPal.
                </p>
                <PayPalButton
                  invoiceId={invoiceId}
                  amount={totalAmount}
                  description={`Commande ${orderNumber} — ${NIVRA.tradeName}`}
                  customer={{
                    first_name: form.firstName,
                    last_name: form.lastName,
                    email: form.email,
                    phone: formatCanadianPhone(form.phone),
                    address: {
                      address_line_1: form.address,
                      admin_area_2: form.city,
                      admin_area_1: form.province,
                      postal_code: formatPostalCode(form.postalCode),
                      country_code: "CA",
                    },
                  }}
                  onSuccess={handlePayPalSuccess}
                  onError={(msg) => toast.error(msg)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border space-y-1">
            <p>{NIVRA.legalName}</p>
            <p>{NIVRA.email} · {NIVRA.website}</p>
          </div>
        </div>
      </div>
    );
  }

  // PHASE 1: KYC Form
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">N</span>
          </div>
          <div>
            <p className="font-bold text-sm">{NIVRA.tradeName}</p>
            <p className="text-[10px] text-muted-foreground">Finalisation — {quote?.quote_number}</p>
          </div>
          <Badge variant="outline" className="ml-auto">
            <Lock className="h-3 w-3 mr-1" /> Sécurisé
          </Badge>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Quote summary */}
        <Card className="border-primary/10 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Soumission {quote?.quote_number}</p>
                <p className="text-2xl font-bold">{Number(quote?.total_due_now || 0).toFixed(2)} $</p>
                <p className="text-sm text-primary font-medium">{Number(quote?.total_monthly || 0).toFixed(2)} $ /mois récurrent</p>
              </div>
              <ShieldCheck className="h-8 w-8 text-primary/30" />
            </div>
          </CardContent>
        </Card>

        {/* Personal info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> Informations personnelles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-sm">Prénom <span className="text-destructive">*</span></Label>
                <Input id="firstName" value={form.firstName} onChange={e => updateField("firstName", e.target.value)} placeholder="Prénom" className={errors.firstName ? "border-destructive" : ""} />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-sm">Nom <span className="text-destructive">*</span></Label>
                <Input id="lastName" value={form.lastName} onChange={e => updateField("lastName", e.target.value)} placeholder="Nom" className={errors.lastName ? "border-destructive" : ""} />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dob" className="text-sm flex items-center gap-1"><Calendar className="h-3 w-3" /> Date de naissance <span className="text-destructive">*</span></Label>
              <Input id="dob" type="date" value={form.dob} onChange={e => updateField("dob", e.target.value)} className={errors.dob ? "border-destructive" : ""} />
              {errors.dob && <p className="text-xs text-destructive">{errors.dob}</p>}
              <p className="text-[10px] text-muted-foreground">Vous devez avoir {MIN_AGE_TELECOM} ans ou plus.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm flex items-center gap-1"><Mail className="h-3 w-3" /> Courriel <span className="text-destructive">*</span></Label>
                <Input id="email" type="email" value={form.email} onChange={e => updateField("email", e.target.value)} placeholder="email@exemple.com" className={errors.email ? "border-destructive" : ""} />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-sm flex items-center gap-1"><Phone className="h-3 w-3" /> Téléphone <span className="text-destructive">*</span></Label>
                <Input id="phone" value={form.phone} onChange={e => updateField("phone", e.target.value)} placeholder="514-000-0000" className={errors.phone ? "border-destructive" : ""} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Adresse de service
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="address" className="text-sm flex items-center gap-1"><Home className="h-3 w-3" /> Adresse <span className="text-destructive">*</span></Label>
              <Input id="address" value={form.address} onChange={e => updateField("address", e.target.value)} placeholder="123 rue Exemple" className={errors.address ? "border-destructive" : ""} />
              {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-sm">Ville <span className="text-destructive">*</span></Label>
                <Input id="city" value={form.city} onChange={e => updateField("city", e.target.value)} placeholder="Montréal" className={errors.city ? "border-destructive" : ""} />
                {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Province <span className="text-destructive">*</span></Label>
                <Select value={form.province} onValueChange={v => updateField("province", v)}>
                  <SelectTrigger className={errors.province ? "border-destructive" : ""}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVINCES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postalCode" className="text-sm">Code postal <span className="text-destructive">*</span></Label>
                <Input id="postalCode" value={form.postalCode} onChange={e => updateField("postalCode", e.target.value)} placeholder="H1A 1A1" className={errors.postalCode ? "border-destructive" : ""} />
                {errors.postalCode && <p className="text-xs text-destructive">{errors.postalCode}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PIN */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" /> NIP de sécurité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Ce NIP à 4 chiffres sera utilisé pour sécuriser l'accès à votre compte.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pin" className="text-sm">NIP <span className="text-destructive">*</span></Label>
                <Input id="pin" type="password" maxLength={4} value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setErrors(prev => ({ ...prev, pin: "" })); }} placeholder="••••" className={errors.pin ? "border-destructive" : ""} />
                {errors.pin && <p className="text-xs text-destructive">{errors.pin}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pinConfirm" className="text-sm">Confirmer NIP <span className="text-destructive">*</span></Label>
                <Input id="pinConfirm" type="password" maxLength={4} value={pinConfirm} onChange={e => { setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4)); setErrors(prev => ({ ...prev, pinConfirm: "" })); }} placeholder="••••" className={errors.pinConfirm ? "border-destructive" : ""} />
                {errors.pinConfirm && <p className="text-xs text-destructive">{errors.pinConfirm}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment method selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Mode de paiement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => updateField("paymentMethod", "paypal")}
                className={`p-4 rounded-lg border-2 text-center transition-all ${
                  form.paymentMethod === "paypal"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <p className="font-medium text-sm">PayPal</p>
                <p className="text-[10px] text-muted-foreground">Paiement en ligne</p>
                {form.paymentMethod === "paypal" && (
                  <Badge variant="secondary" className="mt-1 text-[9px]">Recommandé</Badge>
                )}
              </button>
              <button
                type="button"
                onClick={() => updateField("paymentMethod", "interac")}
                className={`p-4 rounded-lg border-2 text-center transition-all ${
                  form.paymentMethod === "interac"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <p className="font-medium text-sm">Interac</p>
                <p className="text-[10px] text-muted-foreground">Virement électronique</p>
              </button>
            </div>

            {form.paymentMethod === "paypal" && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-xs text-muted-foreground">
                  Après validation de vos informations, vous serez invité à compléter votre paiement via PayPal.
                </p>
              </div>
            )}

            {form.paymentMethod === "interac" && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">
                  Vous recevrez les instructions de paiement par courriel après la validation de vos informations.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Confirmations légales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={form.acceptTerms}
                onCheckedChange={v => updateField("acceptTerms", v as boolean)}
              />
              <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                J'accepte les <a href="/conditions-de-service" target="_blank" className="text-primary underline">conditions d'utilisation</a> et les conditions de service de {NIVRA.tradeName}. <span className="text-destructive">*</span>
              </Label>
            </div>
            {errors.acceptTerms && <p className="text-xs text-destructive">{errors.acceptTerms}</p>}

            <div className="flex items-start gap-3">
              <Checkbox
                id="privacy"
                checked={form.acceptPrivacy}
                onCheckedChange={v => updateField("acceptPrivacy", v as boolean)}
              />
              <Label htmlFor="privacy" className="text-sm leading-relaxed cursor-pointer">
                J'accepte la <a href="/confidentialite-loi25" target="_blank" className="text-primary underline">politique de confidentialité</a>. <span className="text-destructive">*</span>
              </Label>
            </div>
            {errors.acceptPrivacy && <p className="text-xs text-destructive">{errors.acceptPrivacy}</p>}
          </CardContent>
        </Card>

        {/* Summary + Submit */}
        <Card className="border-primary/20">
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total dû maintenant</span>
              <span className="text-lg font-bold">{Number(quote?.total_due_now || 0).toFixed(2)} $</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mensuel récurrent</span>
              <span className="font-medium text-primary">{Number(quote?.total_monthly || 0).toFixed(2)} $ /mois</span>
            </div>
            <Separator />
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Traitement en cours...</>
              ) : form.paymentMethod === "paypal" ? (
                <><ArrowRight className="h-4 w-4" /> Continuer vers le paiement PayPal</>
              ) : (
                <><CheckCircle className="h-4 w-4" /> Confirmer ma commande</>
              )}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              {form.paymentMethod === "paypal"
                ? "Vous serez redirigé vers PayPal pour compléter le paiement."
                : "En confirmant, vous acceptez que votre commande soit traitée selon les termes de votre soumission."
              }
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border space-y-1">
          <p>{NIVRA.legalName}</p>
          <p>{NIVRA.email} · {NIVRA.website}</p>
        </div>
      </div>
    </div>
  );
}
