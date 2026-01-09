import { useDevOverflowDetector } from '@/hooks/useDevOverflowDetector';

/**
 * DEV-ONLY: Wrapper component that activates overflow detection.
 * Only runs in development mode (import.meta.env.DEV).
 * 
 * Place this component inside BrowserRouter to access location.
 */
export function DevOverflowDetector() {
  useDevOverflowDetector();
  return null;
}

export default DevOverflowDetector;
