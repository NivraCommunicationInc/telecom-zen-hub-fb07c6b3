/**
 * Unified Client Search Hook
 * Searches across profiles, billing_customers, accounts, order_snapshots, billing_invoices
 * Normalizes email with trim + lowercase
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";

export interface UnifiedClientResult {
  source: string;
  source_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  has_profile: boolean;
  has_billing_customer: boolean;
  has_account: boolean;
  has_invoices: boolean;
  has_orders: boolean;
}

interface UseUnifiedClientSearchOptions {
  enabled?: boolean;
}

export function useUnifiedClientSearch(options: UseUnifiedClientSearchOptions = {}) {
  const [searchEmail, setSearchEmail] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchPhone, setSearchPhone] = useState("");

  // Normalize inputs before sending
  const normalizedEmail = searchEmail.trim().toLowerCase();
  const normalizedName = searchName.trim().toLowerCase();
  const normalizedPhone = searchPhone.replace(/[^0-9]/g, "");

  const { data: results, isLoading, error, refetch } = useQuery({
    queryKey: ["unified-client-search", normalizedEmail, normalizedName, normalizedPhone],
    queryFn: async () => {
      if (!normalizedEmail && !normalizedName && !normalizedPhone) {
        return [];
      }

      const { data, error } = await supabase.rpc("search_clients_unified", {
        search_email: normalizedEmail || null,
        search_name: normalizedName || null,
        search_phone: normalizedPhone || null,
      });

      if (error) {
        console.error("[UnifiedClientSearch] RPC error:", error);
        throw error;
      }

      return (data as UnifiedClientResult[]) || [];
    },
    enabled: options.enabled !== false && (!!normalizedEmail || !!normalizedName || !!normalizedPhone),
    staleTime: 30000,
  });

  const search = (email?: string, name?: string, phone?: string) => {
    if (email !== undefined) setSearchEmail(email);
    if (name !== undefined) setSearchName(name);
    if (phone !== undefined) setSearchPhone(phone);
  };

  const clearSearch = () => {
    setSearchEmail("");
    setSearchName("");
    setSearchPhone("");
  };

  return {
    results: results || [],
    isLoading,
    error,
    searchEmail,
    searchName,
    searchPhone,
    search,
    setSearchEmail,
    setSearchName,
    setSearchPhone,
    clearSearch,
    refetch,
  };
}

/**
 * Hook to fetch orphaned payments (payments without linked profile)
 */
export function useOrphanedPayments() {
  return useQuery({
    queryKey: ["qa-orphaned-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qa_orphaned_payments")
        .select("*")
        .limit(100);

      if (error) {
        console.error("[OrphanedPayments] Query error:", error);
        throw error;
      }

      return data || [];
    },
    staleTime: 60000,
  });
}

/**
 * Hook to fetch payments without any client entity
 */
export function usePaymentsWithoutClient() {
  return useQuery({
    queryKey: ["qa-payments-without-client"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qa_payments_without_client")
        .select("*")
        .limit(100);

      if (error) {
        console.error("[PaymentsWithoutClient] Query error:", error);
        throw error;
      }

      return data || [];
    },
    staleTime: 60000,
  });
}
