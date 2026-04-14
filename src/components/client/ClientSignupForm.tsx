import { useState, useCallback } from "react";
import HoneypotField, { isHoneypotTriggered } from "@/components/shared/HoneypotField";
import CloudflareTurnstile from "@/components/shared/CloudflareTurnstile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Loader2, User, Mail, Phone, Lock, Eye, EyeOff, Shield, MapPin 
} from "lucide-react";
import { validateCanadianPhone } from "@/components/checkout/CheckoutPhoneField";

// Format postal code: A1A 1A1
const formatPostalCode = (value: string): string => {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
};

// Canadian phone format: (XXX) XXX-XXXX
const formatCanadianPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export interface SignupFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  pin: string;
  confirmPin: string;
  serviceAddress: string;
  serviceCity: string;
  servicePostalCode: string;
}

interface ClientSignupFormProps {
  onSubmit: (data: SignupFormData) => Promise<void>;
  isLoading: boolean;
}

export const ClientSignupForm = ({ onSubmit, isLoading }: ClientSignupFormProps) => {
  const [formData, setFormData] = useState<SignupFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    pin: "",
    confirmPin: "",
    serviceAddress: "",
    serviceCity: "",
    servicePostalCode: "",
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof SignupFormData, string>>>({});
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const handleTurnstileVerify = useCallback((token: string) => setTurnstileToken(token), []);

  const handleChange = (field: keyof SignupFormData, value: string) => {
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }

    // Special handling for phone formatting
    if (field === "phone") {
      setFormData(prev => ({ ...prev, [field]: formatCanadianPhone(value) }));
      return;
    }

    // Special handling for postal code
    if (field === "servicePostalCode") {
      setFormData(prev => ({ ...prev, [field]: formatPostalCode(value) }));
      return;
    }

    // Special handling for PIN (4 digits only)
    if (field === "pin" || field === "confirmPin") {
      const sanitized = value.replace(/\D/g, "").slice(0, 4);
      setFormData(prev => ({ ...prev, [field]: sanitized }));
      return;
    }

    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof SignupFormData, string>> = {};

    // First name
    if (!formData.firstName.trim()) {
      newErrors.firstName = "Le prénom est requis";
    } else if (formData.firstName.trim().length < 2) {
      newErrors.firstName = "Le prénom doit contenir au moins 2 caractères";
    }

    // Last name
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Le nom est requis";
    } else if (formData.lastName.trim().length < 2) {
      newErrors.lastName = "Le nom doit contenir au moins 2 caractères";
    }

    // Email
    if (!formData.email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Veuillez entrer un email valide";
    }

    // Phone
    if (!formData.phone) {
      newErrors.phone = "Le numéro de téléphone est requis";
    } else if (!validateCanadianPhone(formData.phone)) {
      newErrors.phone = "Veuillez entrer un numéro canadien valide";
    }

    // Service address (required for Quebec service)
    if (!formData.serviceAddress.trim()) {
      newErrors.serviceAddress = "L'adresse de service est requise";
    }
    if (!formData.serviceCity.trim()) {
      newErrors.serviceCity = "La ville est requise";
    }
    if (!formData.servicePostalCode.trim()) {
      newErrors.servicePostalCode = "Le code postal est requis";
    } else if (!/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(formData.servicePostalCode.replace(/\s/g, ""))) {
      newErrors.servicePostalCode = "Code postal invalide (ex: H2X 1Y4)";
    }

    // Password
    if (!formData.password) {
      newErrors.password = "Le mot de passe est requis";
    } else if (formData.password.length < 8) {
      newErrors.password = "Le mot de passe doit contenir au moins 8 caractères";
    }

    // Confirm password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Veuillez confirmer votre mot de passe";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Les mots de passe ne correspondent pas";
    }

    // PIN
    if (!formData.pin) {
      newErrors.pin = "Le NIP est requis";
    } else if (formData.pin.length !== 4 || !/^\d{4}$/.test(formData.pin)) {
      newErrors.pin = "Le NIP doit être composé de 4 chiffres";
    }

    // Confirm PIN
    if (!formData.confirmPin) {
      newErrors.confirmPin = "Veuillez confirmer votre NIP";
    } else if (formData.pin !== formData.confirmPin) {
      newErrors.confirmPin = "Les NIP ne correspondent pas";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isHoneypotTriggered(honeypot)) return; // Silent reject
    if (!validate()) return;
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <HoneypotField value={honeypot} onChange={setHoneypot} />
      {/* Name Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="signup-firstName" className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-teal-600" />
            Prénom <span className="text-red-500">*</span>
          </Label>
          <Input
            id="signup-firstName"
            type="text"
            placeholder="Jean"
            value={formData.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            className={`bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20 ${errors.firstName ? "border-destructive" : ""}`}
            autoComplete="given-name"
          />
          {errors.firstName && (
            <p className="text-xs text-destructive">{errors.firstName}</p>
          )}
        </div>
        
        <div className="space-y-1.5">
          <Label htmlFor="signup-lastName" className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-teal-600" />
            Nom <span className="text-red-500">*</span>
          </Label>
          <Input
            id="signup-lastName"
            type="text"
            placeholder="Dupont"
            value={formData.lastName}
            onChange={(e) => handleChange("lastName", e.target.value)}
            className={`bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20 ${errors.lastName ? "border-destructive" : ""}`}
            autoComplete="family-name"
          />
          {errors.lastName && (
            <p className="text-xs text-destructive">{errors.lastName}</p>
          )}
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="signup-email" className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-teal-600" />
          Courriel <span className="text-red-500">*</span>
        </Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="jean.dupont@exemple.com"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          className={`bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20 ${errors.email ? "border-destructive" : ""}`}
          autoComplete="email"
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email}</p>
        )}
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <Label htmlFor="signup-phone" className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-teal-600" />
          Téléphone <span className="text-red-500">*</span>
        </Label>
        <Input
          id="signup-phone"
          type="tel"
          placeholder="(514) 555-1234"
          value={formData.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          className={`bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20 ${errors.phone ? "border-destructive" : ""}`}
          maxLength={14}
          autoComplete="tel"
        />
        {errors.phone && (
          <p className="text-xs text-destructive">{errors.phone}</p>
        )}
      </div>

      {/* Service Address Section */}
      <div className="pt-2 border-t border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-teal-600" />
          <span className="text-sm font-medium text-slate-700">Adresse de service (Québec seulement)</span>
        </div>
        
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="signup-serviceAddress" className="text-sm font-medium text-slate-700">
              Adresse <span className="text-red-500">*</span>
            </Label>
            <Input
              id="signup-serviceAddress"
              type="text"
              placeholder="123 rue Principale"
              value={formData.serviceAddress}
              onChange={(e) => handleChange("serviceAddress", e.target.value)}
              className={`bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20 ${errors.serviceAddress ? "border-destructive" : ""}`}
              autoComplete="street-address"
            />
            {errors.serviceAddress && (
              <p className="text-xs text-destructive">{errors.serviceAddress}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="signup-serviceCity" className="text-sm font-medium text-slate-700">
                Ville <span className="text-red-500">*</span>
              </Label>
              <Input
                id="signup-serviceCity"
                type="text"
                placeholder="Montréal"
                value={formData.serviceCity}
                onChange={(e) => handleChange("serviceCity", e.target.value)}
                className={`bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20 ${errors.serviceCity ? "border-destructive" : ""}`}
                autoComplete="address-level2"
              />
              {errors.serviceCity && (
                <p className="text-xs text-destructive">{errors.serviceCity}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-servicePostalCode" className="text-sm font-medium text-slate-700">
                Code postal <span className="text-red-500">*</span>
              </Label>
              <Input
                id="signup-servicePostalCode"
                type="text"
                placeholder="H2X 1Y4"
                value={formData.servicePostalCode}
                onChange={(e) => handleChange("servicePostalCode", e.target.value)}
                className={`bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20 ${errors.servicePostalCode ? "border-destructive" : ""}`}
                maxLength={7}
                autoComplete="postal-code"
              />
              {errors.servicePostalCode && (
                <p className="text-xs text-destructive">{errors.servicePostalCode}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <Label htmlFor="signup-password" className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-teal-600" />
          Mot de passe <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Input
            id="signup-password"
            type={showPassword ? "text" : "password"}
            placeholder="Minimum 8 caractères"
            value={formData.password}
            onChange={(e) => handleChange("password", e.target.value)}
            className={`pr-10 bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20 ${errors.password ? "border-destructive" : ""}`}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password}</p>
        )}
      </div>

      {/* Confirm Password */}
      <div className="space-y-1.5">
        <Label htmlFor="signup-confirmPassword" className="text-sm font-medium text-slate-700">
          Confirmer le mot de passe <span className="text-red-500">*</span>
        </Label>
        <Input
          id="signup-confirmPassword"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          value={formData.confirmPassword}
          onChange={(e) => handleChange("confirmPassword", e.target.value)}
          className={`bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20 ${errors.confirmPassword ? "border-destructive" : ""}`}
          autoComplete="new-password"
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">{errors.confirmPassword}</p>
        )}
      </div>

      {/* PIN Section */}
      <div className="pt-2 border-t border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-teal-600" />
          <span className="text-sm font-medium text-slate-700">NIP de sécurité (4 chiffres)</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Ce NIP sera utilisé pour valider votre identité lors d'appels au service client.
        </p>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="signup-pin" className="text-sm font-medium text-slate-700">
              NIP <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="signup-pin"
                type={showPin ? "text" : "password"}
                placeholder="••••"
                value={formData.pin}
                onChange={(e) => handleChange("pin", e.target.value)}
                className={`text-center tracking-widest bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20 ${errors.pin ? "border-destructive" : ""}`}
                maxLength={4}
                inputMode="numeric"
                pattern="\d{4}"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {errors.pin && (
              <p className="text-xs text-destructive">{errors.pin}</p>
            )}
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="signup-confirmPin" className="text-sm font-medium text-slate-700">
              Confirmer <span className="text-red-500">*</span>
            </Label>
            <Input
              id="signup-confirmPin"
              type={showPin ? "text" : "password"}
              placeholder="••••"
              value={formData.confirmPin}
              onChange={(e) => handleChange("confirmPin", e.target.value)}
              className={`text-center tracking-widest bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20 ${errors.confirmPin ? "border-destructive" : ""}`}
              maxLength={4}
              inputMode="numeric"
              pattern="\d{4}"
            />
            {errors.confirmPin && (
              <p className="text-xs text-destructive">{errors.confirmPin}</p>
            )}
          </div>
        </div>
      </div>

      {/* Anti-bot */}
      <CloudflareTurnstile onVerify={handleTurnstileVerify} className="flex justify-center" />

      {/* Submit Button */}
      <Button 
        type="submit" 
        className="w-full mt-6 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold shadow-lg shadow-teal-500/25" 
        disabled={isLoading}
        size="lg"
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Créer mon compte
      </Button>

      <p className="text-xs text-center text-slate-500">
        En créant un compte, vous acceptez nos{" "}
        <a href="/conditions-de-service" className="text-teal-600 hover:underline">
          conditions d'utilisation
        </a>{" "}
        et notre{" "}
        <a href="/politique-de-confidentialite" className="text-teal-600 hover:underline">
          politique de confidentialité
        </a>
        .
      </p>
    </form>
  );
};

export default ClientSignupForm;
