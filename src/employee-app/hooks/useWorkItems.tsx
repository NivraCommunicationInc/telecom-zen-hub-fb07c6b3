/**
 * useWorkItems — Fetches from employee_work_items table (Phase 3).
 * Replaces the old multi-table query approach with a unified work queue.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { useEffect } from "react";

export interface WorkItem {
  id: string;
  item_type: "order" | "payment" | "kyc" | "activation" | "ticket";
  source_id: string;
  source_reference: string | null;
  client_id: string | null;
  client_name: string | null;
  client_email: string | null;
  team: string;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  status: string;
  priority: "low" | "normal" | "high" | "urgent";
  sla_status: "on_time" | "at_risk" | "breached";
  sla_deadline_at: string | null;
  sla_breached_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export function useWorkItems(filter?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<WorkItem[]>({
    queryKey: ["employee-work-items", filter],
    queryFn: async () => {
      let q = supabase
        .from("employee_work_items")
        .select("*")
        .in("status", ["open", "assigned", "in_progress", "escalated"])
        .order("created_at", { ascending: true })
        .limit(200);

      if (filter === "mine" && user?.id) {
        q = q.eq("assigned_to_id", user.id);
      } else if (filter === "unassigned") {
        q = q.is("assigned_to_id", null);
      } else if (filter === "urgent") {
        q = q.in("priority", ["urgent", "high"]);
      } else if (filter === "breached") {
        q = q.eq("sla_status", "breached");
      } else if (filter && ["order", "payment", "kyc", "activation", "ticket"].includes(filter)) {
        q = q.eq("item_type", filter);
      }

      const { data, error } = await q;
      if (error) throw error;

      // Sort: urgent first, then by SLA status, then by creation date
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      const slaOrder = { breached: 0, at_risk: 1, on_time: 2 };

      return ((data || []) as WorkItem[]).sort((a, b) => {
        const slaD = (slaOrder[a.sla_status] ?? 2) - (slaOrder[b.sla_status] ?? 2);
        if (slaD !== 0) return slaD;
        const pd = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
        if (pd !== 0) return pd;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    },
    staleTime: 1000 * 60,
  });

  // Realtime subscription for work items changes
  useEffect(() => {
    const channel = supabase
      .channel("work-items-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employee_work_items" },
        () => queryClient.invalidateQueries({ queryKey: ["employee-work-items"] })
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function useWorkItemCounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["employee-work-item-counts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_work_items")
        .select("item_type, status, priority, sla_status, assigned_to_id")
        .in("status", ["open", "assigned", "in_progress", "escalated"]);

      if (error) throw error;
      const items = data || [];

      return {
        total: items.length,
        mine: items.filter((i: any) => i.assigned_to_id === user?.id).length,
        unassigned: items.filter((i: any) => !i.assigned_to_id).length,
        urgent: items.filter((i: any) => i.priority === "urgent" || i.priority === "high").length,
        breached: items.filter((i: any) => i.sla_status === "breached").length,
        atRisk: items.filter((i: any) => i.sla_status === "at_risk").length,
        byType: {
          order: items.filter((i: any) => i.item_type === "order").length,
          payment: items.filter((i: any) => i.item_type === "payment").length,
          kyc: items.filter((i: any) => i.item_type === "kyc").length,
          activation: items.filter((i: any) => i.item_type === "activation").length,
          ticket: items.filter((i: any) => i.item_type === "ticket").length,
        },
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });
}
