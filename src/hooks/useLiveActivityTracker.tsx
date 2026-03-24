import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

export type ActivityType =
  | "page_view"
  | "plan_view"
  | "add_to_cart"
  | "checkout_started"
  | "checkout_step_completed"
  | "payment_started"
  | "order_submitted"
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

// Standalone function for tracking from outside React components
export const trackLiveActivity = async (
  activityType: ActivityType,
  label?: string,
  options?: TrackActivityOptions & { userId?: string }
) => {
  try {
    await supabase.from("live_activity_logs").insert({
      user_id: options?.userId || null,
      session_id: getSessionId(),
      activity_type: activityType,
      activity_label: label || getActivityLabel(activityType),
      city: options?.city || null,
      province: "QC",
      postal_code: options?.postalCode || null,
      latitude: null,
      longitude: null,
      metadata: options?.metadata || {},
    });
  } catch (error) {
    // Silent fail — tracking should never break UX
    console.error("[LiveTracker] Failed:", error);
  }
};

export const useLiveActivityTracker = () => {
  const lastTrackedPage = useRef<string>("");
  const location = useLocation();

  const trackActivity = useCallback(async (
    activityType: ActivityType,
    label?: string,
    options?: TrackActivityOptions
  ) => {
    try {
      // Get current user if authenticated (non-blocking)
      let userId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      } catch {
        // Anonymous visitor
      }

      await supabase.from("live_activity_logs").insert({
        user_id: userId,
        session_id: getSessionId(),
        activity_type: activityType,
        activity_label: label || getActivityLabel(activityType),
        city: options?.city || null,
        province: "QC",
        postal_code: options?.postalCode || null,
        latitude: null,
        longitude: null,
        metadata: {
          ...options?.metadata,
          page: window.location.pathname,
          referrer: document.referrer || null,
        },
      });
    } catch (error) {
      // Silent fail
      console.error("[LiveTracker] Failed:", error);
    }
  }, []);

  // Auto-track page views on route change
  useEffect(() => {
    const path = location.pathname;
    // Avoid duplicate tracking of same page
    if (lastTrackedPage.current === path) return;
    lastTrackedPage.current = path;

    trackActivity("page_view", `Visite: ${getPageName(path)}`);
  }, [location.pathname, trackActivity]);

  return { trackActivity };
};

function getActivityLabel(type: ActivityType): string {
  const labels: Record<ActivityType, string> = {
    page_view: "Visite de page",
    plan_view: "Consultation de forfait",
    add_to_cart: "Ajout au panier",
    checkout_started: "Checkout débuté",
    checkout_step_completed: "Étape checkout complétée",
    payment_started: "Paiement initié",
    order_submitted: "Commande soumise",
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
  if (path === "/") return "Accueil";
  if (path.includes("/internet")) return "Internet";
  if (path.includes("/mobile")) return "Mobile";
  if (path.includes("/tv") || path.includes("/television")) return "Télévision";
  if (path.includes("/streaming")) return "Streaming";
  if (path.includes("/compare")) return "Comparateur";
  if (path.includes("/services")) return "Services";
  if (path.includes("/contact")) return "Contact";
  if (path.includes("/faq") || path.includes("/aide")) return "FAQ / Aide";
  if (path.includes("/about") || path.includes("/a-propos")) return "À propos";
  if (path.includes("/careers") || path.includes("/apply")) return "Carrières";
  if (path.includes("/concours")) return "Concours";
  if (path.includes("/client/new-order")) return "Nouvelle commande";
  if (path.includes("/client/dashboard")) return "Tableau de bord";
  if (path.includes("/client/orders")) return "Mes commandes";
  if (path.includes("/client/profile")) return "Mon profil";
  if (path.includes("/client/billing") || path.includes("/client/invoices")) return "Facturation";
  if (path.includes("/client/services")) return "Mes services";
  if (path.includes("/client/tv")) return "Télévision";
  if (path.includes("/client/support")) return "Support";
  if (path.includes("/client")) return "Portail client";
  if (path.includes("/login") || path.includes("/auth")) return "Connexion";
  return path.replace(/\//g, " › ").trim() || "Page";
}

export default useLiveActivityTracker;
