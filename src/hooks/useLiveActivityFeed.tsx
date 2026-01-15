import { useState, useEffect, useCallback } from "react";
import { backendClient } from "@/integrations/backend/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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

interface UseLiveActivityFeedOptions {
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const useLiveActivityFeed = (options: UseLiveActivityFeedOptions = {}) => {
  const { limit = 50, autoRefresh = true, refreshInterval = 5000 } = options;
  const queryClient = useQueryClient();
  const [realtimeActivities, setRealtimeActivities] = useState<LiveActivity[]>([]);

  // Fetch initial activities
  const { data: activities = [], isLoading, refetch } = useQuery({
    queryKey: ["live-activity-feed", limit],
    queryFn: async () => {
      const { data, error } = await backendClient
        .from("live_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as LiveActivity[];
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 2000,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = backendClient
      .channel("live-activity-realtime")
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
            // Avoid duplicates
            if (prev.some((a) => a.id === newActivity.id)) return prev;
            // Keep only recent activities
            const updated = [newActivity, ...prev].slice(0, limit);
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      backendClient.removeChannel(channel);
    };
  }, [limit]);

  // Merge realtime with fetched activities
  const mergedActivities = useCallback(() => {
    const all = [...realtimeActivities, ...activities];
    // Deduplicate by id
    const unique = Array.from(new Map(all.map((a) => [a.id, a])).values());
    // Sort by created_at descending
    return unique.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, limit);
  }, [realtimeActivities, activities, limit]);

  // Get activity stats
  const stats = useCallback(() => {
    const allActivities = mergedActivities();
    const now = new Date();
    const last24h = allActivities.filter(
      (a) => now.getTime() - new Date(a.created_at).getTime() < 24 * 60 * 60 * 1000
    );
    const lastHour = allActivities.filter(
      (a) => now.getTime() - new Date(a.created_at).getTime() < 60 * 60 * 1000
    );

    return {
      total24h: last24h.length,
      totalHour: lastHour.length,
      orders: last24h.filter((a) => a.activity_type.includes("order")).length,
      signups: last24h.filter((a) => a.activity_type === "signup").length,
      logins: last24h.filter((a) => a.activity_type === "login").length,
      uniqueCities: new Set(last24h.map((a) => a.city).filter(Boolean)).size,
    };
  }, [mergedActivities]);

  // Get activities grouped by city
  const activitiesByCity = useCallback(() => {
    const all = mergedActivities();
    const grouped: Record<string, LiveActivity[]> = {};
    
    for (const activity of all) {
      const city = activity.city || "Inconnu";
      if (!grouped[city]) grouped[city] = [];
      grouped[city].push(activity);
    }
    
    return grouped;
  }, [mergedActivities]);

  return {
    activities: mergedActivities(),
    isLoading,
    refetch,
    stats: stats(),
    activitiesByCity: activitiesByCity(),
  };
};
