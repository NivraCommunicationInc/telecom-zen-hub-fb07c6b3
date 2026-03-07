import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect } from 'react';

/**
 * SWUpdateHandler
 *
 * Handles service-worker lifecycle so that newly deployed assets are picked up
 * on mobile browsers (especially Safari/iOS) where a stale SW can keep serving
 * old cached bundles indefinitely.
 *
 * Strategy:
 * - Check for SW updates every 60 seconds while the page is open.
 * - When a new SW is waiting, call updateServiceWorker() which tells the
 *   waiting SW to skipWaiting + triggers a page reload, loading the fresh build.
 */
export function SWUpdateHandler() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Poll for updates every 60 seconds
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[SW] Registration error:', error);
    },
  });

  // Auto-activate the new SW as soon as it's ready
  useEffect(() => {
    if (needRefresh) {
      console.log('[SW] New version available — activating…');
      updateServiceWorker(true); // true = reload page after activation
    }
  }, [needRefresh, updateServiceWorker]);

  // This component renders nothing; it only manages SW updates.
  return null;
}
