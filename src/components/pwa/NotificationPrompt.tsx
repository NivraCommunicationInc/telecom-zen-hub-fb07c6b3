import { useState, useEffect } from 'react';
import { X, Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function NotificationPrompt() {
  const { permission, isSupported, requestPermission, isLoading } = usePushNotifications();
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if not supported or already granted/denied
    if (!isSupported || permission !== 'default') return;

    // Check if user has dismissed the prompt before
    const wasDismissed = localStorage.getItem('notification-prompt-dismissed');
    const dismissedAt = wasDismissed ? parseInt(wasDismissed, 10) : 0;
    const daysSinceDismissed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);

    // Show prompt after delay if not dismissed recently (14 days)
    if (daysSinceDismissed > 14) {
      const timer = setTimeout(() => setShowPrompt(true), 10000); // Show after 10s
      return () => clearTimeout(timer);
    }
  }, [isSupported, permission]);

  const handleEnable = async () => {
    await requestPermission();
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowPrompt(false);
    localStorage.setItem('notification-prompt-dismissed', Date.now().toString());
  };

  if (!showPrompt || dismissed || !isSupported || permission !== 'default') return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-2xl bg-card border border-border shadow-2xl p-4">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="h-6 w-6 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-lg">
              Activer les notifications
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Recevez des alertes pour vos factures, renouvellements et offres exclusives.
            </p>

            <div className="flex gap-2 mt-3">
              <Button
                onClick={handleEnable}
                size="sm"
                className="flex-1"
                disabled={isLoading}
              >
                <Bell className="h-4 w-4 mr-2" />
                {isLoading ? 'Activation...' : 'Activer'}
              </Button>
              <Button
                onClick={handleDismiss}
                variant="outline"
                size="sm"
              >
                <BellOff className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
