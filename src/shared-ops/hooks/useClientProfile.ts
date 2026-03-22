/**
 * useClientProfile — Shared canonical client profile loader.
 * Single source of truth for client data across Core and Employee portals.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientProfileData {
  profile: any;
  account: any | null;
  orders: any[];
  invoices: any[];
  payments: any[];
  subscriptions: any[];
  equipment: any[];
  billingCustomer: any | null;
}

export function useClientProfile(clientId: string | undefined) {
  return useQuery<ClientProfileData>({
    queryKey: ["shared-client-profile", clientId],
    enabled: !!clientId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      if (!clientId) throw new Error("Client ID manquant");
      const { data: profile, error } = await supabase.from("profiles").select("*").eq("user_id", clientId).single();
      if (error) throw error;

      const [accountRes, ordersRes] = await Promise.all([
        supabase.from("accounts").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("orders").select("id, order_number, status, created_at, service_type, total_amount, payment_status").eq("user_id", clientId).eq("environment", "live").order("created_at", { ascending: false }).limit(50),
      ]);

      const account = accountRes.data;
      const orders = ordersRes.data ?? [];

      let billingCustomer = null;
      if (profile?.email) {
        const { data: bc } = await supabase.from("billing_customers").select("*").eq("email", profile.email.trim().toLowerCase()).maybeSingle();
        billingCustomer = bc;
      }

      let invoices: any[] = [], payments: any[] = [], subscriptions: any[] = [], equipment: any[] = [];
      if (billingCustomer?.id) {
        const [invRes, payRes, subRes] = await Promise.all([
          supabase.from("billing_invoices").select("id, invoice_number, total, status, due_date, paid_at, balance_due, type, created_at").eq("customer_id", billingCustomer.id).eq("environment", "live").order("created_at", { ascending: false }).limit(50),
          supabase.from("billing_payments").select("id, payment_number, amount, method, status, received_at, reference, created_at").eq("customer_id", billingCustomer.id).eq("environment", "live").order("created_at", { ascending: false }).limit(50),
          supabase.from("billing_subscriptions").select("id, plan_name, plan_price, status, cycle_start_date, cycle_end_date, next_renewal_at").eq("customer_id", billingCustomer.id).eq("environment", "live").order("created_at", { ascending: false }).limit(20),
        ]);
        invoices = invRes.data ?? []; payments = payRes.data ?? []; subscriptions = subRes.data ?? [];
      }

      const orderIds = orders.map((o: any) => o.id);
      if (orderIds.length > 0) {
        const { data: eq } = await supabase.from("equipment_inventory").select("id, catalog_name, serial_number, mac_address, status, category, order_id").in("order_id", orderIds);
        equipment = eq ?? [];
      }

      return { profile, account, orders, invoices, payments, subscriptions, equipment, billingCustomer };
    },
  });
}