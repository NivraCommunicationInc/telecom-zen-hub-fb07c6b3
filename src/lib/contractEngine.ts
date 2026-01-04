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

  // Fetch order with ALL relevant fields including individual service plans and prices
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(`
      id, user_id, order_number, created_at, status, service_type, category,
      client_email, subtotal, total_amount, tps_amount, tvq_amount,
      activation_fee, delivery_fee, installation_fee, terminal_fee, terminal_count, router_fee,
      equipment_details, selected_channels, notes, internal_notes,
      related_contract_id
    `)
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

  // Parse service type and equipment details to determine individual services and prices
  const serviceType = String((order as any).service_type || "").toLowerCase();
  const subtotal = Number((order as any).subtotal ?? 0);
  
  // Try to extract structured service data from equipment_details if available
  const equipmentDetails = (order as any).equipment_details;
  let parsedServices: Array<{type: string; name: string; price?: number; priceLabel?: string}> = [];
  
  // Check if equipment_details contains line_items or services array
  if (equipmentDetails && typeof equipmentDetails === 'object') {
    const lineItems = equipmentDetails.line_items || equipmentDetails.services || [];
    if (Array.isArray(lineItems)) {
      parsedServices = lineItems.filter((item: any) => 
        item && (item.type || item.name) && item.category !== 'equipment' && item.category !== 'fee'
      ).map((item: any) => ({
        type: item.type || 'Other',
        name: item.name || item.description || 'Service',
        price: item.unitPrice || item.price || item.monthlyPrice,
        priceLabel: item.priceLabel || item.periodLabel || '/mois',
      }));
    }
  }
  
  // Build individual service prices based on parsed data or service_type fallback
  let internetPlan: string | undefined;
  let internetPrice: number | undefined;
  let tvBundle: string | undefined;
  let tvPrice: number | undefined;
  let mobilePlan: string | undefined;
  let mobilePrice: number | undefined;
  let streamingPlan: string | undefined;
  let streamingPrice: number | undefined;
  
  // First, use parsed services if available
  if (parsedServices.length > 0) {
    for (const svc of parsedServices) {
      const svcType = (svc.type || '').toLowerCase();
      if (svcType.includes('internet') || svcType === 'internet') {
        internetPlan = svc.name;
        internetPrice = svc.price;
      } else if (svcType.includes('tv') || svcType === 'tv') {
        tvBundle = svc.name;
        tvPrice = svc.price;
      } else if (svcType.includes('mobile') || svcType === 'mobile') {
        mobilePlan = svc.name;
        mobilePrice = svc.price;
      } else if (svcType.includes('streaming') || svcType === 'streaming') {
        streamingPlan = svc.name;
        streamingPrice = svc.price;
      }
    }
  }
  
  // Fallback: Parse service_type string if no parsed services found
  if (!internetPlan && !tvBundle && !mobilePlan && !streamingPlan) {
    if (serviceType.includes("internet") || serviceType.includes("fibre")) {
      internetPlan = "Internet Résidentiel";
      // Don't set a hardcoded price - let it show "Prix à confirmer"
      internetPrice = undefined;
    }
    if (serviceType.includes("tv") || serviceType.includes("télé")) {
      tvBundle = "Forfait TV";
      tvPrice = undefined;
    }
    if (serviceType.includes("mobile") || serviceType.includes("cellulaire")) {
      mobilePlan = "Forfait Mobile Prépayé";
      mobilePrice = undefined;
    }
    if (serviceType.includes("streaming")) {
      streamingPlan = "Streaming+";
      streamingPrice = undefined;
    }
  }
  
  // If we can't parse specific services, use the whole subtotal as one service
  const hasSpecificServices = internetPlan || tvBundle || mobilePlan || streamingPlan;

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

    // Individual service plans with prices
    internetPlan: internetPlan,
    internetPrice: internetPrice,
    tvBundle: tvBundle,
    tvPrice: tvPrice,
    mobilePlan: mobilePlan,
    mobilePrice: mobilePrice,
    streamingPlan: streamingPlan,
    streamingPrice: streamingPrice,
    
    // Fallback service plan only if no specific services detected
    servicePlan: hasSpecificServices ? undefined : ((order as any).service_type || contract.contract_name),

    activationFee: Number((order as any).activation_fee ?? CONTRACT_TERMS.fees.activation),
    deliveryFee: Number((order as any).delivery_fee ?? CONTRACT_TERMS.fees.delivery),
    installationFee: Number((order as any).installation_fee ?? 0),
    terminalFee: Number((order as any).terminal_fee ?? 0),
    terminalCount: Number((order as any).terminal_count ?? 0),
    routerFee: Number((order as any).router_fee ?? 0),

    subtotal: subtotal,
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
