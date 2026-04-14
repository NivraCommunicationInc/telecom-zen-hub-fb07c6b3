import { useState, forwardRef, useCallback } from "react";
import HoneypotField, { isHoneypotTriggered } from "@/components/shared/HoneypotField";
import CloudflareTurnstile from "@/components/shared/CloudflareTurnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowRight, 
  CheckCircle, 
  User, 
  Mail, 
  Phone, 
  MessageSquare,
  AlertTriangle,
  MapPin,
  Building,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy
} from "lucide-react";
import { z } from "zod";
import { useLanguage } from "@/contexts/LanguageContext";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";

const SUBJECT_OPTIONS = [
  { value: "new_order", labelFr: "Nouvelle commande / Info forfaits", labelEn: "New order / Plan info" },
  { value: "billing", labelFr: "Facturation / Paiement", labelEn: "Billing / Payment" },
  { value: "tech_support", labelFr: "Support technique (Internet / TV / Mobile)", labelEn: "Technical support (Internet / TV / Mobile)" },
  { value: "number_transfer", labelFr: "Transfert de numéro (portabilité)", labelEn: "Number transfer (portability)" },
  { value: "installation", labelFr: "Installation / Rendez-vous", labelEn: "Installation / Appointment" },
  { value: "delivery", labelFr: "Livraison / Équipement", labelEn: "Delivery / Equipment" },
  { value: "complaint", labelFr: "Réclamation / Annulation", labelEn: "Complaint / Cancellation" },
  { value: "other", labelFr: "Autre", labelEn: "Other" },
];

// Canadian phone format: (XXX) XXX-XXXX
const formatCanadianPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

// Format postal code as A1A 1A1
const formatPostalCode = (value: string): string => {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
};

