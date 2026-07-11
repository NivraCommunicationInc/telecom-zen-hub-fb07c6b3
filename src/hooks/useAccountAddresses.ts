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

  // Module 49 Phase B2: all writes go through client-account-actions gateway.
  const invokeGateway = async <T = any>(body: Record<string, unknown>): Promise<T> => {
    const { data, error } = await (backend as any).functions.invoke("client-account-actions", { body });
    if (error) {
      const detail = (error as any)?.context?.text ? await (error as any).context.text() : error.message;
      throw new Error(detail || error.message || "Gateway error");
    }
    return data as T;
  };

  const create = useMutation({
    mutationFn: async (input: CreateAddressInput) => {
      if (!accountId) throw new Error("accountId required");
      const idempotencyKey = `sa-create:${accountId}:${(input.address_line || "").toLowerCase().replace(/\s+/g, "-").slice(0, 60)}:${Date.now()}`;
      const res = await invokeGateway<{ ok: boolean; service_address: ServiceAddress; correlation_id: string }>({
        action: "service_address.create",
        account_id: accountId,
        payload: {
          address_line: input.address_line,
          city: input.city,
          province: input.province ?? "QC",
          postal_code: input.postal_code,
          contact_name: input.contact_name,
          contact_phone: input.contact_phone,
          notes: input.notes,
          label: input.notes ?? undefined,
        },
        idempotency_key: idempotencyKey,
      });
      const confirmed = res?.service_address;
      if (!confirmed?.id) throw new Error("La création de l'adresse a échoué (gateway).");
      qc.setQueryData<ServiceAddress[]>(queryKey, (current = []) => {
        const next = current.filter((address) => address.id !== confirmed.id);
        next.push(confirmed as ServiceAddress);
        return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });
      await qc.invalidateQueries({ queryKey });
      await qc.refetchQueries({ queryKey });
      return confirmed.id;
    },
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      if (!accountId) throw new Error("accountId required");
      await invokeGateway({
        action: "service_address.soft_delete",
        account_id: accountId,
        payload: { service_address_id: id },
        idempotency_key: `sa-delete:${accountId}:${id}:${Date.now()}`,
      });
      await qc.invalidateQueries({ queryKey });
      await qc.refetchQueries({ queryKey });
    },
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      if (!accountId) throw new Error("accountId required");
      await invokeGateway({
        action: "service_address.restore",
        account_id: accountId,
        payload: { service_address_id: id },
        idempotency_key: `sa-restore:${accountId}:${id}:${Date.now()}`,
      });
      await qc.invalidateQueries({ queryKey });
      await qc.refetchQueries({ queryKey });
    },
  });

  const update = useMutation({
    mutationFn: async (input: { id: string; patch: Partial<CreateAddressInput> & { label?: string; is_primary?: boolean } }) => {
      if (!accountId) throw new Error("accountId required");
      await invokeGateway({
        action: "service_address.update",
        account_id: accountId,
        payload: { service_address_id: input.id, ...input.patch },
        idempotency_key: `sa-update:${accountId}:${input.id}:${Date.now()}`,
      });
      await qc.invalidateQueries({ queryKey });
      await qc.refetchQueries({ queryKey });
    },
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
