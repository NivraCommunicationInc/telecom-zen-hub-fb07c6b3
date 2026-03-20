/**
 * Types for the Field Sales guided workflow.
 */
export interface FieldSaleCustomer {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  province: string;
  notes: string;
  serviceability_status: "unknown" | "checking" | "available" | "unavailable";
}

export interface FieldSaleService {
  id: string;
  name: string;
  category: string;
  monthlyPrice: number;
  description: string | null;
  speed?: string;
}

export interface FieldSaleEquipment {
  id: string;
  name: string;
  price: number;
  category: string; // router, terminal, sim, etc.
  quantity: number;
}

export interface FieldSaleInstallation {
  type: "technician" | "self_install";
  scheduledDate: string | null;
  timeWindow: string | null;
}

export interface FieldSaleBilling {
  preauthorizedPayment: boolean;
  billingCycleDay: number;
}

export interface FieldSalePayment {
  method: "send_link" | "card_present";
  status: "pending" | "sent" | "completed";
  linkSentTo: string | null;
}

export type FieldSaleStep = 
  | "customer"
  | "services"
  | "equipment"
  | "installation"
  | "billing"
  | "payment"
  | "review"
  | "submitted";

export interface FieldSaleDraft {
  id?: string;
  step: FieldSaleStep;
  customer: FieldSaleCustomer;
  services: FieldSaleService[];
  equipment: FieldSaleEquipment[];
  installation: FieldSaleInstallation;
  billing: FieldSaleBilling;
  payment: FieldSalePayment;
  agentId: string;
  createdAt: string;
}

export const EMPTY_DRAFT: Omit<FieldSaleDraft, "agentId" | "createdAt"> = {
  step: "customer",
  customer: {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postal_code: "",
    province: "QC",
    notes: "",
    serviceability_status: "unknown",
  },
  services: [],
  equipment: [],
  installation: {
    type: "self_install",
    scheduledDate: null,
    timeWindow: null,
  },
  billing: {
    preauthorizedPayment: false,
    billingCycleDay: new Date().getDate(),
  },
  payment: {
    method: "send_link",
    status: "pending",
    linkSentTo: null,
  },
};

export const STEP_ORDER: FieldSaleStep[] = [
  "customer",
  "services",
  "equipment",
  "installation",
  "billing",
  "payment",
  "review",
];

export const STEP_LABELS: Record<FieldSaleStep, string> = {
  customer: "Client",
  services: "Services",
  equipment: "Équipement",
  installation: "Installation",
  billing: "Facturation",
  payment: "Paiement",
  review: "Confirmation",
  submitted: "Soumis",
};
