import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface Props {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

/**
 * Activate / deactivate Web Push notifications for the current user.
 * Renders nothing if push isn't supported by the browser.
 */
export function PushNotificationToggle({ variant = "outline", size = "sm", className }: Props) {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={isLoading}
      onClick={() => (isSubscribed ? unsubscribe() : subscribe())}
    >
      {isSubscribed ? (
        <>
          <BellOff className="w-4 h-4 mr-2" />
          Désactiver les notifications
        </>
      ) : (
        <>
          <Bell className="w-4 h-4 mr-2" />
          Activer les notifications
        </>
      )}
    </Button>
  );
}
