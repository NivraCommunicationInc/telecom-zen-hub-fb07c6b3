import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface PresenceUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  avatar?: string;
  online_at: string;
  current_page?: string;
}

interface PresenceState {
  [key: string]: PresenceUser[];
}

interface UsePresenceOptions {
  channelName?: string;
  heartbeatInterval?: number;
}

export const usePresence = (options: UsePresenceOptions = {}) => {
  const { channelName = "admin-presence", heartbeatInterval = 30000 } = options;
  const { user, role } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Extract unique users from presence state
  const extractUsers = useCallback((state: PresenceState): PresenceUser[] => {
    const usersMap = new Map<string, PresenceUser>();
    
    Object.values(state).forEach((presences) => {
      presences.forEach((presence) => {
        // Keep the most recent presence for each user
        const existing = usersMap.get(presence.id);
        if (!existing || new Date(presence.online_at) > new Date(existing.online_at)) {
          usersMap.set(presence.id, presence);
        }
      });
    });

    return Array.from(usersMap.values()).sort(
      (a, b) => new Date(b.online_at).getTime() - new Date(a.online_at).getTime()
    );
  }, []);

  // Track current user's presence
  const trackPresence = useCallback(async (channel: RealtimeChannel, currentPage?: string) => {
    if (!user) return;

    const presenceData: PresenceUser = {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Utilisateur",
      role: role || "unknown",
      online_at: new Date().toISOString(),
      current_page: currentPage || window.location.pathname,
    };

    try {
      await channel.track(presenceData);
    } catch (error) {
      console.error("Error tracking presence:", error);
    }
  }, [user, role]);

  // Update current page
  const updateCurrentPage = useCallback((page: string) => {
    if (channelRef.current && user) {
      trackPresence(channelRef.current, page);
    }
  }, [trackPresence, user]);

  const isStaffRole = role === "admin" || role === "employee" || role === "technician";

  useEffect(() => {
    if (!user || !isStaffRole) {
      setOnlineUsers([]);
      setIsConnected(false);
      return;
    }

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channelRef.current = channel;

    // Handle presence sync
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceUser>();
      const users = extractUsers(state);
      setOnlineUsers(users);
    });

    // Handle user join
    channel.on("presence", { event: "join" }, ({ newPresences }) => {
      console.log("User joined:", newPresences);
    });

    // Handle user leave
    channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
      console.log("User left:", leftPresences);
    });

    // Subscribe and track
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setIsConnected(true);
        await trackPresence(channel);
      }
    });

    // Heartbeat to keep presence alive
    const heartbeat = setInterval(() => {
      if (channel) {
        trackPresence(channel);
      }
    }, heartbeatInterval);

    // Cleanup
    return () => {
      clearInterval(heartbeat);
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [user, channelName, extractUsers, trackPresence, heartbeatInterval]);

  return {
    onlineUsers,
    isConnected,
    currentUserId: user?.id,
    updateCurrentPage,
    onlineCount: onlineUsers.length,
  };
};

export default usePresence;
