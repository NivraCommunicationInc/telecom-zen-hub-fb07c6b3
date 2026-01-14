import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Loader2, User, Mail, Phone, Lock, Eye, EyeOff 
} from "lucide-react";

// Canadian phone format: (XXX) XXX-XXXX
const formatCanadianPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const validateCanadianPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return false;
  if (digits[0] === "0" || digits[0] === "1") return false;
  return true;
};

export interface PartnerSignupFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

interface PartnerSignupFormProps {
  onSubmit: (data: PartnerSignupFormData) => Promise<void>;
  isLoading: boolean;
}

export const PartnerSignupForm = ({ onSubmit, isLoading }: PartnerSignupFormProps) => {
  const [formData, setFormData] = useState<PartnerSignupFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof PartnerSignupFormData, string>>>({});

  const handleChange = (field: keyof PartnerSignupFormData, value: string | boolean) => {
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }

    // Special handling for phone formatting
    if (field === "phone" && typeof value === "string") {
      setFormData(prev => ({ ...prev, [field]: formatCanadianPhone(value) }));
      return;
    }

    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof PartnerSignupFormData, string>> = {};

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

    // Terms
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = "Vous devez accepter les conditions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="partner-firstName" className="text-sm font-medium flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-primary" />
            Prénom <span className="text-destructive">*</span>
          </Label>
          <Input
            id="partner-firstName"
            type="text"
            placeholder="Jean"
            value={formData.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            className={errors.firstName ? "border-destructive" : ""}
            autoComplete="given-name"
          />
          {errors.firstName && (
            <p className="text-xs text-destructive">{errors.firstName}</p>
          )}
        </div>
        
        <div className="space-y-1.5">
          <Label htmlFor="partner-lastName" className="text-sm font-medium flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-primary" />
            Nom <span className="text-destructive">*</span>
          </Label>
          <Input
            id="partner-lastName"
            type="text"
            placeholder="Dupont"
            value={formData.lastName}
            onChange={(e) => handleChange("lastName", e.target.value)}
            className={errors.lastName ? "border-destructive" : ""}
            autoComplete="family-name"
          />
          {errors.lastName && (
            <p className="text-xs text-destructive">{errors.lastName}</p>
          )}
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="partner-email" className="text-sm font-medium flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-primary" />
          Courriel <span className="text-destructive">*</span>
        </Label>
        <Input
          id="partner-email"
          type="email"
          placeholder="jean.dupont@exemple.com"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
          className={errors.email ? "border-destructive" : ""}
          autoComplete="email"
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email}</p>
        )}
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <Label htmlFor="partner-phone" className="text-sm font-medium flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-primary" />
          Téléphone <span className="text-destructive">*</span>
        </Label>
        <Input
          id="partner-phone"
          type="tel"
          placeholder="(514) 555-1234"
          value={formData.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          className={errors.phone ? "border-destructive" : ""}
          maxLength={14}
          autoComplete="tel"
        />
        {errors.phone && (
          <p className="text-xs text-destructive">{errors.phone}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <Label htmlFor="partner-password" className="text-sm font-medium flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-primary" />
          Mot de passe <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            id="partner-password"
            type={showPassword ? "text" : "password"}
            placeholder="Minimum 8 caractères"
            value={formData.password}
            onChange={(e) => handleChange("password", e.target.value)}
            className={`pr-10 ${errors.password ? "border-destructive" : ""}`}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
        <Label htmlFor="partner-confirmPassword" className="text-sm font-medium">
          Confirmer le mot de passe <span className="text-destructive">*</span>
        </Label>
        <Input
          id="partner-confirmPassword"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          value={formData.confirmPassword}
          onChange={(e) => handleChange("confirmPassword", e.target.value)}
          className={errors.confirmPassword ? "border-destructive" : ""}
          autoComplete="new-password"
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">{errors.confirmPassword}</p>
        )}
      </div>

      {/* Terms Checkbox */}
      <div className="flex items-start space-x-2 pt-2">
        <Checkbox
          id="partner-terms"
          checked={formData.acceptTerms}
          onCheckedChange={(checked) => handleChange("acceptTerms", checked as boolean)}
          className={errors.acceptTerms ? "border-destructive" : ""}
        />
        <div className="grid gap-1.5 leading-none">
          <Label htmlFor="partner-terms" className="text-sm leading-tight cursor-pointer">
            J'accepte les{" "}
            <a href="/conditions-de-service" target="_blank" className="text-primary hover:underline">
              conditions d'utilisation
            </a>{" "}
            et la{" "}
            <a href="/politique-de-confidentialite" target="_blank" className="text-primary hover:underline">
              politique de confidentialité
            </a>
          </Label>
          {errors.acceptTerms && (
            <p className="text-xs text-destructive">{errors.acceptTerms}</p>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <Button 
        type="submit" 
        className="w-full mt-4" 
        variant="hero" 
        disabled={isLoading}
        size="lg"
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Créer mon compte partenaire
      </Button>
    </form>
  );
};

export default PartnerSignupForm;
