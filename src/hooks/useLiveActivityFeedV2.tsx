import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { backendClient } from "@/integrations/backend/client";
import { useQuery } from "@tanstack/react-query";
import type { ActivityFilterCategory } from "@/components/admin/live-activity/ActivityFilterTabs";
import { ACTIVITY_CONFIG } from "@/components/admin/live-activity/ActivityFeedItem";

/**
 * Unified Activity type mapped from activity_logs table
 */
export interface LiveActivity {
  id: string;
  user_id: string;
  action: string; // Maps to activity_type for display
  entity_type: string;
  entity_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  actor_email: string | null;
  details: Record<string, unknown> | null;
  changed_field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
}

interface UseLiveActivityFeedV2Options {
  limit?: number;
  pollingInterval?: number;
}

interface UseLiveActivityFeedV2Return {
  activities: LiveActivity[];
  filteredActivities: LiveActivity[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  lastUpdated: Date | null;
  isLive: boolean;
  setIsLive: (value: boolean) => void;
  filter: ActivityFilterCategory;
  setFilter: (filter: ActivityFilterCategory) => void;
  filterCounts: Record<ActivityFilterCategory, number>;
  newActivityIds: Set<string>;
}

export const useLiveActivityFeedV2 = (
  options: UseLiveActivityFeedV2Options = {}
): UseLiveActivityFeedV2Return => {
  const { limit = 50, pollingInterval = 15000 } = options;

  const [isLive, setIsLive] = useState(true);
  const [filter, setFilter] = useState<ActivityFilterCategory>("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [realtimeActivities, setRealtimeActivities] = useState<LiveActivity[]>([]);
  const [newActivityIds, setNewActivityIds] = useState<Set<string>>(new Set());
  const previousIdsRef = useRef<Set<string>>(new Set());

  // Main query with polling - using activity_logs table (source of truth)
  const {
    data: fetchedActivities = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["live-activity-feed-v2", limit],
    queryFn: async () => {
      const { data, error } = await backendClient
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      setLastUpdated(new Date());
      return (data || []) as LiveActivity[];
    },
    refetchInterval: isLive ? pollingInterval : false,
    staleTime: 5000,
  });

  // Realtime subscription for activity_logs table
  useEffect(() => {
    if (!isLive) return;

    const channel = backendClient
      .channel("activity-logs-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
        },
        (payload) => {
          const newActivity = payload.new as LiveActivity;
          setRealtimeActivities((prev) => {
            // Dedupe by ID
            if (prev.some((a) => a.id === newActivity.id)) return prev;
            const updated = [newActivity, ...prev].slice(0, limit);
            return updated;
          });
          setLastUpdated(new Date());
        }
      )
      .subscribe();

    return () => {
      backendClient.removeChannel(channel);
    };
  }, [isLive, limit]);

  // Merge and dedupe activities
  const allActivities = useMemo(() => {
    const merged = [...realtimeActivities, ...fetchedActivities];
    // Dedupe by id
    const unique = Array.from(new Map(merged.map((a) => [a.id, a])).values());
    // Sort by created_at descending
    const sorted = unique.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    // Limit to max items
    return sorted.slice(0, limit);
  }, [realtimeActivities, fetchedActivities, limit]);

  // Track new activity IDs (items added since last update)
  useEffect(() => {
    const currentIds = new Set(allActivities.map((a) => a.id));
    const newIds = new Set<string>();

    currentIds.forEach((id) => {
      if (!previousIdsRef.current.has(id)) {
        newIds.add(id);
      }
    });

    if (newIds.size > 0) {
      setNewActivityIds(newIds);
      // Clear "new" status after 5 seconds
      const timer = setTimeout(() => {
        setNewActivityIds(new Set());
      }, 5000);
      return () => clearTimeout(timer);
    }

    previousIdsRef.current = currentIds;
  }, [allActivities]);

  // Get category for activity based on action or entity_type
  const getCategory = useCallback(
    (activity: LiveActivity): ActivityFilterCategory => {
      // First check if we have a direct mapping in ACTIVITY_CONFIG
      const config = ACTIVITY_CONFIG[activity.action];
      if (config?.category) return config.category;

      // Fallback: categorize by entity_type
      const entityType = activity.entity_type?.toLowerCase() || "";
      if (entityType.includes("order") || entityType.includes("demand")) return "orders";
      if (entityType.includes("payment") || entityType.includes("billing") || entityType.includes("invoice")) return "payments";
      if (entityType.includes("client") || entityType.includes("user") || entityType.includes("profile")) return "clients";
      if (entityType.includes("ticket") || entityType.includes("support")) return "tickets";

      // Fallback: categorize by action keywords
      const action = activity.action?.toLowerCase() || "";
      if (action.includes("order") || action.includes("demand")) return "orders";
      if (action.includes("payment") || action.includes("invoice") || action.includes("billing")) return "payments";
      if (action.includes("signup") || action.includes("login") || action.includes("profile") || action.includes("client")) return "clients";
      if (action.includes("ticket") || action.includes("support")) return "tickets";

      return "system";
    },
    []
  );

  // Filter activities by category
  const filteredActivities = useMemo(() => {
    if (filter === "all") return allActivities;
    return allActivities.filter((a) => getCategory(a) === filter);
  }, [allActivities, filter, getCategory]);

  // Calculate counts per category
  const filterCounts = useMemo(() => {
    const counts: Record<ActivityFilterCategory, number> = {
      all: allActivities.length,
      orders: 0,
      payments: 0,
      clients: 0,
      tickets: 0,
      system: 0,
    };

    allActivities.forEach((activity) => {
      const category = getCategory(activity);
      counts[category]++;
    });

    return counts;
  }, [allActivities, getCategory]);

  return {
    activities: allActivities,
    filteredActivities,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    lastUpdated,
    isLive,
    setIsLive,
    filter,
    setFilter,
    filterCounts,
    newActivityIds,
  };
};

export default useLiveActivityFeedV2;
