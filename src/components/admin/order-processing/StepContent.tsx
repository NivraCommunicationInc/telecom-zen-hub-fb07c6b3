/**
 * StepContent — Routes active step to the correct component
 */
import { ClientInfoStep } from "./steps/ClientInfoStep";
import { OrderReviewStep } from "./steps/OrderReviewStep";
import { PaymentInvoiceStep } from "./steps/PaymentInvoiceStep";
import { KycStep } from "./steps/KycStep";
import { FulfillmentStep } from "./steps/FulfillmentStep";
import { EquipmentStep } from "./steps/EquipmentStep";
import { ActivationStep } from "./steps/ActivationStep";
import { ContractDocumentsStep } from "./steps/ContractDocumentsStep";
import { ShippingTechnicianStep } from "./steps/ShippingTechnicianStep";
import { CompletionStep } from "./steps/CompletionStep";
import { TVChannelActivationStep } from "./steps/TVChannelActivationStep";

interface Props {
  proc: any;
}

export function StepContent({ proc }: Props) {
  switch (proc.activeStep) {
    case "client_info":
      return <ClientInfoStep proc={proc} />;
    case "order_review":
      return <OrderReviewStep proc={proc} />;
    case "payment":
      return <PaymentInvoiceStep proc={proc} />;
    case "kyc":
      return <KycStep proc={proc} />;
    case "fulfillment":
      return <FulfillmentStep proc={proc} />;
    case "equipment":
      return <EquipmentStep proc={proc} />;
    case "activation":
      return <ActivationStep proc={proc} />;
    case "tv_channels":
      return <TVChannelActivationStep proc={proc} />;
    case "contracts":
      return <ContractDocumentsStep proc={proc} />;
    case "shipping":
      return <ShippingTechnicianStep proc={proc} />;
    case "completion":
      return <CompletionStep proc={proc} />;
    default:
      return <div className="text-gray-500 text-sm">Sélectionnez une étape.</div>;
  }
}
