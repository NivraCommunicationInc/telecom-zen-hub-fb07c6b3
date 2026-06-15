import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "promo_bar_dismissed_until";
const DISMISS_DURATION_DAYS = 7;

const EXCLUDED_PATH_PREFIXES = [
  "/admin",
  "/portal",
  "/employee",
  "/technician",
  "/client-portal",
];

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

const dismissBar = () => {
  try {
    const dismissUntil = new Date();
    dismissUntil.setDate(dismissUntil.getDate() + DISMISS_DURATION_DAYS);
    localStorage.setItem(STORAGE_KEY, dismissUntil.toISOString());
  } catch {}
};

const AnnouncementBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const isExcludedRoute = EXCLUDED_PATH_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix)
  );

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(motionQuery.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    motionQuery.addEventListener("change", handleMotionChange);
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
    if (location.pathname === "/") {
      const servicesSection = document.getElementById("services");
      if (servicesSection) {
        servicesSection.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      navigate("/#services");
      setTimeout(() => {
        const servicesSection = document.getElementById("services");
        if (servicesSection) {
          servicesSection.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  };

  if (!isVisible || isExcludedRoute) {
    return null;
  }

  return (
    <div
      id="announcement-bar"
      className="relative z-40 bg-purple-600 text-white overflow-hidden"
      role="banner"
      aria-label="Annonce promotionnelle"
    >
      <div className="relative flex items-center h-10">
        {/* Scrolling text — edge to edge, no left padding */}
        <div className="flex-1 overflow-hidden">
          <div
            className={`flex items-center gap-8 whitespace-nowrap ${
              prefersReducedMotion ? "" : "animate-marquee hover:pause-animation"
            }`}
            aria-hidden="true"
          >
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-medium pl-4">
                <span>Nouveau client? Obtenez 50% de rabais sur votre première facture</span>
                <span className="text-white/40 mx-2 sm:mx-4">•</span>
                <span>Offre exclusive — Aucun contrat requis</span>
                <span className="text-white/40 mx-2 sm:mx-4">•</span>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons — fixed right, avec fond pour masquer le texte qui passe dessous */}
        <div className="flex items-center gap-1.5 shrink-0 pr-2 pl-3 h-full" style={{ background: 'linear-gradient(to right, transparent, #9333ea 24px, #9333ea)' }}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 sm:px-2.5 text-xs font-medium bg-white/15 hover:bg-white/25 text-white border-0"
            onClick={handlePlansClick}
            aria-label="Voir nos forfaits disponibles"
          >
            <span className="hidden sm:inline">Voir nos forfaits</span>
            <span className="sm:hidden">Forfaits</span>
          </Button>

          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-md hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Fermer l'annonce"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
        }
        .hover\\:pause-animation:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-marquee { animation: none; }
        }
      `}</style>
    </div>
  );
};

export default AnnouncementBar;
