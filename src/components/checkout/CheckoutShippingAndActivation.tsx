/**
 * CheckoutShippingAndActivation — Nivra checkout aesthetic
 *
 * Three optional blocks, each wrapped in the same white/blue Nivra card shell:
 *   1. Livraison de l'équipement (optional alt shipping address)
 *   2. Date d'activation
 *   3. Informations d'installation (optional)
 *
 * 100% backward compatible — same public API, same validators, same defaults.
 */
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, CalendarIcon, Wrench, Info, Cable, X, HelpCircle, Home, DoorClosed, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
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
  /** When false, hides the "Livraison" + "Date d'activation" cards (used to split the step). Default true. */
  showShippingActivation?: boolean;
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

export function validateShipping(s: ShippingAddressData): string | null {
  if (!s.shipToDifferentAddress) return null;
  if (!s.shippingFirstName.trim()) return "Prénom requis";
  if (!s.shippingLastName.trim())  return "Nom requis";
  if (!s.shippingAddressLine.trim()) return "Adresse requise";
  if (!s.shippingCity.trim())      return "Ville requise";
  if (!s.shippingProvince.trim())  return "Province requise";
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

/** Nivra checkout card shell — identical to InstallationSection / CheckoutSection */
const NivraCard = ({
  title, description, icon: Icon, children,
}: { title: string; description?: string; icon: LucideIcon; children: ReactNode }) => (
  <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
    <div className="px-5 sm:px-6 py-4 border-b border-[#E5E7EB]" style={{ background: '#F0F6FC' }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#0066CC]/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-[#0066CC]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-[#1A1A2E] leading-tight">{title}</h3>
          {description && (
            <p className="text-sm text-[#6B7280] mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
    </div>
    <div className="p-5 sm:p-6 space-y-4">{children}</div>
  </div>
);

const FieldLabel = ({ htmlFor, children, required }: { htmlFor: string; children: ReactNode; required?: boolean }) => (
  <Label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5 block">
    {children}{required && <span className="text-[#D93025] ml-0.5">*</span>}
  </Label>
);

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
      {/* ── Shipping address ─────────────────────────────────────── */}
      <NivraCard
        title="Livraison de l'équipement"
        description="Par défaut, l'équipement est livré à votre adresse de service."
        icon={Truck}
      >
        <label className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E7EB] bg-[#F5F7FA] cursor-pointer hover:border-[#0066CC]/40 transition-colors">
          <Checkbox
            id="ship-different"
            checked={shipping.shipToDifferentAddress}
            onCheckedChange={(c) => updateShipping("shipToDifferentAddress", !!c)}
            className="mt-0.5 border-[#0066CC] data-[state=checked]:bg-[#0066CC] data-[state=checked]:border-[#0066CC]"
          />
          <span className="text-sm leading-relaxed text-[#1A1A2E]">
            Livrer l'équipement à une adresse différente de l'adresse de service
          </span>
        </label>

        {shipping.shipToDifferentAddress && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <FieldLabel htmlFor="ship-first-name" required>Prénom</FieldLabel>
              <Input id="ship-first-name" value={shipping.shippingFirstName}
                onChange={(e) => updateShipping("shippingFirstName", e.target.value)}
                placeholder="Prénom du destinataire" />
            </div>
            <div>
              <FieldLabel htmlFor="ship-last-name" required>Nom</FieldLabel>
              <Input id="ship-last-name" value={shipping.shippingLastName}
                onChange={(e) => updateShipping("shippingLastName", e.target.value)}
                placeholder="Nom du destinataire" />
            </div>

            <div className="md:col-span-2">
              <FieldLabel htmlFor="ship-address" required>Adresse (numéro + rue)</FieldLabel>
              <Input id="ship-address" value={shipping.shippingAddressLine}
                onChange={(e) => updateShipping("shippingAddressLine", e.target.value)}
                placeholder="Ex: 123 Rue Saint-Laurent" />
            </div>

            <div>
              <FieldLabel htmlFor="ship-apartment">Appartement / Unité</FieldLabel>
              <Input id="ship-apartment" value={shipping.shippingApartment}
                onChange={(e) => updateShipping("shippingApartment", e.target.value)}
                placeholder="Ex: Apt 4B" />
            </div>

            <div>
              <FieldLabel htmlFor="ship-city" required>Ville</FieldLabel>
              <Input id="ship-city" value={shipping.shippingCity}
                onChange={(e) => updateShipping("shippingCity", e.target.value)}
                placeholder="Ex: Montréal" />
            </div>

            <div>
              <FieldLabel htmlFor="ship-province" required>Province</FieldLabel>
              <select
                id="ship-province"
                className="w-full h-10 px-3 rounded-md border border-[#E5E7EB] bg-white text-[#1A1A2E] text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]/40 focus:border-[#0066CC]"
                value={shipping.shippingProvince}
                onChange={(e) => updateShipping("shippingProvince", e.target.value)}
              >
                <option value="QC">Québec</option>
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="ship-postal" required>Code postal</FieldLabel>
              <Input id="ship-postal" value={shipping.shippingPostalCode}
                onChange={(e) => updateShipping("shippingPostalCode", formatPostalCode(e.target.value))}
                placeholder="Ex: H2X 1Y4" maxLength={7} />
            </div>

            <div className="md:col-span-2">
              <FieldLabel htmlFor="ship-instructions">Instructions de livraison (optionnel)</FieldLabel>
              <Textarea id="ship-instructions" value={shipping.shippingInstructions}
                onChange={(e) => updateShipping("shippingInstructions", e.target.value)}
                placeholder="Ex: Sonner à l'interphone, code d'accès 1234, laisser au concierge..."
                rows={3} />
            </div>
          </div>
        )}
      </NivraCard>

      {/* ── Activation date ─────────────────────────────────────── */}
      <NivraCard
        title="Date d'activation"
        description="Choisissez quand vous souhaitez que votre service soit activé."
        icon={CalendarIcon}
      >
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
          {[
            { v: "ASAP", title: "Le plus tôt possible", sub: "Nous activerons votre service dès la réception et l'installation de l'équipement." },
            { v: "SCHEDULED", title: "Choisir une date", sub: "Idéal si vous déménagez ou souhaitez planifier l'activation." },
          ].map(opt => {
            const selected = activation.activationPreference === opt.v;
            return (
              <label
                key={opt.v}
                htmlFor={`act-${opt.v}`}
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  selected ? "border-[#0066CC] bg-[#0066CC]/[0.04]" : "border-[#E5E7EB] bg-white hover:border-[#0066CC]/40"
                }`}
              >
                <RadioGroupItem
                  value={opt.v}
                  id={`act-${opt.v}`}
                  className="mt-0.5 border-[#0066CC] text-[#0066CC]"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#1A1A2E]">{opt.title}</p>
                  <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">{opt.sub}</p>
                </div>
              </label>
            );
          })}
        </RadioGroup>

        {activation.activationPreference === "SCHEDULED" && (
          <div className="space-y-2 pl-3 border-l-2 border-[#0066CC]/40 ml-1">
            <FieldLabel htmlFor="act-date" required>Date souhaitée</FieldLabel>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="act-date"
                  variant="outline"
                  className={cn(
                    "w-full md:w-[280px] justify-start text-left font-normal border-[#E5E7EB] hover:border-[#0066CC] hover:bg-[#0066CC]/5",
                    !activation.requestedActivationDate && "text-[#6B7280]"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-[#0066CC]" />
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
                    onActivationChange({ ...activation, requestedActivationDate: d ?? null })
                  }
                  disabled={(date) => date < getMinActivationDate() || date > getMaxActivationDate()}
                  initialFocus
                  locale={fr}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-[#6B7280] flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#0066CC]" />
              Disponible entre {MIN_DAYS_AHEAD} et {MAX_DAYS_AHEAD} jours à partir d'aujourd'hui.
            </p>
          </div>
        )}
      </NivraCard>

      {/* ── Installation details (optional bonus) ───────────────── */}
      {showInstallationDetails && (
        <NivraCard
          title="Informations d'installation (optionnel)"
          description="Ces informations aident notre équipe à préparer votre installation et réduire les délais."
          icon={Wrench}
        >
          {/* Câble coaxial */}
          <div>
            <FieldLabel htmlFor="coax">Câble coaxial disponible ?</FieldLabel>
            <div id="coax" className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { v: "yes", label: "Oui", Icon: Check, tint: "#00A651" },
                { v: "no", label: "Non", Icon: X, tint: "#D93025" },
                { v: "unknown", label: "Je ne sais pas", Icon: HelpCircle, tint: "#6B7280" },
              ].map(({ v, label, Icon, tint }) => {
                const selected = installationDetails.coaxAvailable === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => updateInstall("coaxAvailable", v as InstallationDetailsData["coaxAvailable"])}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 text-sm font-semibold transition-all min-h-[80px]",
                      selected
                        ? "border-[#0066CC] bg-[#0066CC] text-white shadow-sm"
                        : "border-[#E5E7EB] bg-white text-[#1A1A2E] hover:border-[#0066CC]/50 hover:bg-[#0066CC]/[0.03]"
                    )}
                  >
                    <Icon className="w-5 h-5" style={{ color: selected ? "#fff" : tint }} />
                    <span className="text-xs sm:text-sm text-center leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Statut du logement */}
          <div>
            <FieldLabel htmlFor="occupancy">Statut du logement</FieldLabel>
            <div id="occupancy" className="grid grid-cols-2 gap-2 sm:gap-3">
              {[
                { v: "occupied", label: "Occupé", Icon: Home, desc: "Vous ou un occupant sera présent" },
                { v: "vacant", label: "Vacant", Icon: DoorClosed, desc: "Logement inoccupé" },
              ].map(({ v, label, Icon, desc }) => {
                const selected = installationDetails.occupancyStatus === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => updateInstall("occupancyStatus", v as InstallationDetailsData["occupancyStatus"])}
                    className={cn(
                      "flex flex-col items-start gap-1.5 p-3.5 rounded-xl border-2 text-left transition-all",
                      selected
                        ? "border-[#0066CC] bg-[#0066CC] text-white shadow-sm"
                        : "border-[#E5E7EB] bg-white text-[#1A1A2E] hover:border-[#0066CC]/50 hover:bg-[#0066CC]/[0.03]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-semibold">{label}</span>
                    </div>
                    <span className={cn("text-[11px] leading-tight", selected ? "text-white/85" : "text-[#6B7280]")}>{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="access-notes">Notes d'accès</FieldLabel>
            <Textarea
              id="access-notes"
              value={installationDetails.accessNotes}
              onChange={(e) => updateInstall("accessNotes", e.target.value)}
              placeholder="Ex: Code d'interphone, étage, contraintes d'horaires, animaux, stationnement..."
              rows={3}
            />
          </div>
        </NivraCard>
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
