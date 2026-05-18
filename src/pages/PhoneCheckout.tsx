/**
 * PhoneCheckout — public checkout for buying a phone (with optional mobile plan).
 *
 * Route: /telephones/:id/commander
 *
 * Flow:
 *   1. Display phone summary, mode toggle (phone-only | phone+plan).
 *   2. Collect client info (logged-in users get pre-fill from profile).
 *   3. Collect shipping address (Canada-wide for phone-only; QC-only with plan).
 *   4. Show mandatory KYC notice.
 *   5. PayPal one-time payment.
 *   6. On success:
 *        - create row in `orders` (service_type='phone')
 *        - create row in `phone_orders` (status='pending_kyc')
 *        - call `calculate-phone-fraud-score` and persist results
 *        - reserve the phone (phone_inventory.status='reserved')
 *        - send KYC reminder email via `send-transactional-email`
 *
 * IMPORTANT: this flow goes through the existing PayPal one-time button —
 * it does NOT touch billing-generate-renewals or paypal-webhook.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Smartphone, ShieldCheck, Truck, AlertTriangle, Loader2, Phone as PhoneIcon } from "lucide-react";
import { PayPalButton, type PayPalPayerAddress } from "@/components/payment/PayPalButton";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMobilePlans } from "@/hooks/usePublicServices";
import {
  formatCanadianPhone,
  validateCanadianPhone,
  formatPostalCode,
  validateCanadianPostalCode,
} from "@/lib/validation/checkoutFields";
import { validateDob } from "@/lib/validation/dob";

type Phone = {
  id: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  condition: string;
  price_cad: number;
  photos: string[];
  warranty_days: number;
  status: string;
  available_colors: string[] | null;
  available_storage: string[] | null;
};

const SHIPPING_FEE = 20; // flat CAD shipping (canonical Nivra rate)
const TAX_RATE = 0.14975; // QC GST+QST combined approximation
const CANADIAN_PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];

// Storage upcharges relative to the base (default) configuration
const STORAGE_UPCHARGE: Record<string, number> = {
  "64GB": 0,
  "128GB": 0,
  "256GB": 0,
  "512GB": 100,
  "1TB": 200,
};

export default function PhoneCheckout() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  const isFr = language === "fr";
  const navigate = useNavigate();

  const [phone, setPhone] = useState<Phone | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { plans: mobilePlans, isLoading: plansLoading } = useMobilePlans(isFr);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");

  const [mode, setMode] = useState<"phone_only" | "phone_plus_plan">("phone_only");
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);

  // Selected variant (from URL params, falls back to phone defaults)
  const [selectedColor, setSelectedColor] = useState<string>(searchParams.get("color") ?? "");
  const [selectedStorage, setSelectedStorage] = useState<string>(searchParams.get("storage") ?? "");

  // Client info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dob, setDob] = useState("");

  // Shipping
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("QC");
  const [postalCode, setPostalCode] = useState("");

  const [acceptKyc, setAcceptKyc] = useState(false);

  // Draft order created BEFORE opening PayPal so paypal-create-order
  // receives a valid order_id (rejected otherwise — see hardening 2026-04-17).
  const [draftOrderId, setDraftOrderId] = useState<string | null>(null);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [preparedOrder, setPreparedOrder] = useState<{
    order_id: string;
    user_id: string;
    account_id: string;
    amount: number;
  } | null>(null);

  // -------- Load phone + user + plans --------
  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: phoneData }, { data: { user: u } }] = await Promise.all([
        supabase
          .from("phone_inventory")
          .select("id, brand, model, storage, color, condition, price_cad, photos, warranty_days, status, available_colors, available_storage, is_visible_on_site")
          .eq("id", id)
          .eq("is_visible_on_site", true)
          .maybeSingle(),
        supabase.auth.getUser(),
      ]);

      const p = phoneData as Phone | null;
      setPhone(p);
      if (p) {
        if (!searchParams.get("color")) setSelectedColor(p.color);
        if (!searchParams.get("storage")) setSelectedStorage(p.storage);
      }
      if (u) {
        setUser({ id: u.id, email: u.email });
        setEmail(u.email ?? "");
        // Pre-fill from latest order
        const { data: lastOrder } = await supabase
          .from("orders")
          .select("client_first_name, client_last_name, client_phone, client_dob, shipping_address, shipping_city, shipping_province, shipping_postal_code")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastOrder) {
          setFirstName(lastOrder.client_first_name ?? "");
          setLastName(lastOrder.client_last_name ?? "");
          setPhoneNumber(lastOrder.client_phone ?? "");
          setDob(lastOrder.client_dob ?? "");
          setAddress(lastOrder.shipping_address ?? "");
          setCity(lastOrder.shipping_city ?? "");
          setProvince(lastOrder.shipping_province ?? "QC");
          setPostalCode(lastOrder.shipping_postal_code ?? "");
        }
      }
      setLoading(false);
    })();
  }, [id]);

  // Mobile plans loaded from services_catalog via useMobilePlans hook (same source as MobilePlans.tsx)

  // -------- Totals (storage upcharge applied to base) --------
  const basePrice = Number(phone?.price_cad ?? 0);
  const baseUpcharge = phone ? (STORAGE_UPCHARGE[phone.storage] ?? 0) : 0;
  const selectedUpcharge = STORAGE_UPCHARGE[selectedStorage] ?? 0;
  const phonePrice = +(basePrice - baseUpcharge + selectedUpcharge).toFixed(2);
  const subtotal = phonePrice + SHIPPING_FEE;
  const tax = +(subtotal * TAX_RATE).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);

  // -------- Validation --------
  const planRequiresQuebec = mode === "phone_plus_plan";
  const provinceError =
    planRequiresQuebec && province !== "QC"
      ? (isFr ? "Les forfaits mobiles sont disponibles uniquement au Québec." : "Mobile plans are Quebec only.")
      : "";

  const planError =
    planRequiresQuebec && !selectedPlanId
      ? (isFr ? "Sélectionnez un forfait mobile." : "Select a mobile plan.")
      : "";

  // DOB only required when buying a phone + mobile plan AND (guest OR no DOB on profile yet)
  const dobRequired = mode === "phone_plus_plan" && (!user || !dob);

  // Strict field-level validation (Option A — same rules as GuestCheckout)
  const phoneValid = validateCanadianPhone(phoneNumber);
  const postalValid = validateCanadianPostalCode(postalCode);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const dobCheck = dobRequired
    ? validateDob(dob, { required: true })
    : { isValid: true as const };

  // Granular validation issues — shown to the user so they know exactly what to fix.
  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (firstName.trim().length < 2) issues.push(isFr ? "Prénom (au moins 2 caractères)" : "First name (min 2 chars)");
    if (lastName.trim().length < 2) issues.push(isFr ? "Nom (au moins 2 caractères)" : "Last name (min 2 chars)");
    if (!emailValid) issues.push(isFr ? "Courriel valide (ex: nom@domaine.com)" : "Valid email (e.g. name@domain.com)");
    if (!phoneValid) issues.push(isFr ? "Téléphone canadien à 10 chiffres" : "10-digit Canadian phone");
    if (dobRequired && !dobCheck.isValid) issues.push(isFr ? "Date de naissance valide" : "Valid date of birth");
    if (!address.trim()) issues.push(isFr ? "Adresse (rue)" : "Street address");
    if (!city.trim()) issues.push(isFr ? "Ville" : "City");
    if (!province) issues.push(isFr ? "Province" : "Province");
    if (!postalValid) issues.push(isFr ? "Code postal canadien (ex: H2X 1Y4)" : "Canadian postal code (e.g. H2X 1Y4)");
    if (provinceError) issues.push(provinceError);
    if (planError) issues.push(planError);
    if (!acceptKyc) issues.push(isFr ? "Acceptation de la vérification d'identité" : "Accept identity verification");
    return issues;
  }, [firstName, lastName, emailValid, phoneValid, dobRequired, dobCheck.isValid, address, city, province, postalValid, provinceError, planError, acceptKyc, isFr]);

  const formValid = validationIssues.length === 0;

  // -------- Create draft order BEFORE PayPal opens --------
  // Required: paypal-create-order rejects payloads without order_id (hardening 2026-04-17).
  const ensureDraftOrder = async (): Promise<string | null> => {
    if (draftOrderId) return draftOrderId;
    if (!phone || !formValid) return null;
    setCreatingDraft(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-checkout-prepare", {
        body: {
          phone_id: phone.id,
          mode,
          selected_plan_id: selectedPlanId || null,
          selected_color: selectedColor,
          selected_storage: selectedStorage,
          customer: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
            phone: phoneNumber.trim(),
            dob: dob || null,
          },
          shipping: {
            address: address.trim(),
            city: city.trim(),
            province,
            postal_code: postalCode.trim(),
          },
        },
      });

      if (error || !data?.success || !data?.order_id) {
        console.error("[phone-checkout] draft order failed", error || data);
        toast.error(isFr ? "Impossible de préparer la commande." : "Could not prepare order.");
        return null;
      }
      setPreparedOrder({
        order_id: data.order_id,
        user_id: data.user_id,
        account_id: data.account_id,
        amount: Number(data.amount),
      });
      setDraftOrderId(data.order_id);
      return data.order_id;
    } finally {
      setCreatingDraft(false);
    }
  };

  // -------- Payment success --------
  const handlePaymentSuccess = async (captureId: string, payerAddress?: PayPalPayerAddress | null) => {
    if (!phone || !draftOrderId || !preparedOrder) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-checkout-finalize", {
        body: {
          order_id: draftOrderId,
          phone_id: phone.id,
          capture_id: captureId,
          selected_color: selectedColor,
          selected_storage: selectedStorage,
          payer_address: payerAddress ?? null,
        },
      });

      if (error || !data?.success) throw error ?? new Error(data?.error || "order finalize failed");

      toast.success(isFr ? "Commande confirmée!" : "Order confirmed!");
      navigate(`/track-order?id=${draftOrderId}`);
    } catch (e: any) {
      console.error("[phone-checkout]", e);
      toast.error(isFr ? "Erreur lors de la création de la commande." : "Order creation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // -------- Render --------
  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </>
    );
  }

  if (!phone || phone.status !== "available") {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-20">
          <div className="container mx-auto px-4 py-16 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
            <h1 className="text-2xl font-bold mb-2">{isFr ? "Appareil indisponible" : "Phone unavailable"}</h1>
            <Button asChild className="mt-4"><Link to="/telephones">{isFr ? "Retour au catalogue" : "Back to catalog"}</Link></Button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main id="main-content" className="min-h-screen bg-background pt-20">
        <div className="container mx-auto px-4 py-10 max-w-4xl">
          <h1 className="text-3xl font-bold mb-8">{isFr ? "Finaliser votre commande" : "Complete your order"}</h1>

          {/* SECTION 1 — Product summary + mode toggle */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" />{isFr ? "Votre appareil" : "Your device"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                  {phone.photos?.[0] ? (
                    <img src={phone.photos[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Smartphone className="w-12 h-12 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{phone.brand} {phone.model}</h3>
                  <p className="text-sm text-muted-foreground">{selectedStorage} · {selectedColor}</p>
                  <p className="text-xl font-bold mt-1">{phonePrice.toFixed(2)}$</p>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">{isFr ? "Type de commande" : "Order type"}</Label>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                  <div className="flex items-center space-x-2 border rounded-lg p-3">
                    <RadioGroupItem value="phone_only" id="phone-only" />
                    <Label htmlFor="phone-only" className="cursor-pointer flex-1">
                      <span className="font-medium">{isFr ? "Téléphone seulement" : "Phone only"}</span>
                      <span className="block text-xs text-muted-foreground">{isFr ? "Livraison partout au Canada" : "Shipping anywhere in Canada"}</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-3">
                    <RadioGroupItem value="phone_plus_plan" id="phone-plan" />
                    <Label htmlFor="phone-plan" className="cursor-pointer flex-1">
                      <span className="font-medium">{isFr ? "Téléphone + Forfait mobile" : "Phone + mobile plan"}</span>
                      <span className="block text-xs text-muted-foreground">{isFr ? "Québec uniquement" : "Quebec only"}</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {mode === "phone_plus_plan" && (
                <div>
                  <Label htmlFor="plan">{isFr ? "Forfait mobile" : "Mobile plan"}</Label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId} disabled={plansLoading}>
                    <SelectTrigger id="plan"><SelectValue placeholder={plansLoading ? (isFr ? "Chargement..." : "Loading...") : (isFr ? "Choisir un forfait" : "Choose a plan")} /></SelectTrigger>
                    <SelectContent>
                      {mobilePlans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — {Number(p.price).toFixed(2)}$/mo</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SECTION 2 — Client info */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PhoneIcon className="w-5 h-5 text-primary" />{isFr ? "Vos informations" : "Your info"}</CardTitle>
              {!user && <CardDescription>{isFr ? "Un compte sera créé après le paiement." : "An account will be created after payment."}</CardDescription>}
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label htmlFor="fn">{isFr ? "Prénom" : "First name"} *</Label><Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div><Label htmlFor="ln">{isFr ? "Nom" : "Last name"} *</Label><Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
              <div><Label htmlFor="em">{isFr ? "Courriel" : "Email"} *</Label><Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user} /></div>
              <div><Label htmlFor="ph">{isFr ? "Téléphone" : "Phone"} *</Label><Input id="ph" type="tel" placeholder="(514) 555-1234" value={phoneNumber} onChange={(e) => setPhoneNumber(formatCanadianPhone(e.target.value))} maxLength={14} /></div>
              {dobRequired && (
                <div className="md:col-span-2">
                  <Label htmlFor="dob">{isFr ? "Date de naissance" : "Date of birth"} *</Label>
                  <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">
                    {isFr
                      ? "Requise pour l'activation du forfait mobile (vérification d'âge légal)."
                      : "Required to activate your mobile plan (age verification)."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SECTION 3 — Shipping */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Truck className="w-5 h-5 text-primary" />{isFr ? "Adresse de livraison" : "Shipping address"}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><Label htmlFor="addr">{isFr ? "Rue" : "Street"} *</Label><AddressAutocomplete value={address} onValueChange={setAddress} onSelect={(a) => { setAddress(a.line1 || a.formatted); if (a.city) setCity(a.city); if (a.region) setProvince(a.region); if (a.postalCode) setPostalCode(a.postalCode); }} placeholder={isFr ? "Commencez à taper votre adresse..." : "Start typing your address..."} /></div>
              <div><Label htmlFor="city">{isFr ? "Ville" : "City"} *</Label><Input id="city" value={city} onChange={(e) => setCity(e.target.value)} /></div>
              <div>
                <Label htmlFor="prov">{isFr ? "Province" : "Province"} *</Label>
                <Select value={province} onValueChange={setProvince}>
                  <SelectTrigger id="prov"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANADIAN_PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="pc">{isFr ? "Code postal" : "Postal code"} *</Label><Input id="pc" value={postalCode} onChange={(e) => setPostalCode(formatPostalCode(e.target.value))} placeholder="H2X 1Y4" maxLength={7} /></div>
              <div className="md:col-span-2 text-xs text-muted-foreground">{isFr ? "Pays : Canada" : "Country: Canada"}</div>
              <Alert className="md:col-span-2 border-primary/30 bg-primary/5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <AlertDescription className="text-xs">
                  {isFr
                    ? "L'adresse de livraison est aussi votre adresse de facturation PayPal. Assurez-vous qu'elles correspondent — sinon votre commande pourra être marquée pour vérification supplémentaire."
                    : "Your shipping address is also used as your PayPal billing address. Make sure they match — otherwise your order may be flagged for additional review."}
                </AlertDescription>
              </Alert>
              {provinceError && (
                <Alert variant="destructive" className="md:col-span-2">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>{provinceError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* SECTION 5 — KYC notice */}
          <Alert className="mb-6 border-amber-500/40 bg-amber-500/10">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            <AlertDescription className="text-sm">
              <strong className="block mb-1">{isFr ? "Vérification d'identité obligatoire" : "Identity verification required"}</strong>
              {isFr
                ? "Tous les achats d'appareils requièrent une vérification d'identité. Après votre commande, vous recevrez un courriel pour soumettre vos documents. Votre appareil sera expédié après approbation."
                : "All device purchases require identity verification. After your order, you'll receive an email to submit documents. Your device ships after approval."}
              <label className="flex items-start gap-2 mt-3 cursor-pointer">
                <Checkbox checked={acceptKyc} onCheckedChange={(c) => setAcceptKyc(c === true)} className="mt-0.5" />
                <span>{isFr ? "Je comprends et j'accepte de fournir une pièce d'identité." : "I understand and agree to provide ID."}</span>
              </label>
            </AlertDescription>
          </Alert>

          {/* Order summary */}
          <Card className="mb-6">
            <CardHeader><CardTitle>{isFr ? "Récapitulatif" : "Summary"}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span>{phone.brand} {phone.model}</span><span>{phonePrice.toFixed(2)}$</span></div>
              <div className="flex justify-between text-muted-foreground"><span>{isFr ? "Livraison" : "Shipping"}</span><span>{SHIPPING_FEE.toFixed(2)}$</span></div>
              <div className="flex justify-between text-muted-foreground"><span>{isFr ? "Taxes" : "Taxes"}</span><span>{tax.toFixed(2)}$</span></div>
              <div className="flex justify-between text-base font-bold border-t pt-2"><span>Total</span><span>{total.toFixed(2)}$</span></div>
            </CardContent>
          </Card>

          {/* SECTION 4 — Payment */}
          <Card>
            <CardHeader><CardTitle>{isFr ? "Paiement" : "Payment"}</CardTitle></CardHeader>
            <CardContent>
              {!formValid && (
                <Alert variant="destructive" className="mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">
                      {isFr ? "Complétez ou corrigez ces champs pour continuer :" : "Complete or fix these fields to continue:"}
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {validationIssues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {submitting ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> {isFr ? "Finalisation de la commande..." : "Finalizing order..."}</div>
              ) : !draftOrderId ? (
                <Button
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                  disabled={!formValid || creatingDraft}
                  onClick={ensureDraftOrder}
                >
                  {creatingDraft ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {isFr ? "Préparation..." : "Preparing..."}</>
                  ) : (
                    isFr ? "Continuer vers le paiement" : "Continue to payment"
                  )}
                </Button>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {isFr
                      ? "Commande préparée. Cliquez sur PayPal ci-dessous pour payer."
                      : "Order prepared. Click PayPal below to pay."}
                  </p>
                  <PayPalButton
                    amount={total}
                    orderId={draftOrderId}
                    description={`${phone.brand} ${phone.model} – ${phone.storage}`}
                    customer={{
                      first_name: firstName.trim(),
                      last_name: lastName.trim(),
                      email: email.trim(),
                      phone: phoneNumber.trim(),
                      address: {
                        address_line_1: address.trim(),
                        admin_area_2: city.trim(),
                        admin_area_1: province,
                        postal_code: postalCode.trim(),
                        country_code: "CA",
                      },
                    }}
                    onSuccess={handlePaymentSuccess}
                    onError={(err) => {
                      console.error("[paypal]", err);
                      toast.error(isFr ? "Paiement échoué. Réessayez." : "Payment failed.");
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
