import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { OrderSnapshotData, FulfillmentSnapshotData, OrderDocumentData } from "./orderDocumentGenerator";

// Extended snapshot data to include all contract summary fields
export interface ExtendedOrderSnapshotData extends OrderSnapshotData {
  billCycleDay?: number;
  accountId?: string;
  activationDate?: string;
  paymentMethod?: {
    method: "card" | "etransfer" | "other";
    etransferRule?: "after_receipt" | "after_verification";
    deposit?: number;
    depositConditions?: string;
  };
  selectedChannels?: any;
}

// Create immutable order snapshot at checkout
export async function createOrderSnapshot(
  orderId: string,
  snapshotData: ExtendedOrderSnapshotData
): Promise<{ success: boolean; snapshotId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("order_snapshots")
      .insert({
        order_id: orderId,
        version: 1,
        client_snapshot: snapshotData.client,
        services_snapshot: snapshotData.services,
        equipment_snapshot: snapshotData.equipment,
        fees_snapshot: snapshotData.fees,
        billing_snapshot: snapshotData.billing,
        accepted_at: snapshotData.acceptedAt,
        accepted_method: snapshotData.acceptedMethod,
        // New fields for contract summary
        bill_cycle_day: snapshotData.billCycleDay,
        account_id: snapshotData.accountId,
        activation_date: snapshotData.activationDate,
        payment_method_snapshot: snapshotData.paymentMethod || {},
        selected_channels_snapshot: snapshotData.selectedChannels,
        // Store the complete summary for immutability
        contract_summary_snapshot: {
          client: snapshotData.client,
          services: snapshotData.services,
          equipment: snapshotData.equipment,
          fees: snapshotData.fees,
          billing: snapshotData.billing,
          billCycleDay: snapshotData.billCycleDay,
          paymentMethod: snapshotData.paymentMethod,
          selectedChannels: snapshotData.selectedChannels,
          snapshotCreatedAt: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (error) throw error;
    return { success: true, snapshotId: data.id };
  } catch (error: any) {
    console.error("Failed to create order snapshot:", error);
    return { success: false, error: error.message };
  }
}

// Create/update fulfillment snapshot when order is processed
export async function createFulfillmentSnapshot(
  orderId: string,
  snapshotData: FulfillmentSnapshotData,
  userId: string,
  userRole: string,
  userName?: string
): Promise<{ success: boolean; snapshotId?: string; version?: number; error?: string }> {
  try {
    // Get current max version
    const { data: existing } = await supabase
      .from("fulfillment_snapshots")
      .select("version")
      .eq("order_id", orderId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = existing ? existing.version + 1 : 2;

    const { data, error } = await supabase
      .from("fulfillment_snapshots")
      .insert({
        order_id: orderId,
        version: nextVersion,
        delivery_method: snapshotData.deliveryMethod,
        delivery_fee: snapshotData.deliveryFee,
        tracking_number: snapshotData.trackingNumber,
        tracking_url: snapshotData.trackingUrl,
        installation_selected: snapshotData.installationSelected,
        installation_fee: snapshotData.installationFee,
        technician_eta: snapshotData.technicianETA,
        invoice_number: snapshotData.invoiceNumber,
        payment_method: snapshotData.paymentMethod,
        payment_status: snapshotData.paymentStatus,
        payment_reference: snapshotData.paymentReference,
        equipment_ids: snapshotData.equipmentIds,
        updated_by_id: userId,
        updated_by_role: userRole,
        updated_by_name: userName,
      })
      .select("id")
      .single();

    if (error) throw error;

    // Update order agreement version
    await supabase
      .from("orders")
      .update({ agreement_version: nextVersion })
      .eq("id", orderId);

    return { success: true, snapshotId: data.id, version: nextVersion };
  } catch (error: any) {
    console.error("Failed to create fulfillment snapshot:", error);
    return { success: false, error: error.message };
  }
}

// Build OrderDocumentData from order and snapshots
export async function buildOrderDocumentData(
  orderId: string,
  docType: "order_confirmation_agreement" | "final_service_agreement"
): Promise<OrderDocumentData | null> {
  try {
    // Fetch order with profile
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*, profiles:user_id(full_name, first_name, last_name, email, phone, service_address, service_city, service_province, service_postal_code)")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) return null;

    // Fetch order snapshot
    const { data: orderSnapshot } = await supabase
      .from("order_snapshots")
      .select("*")
      .eq("order_id", orderId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Build client info from profile or snapshot
    const profile = order.profiles as any;
    const clientSnapshot = (orderSnapshot?.client_snapshot || {}) as Record<string, any>;
    
    const client = {
      legalName: clientSnapshot?.legalName || profile?.full_name || "N/A",
      firstName: clientSnapshot?.firstName || profile?.first_name || "",
      lastName: clientSnapshot?.lastName || profile?.last_name || "",
      type: (clientSnapshot?.type || "Individual") as "Individual" | "Business",
      email: clientSnapshot?.email || profile?.email || order.client_email || "",
      phone: clientSnapshot?.phone || profile?.phone || "",
      billingAddress: clientSnapshot?.billingAddress || profile?.service_address || "",
      serviceAddress: clientSnapshot?.serviceAddress || profile?.service_address || "",
      serviceCity: clientSnapshot?.serviceCity || profile?.service_city || "",
      serviceProvince: clientSnapshot?.serviceProvince || profile?.service_province || "QC",
      servicePostalCode: clientSnapshot?.servicePostalCode || profile?.service_postal_code || "",
      authorizedUser: clientSnapshot?.authorizedUser,
    };

    const snapshotData: OrderSnapshotData = {
      client,
      services: (orderSnapshot?.services_snapshot as any[]) || [{
        type: order.category || "Service",
        planName: order.service_type,
        monthlyPrice: order.subtotal || 0,
      }],
      equipment: (orderSnapshot?.equipment_snapshot as any[]) || [],
      fees: (orderSnapshot?.fees_snapshot as any) || {
        activationFee: order.activation_fee || 0,
        deliveryFee: order.delivery_fee || 0,
        installationFee: order.installation_fee || 0,
        installationCredit: order.installation_credit || 0,
        routerFee: order.router_fee || 0,
        terminalFee: order.terminal_fee || 0,
      },
      billing: (orderSnapshot?.billing_snapshot as any) || {
        mrc: order.subtotal || 0,
        otc: (order.delivery_fee || 0) + (order.activation_fee || 0) + (order.installation_fee || 0),
        subtotal: order.subtotal || 0,
        gst: order.tps_amount || 0,
        qst: order.tvq_amount || 0,
        totalDueToday: order.total_amount || 0,
        estimatedNextMonth: order.subtotal || 0,
      },
      acceptedAt: orderSnapshot?.accepted_at || order.created_at,
      acceptedMethod: (orderSnapshot?.accepted_method as "electronic" | "manual") || "electronic",
    };

    const docData: OrderDocumentData = {
      orderConfirmationNumber: order.confirmation_number || order.order_number || "",
      orderNumber: order.order_number || "",
      orderDate: order.created_at,
      status: order.status,
      category: order.category,
      contractNumber: `CTR-QC-${order.order_number || order.id.slice(0, 8)}`,
      agreementVersion: order.agreement_version || 1,
      issueDate: format(new Date(), "d MMMM yyyy", { locale: fr }),
      effectiveDate: format(new Date(order.created_at), "d MMMM yyyy", { locale: fr }),
      orderChannel: order.created_by === "admin" ? "Admin Assisted" : "Client Portal",
      orderSnapshot: snapshotData,
      docType,
    };

    // For Document B, add fulfillment data
    if (docType === "final_service_agreement") {
      const { data: fulfillmentSnapshot } = await supabase
        .from("fulfillment_snapshots")
        .select("*")
        .eq("order_id", orderId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      docData.fulfillmentSnapshot = {
        deliveryMethod: fulfillmentSnapshot?.delivery_method || order.delivery_method || "Standard Québec Delivery",
        deliveryFee: fulfillmentSnapshot?.delivery_fee ?? order.delivery_fee ?? 0,
        trackingNumber: fulfillmentSnapshot?.tracking_number || order.tracking_number,
        trackingUrl: fulfillmentSnapshot?.tracking_url || order.tracking_url,
        installationSelected: fulfillmentSnapshot?.installation_selected ?? (order.installation_type === "technician"),
        installationFee: fulfillmentSnapshot?.installation_fee ?? order.installation_fee ?? 0,
        technicianETA: fulfillmentSnapshot?.technician_eta,
        invoiceNumber: fulfillmentSnapshot?.invoice_number,
        paymentMethod: fulfillmentSnapshot?.payment_method,
        paymentStatus: (fulfillmentSnapshot?.payment_status || (order.payment_status === "captured" ? "paid" : "unpaid")) as "paid" | "unpaid",
        paymentReference: fulfillmentSnapshot?.payment_reference || order.payment_reference,
        equipmentIds: (fulfillmentSnapshot?.equipment_ids as any[]) || [],
      };

      if (fulfillmentSnapshot) {
        docData.agreementVersion = fulfillmentSnapshot.version;
      }
    }

    return docData;
  } catch (error) {
    console.error("Failed to build document data:", error);
    return null;
  }
}

// Save document reference to database
export async function saveOrderDocument(
  orderId: string,
  docType: "order_confirmation_agreement" | "final_service_agreement",
  version: number,
  fileName: string,
  generatedBy?: string,
  generatedByRole?: string
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("order_documents")
      .insert({
        order_id: orderId,
        doc_type: docType,
        version,
        file_name: fileName,
        generated_by: generatedBy,
        generated_by_role: generatedByRole,
      })
      .select("id")
      .single();

    if (error) throw error;
    return { success: true, documentId: data.id };
  } catch (error: any) {
    console.error("Failed to save document:", error);
    return { success: false, error: error.message };
  }
}
