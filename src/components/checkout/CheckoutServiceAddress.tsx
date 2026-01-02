import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapPin, Home, Building, Mail } from "lucide-react";

interface ServiceAddress {
  address: string;
  apartment: string;
  city: string;
  province: string;
  postalCode: string;
}

interface CheckoutServiceAddressProps {
  address: ServiceAddress;
  onChange: (field: keyof ServiceAddress, value: string) => void;
  errors?: Partial<Record<keyof ServiceAddress, string>>;
}

// Canadian postal code format validation: A1A 1A1
export const validateCanadianPostalCode = (postalCode: string): boolean => {
  const cleanedCode = postalCode.replace(/\s/g, "").toUpperCase();
  const postalCodeRegex = /^[A-Z]\d[A-Z]\d[A-Z]\d$/;
  return postalCodeRegex.test(cleanedCode);
};

// Format postal code as A1A 1A1
export const formatPostalCode = (value: string): string => {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
};

export const isAddressComplete = (address: ServiceAddress): boolean => {
  return !!(
    address.address.trim() &&
    address.city.trim() &&
    address.province.trim() &&
    validateCanadianPostalCode(address.postalCode)
  );
};

export const CheckoutServiceAddress = ({
  address,
  onChange,
  errors = {},
}: CheckoutServiceAddressProps) => {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-cyan-500" />
          Adresse de service
        </CardTitle>
        <CardDescription>
          L'adresse où les services seront installés et l'équipement livré
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="service-address" className="flex items-center gap-2">
              <Home className="w-4 h-4 text-muted-foreground" />
              Adresse (numéro + rue) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="service-address"
              placeholder="Ex: 123 Rue Saint-Laurent"
              value={address.address}
              onChange={(e) => onChange("address", e.target.value)}
              className={errors.address ? "border-destructive" : ""}
            />
            {errors.address && (
              <p className="text-xs text-destructive">{errors.address}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-apartment" className="flex items-center gap-2">
              <Building className="w-4 h-4 text-muted-foreground" />
              Appartement / Unité
            </Label>
            <Input
              id="service-apartment"
              placeholder="Ex: Apt 4B"
              value={address.apartment}
              onChange={(e) => onChange("apartment", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-city">
              Ville <span className="text-destructive">*</span>
            </Label>
            <Input
              id="service-city"
              placeholder="Ex: Montréal"
              value={address.city}
              onChange={(e) => onChange("city", e.target.value)}
              className={errors.city ? "border-destructive" : ""}
            />
            {errors.city && (
              <p className="text-xs text-destructive">{errors.city}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-province">
              Province <span className="text-destructive">*</span>
            </Label>
            <select
              id="service-province"
              className={`w-full h-10 px-3 rounded-md border bg-background text-foreground ${
                errors.province ? "border-destructive" : "border-input"
              }`}
              value={address.province}
              onChange={(e) => onChange("province", e.target.value)}
            >
              <option value="QC">Québec</option>
            </select>
            {errors.province && (
              <p className="text-xs text-destructive">{errors.province}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Services disponibles au Québec uniquement
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-postal-code" className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              Code postal <span className="text-destructive">*</span>
            </Label>
            <Input
              id="service-postal-code"
              placeholder="Ex: H2X 1Y4"
              value={address.postalCode}
              onChange={(e) => onChange("postalCode", formatPostalCode(e.target.value))}
              className={errors.postalCode ? "border-destructive" : ""}
              maxLength={7}
            />
            {errors.postalCode && (
              <p className="text-xs text-destructive">{errors.postalCode}</p>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          Taxes calculées selon l'adresse de service (TPS 5% + TVQ 9.975% pour le Québec).
        </p>
      </CardContent>
    </Card>
  );
};

export default CheckoutServiceAddress;
