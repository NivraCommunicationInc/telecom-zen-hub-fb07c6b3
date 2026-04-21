/**
 * CheckoutShippingAndActivation
 * 
 * Phase 2 of the checkout enhancement plan:
 * - Optional separate shipping address
 * - Requested activation date (ASAP or scheduled)
 * - Optional installation details (coax availability, occupancy, access notes)
 * 
 * 100% backward compatible — when nothing is filled in, behavior is unchanged.
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, CalendarIcon, Wrench, Info } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatPostalCode, validateCanadianPostalCode } from "@/lib/validation/checkoutFields";

export interface ShippingAddressData {
  shipToDifferentAddress: boolean;
  shippingFirstName: string;
  shippingLastName: string;
  shippingAddressLine: string;
  shippingApartment: string;
  shippingCity: string;
  shippingProvince: string;
  shippingPostalCode: string;
  shippingInstructions: string;
}

export interface ActivationData {
  activationPreference: "ASAP" | "SCHEDULED";
  requestedActivationDate: Date | null;
}

export interface InstallationDetailsData {
  coaxAvailable: "yes" | "no" | "unknown" | "";
  occupancyStatus: "occupied" | "vacant" | "";
  accessNotes: string;
}

interface CheckoutShippingAndActivationProps {
  shipping: ShippingAddressData;
  onShippingChange: (next: ShippingAddressData) => void;
  activation: ActivationData;
  onActivationChange: (next: ActivationData) => void;
  installationDetails: InstallationDetailsData;
  onInstallationDetailsChange: (next: InstallationDetailsData) => void;
  showInstallationDetails?: boolean;
}

const MIN_DAYS_AHEAD = 3;
const MAX_DAYS_AHEAD = 30;

export function getMinActivationDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + MIN_DAYS_AHEAD);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getMaxActivationDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + MAX_DAYS_AHEAD);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Validation helpers — exported so the parent can gate the "Continue" button */
export function validateShipping(s: ShippingAddressData): string | null {
  if (!s.shipToDifferentAddress) return null;
  if (!s.shippingFirstName.trim()) return "Prénom requis";
  if (!s.shippingLastName.trim()) return "Nom requis";
  if (!s.shippingAddressLine.trim()) return "Adresse requise";
  if (!s.shippingCity.trim()) return "Ville requise";
  if (!s.shippingProvince.trim()) return "Province requise";
  if (!validateCanadianPostalCode(s.shippingPostalCode)) return "Code postal invalide";
  return null;
}

export function validateActivation(a: ActivationData): string | null {
  if (a.activationPreference === "ASAP") return null;
  if (!a.requestedActivationDate) return "Date d'activation requise";
  const min = getMinActivationDate();
  const max = getMaxActivationDate();
  if (a.requestedActivationDate < min) return `La date doit être au minimum dans ${MIN_DAYS_AHEAD} jours`;
  if (a.requestedActivationDate > max) return `La date doit être au maximum dans ${MAX_DAYS_AHEAD} jours`;
  return null;
}

