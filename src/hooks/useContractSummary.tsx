/**
 * Hook to fetch and build ContractSummaryData from order snapshots
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { portalSupabase } from "@/integrations/supabase/portalClient";
import type { ContractSummaryData } from "@/components/contract/ContractSummaryView";

interface UseContractSummaryOptions {
  orderId: string;
  usePortalClient?: boolean;
}

/**
 * Build ContractSummaryData from order and snapshot data
 */
export function buildContractSummaryFromOrder(
  order: any,
  snapshot: any,
  profile?: any,
  account?: any
): ContractSummaryData {
  const clientSnapshot = (snapshot?.client_snapshot || {}) as Record<string, any>;
  const servicesSnapshot = (snapshot?.services_snapshot || []) as any[];
  const feesSnapshot = (snapshot?.fees_snapshot || {}) as Record<string, any>;
  const billingSnapshot = (snapshot?.billing_snapshot || {}) as Record<string, any>;
  const paymentSnapshot = (snapshot?.payment_method_snapshot || {}) as Record<string, any>;
  const channelsSnapshot = snapshot?.selected_channels_snapshot as any;
  
  // Build client info from snapshot first, fallback to profile/order
  const client = {
    legalName: clientSnapshot?.legalName || profile?.full_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "À confirmer",
    firstName: clientSnapshot?.firstName || profile?.first_name,
    lastName: clientSnapshot?.lastName || profile?.last_name,
    phone: clientSnapshot?.phone || profile?.phone || order?.shipping_phone || "À confirmer",
    email: clientSnapshot?.email || profile?.email || order?.client_email || "À confirmer",
    serviceAddress: clientSnapshot?.serviceAddress || profile?.service_address || order?.shipping_address || "À confirmer",
    serviceCity: clientSnapshot?.serviceCity || profile?.service_city || order?.shipping_city,
    serviceProvince: clientSnapshot?.serviceProvince || profile?.service_province || order?.shipping_province || "QC",
    servicePostalCode: clientSnapshot?.servicePostalCode || profile?.service_postal_code || order?.shipping_postal_code,
    billingAddress: clientSnapshot?.billingAddress,
    accountId: account?.id || order?.account_id,
    dateOfBirth: profile?.date_of_birth,
  };

  // Build services from snapshot or order
  const services: ContractSummaryData["services"] = servicesSnapshot.length > 0
    ? servicesSnapshot.map((s: any) => ({
        type: s.type || order?.category || "Service",
        planName: s.planName || s.name || order?.service_type || "À confirmer",
        monthlyPrice: s.monthlyPrice || s.price || 0,
        speed: s.speed,
        terminal: s.terminal,
        lineCount: s.lineCount,
        portability: s.portability || (order?.port_request as any)?.port_in,
        numberToPort: s.numberToPort || (order?.port_request as any)?.phone_number,
        equipment: s.equipment,
      }))
    : [{
        type: order?.category || "Service",
        planName: order?.service_type || "À confirmer",
        monthlyPrice: order?.subtotal || 0,
        portability: (order?.port_request as any)?.port_in,
        numberToPort: (order?.port_request as any)?.phone_number,
      }];

  // Build TV channels summary
  const tvChannels = channelsSnapshot || (order?.selected_channels ? {
    baseChannels: 25,
    freeChoiceCount: (order.selected_channels as any[])?.filter((c: any) => !c.is_premium)?.length || 0,
    premiumCount: (order.selected_channels as any[])?.filter((c: any) => c.is_premium)?.length || 0,
    premiumTotal: (order.selected_channels as any[])?.filter((c: any) => c.is_premium)
      ?.reduce((sum: number, c: any) => sum + (c.price || 0), 0) || 0,
  } : undefined);

  // Build dates
  const dates = {
    accountCreated: account?.created_at || order?.created_at,
    billCycleDay: snapshot?.bill_cycle_day || account?.billing_cycle_day,
    activationDate: snapshot?.activation_date || order?.processed_at,
    nextInvoiceDate: account?.next_invoice_date,
    dueDate: billingSnapshot?.dueDate,
  };

  // Build one-time fees
  const oneTimeFees = {
    router: feesSnapshot?.routerFee ?? order?.router_fee ?? 0,
    terminal4k: feesSnapshot?.terminalFee ?? order?.terminal_fee ?? 0,
    activationFee: feesSnapshot?.activationFee ?? order?.activation_fee ?? 0,
    installationFee: feesSnapshot?.installationFee ?? order?.installation_fee ?? 0,
    deliveryFee: feesSnapshot?.deliveryFee ?? order?.delivery_fee ?? 0,
  };

  // Build payment info
  const paymentMethod = paymentSnapshot?.method || order?.payment_method || 
    (order?.payment_reference?.toLowerCase().includes("etransfer") ? "etransfer" : "card");
  
  const payment = {
    method: paymentMethod,
    etransferRule: paymentSnapshot?.etransferRule,
    deposit: paymentSnapshot?.deposit,
    depositConditions: paymentSnapshot?.depositConditions,
  };

  return {
    client,
    orderId: order?.id || "",
    orderNumber: order?.order_number,
    contractNumber: `CTR-QC-${order?.order_number || order?.id?.slice(0, 8) || ""}`,
    accountNumber: account?.account_number,
    services,
    tvChannels,
    dates,
    oneTimeFees,
    payment,
    snapshotCreatedAt: snapshot?.created_at || snapshot?.accepted_at,
    agreementVersion: snapshot?.version || order?.agreement_version || 1,
  };
}

