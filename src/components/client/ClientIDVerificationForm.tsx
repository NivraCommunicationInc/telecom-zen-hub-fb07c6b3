import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, User, Calendar, CreditCard, MapPin, AlertCircle } from "lucide-react";
import { PortalAddressAutocomplete } from "@/components/client/PortalAddressAutocomplete";
import { validateDob, getMaxDobDate, MIN_AGE_TELECOM } from "@/lib/validation/dob";

const CANADIAN_PROVINCES = [
  { code: "AB", name: { fr: "Alberta", en: "Alberta" } },
  { code: "BC", name: { fr: "Colombie-Britannique", en: "British Columbia" } },
  { code: "MB", name: { fr: "Manitoba", en: "Manitoba" } },
  { code: "NB", name: { fr: "Nouveau-Brunswick", en: "New Brunswick" } },
  { code: "NL", name: { fr: "Terre-Neuve-et-Labrador", en: "Newfoundland and Labrador" } },
  { code: "NS", name: { fr: "Nouvelle-Écosse", en: "Nova Scotia" } },
  { code: "NT", name: { fr: "Territoires du Nord-Ouest", en: "Northwest Territories" } },
  { code: "NU", name: { fr: "Nunavut", en: "Nunavut" } },
  { code: "ON", name: { fr: "Ontario", en: "Ontario" } },
  { code: "PE", name: { fr: "Île-du-Prince-Édouard", en: "Prince Edward Island" } },
  { code: "QC", name: { fr: "Québec", en: "Quebec" } },
  { code: "SK", name: { fr: "Saskatchewan", en: "Saskatchewan" } },
  { code: "YT", name: { fr: "Yukon", en: "Yukon" } },
];

const ID_TYPES = [
  { value: "drivers_license", label: { fr: "Permis de conduire", en: "Driver's License" } },
  { value: "health_card", label: { fr: "Carte d'assurance maladie", en: "Health Card" } },
  { value: "passport", label: { fr: "Passeport", en: "Passport" } },
  { value: "residency_card", label: { fr: "Carte de résident permanent", en: "Residency Card" } },
];

export interface ClientIDData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  serviceAddress: string;
  serviceCity: string;
  serviceProvince: string;
  servicePostalCode: string;
  idType: string;
  idNumber: string;
  idExpiration: string;
  idProvince: string;
}

interface ClientIDVerificationFormProps {
  isFrench: boolean;
  data: ClientIDData;
  onChange: (data: ClientIDData) => void;
  showServiceAddress?: boolean;
  onAddressValidated?: (isValid: boolean, isQuebec: boolean) => void;
  existingProfile?: {
    full_name?: string;
    email?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    service_address?: string;
    service_city?: string;
    service_province?: string;
    service_postal_code?: string;
    id_type?: string;
    id_number?: string;
    id_expiration?: string;
    id_province?: string;
  } | null;
}