export const CheckoutShippingAndActivation = ({
  shipping,
  onShippingChange,
  activation,
  onActivationChange,
  installationDetails,
  onInstallationDetailsChange,
  showInstallationDetails = true,
}: CheckoutShippingAndActivationProps) => {
  const updateShipping = <K extends keyof ShippingAddressData>(k: K, v: ShippingAddressData[K]) =>
    onShippingChange({ ...shipping, [k]: v });
  const updateInstall = <K extends keyof InstallationDetailsData>(k: K, v: InstallationDetailsData[K]) =>
    onInstallationDetailsChange({ ...installationDetails, [k]: v });

  return (
    <div className="space-y-6">
      {/* ── Shipping address ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="w-5 h-5 text-primary" />
            Livraison de l'équipement
          </CardTitle>
          <CardDescription>
            Par défaut, l'équipement est livré à votre adresse de service.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="ship-different"
              checked={shipping.shipToDifferentAddress}
              onCheckedChange={(c) => updateShipping("shipToDifferentAddress", !!c)}
              className="mt-1"
            />
            <Label htmlFor="ship-different" className="text-sm leading-relaxed cursor-pointer">
              Livrer l'équipement à une adresse différente de l'adresse de service
            </Label>
          </div>

          {shipping.shipToDifferentAddress && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
              <div className="space-y-2">
                <Label htmlFor="ship-first-name">
                  Prénom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ship-first-name"
                  value={shipping.shippingFirstName}
                  onChange={(e) => updateShipping("shippingFirstName", e.target.value)}
                  placeholder="Prénom du destinataire"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ship-last-name">
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ship-last-name"
                  value={shipping.shippingLastName}
                  onChange={(e) => updateShipping("shippingLastName", e.target.value)}
                  placeholder="Nom du destinataire"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="ship-address">
                  Adresse (numéro + rue) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ship-address"
                  value={shipping.shippingAddressLine}
                  onChange={(e) => updateShipping("shippingAddressLine", e.target.value)}
                  placeholder="Ex: 123 Rue Saint-Laurent"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ship-apartment">Appartement / Unité</Label>
                <Input
                  id="ship-apartment"
                  value={shipping.shippingApartment}
                  onChange={(e) => updateShipping("shippingApartment", e.target.value)}
                  placeholder="Ex: Apt 4B"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ship-city">
                  Ville <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ship-city"
                  value={shipping.shippingCity}
                  onChange={(e) => updateShipping("shippingCity", e.target.value)}
                  placeholder="Ex: Montréal"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ship-province">
                  Province <span className="text-destructive">*</span>
                </Label>
                <select
                  id="ship-province"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                  value={shipping.shippingProvince}
                  onChange={(e) => updateShipping("shippingProvince", e.target.value)}
                >
                  <option value="QC">Québec</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ship-postal">
                  Code postal <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ship-postal"
                  value={shipping.shippingPostalCode}
                  onChange={(e) =>
                    updateShipping("shippingPostalCode", formatPostalCode(e.target.value))
                  }
                  placeholder="Ex: H2X 1Y4"
                  maxLength={7}
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="ship-instructions">Instructions de livraison (optionnel)</Label>
                <Textarea
                  id="ship-instructions"
                  value={shipping.shippingInstructions}
                  onChange={(e) => updateShipping("shippingInstructions", e.target.value)}
                  placeholder="Ex: Sonner à l'interphone, code d'accès 1234, laisser au concierge..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Activation date ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarIcon className="w-5 h-5 text-primary" />
            Date d'activation
          </CardTitle>
          <CardDescription>
            Choisissez la date à laquelle vous souhaitez que votre service soit activé à votre adresse.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={activation.activationPreference}
            onValueChange={(v) =>
              onActivationChange({
                ...activation,
                activationPreference: v as "ASAP" | "SCHEDULED",
                requestedActivationDate: v === "ASAP" ? null : activation.requestedActivationDate,
              })
            }
            className="space-y-2"
          >
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/40 transition-colors">
              <RadioGroupItem value="ASAP" id="act-asap" className="mt-1" />
              <Label htmlFor="act-asap" className="cursor-pointer flex-1">
                <p className="font-medium text-foreground">Le plus tôt possible</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Nous activerons votre service dès la réception et l'installation de l'équipement.
                </p>
              </Label>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/40 transition-colors">
              <RadioGroupItem value="SCHEDULED" id="act-scheduled" className="mt-1" />
              <Label htmlFor="act-scheduled" className="cursor-pointer flex-1">
                <p className="font-medium text-foreground">Choisir une date</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Idéal si vous déménagez ou souhaitez planifier l'activation.
                </p>
              </Label>
            </div>
          </RadioGroup>

          {activation.activationPreference === "SCHEDULED" && (
            <div className="space-y-2 pl-2 border-l-2 border-primary/30">
              <Label htmlFor="act-date">
                Date souhaitée <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="act-date"
                    variant="outline"
                    className={cn(
                      "w-full md:w-[260px] justify-start text-left font-normal",
                      !activation.requestedActivationDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {activation.requestedActivationDate
                      ? format(activation.requestedActivationDate, "PPP", { locale: fr })
                      : "Sélectionner une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={activation.requestedActivationDate ?? undefined}
                    onSelect={(d) =>
                      onActivationChange({
                        ...activation,
                        requestedActivationDate: d ?? null,
                      })
                    }
                    disabled={(date) => date < getMinActivationDate() || date > getMaxActivationDate()}
                    initialFocus
                    locale={fr}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                Disponible entre {MIN_DAYS_AHEAD} et {MAX_DAYS_AHEAD} jours à partir d'aujourd'hui.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Installation details (bonus) ─────────────────────────── */}
      {showInstallationDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="w-5 h-5 text-primary" />
              Informations d'installation (optionnel)
            </CardTitle>
            <CardDescription>
              Ces informations aident notre équipe à préparer votre installation et réduire les délais.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="coax">Câble coaxial disponible ?</Label>
                <Select
                  value={installationDetails.coaxAvailable || undefined}
                  onValueChange={(v) =>
                    updateInstall("coaxAvailable", v as InstallationDetailsData["coaxAvailable"])
                  }
                >
                  <SelectTrigger id="coax">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Oui, déjà installé</SelectItem>
                    <SelectItem value="no">Non</SelectItem>
                    <SelectItem value="unknown">Je ne sais pas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="occupancy">Statut du logement</Label>
                <Select
                  value={installationDetails.occupancyStatus || undefined}
                  onValueChange={(v) =>
                    updateInstall("occupancyStatus", v as InstallationDetailsData["occupancyStatus"])
                  }
                >
                  <SelectTrigger id="occupancy">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="occupied">Occupé</SelectItem>
                    <SelectItem value="vacant">Vacant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="access-notes">Notes d'accès</Label>
              <Textarea
                id="access-notes"
                value={installationDetails.accessNotes}
                onChange={(e) => updateInstall("accessNotes", e.target.value)}
                placeholder="Ex: Code d'interphone, étage, contraintes d'horaires, animaux, stationnement..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export const DEFAULT_SHIPPING: ShippingAddressData = {
  shipToDifferentAddress: false,
  shippingFirstName: "",
  shippingLastName: "",
  shippingAddressLine: "",
  shippingApartment: "",
  shippingCity: "",
  shippingProvince: "QC",
  shippingPostalCode: "",
  shippingInstructions: "",
};

export const DEFAULT_ACTIVATION: ActivationData = {
  activationPreference: "ASAP",
  requestedActivationDate: null,
};

export const DEFAULT_INSTALLATION_DETAILS: InstallationDetailsData = {
  coaxAvailable: "",
  occupancyStatus: "",
  accessNotes: "",
};

export default CheckoutShippingAndActivation;
