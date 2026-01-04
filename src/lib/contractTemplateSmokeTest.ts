import { supabase } from "@/integrations/supabase/client";
import { generateTelecomContractPDF, type TelecomContractData } from "@/lib/pdfEngine";
import { ACTIVE_CONTRACT_TEMPLATE } from "@/lib/contractTemplate";

type SmokeTestResult = {
  pass: boolean;
  checks: Record<string, boolean>;
  meta: Record<string, any>;
};

const textProbe = async (blob: Blob): Promise<string> => {
  const buf = await blob.arrayBuffer();
  // PDFs are mostly ASCII for embedded text. This is a pragmatic probe for regression checks.
  return new TextDecoder("latin1").decode(new Uint8Array(buf));
};

export const runContractTemplateSmokeTest = async (params: {
  contractId: string;
}): Promise<SmokeTestResult> => {
  const { contractId } = params;

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();

  if (contractError) throw contractError;
  if (!contract) throw new Error("Contract not found");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", contract.user_id)
    .maybeSingle();

  if (profileError) throw profileError;

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("related_contract_id", contractId)
    .maybeSingle();

  const fullName = profile?.full_name || "Client";
  const [firstName, ...rest] = fullName.split(" ");
  const lastName = rest.join(" ");

  const templateVersion = (contract as any).template_version || ACTIVE_CONTRACT_TEMPLATE.version;

  const data: TelecomContractData = {
    contractId,
    templateId: (contract as any).template_id || ACTIVE_CONTRACT_TEMPLATE.id,
    templateVersion,

    contractNumber:
      contract.contract_number ||
      contract.contract_url ||
      `CTR-${contract.id.slice(0, 8).toUpperCase()}`,

    orderReference: order?.order_number || undefined,
    orderDate: order?.created_at || contract.created_at,

    clientFirstName: firstName || "",
    clientLastName: lastName || "",
    clientName: fullName,
    clientEmail: profile?.email || "",
    clientPhone: profile?.phone || undefined,

    billingAddress: profile?.service_address || undefined,
    serviceAddress: profile?.service_address || undefined,
    serviceCity: profile?.service_city || undefined,
    serviceProvince: profile?.service_province || "QC",
    servicePostalCode: profile?.service_postal_code || undefined,

    servicePlan: order?.service_type || contract.contract_name,

    activationFee: Number(order?.activation_fee ?? 25),
    deliveryFee: Number(order?.delivery_fee ?? 30),
    installationFee: Number(order?.installation_fee ?? 0),
    terminalFee: Number(order?.terminal_fee ?? 0),
    terminalCount: Number(order?.terminal_count ?? 0),
    routerFee: Number(order?.router_fee ?? 0),

    subtotal: Number(order?.subtotal ?? 0),
    tpsAmount: Number(order?.tps_amount ?? 0),
    tvqAmount: Number(order?.tvq_amount ?? 0),
    totalAmount: Number(order?.total_amount ?? 0),

    isSigned: Boolean(contract.is_signed),
    signedAt: contract.signed_at || undefined,
  };

  const doc = generateTelecomContractPDF(data);
  const blob = doc.output("blob");
  const probe = await textProbe(blob);

  const checks: Record<string, boolean> = {
    templateVersion: probe.includes(`Template ${templateVersion}`),
    activation25: probe.includes("$25.00") || probe.includes("$25"),
    delivery30: probe.includes("$30.00") || probe.includes("$30"),
    reactivation15: probe.includes("$15.00") || probe.includes("$15"),
    terminal50: probe.includes("$50.00") || probe.includes("$50"),
    router60: probe.includes("$60.00") || probe.includes("$60"),
    tvRequiresInternet: probe.toLowerCase().includes("le forfait tv nécessite un forfait internet actif"),
  };

  const pass = Object.values(checks).every(Boolean);

  return {
    pass,
    checks,
    meta: {
      contractId,
      templateVersion,
      orderId: order?.id,
      contractNumber: data.contractNumber,
    },
  };
};
