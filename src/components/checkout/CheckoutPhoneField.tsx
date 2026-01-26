import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone } from "lucide-react";

interface CheckoutPhoneFieldProps {
  isFrench: boolean;
  phone: string;
  onChange: (phone: string) => void;
  error?: string;
}

// Canadian phone format: (XXX) XXX-XXXX
export const formatCanadianPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const validateCanadianPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, "");
  // Must be exactly 10 digits and not start with 0 or 1
  if (digits.length !== 10) return false;
  if (digits[0] === "0" || digits[0] === "1") return false;
  return true;
};

export const CheckoutPhoneField = ({
  isFrench,
  phone,
  onChange,
  error,
}: CheckoutPhoneFieldProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="checkout-phone" className="flex items-center gap-2">
        <Phone className="w-4 h-4 text-cyan-500" />
        {isFrench ? "Téléphone" : "Phone Number"} <span className="text-destructive">*</span>
      </Label>
      <Input
        id="checkout-phone"
        type="tel"
        placeholder="(514) 555-1234"
        value={phone}
        onChange={(e) => onChange(formatCanadianPhone(e.target.value))}
        className={error ? "border-destructive" : ""}
        maxLength={14}
      />
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {isFrench 
          ? "Nous vous contacterons à ce numéro pour coordonner l'installation."
          : "We will contact you at this number to coordinate installation."}
      </p>
    </div>
  );
};

export default CheckoutPhoneField;
