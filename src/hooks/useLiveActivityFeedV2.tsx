import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { backendClient } from "@/integrations/backend/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActivityFilterCategory } from "@/components/admin/live-activity/ActivityFilterTabs";
import { ACTIVITY_CONFIG } from "@/components/admin/live-activity/ActivityFeedItem";

export interface LiveActivity {
  id: string;
  user_id: string | null;
  session_id: string | null;
  activity_type: string;
  activity_label: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown>;
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
  const queryClient = useQueryClient();

  const [isLive, setIsLive] = useState(true);
  const [filter, setFilter] = useState<ActivityFilterCategory>("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [realtimeActivities, setRealtimeActivities] = useState<LiveActivity[]>([]);
  const [newActivityIds, setNewActivityIds] = useState<Set<string>>(new Set());
  const previousIdsRef = useRef<Set<string>>(new Set());

  // Main query with polling
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
        .from("live_activity_logs")
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

  // Realtime subscription
  useEffect(() => {
    if (!isLive) return;

    const channel = backendClient
      .channel("live-activity-v2")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_activity_logs",
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

  // Get category for activity
  const getCategory = useCallback(
    (activity: LiveActivity): ActivityFilterCategory => {
      const config = ACTIVITY_CONFIG[activity.activity_type];
      return config?.category || "system";
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
