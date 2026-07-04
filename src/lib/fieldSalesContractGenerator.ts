/**
 * Field Sales Contract PDF — V3 THIN WRAPPER
 *
 * All Field Sales contracts now render through the official V3 corporate blue
 * template (`generateContractV3PDF`). This file only adapts the Field Sales
 * order shape to the canonical `ContractDataV3` and triggers the download.
 * DO NOT reintroduce jsPDF logic here — the template is locked.
 */
import { generateContractV3PDF, type ContractDataV3 } from "./pdf/contractTemplateV3";
import { CURRENT_TERMS_VERSION } from "./pdf/serviceTermsTemplate";
import { TAX } from "./pdf/companyInfo";

interface FieldSalesContractData {
  orderNumber: string;
  createdAt: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
  };
  service: {
    type: string;
    planName: string;
    monthlyPrice: number;
  };
  payment: {
    method: string;
    status: string;
    totalAmount: number;
    reference: string | null;
  };
  salespersonName: string;
  appointmentDate: string | null;
  appointmentNotes: string | null;
  signatureData?: string | null;
}

export async function generateFieldSalesContractPDF(data: FieldSalesContractData): Promise<void> {
  const total = Number(data.payment?.totalAmount) || 0;
  const rateSum = 1 + TAX.GST_RATE + TAX.QST_RATE;
  const subtotalTaxed = total > 0 ? +(total / rateSum).toFixed(2) : 0;
  const gst = total > 0 ? +(subtotalTaxed * TAX.GST_RATE).toFixed(2) : 0;
  const qst = total > 0 ? +(subtotalTaxed * TAX.QST_RATE).toFixed(2) : 0;

  const contractDate = (data.createdAt || new Date().toISOString()).slice(0, 10);
  const monthly = Number(data.service?.monthlyPrice) || 0;
  const orderNum = data.orderNumber || "—";
  const fullAddress = [data.customer.address, data.customer.city, data.customer.postalCode]
    .filter(Boolean)
    .join(", ");

  const canonical: ContractDataV3 = {
    contract_number: `CTR-${orderNum}`,
    contract_date: contractDate,
    terms_version: CURRENT_TERMS_VERSION,

    client_name: data.customer.name || "—",
    client_email: data.customer.email || "—",
    client_phone: data.customer.phone || "—",
    billing_address: fullAddress || "—",
    service_address: fullAddress || "—",

    account_number: orderNum.replace(/[^0-9]/g, "").slice(-6) || "—",
    order_number: orderNum,

    services: [
      {
        type: data.service?.type || "Service",
        name: data.service?.planName || "Service",
        monthly_price: monthly,
      },
    ],
    equipment: [],
    one_time_fees: [],

    subtotal_monthly: monthly,
    subtotal_one_time: Math.max(0, subtotalTaxed - monthly),
    discount_amount: 0,
    tax_gst: gst,
    tax_qst: qst,
    total_due_today: total,

    payment_method: data.payment?.method || undefined,

    is_signed: !!data.signatureData,
    signature_name: data.signatureData ? data.customer.name : undefined,
    signature_date: data.signatureData ? contractDate : undefined,
  };

  const result = generateContractV3PDF(canonical);
  if (!result.success || !result.blob) {
    throw new Error(result.error || "Échec de génération du contrat (V3).");
  }

  const url = URL.createObjectURL(result.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = result.filename || `Contrat_${orderNum}.pdf`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
