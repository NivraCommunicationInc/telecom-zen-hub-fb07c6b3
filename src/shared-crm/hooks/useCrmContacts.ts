/**
 * useCrmContacts — Realtime list of CRM contacts with filters.
 */
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmContact } from "../lib/crmTypes";

export interface CrmFilters {
  search?: string;
  status?: string;
  city?: string;
  agentId?: string; // filter to a specific agent's assigned contacts
  onlyAssignedToMe?: boolean;
  currentUserId?: string;
}

export function useCrmContacts(filters: CrmFilters = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["crm-contacts", filters.status ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("crm_contacts")
        .select(
          "id, first_name, last_name, full_name, phone, email, address, city, postal_code, date_of_birth, desired_install_date, service_address, service_city, service_postal_code, call_status, call_attempts, last_called_at, last_called_by, call_notes, callback_scheduled_at, next_callback_at, is_locked, locked_by, locked_by_name, locked_at, locked_until, assigned_to, converted_to_user_id, converted_order_id, priority, territory, source, status, is_dnc, dnc_reason, interest_tags, created_at"
        )

        .order("priority", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1000);
      if (filters.status && filters.status !== "all") {
        q = q.eq("call_status", filters.status);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CrmContact[];
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("crm-contacts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_contacts" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filtered = useMemo(() => {
    const list = query.data ?? [];
    const needle = filters.search?.trim().toLowerCase() ?? "";
    return list.filter((c) => {
      if (filters.city && filters.city !== "all" && c.city !== filters.city) return false;
      if (filters.onlyAssignedToMe && filters.currentUserId && c.assigned_to !== filters.currentUserId) return false;
      if (filters.agentId && c.assigned_to !== filters.agentId) return false;
      if (!needle) return true;
      const hay = [c.full_name, c.first_name, c.last_name, c.phone, c.email, c.city, c.address, c.postal_code]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [query.data, filters.search, filters.city, filters.onlyAssignedToMe, filters.currentUserId, filters.agentId]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    (query.data ?? []).forEach((c) => { if (c.city) set.add(c.city); });
    return ["all", ...Array.from(set).sort()];
  }, [query.data]);

  const stats = useMemo(() => {
    const list = query.data ?? [];
    return {
      total: list.length,
      to_call: list.filter((c) => c.call_status === "not_called").length,
      in_progress: list.filter((c) => c.call_status === "in_progress").length,
      callback: list.filter((c) => c.call_status === "callback").length,
      sold: list.filter((c) => c.call_status === "sold").length,
    };
  }, [query.data]);

  return {
    ...query,
    contacts: filtered,
    allContacts: query.data ?? [],
    cities,
    stats,
  };
}
