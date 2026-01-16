import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, [user]);

  const checkSubscription = async () => {
    if (!user) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  const subscribe = useCallback(async () => {
    if (!user || !isSupported) return false;
    
    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      
      if (perm !== "granted") {
        toast.error("Notifications refusées");
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Note: In production, you'd use VAPID keys
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: undefined // Add VAPID public key in production
      });

      const { endpoint, keys } = subscription.toJSON();
      
      await supabase.from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint: endpoint!,
        p256dh: keys!.p256dh!,
        auth: keys!.auth!,
        user_agent: navigator.userAgent,
        is_active: true
      }, { onConflict: "user_id,endpoint" });

      setIsSubscribed(true);
      toast.success("Notifications activées!");
      return true;
    } catch (error) {
      console.error("Push subscription error:", error);
      toast.error("Erreur lors de l'activation");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!user) return false;
    
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);
      }

      setIsSubscribed(false);
      toast.success("Notifications désactivées");
      return true;
    } catch (error) {
      console.error("Unsubscribe error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe
  };
};
