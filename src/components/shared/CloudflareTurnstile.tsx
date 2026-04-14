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

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_ID = "cf-turnstile-script";

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
    if (!SITE_KEY) return;

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

  if (!SITE_KEY) return null;

  return <div ref={containerRef} className={className} />;
}
