import { useEffect, useCallback, useRef } from "react";
import { portalClient } from "@/integrations/backend/portalClient";
import { useClientAuth } from "@/hooks/useClientAuth";
import { findCityCoordinates, getRandomQuebecCoordinates } from "@/data/quebecCities";

type ActivityType = 
  | "page_view"
  | "order_started"
  | "order_completed"
  | "signup"
  | "login"
  | "profile_update"
  | "subscription"
  | "payment";

interface TrackActivityOptions {
  city?: string;
  postalCode?: string;
  metadata?: Record<string, unknown>;
}

// Generate a session ID for anonymous tracking
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem("nivra_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem("nivra_session_id", sessionId);
  }
  return sessionId;
};

export const useLiveActivityTracker = () => {
  const { user } = useClientAuth();
  const lastTrackedRef = useRef<string>("");

  // Get user's city from their profile
  const getUserCity = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    
    try {
      const { data: profile } = await portalClient
        .from("profiles")
        .select("service_city")
        .eq("user_id", user.id)
        .maybeSingle();
      
      return profile?.service_city || null;
    } catch {
      return null;
    }
  }, [user]);

  const trackActivity = useCallback(async (
    activityType: ActivityType,
    label?: string,
    options?: TrackActivityOptions
  ) => {
    // Prevent duplicate tracking in quick succession
    const trackKey = `${activityType}_${label}_${Date.now()}`;
    if (lastTrackedRef.current === trackKey) return;
    lastTrackedRef.current = trackKey;

    try {
      // Determine city
      let city = options?.city;
      if (!city && user) {
        city = await getUserCity() || undefined;
      }

      // Get coordinates
      let coordinates = city ? findCityCoordinates(city) : null;
      if (!coordinates) {
        coordinates = {
          name: city || "Québec",
          lat: getRandomQuebecCoordinates().lat,
          lng: getRandomQuebecCoordinates().lng,
        };
      }

      await portalClient.from("live_activity_logs").insert({
        user_id: user?.id || null,
        session_id: getSessionId(),
        activity_type: activityType,
        activity_label: label || getActivityLabel(activityType),
        city: city || coordinates?.name || null,
        province: "QC",
        postal_code: options?.postalCode || null,
        latitude: coordinates?.lat || null,
        longitude: coordinates?.lng || null,
        metadata: options?.metadata || {},
      });
    } catch (error) {
      console.error("Failed to track activity:", error);
    }
  }, [user, getUserCity]);

  // Track page view on mount
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes("/client")) {
      trackActivity("page_view", `Visite: ${getPageName(path)}`);
    }
  }, [trackActivity]);

  return { trackActivity };
};

// Standalone function for tracking from outside React components
export const trackLiveActivity = async (
  activityType: ActivityType,
  label?: string,
  options?: TrackActivityOptions & { userId?: string }
) => {
  try {
    let coordinates = options?.city ? findCityCoordinates(options.city) : null;
    if (!coordinates) {
      const randomCoords = getRandomQuebecCoordinates();
      coordinates = {
        name: options?.city || "Québec",
        lat: randomCoords.lat,
        lng: randomCoords.lng,
      };
    }

    await portalClient.from("live_activity_logs").insert({
      user_id: options?.userId || null,
      session_id: getSessionId(),
      activity_type: activityType,
      activity_label: label || getActivityLabel(activityType),
      city: options?.city || null,
      province: "QC",
      postal_code: options?.postalCode || null,
      latitude: coordinates?.lat || null,
      longitude: coordinates?.lng || null,
      metadata: options?.metadata || {},
    });
  } catch (error) {
    console.error("Failed to track live activity:", error);
  }
};

function getActivityLabel(type: ActivityType): string {
  const labels: Record<ActivityType, string> = {
    page_view: "Visite de page",
    order_started: "Commande débutée",
    order_completed: "Commande complétée",
    signup: "Nouvelle inscription",
    login: "Connexion",
    profile_update: "Mise à jour profil",
    subscription: "Nouvel abonnement",
    payment: "Paiement reçu",
  };
  return labels[type];
}

function getPageName(path: string): string {
  if (path.includes("/dashboard")) return "Tableau de bord";
  if (path.includes("/new-order")) return "Nouvelle commande";
  if (path.includes("/orders")) return "Mes commandes";
  if (path.includes("/profile")) return "Mon profil";
  if (path.includes("/billing")) return "Facturation";
  if (path.includes("/services")) return "Mes services";
  if (path.includes("/tv")) return "Télévision";
  if (path.includes("/support")) return "Support";
  return "Page client";
}
