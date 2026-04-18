import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/hooks/usePWA';

export function InstallPrompt() {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWA();
  const location = useLocation();
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Restrict install prompt to the client portal area only
  const isPortalRoute = location.pathname.startsWith('/portal');

  useEffect(() => {
    if (!isPortalRoute) {
      setShowPrompt(false);
      return;
    }

    // Check if user has dismissed the prompt before
    const wasDismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedAt = wasDismissed ? parseInt(wasDismissed, 10) : 0;
    const daysSinceDismissed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);

    // Show prompt if not installed, not dismissed recently (7 days), and either installable or iOS
    if (!isInstalled && daysSinceDismissed > 7 && (isInstallable || isIOS)) {
      // Delay showing prompt
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isInstalled, isInstallable, isIOS, isPortalRoute]);

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!showPrompt || dismissed || isInstalled) return null;

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
          <div className="flex-shrink-0">
            <img
              src="/pwa-192x192.png"
              alt="Nivra"
              className="w-14 h-14 rounded-xl"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-lg">
              Installer Nivra
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Accédez rapidement à votre portail client et recevez des notifications.
            </p>

            {isIOS ? (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Share className="h-4 w-4" />
                  Appuyez sur
                  <span className="font-medium text-foreground">Partager</span>
                  puis
                  <Plus className="h-4 w-4" />
                  <span className="font-medium text-foreground">Sur l'écran d'accueil</span>
                </p>
              </div>
            ) : (
              <Button
                onClick={handleInstall}
                className="mt-3 w-full"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Installer l'application
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
