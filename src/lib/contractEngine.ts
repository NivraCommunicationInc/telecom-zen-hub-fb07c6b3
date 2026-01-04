import { supabase } from "@/integrations/supabase/client";
import { generateTelecomContractPDF, type TelecomContractData } from "@/lib/pdfEngine";
import { ACTIVE_CONTRACT_TEMPLATE } from "@/lib/contractTemplate";
import { CONTRACT_TERMS } from "@/lib/contractPolicies";
import { hashBlobSHA256Hex } from "@/lib/pdfHash";

const buildContractNumber = () =>
  `CTR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export const ensureOrderContractUpToDate = async (params: {
  orderId: string;
  trigger: string;
  force?: boolean;
}) => {
  const now = new Date().toISOString();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", params.orderId)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) throw new Error("Order not found");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", order.user_id)
    .maybeSingle();

  if (profileError) throw profileError;

  // 1) Ensure a contract row exists + is linked
  let contractId = (order as any).related_contract_id as string | null;
  let contract: any = null;

  if (contractId) {
    const { data: existingContract } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", contractId)
      .maybeSingle();
    contract = existingContract;
  }

  if (!contract) {
    const contractNumber = buildContractNumber();
    const { data: newContract, error: contractErr } = await supabase
      .from("contracts")
      .insert({
        user_id: order.user_id,
        contract_name: `Contrat de services - ${order.service_type}`,
        contract_url: contractNumber,
        contract_number: contractNumber,
        is_signed: false,
        template_id: ACTIVE_CONTRACT_TEMPLATE.id,
        template_version: ACTIVE_CONTRACT_TEMPLATE.version,
      } as any)
      .select()
      .single();

    if (contractErr) throw contractErr;

    contract = newContract;
    contractId = newContract.id;

    await supabase
      .from("orders")
      .update({ related_contract_id: contractId } as any)
      .eq("id", order.id);
  }

  // 2) Decide if we must regenerate
  const activeUpdatedAt = new Date(ACTIVE_CONTRACT_TEMPLATE.updatedAt).getTime();
  const generatedAtMs = contract.pdf_generated_at ? new Date(contract.pdf_generated_at).getTime() : 0;

  const activeVersion = ACTIVE_CONTRACT_TEMPLATE.version;
  const needsRegeneration =
    Boolean(params.force) ||
    (contract.template_version || "") !== activeVersion ||
    generatedAtMs < activeUpdatedAt;

  if (!needsRegeneration) {
    return { contractId: contract.id, regenerated: false };
  }

  // 3) Generate PDF blob + hash (client-side) and persist audit fields
  const fullName =
    profile?.full_name ||
    profile?.email ||
    (order as any).client_email ||
    "Client";
  const [firstName, ...rest] = String(fullName).split(" ");
  const lastName = rest.join(" ");

  const data: TelecomContractData = {
    contractId: contract.id,
    templateId: ACTIVE_CONTRACT_TEMPLATE.id,
    templateVersion: ACTIVE_CONTRACT_TEMPLATE.version,

    contractNumber:
      contract.contract_number ||
      contract.contract_url ||
      `CTR-${contract.id.slice(0, 8).toUpperCase()}`,

    orderReference: (order as any).order_number || undefined,
    orderDate: (order as any).created_at || contract.created_at,

    clientFirstName: firstName || "",
    clientLastName: lastName || "",
    clientName: String(fullName),
    clientEmail: profile?.email || (order as any).client_email || "",
    clientPhone: profile?.phone || "",

    billingAddress: profile?.service_address || "",
    serviceAddress: profile?.service_address || "",
    serviceCity: profile?.service_city || "",
    serviceProvince: profile?.service_province || "QC",
    servicePostalCode: profile?.service_postal_code || "",

    servicePlan: (order as any).service_type || contract.contract_name,

    activationFee: Number((order as any).activation_fee ?? CONTRACT_TERMS.fees.activation),
    deliveryFee: Number((order as any).delivery_fee ?? CONTRACT_TERMS.fees.delivery),
    installationFee: Number((order as any).installation_fee ?? 0),
    terminalFee: Number((order as any).terminal_fee ?? 0),
    terminalCount: Number((order as any).terminal_count ?? 0),
    routerFee: Number((order as any).router_fee ?? 0),

    subtotal: Number((order as any).subtotal ?? 0),
    tpsAmount: Number((order as any).tps_amount ?? 0),
    tvqAmount: Number((order as any).tvq_amount ?? 0),
    totalAmount: Number((order as any).total_amount ?? 0),

    isSigned: Boolean(contract.is_signed),
    signedAt: contract.signed_at || undefined,
  };

  const doc = generateTelecomContractPDF(data);
  const blob = doc.output("blob");
  const pdfHash = await hashBlobSHA256Hex(blob);

  await supabase
    .from("contracts")
    .update({
      template_id: ACTIVE_CONTRACT_TEMPLATE.id,
      template_version: ACTIVE_CONTRACT_TEMPLATE.version,
      pdf_hash: pdfHash,
      pdf_generated_at: now,
    } as any)
    .eq("id", contract.id);

  // 4) Audit log (mandatory fields)
  const { data: me } = await supabase.auth.getUser();
  const actor = me.user;

  await supabase.from("activity_logs").insert({
    user_id: actor?.id || "00000000-0000-0000-0000-000000000000",
    entity_type: "contract_pdf",
    entity_id: contract.id,
    action: "Generated",
    actor_email: actor?.email,
    actor_name: (actor?.user_metadata as any)?.full_name || actor?.email,
    actor_role: "Admin",
    changed_field: "pdf_generated_at",
    new_value: now,
    details: {
      orderId: order.id,
      contractId: contract.id,
      templateId: ACTIVE_CONTRACT_TEMPLATE.id,
      templateVersion: ACTIVE_CONTRACT_TEMPLATE.version,
      timestamp: now,
      pdfHash,
      trigger: params.trigger,
    },
  } as any);

  // Console log (useful for debugging)
  console.log("[ContractEngine] generated", {
    orderId: order.id,
    contractId: contract.id,
    templateId: ACTIVE_CONTRACT_TEMPLATE.id,
    templateVersion: ACTIVE_CONTRACT_TEMPLATE.version,
    timestamp: now,
    pdfHash,
    trigger: params.trigger,
  });

  return {
    contractId: contract.id,
    regenerated: true,
    templateId: ACTIVE_CONTRACT_TEMPLATE.id,
    templateVersion: ACTIVE_CONTRACT_TEMPLATE.version,
    pdfHash,
    timestamp: now,
  };
};
