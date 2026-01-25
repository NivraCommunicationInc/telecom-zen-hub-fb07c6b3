import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "promo_bar_dismissed_until";
const DISMISS_DURATION_DAYS = 7;

// Routes where the bar should NOT appear
const EXCLUDED_PATH_PREFIXES = [
  "/admin",
  "/portal",
  "/employee",
  "/technician",
  "/client-portal",
];

/**
 * Check if the bar should be hidden based on localStorage dismissal
 */
const isDismissed = (): boolean => {
  try {
    const dismissedUntil = localStorage.getItem(STORAGE_KEY);
    if (!dismissedUntil) return false;
    
    const dismissDate = new Date(dismissedUntil);
    return dismissDate > new Date();
  } catch {
    return false;
  }
};

/**
 * Store dismissal in localStorage for 7 days
 */
const dismissBar = () => {
  try {
    const dismissUntil = new Date();
    dismissUntil.setDate(dismissUntil.getDate() + DISMISS_DURATION_DAYS);
    localStorage.setItem(STORAGE_KEY, dismissUntil.toISOString());
  } catch {
    // Silently fail if localStorage is not available
  }
};

/**
 * Promo Announcement Bar
 * 
 * Displays a sticky scrolling announcement at the top of public pages.
 * Features:
 * - Marquee animation (respects prefers-reduced-motion)
 * - Dismissible with 7-day localStorage persistence
 * - Hidden on admin/portal/employee routes
 * - Mobile-friendly
 */
const AnnouncementBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check if current route is excluded
  const isExcludedRoute = EXCLUDED_PATH_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix)
  );

  useEffect(() => {
    // Check for reduced motion preference
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(motionQuery.matches);

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    motionQuery.addEventListener("change", handleMotionChange);

    // Check dismissal status
    if (!isDismissed() && !isExcludedRoute) {
      setIsVisible(true);
    }

    return () => {
      motionQuery.removeEventListener("change", handleMotionChange);
    };
  }, [isExcludedRoute]);

  const handleDismiss = () => {
    dismissBar();
    setIsVisible(false);
  };

  const handlePlansClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // If already on homepage, just scroll
    if (location.pathname === "/") {
      const servicesSection = document.getElementById("services");
      if (servicesSection) {
        servicesSection.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      // Navigate to homepage with hash, then scroll
      navigate("/#services");
      // After navigation, scroll to section
      setTimeout(() => {
        const servicesSection = document.getElementById("services");
        if (servicesSection) {
          servicesSection.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  };

  // Don't render if hidden or on excluded route
  if (!isVisible || isExcludedRoute) {
    return null;
  }

  const announcementText =
    "50% de rabais sur ton 1er mois — code: BIENVENUE — + Tirage 500$ cash le 15 février 2026";

  return (
    <div
      id="announcement-bar"
      className="relative z-[60] bg-accent text-accent-foreground overflow-hidden"
      role="banner"
      aria-label="Annonce promotionnelle"
    >
      <div className="relative flex items-center h-10 px-2 sm:px-4">
        {/* Scrolling content container */}
        <div className="flex-1 overflow-hidden mr-2">
          <div
            className={`flex items-center gap-8 whitespace-nowrap ${
              prefersReducedMotion ? "" : "animate-marquee hover:pause-animation"
            }`}
          >
            {/* Repeat content for seamless loop */}
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3 text-sm font-medium">
                <span>50% de rabais sur ton 1er mois</span>
                <span className="text-accent-foreground/70">—</span>
                <span className="flex items-center gap-1.5">
                  code:{" "}
                  <span className="inline-flex items-center px-2 py-0.5 bg-white/20 rounded font-bold tracking-wide">
                    BIENVENUE
                  </span>
                </span>
                <span className="text-accent-foreground/70">—</span>
                <span>+ Tirage 500$ cash le 15 février 2026</span>
                <span className="text-accent-foreground/40 mx-4">•</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs font-medium bg-white/15 hover:bg-white/25 text-accent-foreground border-0"
            asChild
          >
            <Link to="/concours">Voir les détails</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex h-7 px-2.5 text-xs font-medium bg-white/25 hover:bg-white/35 text-accent-foreground border-0"
            onClick={handlePlansClick}
          >
            Plans
          </Button>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="ml-1 p-1.5 rounded-md hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Fermer l'annonce"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CSS for marquee animation */}
      <style>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .animate-marquee {
          animation: marquee 25s linear infinite;
        }

        .hover\\:pause-animation:hover {
          animation-play-state: paused;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-marquee {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
};

export default AnnouncementBar;
