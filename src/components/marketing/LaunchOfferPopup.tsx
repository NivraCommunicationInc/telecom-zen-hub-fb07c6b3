/**
 * LaunchOfferPopup — Homepage promo popup for new visitors only.
 * - Shows after 3s on homepage
 * - Hidden for logged-in clients (presence of Supabase session)
 * - Dismissed for 7 days via localStorage
 * - Click "Commander" auto-applies BIENVENUE2026 via URL param
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const STORAGE_KEY = "nivra_launch_popup_dismissed_at";
const DISMISS_DAYS = 7;
const SHOW_DELAY_MS = 12000;

const LaunchOfferPopup = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const maybeShow = async () => {
      try {
        // Skip if recently dismissed
        const dismissedAt = localStorage.getItem(STORAGE_KEY);
        if (dismissedAt) {
          const elapsedDays = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
          if (elapsedDays < DISMISS_DAYS) return;
        }

        // Skip for logged-in users (any Supabase session)
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) return;

        if (cancelled) return;
        timer = setTimeout(() => {
          if (!cancelled) setOpen(true);
        }, SHOW_DELAY_MS);
      } catch {
        // Silent fail — never break the homepage
      }
    };

    maybeShow();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setOpen(false);
  };

  if (!open) return null;

  const t = isFr
    ? {
        eyebrow: "🎁 OFFRE DE LANCEMENT",
        line1: "Premier mois 100% GRATUIT",
        line2: "+ Essai 30 jours satisfait ou remboursé",
        details: "Voir les détails",
        order: "Commander maintenant",
        close: "Fermer",
      }
    : {
        eyebrow: "🎁 LAUNCH OFFER",
        line1: "First month 100% FREE",
        line2: "+ 30-day money-back guarantee",
        details: "See details",
        order: "Order now",
        close: "Close",
      };

  return (
    <div
      role="dialog"
      aria-labelledby="launch-offer-title"
      className="fixed z-[60] animate-in fade-in slide-in-from-bottom-4 duration-300"
      style={{
        bottom: "16px",
        right: "16px",
        left: "16px",
        maxWidth: "380px",
        marginLeft: "auto",
      }}
    >
      <div
        className="relative w-full rounded-2xl shadow-2xl text-white"
        style={{ background: "#7C3AED", padding: "20px 22px 18px" }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.close}
          className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/15"
          style={{ color: "#FFFFFF" }}
        >
          <X className="w-4 h-4" />
        </button>

        <p className="font-bold uppercase mb-1.5" style={{ fontSize: 11, letterSpacing: 1.5, opacity: 0.9 }}>
          {t.eyebrow}
        </p>
        <h2 id="launch-offer-title" className="font-extrabold leading-tight mb-1" style={{ fontSize: 20 }}>
          {t.line1}
        </h2>
        <p className="mb-4" style={{ fontSize: 13, opacity: 0.95 }}>
          {t.line2}
        </p>

        <div className="flex items-center gap-2">
          <Link
            to="/commander?promo=BIENVENUE2026"
            onClick={dismiss}
            className="flex-1 flex items-center justify-center px-4 font-bold transition-all"
            style={{ height: 40, borderRadius: 50, background: "#FFFFFF", color: "#7C3AED", fontSize: 13 }}
          >
            {t.order} →
          </Link>
          <Link
            to={isFr ? "/garantie" : "/guarantee"}
            onClick={dismiss}
            className="flex items-center justify-center px-3 font-semibold transition-all"
            style={{ height: 40, borderRadius: 50, color: "#FFFFFF", fontSize: 12, opacity: 0.9 }}
          >
            {t.details}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LaunchOfferPopup;