export const ClientIDVerificationForm = ({
  isFrench,
  data,
  onChange,
  showServiceAddress = true,
  onAddressValidated,
  existingProfile
}: ClientIDVerificationFormProps) => {
  // Check if ID info is missing from existing profile
  const idInfoMissing = existingProfile && (
    !existingProfile.date_of_birth ||
    !existingProfile.id_type ||
    !existingProfile.id_number ||
    !existingProfile.id_expiration ||
    !existingProfile.id_province
  );

  const updateField = <K extends keyof ClientIDData>(field: K, value: ClientIDData[K]) => {
    onChange({ ...data, [field]: value });
  };

  const handleAddressSelect = (details: {
    formattedAddress: string;
    city?: string;
    province?: string;
    postalCode?: string;
  }) => {
    const postalCode = details.postalCode || "";
    const province = details.province || "";
    
    const isQuebecPostal = /^[GHJ]/i.test(postalCode);
    const isQuebecProvince = province.toUpperCase().includes("QC") || province.toUpperCase().includes("QUEBEC");
    const isQuebec = isQuebecPostal || isQuebecProvince;
    
    onChange({
      ...data,
      serviceAddress: details.formattedAddress,
      serviceCity: details.city || "",
      serviceProvince: isQuebec ? "QC" : province,
      servicePostalCode: postalCode
    });
    
    onAddressValidated?.(true, isQuebec);
  };

  // Get max DOB date using centralized validation (minimum 13 years - legal requirement for telecom in Quebec)
  const maxDOBString = getMaxDobDate(MIN_AGE_TELECOM);

  // Min expiration date is today
  const minExpiration = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* ID Info Missing Notice for Existing Users */}
      {idInfoMissing && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="py-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {isFrench ? "Informations requises" : "Information Required"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isFrench 
                  ? "Veuillez compléter vos informations d'identité pour continuer avec cette commande."
                  : "Please complete your identity information to proceed with this order."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personal Information */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5 text-cyan-500" />
            {isFrench ? "Informations personnelles" : "Personal Information"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isFrench ? "Prénom *" : "First Name *"}</Label>
              <Input
                value={data.firstName}
                onChange={(e) => updateField("firstName", e.target.value)}
                placeholder={isFrench ? "Jean" : "John"}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{isFrench ? "Nom *" : "Last Name *"}</Label>
              <Input
                value={data.lastName}
                onChange={(e) => updateField("lastName", e.target.value)}
                placeholder={isFrench ? "Tremblay" : "Smith"}
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isFrench ? "Courriel *" : "Email *"}</Label>
              <Input
                type="email"
                value={data.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="email@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{isFrench ? "Téléphone *" : "Phone *"}</Label>
              <Input
                type="tel"
                value={data.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="(514) 555-0123"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {isFrench ? "Date de naissance *" : "Date of Birth *"}
            </Label>
            <Input
              type="date"
              value={data.dateOfBirth}
              onChange={(e) => updateField("dateOfBirth", e.target.value)}
              max={maxDOBString}
              required
              className="w-full md:w-1/2"
            />
            <p className="text-xs text-muted-foreground">
              {isFrench ? "Vous devez avoir au moins 13 ans" : "You must be at least 13 years old"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Service Address */}
      {showServiceAddress && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="w-5 h-5 text-cyan-500" />
              {isFrench ? "Adresse de service" : "Service Address"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{isFrench ? "Adresse complète (Québec seulement) *" : "Full Address (Quebec only) *"}</Label>
              <PortalAddressAutocomplete
                value={data.serviceAddress}
                onChange={(value) => updateField("serviceAddress", value)}
                onAddressSelect={handleAddressSelect}
                placeholder={isFrench ? "123 rue Exemple, Montréal, QC H2X 1Y4" : "123 Example St, Montreal, QC H2X 1Y4"}
                restrictToQuebec={true}
              />
            </div>
            
            <Card className="bg-amber-500/10 border-amber-500/30">
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">
                  {isFrench 
                    ? "⚠️ Nos services sont disponibles uniquement au Québec."
                    : "⚠️ Our services are only available in Quebec."}
                </p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}

      {/* ID Verification */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="w-5 h-5 text-cyan-500" />
            {isFrench ? "Pièce d'identité" : "Government ID"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Card className="bg-accent/30 border-accent/50">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">
                <Shield className="w-3 h-3 inline mr-1" />
                {isFrench 
                  ? "Aucune vérification de crédit n'est effectuée. Nous collectons ces informations uniquement pour valider votre identité."
                  : "No credit check is performed. We collect this information only to validate your identity."}
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isFrench ? "Type de pièce d'identité *" : "ID Type *"}</Label>
              <Select value={data.idType} onValueChange={(value) => updateField("idType", value)}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={isFrench ? "Sélectionner" : "Select"} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border z-50">
                  {ID_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {isFrench ? type.label.fr : type.label.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>{isFrench ? "Numéro de pièce d'identité *" : "ID Number *"}</Label>
              <Input
                value={data.idNumber}
                onChange={(e) => updateField("idNumber", e.target.value)}
                placeholder={isFrench ? "Numéro sur votre pièce" : "Number on your ID"}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isFrench ? "Date d'expiration *" : "Expiration Date *"}</Label>
              <Input
                type="date"
                value={data.idExpiration}
                onChange={(e) => updateField("idExpiration", e.target.value)}
                min={minExpiration}
                required
              />
              <p className="text-xs text-muted-foreground">
                {isFrench ? "La pièce ne doit pas être expirée" : "ID must not be expired"}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>{isFrench ? "Province d'émission *" : "Province of Issue *"}</Label>
              <Select value={data.idProvince} onValueChange={(value) => updateField("idProvince", value)}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={isFrench ? "Sélectionner" : "Select"} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border z-50">
                  {CANADIAN_PROVINCES.map((prov) => (
                    <SelectItem key={prov.code} value={prov.code}>
                      {isFrench ? prov.name.fr : prov.name.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const validateIDData = (data: ClientIDData, requireAddress: boolean = true): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.firstName?.trim()) errors.push("First name is required");
  if (!data.lastName?.trim()) errors.push("Last name is required");
  if (!data.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push("Valid email is required");
  if (!data.phone?.trim()) errors.push("Phone number is required");
  if (!data.dateOfBirth) errors.push("Date of birth is required");
  
  if (requireAddress) {
    if (!data.serviceAddress?.trim()) errors.push("Service address is required");
  }
  
  if (!data.idType) errors.push("ID type is required");
  if (!data.idNumber?.trim()) errors.push("ID number is required");
  if (!data.idExpiration) errors.push("ID expiration date is required");
  if (!data.idProvince) errors.push("ID province is required");

  // CRITICAL: Validate DOB using centralized validation (13+ - legal requirement for telecom in Quebec)
  // DOB is REQUIRED for orders - this catches empty/invalid/future/<13/>120
  const dobResult = validateDob(data.dateOfBirth, { minAge: MIN_AGE_TELECOM, required: true });
  if (!dobResult.isValid && dobResult.error) {
    errors.push(dobResult.error.en);
  }

  // Validate ID expiration (not expired)
  if (data.idExpiration) {
    const expDate = new Date(data.idExpiration);
    if (expDate < new Date()) errors.push("ID must not be expired");
  }

  return { valid: errors.length === 0, errors };
};

export default ClientIDVerificationForm;
