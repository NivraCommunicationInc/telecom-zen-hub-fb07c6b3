import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { backendClient as supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

export interface StreamingCatalogItem {
  id: string;
  name: string;
  status: "active" | "hold" | "inactive";
  category: "video" | "music";
  description: string | null;
  price_monthly: number;
  currency: string;
  features: string[];
  sort_order: number;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface StreamingSnapshot {
  id: string;
  name: string;
  price_monthly: number;
  category: "video" | "music";
}

// Active items only (for client portal)
export const useStreamingCatalogActive = () => {
  return useQuery({
    queryKey: ["streaming-catalog-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_catalog")
        .select("*")
        .eq("status", "active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as StreamingCatalogItem[];
    },
    staleTime: 30000,
  });
};

// All items (for admin portal - active + hold, not inactive)
export const useStreamingCatalogAll = () => {
  return useQuery({
    queryKey: ["streaming-catalog-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_catalog")
        .select("*")
        .in("status", ["active", "hold"])
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as StreamingCatalogItem[];
    },
    staleTime: 10000,
  });
};

// Full catalog including inactive (for admin audit)
export const useStreamingCatalogFull = () => {
  return useQuery({
    queryKey: ["streaming-catalog-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_catalog")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as StreamingCatalogItem[];
    },
    staleTime: 10000,
  });
};

// Audit log entries
export const useStreamingCatalogAuditLogs = (catalogItemId?: string) => {
  return useQuery({
    queryKey: ["streaming-catalog-audit-logs", catalogItemId],
    queryFn: async () => {
      let query = supabase
        .from("streaming_catalog_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (catalogItemId) {
        query = query.eq("catalog_item_id", catalogItemId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: true,
  });
};

// CRUD mutations with audit logging
export const useStreamingCatalogMutations = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const logAudit = async (
    action: string,
    catalogItemId: string | null,
    oldValue: any,
    newValue: any,
    changedFields: string[]
  ) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user?.id)
      .maybeSingle();

    await supabase.from("streaming_catalog_audit_logs").insert({
      catalog_item_id: catalogItemId,
      action,
      actor_id: user?.id,
      actor_email: user?.email || profile?.email,
      actor_name: profile?.full_name || user?.email,
      old_value: oldValue,
      new_value: newValue,
      changed_fields: changedFields,
    });
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["streaming-catalog-active"] });
    queryClient.invalidateQueries({ queryKey: ["streaming-catalog-all"] });
    queryClient.invalidateQueries({ queryKey: ["streaming-catalog-full"] });
    queryClient.invalidateQueries({ queryKey: ["streaming-catalog-audit-logs"] });
  };

  const createItem = useMutation({
    mutationFn: async (item: Omit<StreamingCatalogItem, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("streaming_catalog")
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      
      await logAudit("create", data.id, null, item, Object.keys(item));
      return data;
    },
    onSuccess: invalidateAll,
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, updates, oldItem }: { id: string; updates: Partial<StreamingCatalogItem>; oldItem: StreamingCatalogItem }) => {
      const { data, error } = await supabase
        .from("streaming_catalog")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      const changedFields = Object.keys(updates).filter(
        key => JSON.stringify((oldItem as any)[key]) !== JSON.stringify((updates as any)[key])
      );
      
      await logAudit("update", id, oldItem, data, changedFields);
      return data;
    },
    onSuccess: invalidateAll,
  });

  const deleteItem = useMutation({
    mutationFn: async ({ id, oldItem }: { id: string; oldItem: StreamingCatalogItem }) => {
      const { error } = await supabase
        .from("streaming_catalog")
        .delete()
        .eq("id", id);
      if (error) throw error;
      
      await logAudit("delete", id, oldItem, null, []);
    },
    onSuccess: invalidateAll,
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, newStatus, oldItem }: { id: string; newStatus: "active" | "hold" | "inactive"; oldItem: StreamingCatalogItem }) => {
      const { data, error } = await supabase
        .from("streaming_catalog")
        .update({ status: newStatus })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      await logAudit("status_change", id, { status: oldItem.status }, { status: newStatus }, ["status"]);
      return data;
    },
    onSuccess: invalidateAll,
  });

  return { createItem, updateItem, deleteItem, toggleStatus };
};

// Helper to create snapshot for orders
export const createStreamingSnapshot = (items: StreamingCatalogItem[]): StreamingSnapshot[] => {
  return items.map(item => ({
    id: item.id,
    name: item.name,
    price_monthly: item.price_monthly,
    category: item.category,
  }));
};

// Helper to calculate total
export const calculateStreamingTotal = (items: StreamingCatalogItem[]): number => {
  return items.reduce((sum, item) => sum + item.price_monthly, 0);
};
