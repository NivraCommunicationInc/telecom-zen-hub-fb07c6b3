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
      aria-modal="true"
      aria-labelledby="launch-offer-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(17,17,17,0.55)" }}
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md rounded-3xl shadow-2xl text-white animate-in fade-in zoom-in-95 duration-200"
        style={{ background: "#7C3AED", padding: "32px 28px 28px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.close}
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-white/15"
          style={{ color: "#FFFFFF" }}
        >
          <X className="w-5 h-5" />
        </button>

        <p className="font-bold uppercase mb-3" style={{ fontSize: 12, letterSpacing: 2, opacity: 0.9 }}>
          {t.eyebrow}
        </p>
        <h2 id="launch-offer-title" className="font-extrabold leading-tight mb-2" style={{ fontSize: 28 }}>
          {t.line1}
        </h2>
        <p className="mb-6" style={{ fontSize: 15, opacity: 0.95 }}>
          {t.line2}
        </p>

        <div className="flex flex-col gap-2.5">
          <Link
            to="/commander?promo=BIENVENUE2026"
            onClick={dismiss}
            className="flex items-center justify-center px-6 font-bold transition-all"
            style={{ height: 48, borderRadius: 50, background: "#FFFFFF", color: "#7C3AED", fontSize: 14 }}
          >
            {t.order} →
          </Link>
          <Link
            to={isFr ? "/garantie" : "/guarantee"}
            onClick={dismiss}
            className="flex items-center justify-center px-6 font-semibold transition-all"
            style={{ height: 44, borderRadius: 50, border: "2px solid rgba(255,255,255,0.6)", color: "#FFFFFF", fontSize: 13 }}
          >
            {t.details}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LaunchOfferPopup;
