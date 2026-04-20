import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone } from "lucide-react";
// Re-export validators from the canonical location so existing imports keep working.
import { formatCanadianPhone, validateCanadianPhone } from "@/lib/validation/checkoutFields";
export { formatCanadianPhone, validateCanadianPhone };

interface CheckoutPhoneFieldProps {
  isFrench: boolean;
  phone: string;
  onChange: (phone: string) => void;
  error?: string;
}

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
