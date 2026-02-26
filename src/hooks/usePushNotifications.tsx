import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export const usePushNotifications = () => {
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
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager?.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;
    
    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      
      if (perm === "granted") {
        setIsSubscribed(true);
        toast.success("Notifications activées!");
        return true;
      } else {
        toast.error("Notifications refusées");
        return false;
      }
    } catch (error) {
      console.error("Permission request error:", error);
      toast.error("Erreur lors de l'activation");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const sendLocalNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (permission === "granted") {
      new Notification(title, options);
    }
  }, [permission]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    requestPermission,
    sendLocalNotification
  };
};