const ContactForm = forwardRef<HTMLDivElement>((_, ref) => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const isFrench = language === 'fr';
  
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const [showAddress, setShowAddress] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const handleTurnstileVerify = useCallback((token: string) => setTurnstileToken(token), []);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
    preferredContact: "email",
    consentGiven: false,
    addressStreet: "",
    addressApartment: "",
    addressCity: "",
    addressProvince: "QC",
    addressPostalCode: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const contactSchema = z.object({
    firstName: z.string().trim().min(1, isFrench ? "Prénom requis" : "First name required").max(50),
    lastName: z.string().trim().min(1, isFrench ? "Nom requis" : "Last name required").max(50),
    email: z.string().trim().email(isFrench ? "Courriel invalide" : "Invalid email").max(255),
    phone: z.string().refine(
      (val) => val.replace(/\D/g, "").length === 10,
      isFrench ? "Téléphone invalide (10 chiffres requis)" : "Invalid phone (10 digits required)"
    ),
    subject: z.string().min(1, isFrench ? "Sujet requis" : "Subject required"),
    message: z.string().trim().min(10, isFrench ? "Message trop court (min 10 caractères)" : "Message too short (min 10 characters)").max(2000),
    preferredContact: z.enum(["email", "phone"]),
    consentGiven: z.literal(true, {
      errorMap: () => ({ message: isFrench ? "Consentement requis" : "Consent required" })
    }),
    addressStreet: z.string().optional(),
    addressApartment: z.string().optional(),
    addressCity: z.string().optional(),
    addressProvince: z.string().optional(),
    addressPostalCode: z.string().optional().refine(
      (val) => !val || val === "" || /^[A-Za-z]\d[A-Za-z][ ]?\d[A-Za-z]\d$/.test(val),
      isFrench ? "Code postal invalide (ex: H2X 1Y4)" : "Invalid postal code (e.g., H2X 1Y4)"
    ),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let processedValue = value;
    
    if (name === "phone") {
      processedValue = formatCanadianPhone(value);
    } else if (name === "addressPostalCode") {
      processedValue = formatPostalCode(value);
    }
    
    setFormData((prev) => ({ ...prev, [name]: processedValue }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const copyRequestNumber = () => {
    if (requestNumber) {
      navigator.clipboard.writeText(requestNumber);
      toast({
        title: isFrench ? "Copié!" : "Copied!",
        description: isFrench ? "Numéro de référence copié" : "Reference number copied",
      });
    }
  };

  const handleSubmitClick = async () => {
    // Anti-bot: silently reject honeypot
    if (isHoneypotTriggered(honeypot)) {
      setIsSubmitted(true);
      return;
    }

    setErrors({});

    // Hard block when consent is not accepted
    if (formData.consentGiven !== true) {
      const msg = isFrench
        ? "Veuillez accepter le consentement pour envoyer le message."
        : "Please accept the consent to send the message.";
      setErrors({ consentGiven: msg });
      toast({
        title: isFrench ? "Consentement requis" : "Consent required",
        description: msg,
        variant: "destructive",
      });
      return;
    }

    // Validation Zod
    const result = contactSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const backendUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      
      if (!backendUrl || !anonKey) {
        throw new Error("Configuration backend manquante");
      }

      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email.toLowerCase().trim(),
        phone: formData.phone,
        subject: formData.subject,
        message: formData.message,
        preferredContact: formData.preferredContact,
        consentGiven: true,
        pageUrl: typeof window !== "undefined" ? window.location.href : null,
        addressStreet: formData.addressStreet || null,
        addressApartment: formData.addressApartment || null,
        addressCity: formData.addressCity || null,
        addressProvince: formData.addressProvince || null,
        addressPostalCode: formData.addressPostalCode || null,
        turnstileToken: turnstileToken || null,
      };

      const response = await fetch(`${backendUrl}/functions/v1/submit-web-form`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": anonKey,
          "Authorization": `Bearer ${anonKey}`,
        },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (!response.ok || resData.ok === false) {
        console.error("[ContactForm] Submission failed:", {
          status: response.status,
          statusText: response.statusText,
          body: resData,
        });
        throw new Error(resData.error || `Erreur ${response.status}: ${response.statusText}`);
      }

      // Success - use thread_number from web_form_threads
      setRequestNumber(resData.thread_number || null);
      setIsSubmitted(true);

      // Reset form state
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
        preferredContact: "email",
        consentGiven: false,
        addressStreet: "",
        addressApartment: "",
        addressCity: "",
        addressProvince: "QC",
        addressPostalCode: "",
      });

      toast({
        title: isFrench ? "Message envoyé!" : "Message sent!",
        description: isFrench
          ? "Votre demande a été reçue. Notre équipe vous contactera sous peu."
          : "Your request has been received. Our team will contact you soon.",
      });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("[ContactForm] Error:", errorMessage);
      toast({
        title: isFrench ? "Erreur" : "Error",
        description: errorMessage || (isFrench
          ? "Impossible d'envoyer votre demande. Veuillez réessayer."
          : "Unable to send your request. Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 md:p-10">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          
          <div>
            <h3 className="font-display text-2xl font-bold text-primary-foreground mb-2">
              {isFrench ? "Demande reçue!" : "Request received!"}
            </h3>
            <p className="text-cyan-100/70">
              {isFrench 
                ? "Merci de nous avoir contacté. Notre équipe vous répondra dans les plus brefs délais."
                : "Thank you for contacting us. Our team will respond as soon as possible."}
            </p>
          </div>

          {requestNumber && (
            <Card className="bg-background/30 border-cyan-500/30">
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground mb-2">
                  {isFrench ? "Numéro de référence" : "Reference number"}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl font-mono font-bold text-cyan-400">{requestNumber}</span>
                  <Button variant="ghost" size="sm" onClick={copyRequestNumber} className="h-8 w-8 p-0">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="py-4 flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <p className="text-sm text-left text-cyan-100/80">
                {isFrench 
                  ? "Délai de réponse estimé: 1 jour ouvrable"
                  : "Estimated response time: 1 business day"}
              </p>
            </CardContent>
          </Card>

          <Button 
            variant="outline" 
            onClick={() => {
              setIsSubmitted(false);
              setFormData({
                firstName: "", lastName: "", email: "", phone: "",
                subject: "", message: "", preferredContact: "email",
                consentGiven: false, addressStreet: "", addressApartment: "",
                addressCity: "", addressProvince: "QC", addressPostalCode: "",
              });
            }}
            className="mt-4"
          >
            {isFrench ? "Soumettre une autre demande" : "Submit another request"}
          </Button>
        </div>
      </div>
    );
  }

  // Use <div> instead of <form> to prevent ANY native form submission/navigation
  return (
    <div
      ref={ref}
      data-testid="contact-form"
      className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm"
    >
      <h3 className="text-xl font-semibold text-foreground mb-6 text-center">
        {isFrench ? "Contact" : "Contact"}
      </h3>
      
      <div className="space-y-5">
        {/* Name fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-foreground flex items-center gap-2 text-sm font-medium">
              <User className="w-4 h-4 text-muted-foreground" />
              {isFrench ? "Prénom" : "First Name"} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="firstName"
              name="firstName"
              type="text"
              placeholder={isFrench ? "Votre prénom" : "Your first name"}
              value={formData.firstName}
              onChange={handleChange}
              className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-accent focus:ring-accent/30 h-11"
            />
            {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-foreground text-sm font-medium">
              {isFrench ? "Nom" : "Last Name"} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lastName"
              name="lastName"
              type="text"
              placeholder={isFrench ? "Votre nom" : "Your last name"}
              value={formData.lastName}
              onChange={handleChange}
              className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-accent focus:ring-accent/30 h-11"
            />
            {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground flex items-center gap-2 text-sm font-medium">
            <Mail className="w-4 h-4 text-muted-foreground" />
            {isFrench ? "Courriel" : "Email"} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="votre@courriel.com"
            value={formData.email}
            onChange={handleChange}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-accent focus:ring-accent/30 h-11"
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-foreground flex items-center gap-2 text-sm font-medium">
            <Phone className="w-4 h-4 text-muted-foreground" />
            {isFrench ? "Téléphone" : "Phone"} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="(514) 555-1234"
            value={formData.phone}
            onChange={handleChange}
            maxLength={14}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-accent focus:ring-accent/30 h-11"
          />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <Label htmlFor="subject" className="text-foreground text-sm font-medium">
            {isFrench ? "Sujet" : "Subject"} <span className="text-destructive">*</span>
          </Label>
          <select
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
          >
            <option value="">{isFrench ? "Sélectionnez un sujet" : "Select a subject"}</option>
            {SUBJECT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {isFrench ? option.labelFr : option.labelEn}
              </option>
            ))}
          </select>
          {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
        </div>

        {/* Message */}
        <div className="space-y-2">
          <Label htmlFor="message" className="text-foreground flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            {isFrench ? "Message" : "Message"} <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="message"
            name="message"
            placeholder={isFrench ? "Décrivez votre demande en détail..." : "Describe your request in detail..."}
            value={formData.message}
            onChange={handleChange}
            rows={4}
            maxLength={2000}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-accent focus:ring-accent/30 resize-none"
          />
          <div className="flex justify-between">
            {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
            <p className="text-xs text-muted-foreground ml-auto">{formData.message.length}/2000</p>
          </div>
        </div>

        {/* Optional Address Section */}
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setShowAddress(!showAddress)}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
          >
            <MapPin className="w-4 h-4" />
            {isFrench ? "Adresse (optionnel)" : "Address (optional)"}
            {showAddress ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {showAddress && (
            <div className="mt-4 space-y-4 animate-in slide-in-from-top-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="addressStreet" className="text-slate-900 font-medium text-sm">
                    {isFrench ? "Adresse (rue)" : "Street Address"}
                  </Label>
                  <AddressAutocomplete
                    value={formData.addressStreet}
                    onValueChange={(value) => setFormData({ ...formData, addressStreet: value })}
                    onSelect={(details: AddressValue) => {
                      setFormData({
                        ...formData,
                        addressStreet: details.line1,
                        addressCity: details.city || formData.addressCity,
                        addressProvince: details.region || "QC",
                        addressPostalCode: details.postalCode || formData.addressPostalCode,
                      });
                    }}
                    placeholder={isFrench ? "Rechercher une adresse..." : "Search for an address..."}
                    restrictToQuebec={true}
                    className="bg-background border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-accent focus:ring-accent/30 h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressApartment" className="text-slate-900 font-medium text-sm flex items-center gap-2">
                    <Building className="w-4 h-4 text-slate-500" />
                    {isFrench ? "Appartement / Unité" : "Apt / Unit"}
                  </Label>
                  <Input
                    id="addressApartment"
                    name="addressApartment"
                    placeholder="Apt 4B"
                    value={formData.addressApartment}
                    onChange={handleChange}
                    className="bg-background border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-accent focus:ring-accent/30 h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressCity" className="text-slate-900 font-medium text-sm">
                    {isFrench ? "Ville" : "City"}
                  </Label>
                  <Input
                    id="addressCity"
                    name="addressCity"
                    placeholder="Montréal"
                    value={formData.addressCity}
                    onChange={handleChange}
                    className="bg-background border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-accent focus:ring-accent/30 h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressProvince" className="text-slate-900 font-medium text-sm">
                    {isFrench ? "Province" : "Province"}
                  </Label>
                  <select
                    id="addressProvince"
                    name="addressProvince"
                    value={formData.addressProvince}
                    onChange={handleChange}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-background text-slate-900 focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
                  >
                    <option value="QC">Québec</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressPostalCode" className="text-slate-900 font-medium text-sm">
                    {isFrench ? "Code postal" : "Postal Code"}
                  </Label>
                  <Input
                    id="addressPostalCode"
                    name="addressPostalCode"
                    placeholder="H2X 1Y4"
                    value={formData.addressPostalCode}
                    onChange={handleChange}
                    maxLength={7}
                    className="bg-background border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-accent focus:ring-accent/30 h-11"
                  />
                  {errors.addressPostalCode && <p className="text-sm text-destructive">{errors.addressPostalCode}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preferred Contact Method */}
        <div className="space-y-3">
          <Label className="text-slate-900 font-medium text-sm">
            {isFrench ? "Méthode de contact préférée" : "Preferred Contact Method"}
          </Label>
          <div className="flex gap-6">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="preferredContact"
                value="email"
                checked={formData.preferredContact === "email"}
                onChange={handleChange}
                className="w-4 h-4 accent-accent"
              />
              <span className="text-slate-700 text-sm">{isFrench ? "Courriel" : "Email"}</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="preferredContact"
                value="phone"
                checked={formData.preferredContact === "phone"}
                onChange={handleChange}
                className="w-4 h-4 accent-accent"
              />
              <span className="text-slate-700 text-sm">{isFrench ? "Téléphone" : "Phone"}</span>
            </label>
          </div>
        </div>

        {/* Consent Checkbox */}
        <div className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${errors.consentGiven ? 'bg-destructive/10 border border-destructive/30' : ''}`}>
          <Checkbox
            id="consentGiven"
            checked={formData.consentGiven === true}
            onCheckedChange={(v) => handleCheckboxChange("consentGiven", v === true)}
            className={`mt-1 ${errors.consentGiven ? 'border-destructive' : 'border-slate-300'} data-[state=checked]:bg-accent data-[state=checked]:border-accent`}
          />
          <div className="space-y-1">
            <Label htmlFor="consentGiven" className="text-sm text-slate-600 cursor-pointer leading-relaxed">
              {isFrench 
                ? "J'accepte d'être contacté par Nivra pour le traitement de ma demande." 
                : "I agree to be contacted by Nivra to process my request."}
              <span className="text-destructive"> *</span>
            </Label>
            {errors.consentGiven && (
              <p className="text-sm text-destructive font-medium">
                {isFrench 
                  ? "⚠️ Veuillez accepter le consentement pour envoyer le message." 
                  : "⚠️ Please accept the consent to send the message."}
              </p>
            )}
          </div>
        </div>

        {/* Security Warning */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700 leading-relaxed">
              {isFrench 
                ? "Pour votre sécurité, ne transmettez pas d'informations sensibles (NAS, carte de crédit, mots de passe, NIP complet, numéros de compte) via ce formulaire."
                : "For your security, do not share sensitive information (SIN, credit card, passwords, full PIN, account numbers) via this form."}
            </p>
          </CardContent>
        </Card>

        {/* Submit button - type="button" to prevent any form submission */}
        <Button 
          type="button"
          variant="accent" 
          size="lg" 
          className="w-full group focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-70"
          disabled={isLoading}
          onClick={handleSubmitClick}
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              {isFrench ? "Envoi en cours..." : "Sending..."}
            </>
          ) : (
            <>
              {isFrench ? "Envoyer" : "Send"}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          {isFrench 
            ? "Nous vous répondrons dans un délai de 1 jour ouvrable."
            : "We will respond within 1 business day."}
        </p>
      </div>
    </div>
  );
});

ContactForm.displayName = "ContactForm";

export default ContactForm;
