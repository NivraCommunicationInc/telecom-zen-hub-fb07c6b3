import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "announcement-bar-dismissed";
const DISMISS_DURATION_DAYS = 7;

export const AnnouncementBar = () => {
  const [isReady, setIsReady] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (dismissedAt) {
      const dismissedDate = new Date(dismissedAt);
      const now = new Date();
      const daysDiff = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff < DISMISS_DURATION_DAYS) {
        setIsDismissed(true);
      }
    }
    setIsReady(true);
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setIsDismissed(true);
  };

  // Don't render until ready (prevents flash)
  if (!isReady) return null;
  
  // Don't render if dismissed
  if (isDismissed) return null;

  const message = "Branchez-vous maintenant et obtenez 20 $ de rabais à vie — Sign up now and get $20 off for life";

  return (
    <div className="relative w-full bg-gradient-to-r from-primary via-accent to-primary text-primary-foreground overflow-hidden z-50">
      <Link
        to="/mobile"
        className="flex h-9 md:h-10 items-center overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div
          className={`flex whitespace-nowrap ${isPaused ? "announcement-paused" : "announcement-scroll"}`}
        >
          {/* Duplicate content twice for seamless loop */}
          <div className="flex shrink-0 items-center gap-16 px-8">
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <span className="inline-block w-2 h-2 bg-white/80 rounded-full animate-pulse" />
              {message}
            </span>
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <span className="inline-block w-2 h-2 bg-white/80 rounded-full animate-pulse" />
              {message}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-16 px-8">
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <span className="inline-block w-2 h-2 bg-white/80 rounded-full animate-pulse" />
              {message}
            </span>
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <span className="inline-block w-2 h-2 bg-white/80 rounded-full animate-pulse" />
              {message}
            </span>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/20 transition-colors z-10"
        aria-label="Fermer / Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
