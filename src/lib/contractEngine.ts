import { backendClient } from "@/integrations/backend/client";
import { generateTelecomContractPDF, type TelecomContractData } from "@/lib/pdfEngine";
import { ACTIVE_CONTRACT_TEMPLATE } from "@/lib/contractTemplate";
import { CONTRACT_TERMS } from "@/lib/contractPolicies";
import { hashBlobSHA256Hex } from "@/lib/pdfHash";
import { hasValidLineItems, backfillOrderLineItems } from "@/lib/orderBackfill";

const buildContractNumber = () =>
  `CTR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export const ensureOrderContractUpToDate = async (params: {
  orderId: string;
  trigger: string;
  force?: boolean;
}) => {
  const now = new Date().toISOString();

  // Fetch order with ALL relevant fields including individual service plans and prices
  const { data: order, error: orderError } = await backendClient
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

  // PRIORITY 1: Fetch order snapshot (immutable client data at time of order)
  const { data: orderSnapshot } = await backendClient
    .from("order_snapshots")
    .select("*")
    .eq("order_id", params.orderId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  // PRIORITY 2: Fallback to live profile
  const { data: profile, error: profileError } = await backendClient
    .from("profiles")
    .select("*")
    .eq("user_id", order.user_id)
    .maybeSingle();

  if (profileError) throw profileError;
  
  // CLIENT DATA RESOLUTION: Snapshot first, then profile, then order
  const clientSnapshot = (orderSnapshot?.client_snapshot || {}) as Record<string, any>;
  const resolveClientField = (field: string, fallback: any = ""): any => {
    // Priority: snapshot → profile → order → fallback
    if (clientSnapshot[field] !== undefined && clientSnapshot[field] !== null && clientSnapshot[field] !== "") {
      return clientSnapshot[field];
    }
    if (profile && (profile as any)[field] !== undefined && (profile as any)[field] !== null && (profile as any)[field] !== "") {
      return (profile as any)[field];
    }
    if ((order as any)[field] !== undefined && (order as any)[field] !== null && (order as any)[field] !== "") {
      return (order as any)[field];
    }
    return fallback;
  };
  
  // VALIDATION: Block generation if required fields are missing
  const requiredFields = ["full_name", "email", "phone", "service_address"];
  const missingFields = requiredFields.filter(field => {
    const value = resolveClientField(field === "full_name" ? "legalName" : field) || 
                  resolveClientField(field);
    return !value || String(value).trim() === "";
  });
  
  if (missingFields.length > 0) {
    throw new Error(`Coordonnées client incomplètes — impossible de générer le document. Champs manquants: ${missingFields.join(", ")}`);
  }

  // 1) Ensure a contract row exists + is linked
  let contractId = (order as any).related_contract_id as string | null;
  let contract: any = null;

  if (contractId) {
    const { data: existingContract } = await backendClient
      .from("contracts")
      .select("*")
      .eq("id", contractId)
      .maybeSingle();
    contract = existingContract;
  }

  if (!contract) {
    const contractNumber = buildContractNumber();
    const { data: newContract, error: contractErr } = await backendClient
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

    await backendClient
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
  // USE RESOLVED CLIENT DATA (snapshot priority, then profile fallback)
  const fullName = resolveClientField("legalName") || 
                   resolveClientField("full_name") || 
                   resolveClientField("email") || 
                   (order as any).client_email || 
                   "Client";
  const [firstName, ...rest] = String(fullName).split(" ");
  const lastName = rest.join(" ");
  
  const clientEmail = resolveClientField("email") || (order as any).client_email || "";
  const clientPhone = resolveClientField("phone") || "";
  const serviceAddress = resolveClientField("serviceAddress") || resolveClientField("service_address") || "";
  const serviceCity = resolveClientField("serviceCity") || resolveClientField("service_city") || "";
  const serviceProvince = resolveClientField("serviceProvince") || resolveClientField("service_province") || "QC";
  const servicePostalCode = resolveClientField("servicePostalCode") || resolveClientField("service_postal_code") || "";
  const billingAddress = resolveClientField("billingAddress") || resolveClientField("billing_address") || serviceAddress;

  // Client account number (must always be shown in Contract PDF)
  let clientAccountNumber: string | undefined = resolveClientField("accountId") || 
                                                 (order as any).client_account_number || 
                                                 undefined;

  if (!clientAccountNumber) {
    const { data: acc, error: accError } = await backendClient
      .from("accounts")
      .select("account_number")
      .eq("client_id", order.user_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (accError) {
      console.error("[ContractEngine] Failed to lookup accounts.account_number", {
        orderId: order.id,
        clientId: order.user_id,
        error: accError,
      });
    } else {
      clientAccountNumber = acc?.account_number || undefined;
    }
  }

  if (!clientAccountNumber) {
    console.error("[ContractEngine] Missing client account number (will render N/A)", {
      orderId: order.id,
      clientId: order.user_id,
    });
  }

  // Parse service type and equipment details to determine individual services and prices
  const serviceType = String((order as any).service_type || "").toLowerCase();
  const subtotal = Number((order as any).subtotal ?? 0);
  
  // Import extractLineItemsFromOrder utility
  const { extractLineItemsFromOrder } = await import("@/lib/orderLineItems");
  
  // Try to extract structured line_items from equipment_details (PRIMARY SOURCE)
  let equipmentDetails = (order as any).equipment_details;
  
  // BACKFILL: If no valid line_items, create them from order fields and save
  if (!hasValidLineItems(equipmentDetails)) {
    console.log("[ContractEngine] Backfilling line_items for order:", order.id);
    const backfilledItems = await backfillOrderLineItems(order.id);
    if (backfilledItems && backfilledItems.length > 0) {
      // Refetch the updated equipment_details
      const { data: updatedOrder } = await backendClient
        .from("orders")
        .select("equipment_details")
        .eq("id", order.id)
        .single();
      if (updatedOrder) {
        equipmentDetails = updatedOrder.equipment_details;
      }
    }
  }
  
  const lineItems = extractLineItemsFromOrder(equipmentDetails);
  
  // Build individual service prices based on line_items or fallback parsing
  let internetPlan: string | undefined;
  let internetPrice: number | undefined;
  let tvBundle: string | undefined;
  let tvPrice: number | undefined;
  let mobilePlan: string | undefined;
  let mobilePrice: number | undefined;
  let streamingPlan: string | undefined;
  let streamingPrice: number | undefined;
  
  if (lineItems && lineItems.length > 0) {
    // Use structured line_items as primary source
    for (const item of lineItems) {
      if (item.category === 'service') {
        const itemType = item.type?.toLowerCase() || '';
        const price = item.unit_price > 0 ? item.unit_price : undefined;
        
        if (itemType === 'internet') {
          internetPlan = item.name;
          internetPrice = price;
        } else if (itemType === 'tv') {
          tvBundle = item.name;
          tvPrice = price;
        } else if (itemType === 'mobile') {
          mobilePlan = item.name;
          mobilePrice = price;
        } else if (itemType === 'streaming') {
          // Aggregate streaming services
          if (!streamingPlan) {
            streamingPlan = item.name;
            streamingPrice = price;
          } else {
            streamingPlan += `, ${item.name}`;
            streamingPrice = (streamingPrice || 0) + (price || 0);
          }
        }
      }
    }
  } else {
    // Fallback: Parse service_type string if no line_items found
    if (serviceType.includes("internet") || serviceType.includes("fibre")) {
      internetPlan = "Internet Résidentiel";
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
    clientEmail: clientEmail,
    clientPhone: clientPhone,
    clientAccountNumber: clientAccountNumber,

    billingAddress: billingAddress,
    serviceAddress: serviceAddress,
    serviceCity: serviceCity,
    serviceProvince: serviceProvince,
    servicePostalCode: servicePostalCode,

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

    activationFee: Number((order as any).activation_fee ?? CONTRACT_TERMS.fees.activationSingle),
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
    
    // CRITICAL: Pass structured line_items for dynamic PDF generation
    equipmentDetails: equipmentDetails,
  };

  const doc = generateTelecomContractPDF(data);
  const blob = doc.output("blob");
  const pdfHash = await hashBlobSHA256Hex(blob);

  await backendClient
    .from("contracts")
    .update({
      template_id: ACTIVE_CONTRACT_TEMPLATE.id,
      template_version: ACTIVE_CONTRACT_TEMPLATE.version,
      pdf_hash: pdfHash,
      pdf_generated_at: now,
    } as any)
    .eq("id", contract.id);

  // 4) Audit log (mandatory fields)
  const { data: me } = await backendClient.auth.getUser();
  const actor = me.user;

  await backendClient.from("activity_logs").insert({
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
