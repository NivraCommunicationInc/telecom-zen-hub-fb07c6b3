/**
 * useSupplierAccounts — Admin-only hooks for managing supplier accounts.
 * All operations route through SECURITY DEFINER RPCs that enforce admin role server-side.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SupplierAccountStatus = "active" | "suspended" | "cancelled";

export interface SupplierAccount {
  id: string;
  client_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  mothers_maiden_name: string;
  account_email: string;
  service_name: string;
  monthly_price: number;
  activation_date: string;
  status: SupplierAccountStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierAccountWithClient extends SupplierAccount {
  client?: {
    user_id: string;
    full_name: string | null;
    email: string | null;
    client_number: string | null;
  } | null;
}

export interface SupplierAccountInput {
  client_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  mothers_maiden_name: string;
  account_email: string;
  account_password: string;
  service_name: string;
  monthly_price: number;
  activation_date: string;
  status: SupplierAccountStatus;
  notes?: string | null;
}

// ── List / fetch ─────────────────────────────────────────────────
export function useSupplierAccounts() {
  return useQuery({
    queryKey: ["supplier-accounts"],
    queryFn: async (): Promise<SupplierAccountWithClient[]> => {
      const { data, error } = await supabase
        .from("supplier_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const accounts = (data ?? []) as SupplierAccount[];
      const clientIds = Array.from(new Set(accounts.map((a) => a.client_id)));
      if (clientIds.length === 0) return accounts;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, client_number")
        .in("user_id", clientIds);

      const map = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      return accounts.map((a) => ({ ...a, client: map.get(a.client_id) ?? null }));
    },
  });
}

export function useSupplierAccount(id: string | undefined) {
  return useQuery({
    queryKey: ["supplier-account", id],
    enabled: !!id,
    queryFn: async (): Promise<SupplierAccountWithClient | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("supplier_accounts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const account = data as SupplierAccount;

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, client_number")
        .eq("user_id", account.client_id)
        .maybeSingle();

      return { ...account, client: profile ?? null };
    },
  });
}

export function useSupplierAccountByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ["supplier-account-by-client", clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<SupplierAccount[]> => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("supplier_accounts")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupplierAccount[];
    },
  });
}

// ── Create ──────────────────────────────────────────────────────
export function useCreateSupplierAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SupplierAccountInput): Promise<string> => {
      const { data, error } = await supabase.rpc("create_supplier_account", {
        p_client_id: input.client_id,
        p_first_name: input.first_name,
        p_last_name: input.last_name,
        p_date_of_birth: input.date_of_birth,
        p_mothers_maiden_name: input.mothers_maiden_name,
        p_account_email: input.account_email,
        p_account_password: input.account_password,
        p_service_name: input.service_name,
        p_monthly_price: input.monthly_price,
        p_activation_date: input.activation_date,
        p_status: input.status,
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-accounts"] });
      toast.success("Compte fournisseur créé");
    },
    onError: (e: any) => toast.error(e?.message ?? "Création impossible"),
  });
}

// ── Update ──────────────────────────────────────────────────────
export function useUpdateSupplierAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: SupplierAccountInput & { account_password: string }; // empty string = unchanged
    }) => {
      const { error } = await supabase.rpc("update_supplier_account", {
        p_id: id,
        p_client_id: input.client_id,
        p_first_name: input.first_name,
        p_last_name: input.last_name,
        p_date_of_birth: input.date_of_birth,
        p_mothers_maiden_name: input.mothers_maiden_name,
        p_account_email: input.account_email,
        p_account_password: input.account_password || null,
        p_service_name: input.service_name,
        p_monthly_price: input.monthly_price,
        p_activation_date: input.activation_date,
        p_status: input.status,
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["supplier-accounts"] });
      qc.invalidateQueries({ queryKey: ["supplier-account", vars.id] });
      toast.success("Compte fournisseur mis à jour");
    },
    onError: (e: any) => toast.error(e?.message ?? "Mise à jour impossible"),
  });
}

// ── Delete ──────────────────────────────────────────────────────
export function useDeleteSupplierAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("supplier_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-accounts"] });
      toast.success("Compte fournisseur supprimé");
    },
    onError: (e: any) => toast.error(e?.message ?? "Suppression impossible"),
  });
}

// ── Reveal password (audited server-side) ───────────────────────
export async function revealSupplierPassword(id: string): Promise<string> {
  const { data, error } = await supabase.rpc("reveal_supplier_password", { p_id: id });
  if (error) throw error;
  return data as string;
}

// ── Helpers ─────────────────────────────────────────────────────
export const STATUS_LABEL: Record<SupplierAccountStatus, string> = {
  active: "Actif",
  suspended: "Suspendu",
  cancelled: "Annulé",
};
