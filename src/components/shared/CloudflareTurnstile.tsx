/**
 * CloudflareTurnstile — Invisible/managed CAPTCHA widget.
 * Renders the Turnstile widget and calls onVerify with the token.
 * If VITE_TURNSTILE_SITE_KEY is not set, the widget is hidden and onVerify
 * is never called (form should still work without it in dev).
 */
import { useEffect, useRef, useCallback } from "react";

interface CloudflareTurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const PROD_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const E2E_MODE = import.meta.env.VITE_E2E_MODE === "true";
const SCRIPT_ID = "cf-turnstile-script";

/**
 * Cloudflare Turnstile test key — always passes, invisible.
 * Used on localhost / preview / non-production hosts so we never hit
 * error 110200 ("Domain not permitted for this sitekey"). The real
 * production key is registered only for nivra-telecom.ca.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
const TEST_ALWAYS_PASS_KEY = "1x00000000000000000000AA";

const PROD_HOSTS = new Set([
  "nivra-telecom.ca",
  "www.nivra-telecom.ca",
  "core2617.nivra-telecom.ca",
  "nivra-telecom-ca.lovable.app",
]);

function resolveSiteKey(): string | undefined {
  if (!PROD_SITE_KEY) return undefined;
  if (typeof window === "undefined") return PROD_SITE_KEY;
  const host = window.location.hostname;
  // Any non-production host (localhost, 127.0.0.1, *.lovable.app previews, Playwright)
  // gets the Cloudflare-provided always-pass test key so the widget renders
  // without triggering 110200. Production hosts use the real registered key.
  if (PROD_HOSTS.has(host)) return PROD_SITE_KEY;
  return TEST_ALWAYS_PASS_KEY;
}

const SITE_KEY = resolveSiteKey();


export default function CloudflareTurnstile({ onVerify, onExpire, onError, className }: CloudflareTurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || !SITE_KEY) return;
    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
    }
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: (token: string) => onVerifyRef.current(token),
      "expired-callback": onExpire,
      "error-callback": onError,
      theme: "auto",
      size: "flexible",
    });
  }, [onExpire, onError]);

  useEffect(() => {
    if (!SITE_KEY || E2E_MODE) return;

    // Load script if not present
    if (!document.getElementById(SCRIPT_ID)) {
      window.onTurnstileLoad = renderWidget;
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else if (window.turnstile) {
      renderWidget();
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget]);

  if (!SITE_KEY || E2E_MODE) return null;

  return <div ref={containerRef} className={className} />;
}
