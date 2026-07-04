/**
 * Field Sales Invoice PDF — V3 THIN WRAPPER
 *
 * All Field Sales invoices now render through the official V3 corporate blue
 * template (`generateInvoiceV3PDF`). This file only adapts the Field Sales
 * order shape to the canonical `InvoiceDataV2` and triggers the download.
 * DO NOT reintroduce jsPDF logic here — the template is locked.
 */
import { generateInvoiceV3PDF } from "./pdf/invoiceTemplateV3";
import { TAX } from "./pdf/companyInfo";
import type { InvoiceDataV2 } from "./pdf/types";

interface FieldSalesInvoiceData {
  invoiceNumber: string;
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
}

function splitAddress(full: string, city: string, postal: string) {
  // Strip trailing city/postal noise so address_line1 stays clean.
  let line = (full || "").trim();
  if (city) line = line.replace(new RegExp(`,?\\s*${city}.*$`, "i"), "").trim();
  if (postal) line = line.replace(new RegExp(`,?\\s*${postal}.*$`, "i"), "").trim();
  return line || "—";
}

export async function generateFieldSalesInvoicePDF(data: FieldSalesInvoiceData): Promise<void> {
  const total = Number(data.payment?.totalAmount) || 0;
  // Back-compute canonical taxes from the confirmed total (fail-closed if 0).
  const rateSum = 1 + TAX.GST_RATE + TAX.QST_RATE;
  const subtotal = total > 0 ? +(total / rateSum).toFixed(2) : 0;
  const gst = total > 0 ? +(subtotal * TAX.GST_RATE).toFixed(2) : 0;
  const qst = total > 0 ? +(subtotal * TAX.QST_RATE).toFixed(2) : 0;

  const invoiceDate = (data.createdAt || new Date().toISOString()).slice(0, 10);
  const isPaid = /paid|captured|confirmed/i.test(data.payment?.status || "");

  const canonical: InvoiceDataV2 = {
    invoice_type: "ONETIME",
    invoice_number: data.invoiceNumber,
    invoice_date: invoiceDate,
    due_date: invoiceDate,
    account_number: (data.orderNumber || "").replace(/[^0-9]/g, "").slice(-6) || "—",
    currency: "CAD",
    status: isPaid ? "Paid" : "Pending",
    customer: {
      full_name: data.customer.name || "—",
      email: data.customer.email || "—",
      phone: data.customer.phone || undefined,
      address_line1: splitAddress(data.customer.address, data.customer.city, data.customer.postalCode),
      city: data.customer.city || "—",
      province: "QC",
      postal_code: data.customer.postalCode || "—",
    },
    items: [
      {
        category: (data.service?.type as any) || "Other",
        description: data.service?.planName || "Service",
        qty: 1,
        unit_price: subtotal,
        amount: subtotal,
        is_recurring: false,
      },
    ],
    subtotal,
    taxes: {
      gst_rate: TAX.GST_RATE,
      gst_amount: gst,
      qst_rate: TAX.QST_RATE,
      qst_amount: qst,
    },
    total,
    balance_due: isPaid ? 0 : total,
    payments: isPaid
      ? [
          {
            method: (data.payment?.method as any) || "Manual",
            status: "Confirmed",
            paid_amount: total,
            paid_at: invoiceDate,
            payment_reference: data.payment?.reference || "",
          },
        ]
      : [],
    payments_total: isPaid ? total : 0,
  };

  const result = generateInvoiceV3PDF(canonical);
  if (!result.success || !result.blob) {
    throw new Error(result.error || "Échec de génération du PDF (V3).");
  }

  // Trigger download
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = result.filename || `Facture_${data.orderNumber}.pdf`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
