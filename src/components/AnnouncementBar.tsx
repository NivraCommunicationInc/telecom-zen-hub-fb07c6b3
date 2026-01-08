import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "nivra_announcement_dismissed_at";
const DISMISS_DURATION_DAYS = 7;

function isDismissedWithinWindow(): boolean {
  try {
    const dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (!dismissedAt) return false;
    const dismissedTime = new Date(dismissedAt).getTime();
    if (Number.isNaN(dismissedTime)) return false;
    const diffDays = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
    return diffDays < DISMISS_DURATION_DAYS;
  } catch {
    return false;
  }
}

type AnnouncementBarProps = {
  href?: string;
};

export default function AnnouncementBar({ href = "/mobile" }: AnnouncementBarProps) {
  const [isReady, setIsReady] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    setIsDismissed(isDismissedWithinWindow());
    setIsReady(true);
  }, []);

  const handleDismiss: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // ignore storage errors
    }
    setIsDismissed(true);
  };

  if (!isReady || isDismissed) return null;

  const message =
    "Branchez-vous maintenant et obtenez 20 $ de rabais à vie — Sign up now and get $20 off for life";

  return (
    <div className="w-full border-b border-white/10 bg-slate-950">
      <div
        className="relative overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-10 items-center">
            {/* Clickable bar (does not block dismiss) */}
            <Link to={href} className="flex-1" aria-label="Promotion Nivra">
              <div className={`nivra-marquee ${isPaused ? "is-paused" : ""}`}>
                <div className="nivra-marquee__inner">
                  {/* EXACTLY 2 duplicates for -50% loop */}
                  <span className="mx-8 whitespace-nowrap text-sm font-medium text-white/90">
                    {message}
                  </span>
                  <span
                    className="mx-8 whitespace-nowrap text-sm font-medium text-white/90"
                    aria-hidden="true"
                  >
                    {message}
                  </span>
                </div>
              </div>
            </Link>
            {/* Dismiss button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Fermer"
              title="Fermer"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}