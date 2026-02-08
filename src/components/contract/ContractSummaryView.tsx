/**
 * ContractSummaryView - Displays the "Résumé du contrat" from snapshot data
 * Used in both client and admin portals
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar, 
  CreditCard, 
  Tv, 
  Wifi, 
  Smartphone, 
  Shield,
  FileText,
  CheckCircle
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export interface ContractSummaryData {
  // Client info
  client: {
    legalName: string;
    firstName?: string;
    lastName?: string;
    phone: string;
    email: string;
    serviceAddress: string;
    serviceCity?: string;
    serviceProvince?: string;
    servicePostalCode?: string;
    billingAddress?: string;
    accountId?: string;
    dateOfBirth?: string;
  };
  // Order/contract identifiers
  orderId: string;
  orderNumber?: string;
  contractNumber?: string;
  accountNumber?: string;
  
  // Services
  services: Array<{
    type: "Internet" | "TV" | "Mobile" | "Security" | string;
    planName: string;
    monthlyPrice: number;
    speed?: string;
    terminal?: string;
    lineCount?: number;
    portability?: boolean;
    numberToPort?: string;
    equipment?: string;
  }>;
  
  // TV Channels (if TV service)
  tvChannels?: {
    baseChannels: number;
    freeChoiceCount: number;
    premiumCount: number;
    premiumTotal?: number;
    channelList?: string[];
  };
  
  // Dates
  dates: {
    accountCreated?: string;
    billCycleDay?: number;
    activationDate?: string;
    nextInvoiceDate?: string;
    dueDate?: string;
  };
  
  // One-time fees
  oneTimeFees: {
    router?: number;
    terminal4k?: number;
    other?: number;
    otherDescription?: string;
    activationFee?: number;
    installationFee?: number;
    installationComplex?: number;
    deliveryFee?: number;
  };
  
  // Payment
  payment: {
    method: "card" | "etransfer" | "paypal" | "other" | string;
    etransferRule?: "after_receipt" | "after_verification";
    deposit?: number;
    depositConditions?: string;
    paypalCaptureId?: string;
    reference?: string;
  };
  
  // Snapshot metadata
  snapshotCreatedAt?: string;
  agreementVersion?: number;
}

interface ContractSummaryViewProps {
  data: ContractSummaryData;
  showSignatures?: boolean;
}

const formatCurrency = (amount: number | undefined) => {
  if (amount === undefined || amount === null) return "—";
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount);
};

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return "À confirmer";
  try {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
};

const ServiceIcon = ({ type }: { type: string }) => {
  switch (type.toLowerCase()) {
    case "internet": return <Wifi className="w-4 h-4 text-cyan-500" />;
    case "tv": return <Tv className="w-4 h-4 text-purple-500" />;
    case "mobile": return <Smartphone className="w-4 h-4 text-green-500" />;
    case "security": return <Shield className="w-4 h-4 text-amber-500" />;
    default: return <FileText className="w-4 h-4 text-muted-foreground" />;
  }
};

export function ContractSummaryView({ data, showSignatures = false }: ContractSummaryViewProps) {
  const totalMonthly = data.services.reduce((sum, s) => sum + (s.monthlyPrice || 0), 0) + 
    (data.tvChannels?.premiumTotal || 0);
  
  const totalOneTime = 
    (data.oneTimeFees.router || 0) + 
    (data.oneTimeFees.terminal4k || 0) + 
    (data.oneTimeFees.other || 0) + 
    (data.oneTimeFees.activationFee || 0) + 
    (data.oneTimeFees.installationFee || 0) + 
    (data.oneTimeFees.deliveryFee || 0);

  return (
    <div className="space-y-6 p-4 max-h-[70vh] overflow-y-auto">
      {/* Header */}
      <div className="text-center border-b border-border pb-4">
        <h2 className="text-xl font-bold text-foreground">RÉSUMÉ DU CONTRAT</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Contrat #{data.contractNumber || data.orderNumber || data.orderId.slice(0, 8)}
        </p>
        {data.snapshotCreatedAt && (
          <Badge variant="outline" className="mt-2">
            Snapshot du {formatDate(data.snapshotCreatedAt)}
          </Badge>
        )}
      </div>

      {/* Client Section */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Client
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">Nom légal :</span>
              <p className="font-medium">{data.client.legalName || "À confirmer"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">ID compte client :</span>
              <p className="font-mono text-xs">{data.accountNumber || data.client.accountId || "À confirmer"}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <span className="text-muted-foreground text-xs">Adresse de service :</span>
              <p className="font-medium">
                {data.client.serviceAddress || "À confirmer"}
                {data.client.serviceCity && `, ${data.client.serviceCity}`}
                {data.client.serviceProvince && ` (${data.client.serviceProvince})`}
                {data.client.servicePostalCode && ` ${data.client.servicePostalCode}`}
              </p>
            </div>
          </div>
          {data.client.billingAddress && data.client.billingAddress !== data.client.serviceAddress && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <span className="text-muted-foreground text-xs">Adresse de facturation :</span>
                <p className="font-medium">{data.client.billingAddress}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{data.client.phone || "À confirmer"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs">{data.client.email || "À confirmer"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Section */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Services souscrits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.services.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun service sélectionné</p>
          ) : (
            data.services.map((service, idx) => (
              <div key={idx} className="flex items-start justify-between p-2 bg-accent/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <ServiceIcon type={service.type} />
                  <div>
                    <p className="font-medium">{service.type}</p>
                    <p className="text-sm text-muted-foreground">{service.planName}</p>
                    {service.speed && (
                      <p className="text-xs text-muted-foreground">Vitesse : {service.speed}</p>
                    )}
                    {service.terminal && (
                      <p className="text-xs text-muted-foreground">Terminal : {service.terminal}</p>
                    )}
                    {service.lineCount && service.lineCount > 1 && (
                      <p className="text-xs text-muted-foreground"># lignes : {service.lineCount}</p>
                    )}
                    {service.portability && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        Portabilité : {service.numberToPort || "Oui"}
                      </Badge>
                    )}
                  </div>
                </div>
                <span className="font-bold text-primary">{formatCurrency(service.monthlyPrice)}/mois</span>
              </div>
            ))
          )}

          {/* TV Channels Summary */}
          {data.tvChannels && (
            <div className="mt-3 p-2 bg-purple-500/10 rounded-lg">
              <p className="font-medium text-sm flex items-center gap-2">
                <Tv className="w-4 h-4 text-purple-500" />
                Chaînes TV
              </p>
              <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Base :</span>
                  <p className="font-medium">{data.tvChannels.baseChannels || 25}/26</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Free-Choice :</span>
                  <p className="font-medium">{data.tvChannels.freeChoiceCount || 0}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Premium :</span>
                  <p className="font-medium">
                    {data.tvChannels.premiumCount || 0}
                    {data.tvChannels.premiumTotal ? ` (${formatCurrency(data.tvChannels.premiumTotal)})` : ""}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />
          <div className="flex justify-between font-bold">
            <span>Total mensuel estimé</span>
            <span className="text-primary">{formatCurrency(totalMonthly)}/mois</span>
          </div>
        </CardContent>
      </Card>

      {/* Dates Section */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Dates et facturation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Date création compte :</span>
              <p className="font-medium">{formatDate(data.dates.accountCreated)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Bill Cycle (jour) :</span>
              <p className="font-medium">{data.dates.billCycleDay || "À confirmer"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Date activation :</span>
              <p className="font-medium">{formatDate(data.dates.activationDate)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Prochaine facture :</span>
              <p className="font-medium">{formatDate(data.dates.nextInvoiceDate)}</p>
            </div>
            {data.dates.dueDate && (
              <div>
                <span className="text-muted-foreground">Échéance :</span>
                <p className="font-medium">{formatDate(data.dates.dueDate)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* One-time Fees Section */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Frais uniques / équipements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {data.oneTimeFees.router !== undefined && data.oneTimeFees.router > 0 && (
              <div className="flex justify-between">
                <span>Routeur</span>
                <span>{formatCurrency(data.oneTimeFees.router)}</span>
              </div>
            )}
            {data.oneTimeFees.terminal4k !== undefined && data.oneTimeFees.terminal4k > 0 && (
              <div className="flex justify-between">
                <span>Terminal 4K</span>
                <span>{formatCurrency(data.oneTimeFees.terminal4k)}</span>
              </div>
            )}
            {data.oneTimeFees.activationFee !== undefined && data.oneTimeFees.activationFee > 0 && (
              <div className="flex justify-between">
                <span>Frais d'activation</span>
                <span>{formatCurrency(data.oneTimeFees.activationFee)}</span>
              </div>
            )}
            {data.oneTimeFees.installationFee !== undefined && data.oneTimeFees.installationFee > 0 && (
              <div className="flex justify-between">
                <span>Frais d'installation (standard)</span>
                <span>{formatCurrency(data.oneTimeFees.installationFee)}</span>
              </div>
            )}
            {data.oneTimeFees.installationComplex !== undefined && data.oneTimeFees.installationComplex > 0 && (
              <div className="flex justify-between">
                <span>Frais d'installation (complexe)</span>
                <span>{formatCurrency(data.oneTimeFees.installationComplex)}</span>
              </div>
            )}
            {data.oneTimeFees.deliveryFee !== undefined && data.oneTimeFees.deliveryFee > 0 && (
              <div className="flex justify-between">
                <span>Frais de livraison</span>
                <span>{formatCurrency(data.oneTimeFees.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>Frais de réactivation (rappel)</span>
              <span>15 $</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Total frais uniques</span>
              <span>{formatCurrency(totalOneTime)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Section - CONDITIONAL: Show correct method based on snapshot */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Paiement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {/* Payment method display - strict conditional logic */}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mode :</span>
              <span className="font-medium">
                {data.payment.method?.toLowerCase() === "paypal" ? (
                  <span className="flex items-center gap-1">
                    <span className="text-blue-600">PayPal</span>
                    {data.payment.paypalCaptureId && (
                      <Badge variant="outline" className="text-xs ml-1">
                        {data.payment.paypalCaptureId.slice(0, 8)}...
                      </Badge>
                    )}
                  </span>
                ) : data.payment.method?.toLowerCase() === "card" ? (
                  "Carte de crédit"
                ) : data.payment.method?.toLowerCase() === "etransfer" || data.payment.method?.toLowerCase() === "interac" ? (
                  "Interac e-Transfer"
                ) : (
                  data.payment.method || "À confirmer"
                )}
              </span>
            </div>

            {/* ONLY show Interac rules if method is actually etransfer/interac */}
            {(data.payment.method?.toLowerCase() === "etransfer" || data.payment.method?.toLowerCase() === "interac") && (
              <>
                {data.payment.etransferRule && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Règle activation :</span>
                    <span className="font-medium">
                      {data.payment.etransferRule === "after_receipt" 
                        ? "Après réception" 
                        : "Après réception et vérification"}
                    </span>
                  </div>
                )}
                <div className="p-2 bg-amber-500/10 rounded-lg text-xs">
                  <p className="font-medium text-amber-600">Instructions Interac e-Transfer :</p>
                  <p>nvrpay@nivra-telecom.ca • Q: nivra R: nivra2024</p>
                </div>
              </>
            )}

            {/* Show PayPal confirmation if paid via PayPal */}
            {data.payment.method?.toLowerCase() === "paypal" && data.payment.paypalCaptureId && (
              <div className="p-2 bg-blue-500/10 rounded-lg text-xs">
                <p className="font-medium text-blue-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Paiement PayPal confirmé
                </p>
                <p className="text-muted-foreground">Réf: {data.payment.paypalCaptureId}</p>
              </div>
            )}

            {/* Deposit section */}
            {data.payment.deposit !== undefined && data.payment.deposit > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dépôt :</span>
                  <span className="font-medium">{formatCurrency(data.payment.deposit)}</span>
                </div>
                {data.payment.depositConditions && (
                  <div>
                    <span className="text-muted-foreground text-xs">Conditions : </span>
                    <span className="text-xs">{data.payment.depositConditions}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Acceptance Section */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Acceptation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Le Client déclare avoir lu et accepté : Annexe A — Termes & Conditions, 
            Annexe B — Conditions spécifiques, Annexe C — Installation, 
            Annexe D — Paiements, Annexe E — Support/SLA (si applicable).
          </p>
          {showSignatures && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Signature Client :</p>
                <div className="h-8 border-b border-dashed border-muted-foreground mt-2" />
                <p className="text-xs text-muted-foreground mt-2">Date : ___/___/______</p>
              </div>
              <div className="border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Signature Nivra :</p>
                <div className="h-8 border-b border-dashed border-muted-foreground mt-2" />
                <p className="text-xs text-muted-foreground mt-2">Date : ___/___/______</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ContractSummaryView;
