/**
 * useAccountAddresses — hook partagé multi-portails (Pass 3A).
 *
 * Source de vérité UNIQUE : table `service_addresses`.
 * Aucune supposition sur le nombre d'adresses (0, 1, 2, 5, 10+).
 * Aucun accès `addresses[0]` / `primary` : toujours une collection.
 *
 * Utilisé par : Guest Checkout, Portail Client, Core, Employee, Field.
 */
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { portalClient } from "@/integrations/backend/portalClient";

export interface ServiceAddress {
  id: string;
  account_id: string | null;
  address_line: string;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  created_at: string;
  deleted_at?: string | null;
  [key: string]: any;
}

export interface CreateAddressInput {
  address_line: string;
  city: string;
  province?: string;
  postal_code: string;
  country?: string;
  contact_name?: string;
  contact_phone?: string;
  notes?: string;
}

export function useAccountAddresses(accountId: string | null | undefined) {
  const qc = useQueryClient();
  const queryKey = ["account-service-addresses", accountId];
  const backend =
    typeof window !== "undefined" && window.location.pathname.startsWith("/portal")
      ? portalClient
      : supabase;

  const query = useQuery({
    queryKey,
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await backend
        .from("service_addresses")
        .select("*")
        .eq("account_id", accountId as string)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ServiceAddress[];
    },
  });

  // Realtime: rafraîchissement automatique quand une adresse change
  useEffect(() => {
    if (!accountId) return;
    const channel = backend
      .channel(`sa-${accountId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_addresses", filter: `account_id=eq.${accountId}` },
        () => qc.invalidateQueries({ queryKey: ["account-service-addresses", accountId] }),
      )
      .subscribe();
    return () => {
      backend.removeChannel(channel);
    };
  }, [accountId, qc, backend]);

  const create = useMutation({
    mutationFn: async (input: CreateAddressInput) => {
      if (!accountId) throw new Error("accountId required");
      const { data, error } = await backend.rpc("resolve_or_create_service_address", {
        p_account_id: accountId,
        p_address: input.address_line,
        p_city: input.city,
        p_province: input.province ?? "QC",
        p_postal: input.postal_code,
        p_created_via: typeof window !== "undefined" && window.location.pathname.startsWith("/portal") ? "portal" : "core",
        p_actor_user_id: null,
        p_order_id: null,
        p_employee_id: null,
        p_field_agent_id: null,
        p_label: null,
      } as any);
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await backend
        .from("service_addresses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    addresses: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    create: create.mutateAsync,
    creating: create.isPending,
    softDelete: softDelete.mutateAsync,
    deleting: softDelete.isPending,
  };
}
