import { generateDeliverySlipPDF, type DeliverySlipData } from "@/lib/pdf/deliverySlipTemplate";

const cleanText = (value: unknown): string => String(value ?? "").trim();

const firstPresent = (...values: unknown[]): string => {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
};

const isFeeOrRecurring = (item: any): boolean => {
  const haystack = [
    item?.line_type,
    item?.item_type,
    item?.category,
    item?.service_type,
    item?.name,
    item?.plan_name,
    item?.description,
  ]
    .map((part) => cleanText(part).toLowerCase())
    .join(" ");

  if (item?.is_recurring === true) return true;
  return /mensuel|monthly|recurring|abonnement|subscription|frais|fee|livraison|shipping|activation|installation|taxe|tax/.test(haystack);
};

const normalizeQuantity = (value: unknown): number => {
  const qty = Number(value);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
};

const normalizeItem = (item: any) => ({
  description: firstPresent(
    item?.description,
    item?.catalog_name,
    item?.equipment_name,
    item?.item_name,
    item?.name,
    item?.plan_name,
    item?.sku,
  ) || "Équipement de commande — détails à compléter",
  serial_number: firstPresent(item?.serial_number, item?.serial, item?.mac_address, item?.imei) || undefined,
  quantity: normalizeQuantity(item?.quantity ?? item?.qty),
});

export const buildClientDeliverySlipData = (canonicalData: any, order: any): DeliverySlipData => {
  const profile = canonicalData?.profile ?? {};
  const account = canonicalData?.account ?? {};
  const serviceAddress = Array.isArray(canonicalData?.serviceAddresses) ? canonicalData.serviceAddresses[0] : null;
  const orderNumber = firstPresent(order?.order_number, order?.id?.slice?.(0, 8), "COMMANDE");

  const equipmentOrderLines = (canonicalData?.equipmentOrderLines || [])
    .filter((item: any) => item?.order_id === order?.id)
    .map(normalizeItem);

  const assignedEquipment = (canonicalData?.equipment || [])
    .filter((item: any) => item?.order_id === order?.id)
    .map(normalizeItem);

  const orderSnapshotItems = (Array.isArray(order?.equipment_line_details) ? order.equipment_line_details : [])
    .map(normalizeItem);

  const orderItems = (canonicalData?.orderItems || [])
    .filter((item: any) => item?.order_id === order?.id && !isFeeOrRecurring(item))
    .map(normalizeItem);

  const items = [
    ...equipmentOrderLines,
    ...assignedEquipment,
    ...orderSnapshotItems,
    ...orderItems,
  ];

  return {
    slip_number: orderNumber,
    issue_date: firstPresent(order?.shipped_at, order?.updated_at, order?.created_at, new Date().toISOString()),
    client_name: firstPresent(profile?.full_name, order?.client_name, order?.customer_name, "Client Nivra"),
    client_email: firstPresent(profile?.email, order?.client_email, order?.email),
    client_phone: firstPresent(profile?.phone, order?.client_phone, order?.phone) || undefined,
    account_number: firstPresent(account?.account_number, profile?.client_number, order?.account_number, orderNumber),
    delivery_address: firstPresent(order?.shipping_address, order?.service_address, profile?.service_address, account?.service_address, serviceAddress?.address_line, "[À COMPLÉTER]"),
    delivery_city: firstPresent(order?.shipping_city, order?.service_city, profile?.service_city, account?.service_city, serviceAddress?.city) || undefined,
    delivery_province: firstPresent(order?.shipping_province, order?.service_province, profile?.service_province, account?.service_province, serviceAddress?.province, "QC") || undefined,
    delivery_postal: firstPresent(order?.shipping_postal_code, order?.shipping_postal, order?.service_postal_code, profile?.service_postal_code, account?.service_postal_code, serviceAddress?.postal_code) || undefined,
    order_number: orderNumber,
    carrier: firstPresent(order?.carrier, order?.shipping_carrier, order?.shipment_carrier, "En préparation"),
    tracking_number: firstPresent(order?.tracking_number, order?.shipment_tracking_number, order?.tracking_code, "—"),
    estimated_delivery: firstPresent(order?.estimated_delivery, order?.delivery_eta, order?.scheduled_delivery) || undefined,
    items: items.length > 0 ? items : [{ description: "Équipement de commande — détails à compléter", quantity: 1 }],
  };
};

export const generateClientDeliverySlipPDF = (canonicalData: any, order: any) => {
  return generateDeliverySlipPDF(buildClientDeliverySlipData(canonicalData, order));
};

export const downloadClientDeliverySlipPDF = (canonicalData: any, order: any) => {
  const result = generateClientDeliverySlipPDF(canonicalData, order);
  if (!result.success || !result.blob) {
    throw new Error(result.error || "Bordereau indisponible");
  }

  const url = URL.createObjectURL(result.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = result.filename || `Bon_Livraison_${order?.order_number || order?.id || "commande"}.pdf`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};