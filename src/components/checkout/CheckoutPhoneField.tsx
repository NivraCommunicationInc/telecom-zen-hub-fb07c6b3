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
    <div className="space-y-1.5">
      <Label htmlFor="checkout-phone" className="flex items-center gap-2 text-sm font-medium text-[#1A1A2E]">
        <Phone className="w-4 h-4 text-[#0066CC]" />
        {isFrench ? "Téléphone" : "Phone Number"} <span className="text-red-600 ml-0.5">*</span>
      </Label>
      <Input
        id="checkout-phone"
        type="tel"
        placeholder="(514) 555-1234"
        value={phone}
        onChange={(e) => onChange(formatCanadianPhone(e.target.value))}
        className={`h-11 rounded-lg border-[#E5E7EB] focus-visible:border-[#0066CC] focus-visible:ring-2 focus-visible:ring-[#0066CC]/15 ${error ? "border-red-500" : ""}`}
        maxLength={14}
      />
      {error && (
        <p className="text-xs text-red-600 font-medium">{error}</p>
      )}
      <p className="text-xs text-[#6B7280]">
        {isFrench
          ? "Nous vous contacterons à ce numéro pour coordonner l'installation."
          : "We will contact you at this number to coordinate installation."}
      </p>
    </div>
  );
};

export default CheckoutPhoneField;