export function useContractSummary({ orderId, usePortalClient = false }: UseContractSummaryOptions) {
  const client = usePortalClient ? portalSupabase : supabase;

  return useQuery({
    queryKey: ["contract-summary", orderId],
    queryFn: async () => {
      if (!orderId) return null;

      // Fetch order with profile
      const { data: order, error: orderErr } = await client
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (orderErr || !order) {
        console.error("Failed to fetch order for summary:", orderErr);
        return null;
      }

      // Fetch profile
      const { data: profile } = await client
        .from("profiles")
        .select("*")
        .eq("user_id", order.user_id)
        .maybeSingle();

      // Fetch order snapshot - prioritize contract_summary_snapshot if available
      const { data: snapshot } = await client
        .from("order_snapshots")
        .select("*")
        .eq("order_id", orderId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      // If we have a complete contract_summary_snapshot, use it directly (immutable)
      const contractSummarySnapshot = snapshot?.contract_summary_snapshot as Record<string, any> | null;
      if (contractSummarySnapshot && Object.keys(contractSummarySnapshot).length > 0) {
        // Return the snapshot data directly - it's immutable
        return {
          client: {
            legalName: contractSummarySnapshot.client?.legalName || "À confirmer",
            firstName: contractSummarySnapshot.client?.firstName,
            lastName: contractSummarySnapshot.client?.lastName,
            phone: contractSummarySnapshot.client?.phone || "À confirmer",
            email: contractSummarySnapshot.client?.email || "À confirmer",
            serviceAddress: contractSummarySnapshot.client?.serviceAddress || "À confirmer",
            serviceCity: contractSummarySnapshot.client?.serviceCity,
            serviceProvince: contractSummarySnapshot.client?.serviceProvince || "QC",
            servicePostalCode: contractSummarySnapshot.client?.servicePostalCode,
            billingAddress: contractSummarySnapshot.client?.billingAddress,
            accountId: snapshot?.account_id || order?.account_id,
          },
          orderId: order?.id || "",
          orderNumber: order?.order_number,
          contractNumber: `CTR-QC-${order?.order_number || order?.id?.slice(0, 8) || ""}`,
          accountNumber: undefined,
          services: contractSummarySnapshot.services || [],
          tvChannels: contractSummarySnapshot.selectedChannels ? {
            baseChannels: 25,
            freeChoiceCount: contractSummarySnapshot.selectedChannels.freeChoiceCount || 0,
            premiumCount: contractSummarySnapshot.selectedChannels.premiumCount || 0,
            premiumTotal: contractSummarySnapshot.selectedChannels.premiumTotal || 0,
          } : undefined,
          dates: {
            accountCreated: snapshot?.created_at || order?.created_at,
            billCycleDay: contractSummarySnapshot.billCycleDay || snapshot?.bill_cycle_day,
            activationDate: snapshot?.activation_date || order?.processed_at,
            nextInvoiceDate: undefined,
            dueDate: contractSummarySnapshot.billing?.dueDate,
          },
          oneTimeFees: {
            router: contractSummarySnapshot.fees?.routerFee ?? 0,
            terminal4k: contractSummarySnapshot.fees?.terminalFee ?? 0,
            activationFee: contractSummarySnapshot.fees?.activationFee ?? 0,
            installationFee: contractSummarySnapshot.fees?.installationFee ?? 0,
            deliveryFee: contractSummarySnapshot.fees?.deliveryFee ?? 0,
          },
          payment: {
            method: contractSummarySnapshot.paymentMethod?.method || "card",
            etransferRule: contractSummarySnapshot.paymentMethod?.etransferRule,
            deposit: contractSummarySnapshot.paymentMethod?.deposit,
            depositConditions: contractSummarySnapshot.paymentMethod?.depositConditions,
          },
          snapshotCreatedAt: contractSummarySnapshot.snapshotCreatedAt || snapshot?.created_at,
          agreementVersion: snapshot?.version || order?.agreement_version || 1,
        } as ContractSummaryData;
      }

      // Fetch account if linked
      let account = null;
      if (order.account_id) {
        const { data: acc } = await client
          .from("accounts")
          .select("*")
          .eq("id", order.account_id)
          .maybeSingle();
        account = acc;
      }

      // Fallback: build from order/profile data
      return buildContractSummaryFromOrder(order, snapshot, profile, account);
    },
    enabled: !!orderId,
  });
}

export default useContractSummary;
