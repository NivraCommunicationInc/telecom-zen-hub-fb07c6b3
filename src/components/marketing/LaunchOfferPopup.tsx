/**
 * LaunchOfferPopup — Homepage promo popup for new visitors.
 * - Shows after 4s on homepage (once per session)
 * - Hidden for logged-in clients
 * - Dismissed via close button, backdrop click, or Escape key
 * - Redirects to /internet (Internet plans page)
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ShieldCheck, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const SESSION_KEY = "nivra_launch_popup_shown";
const SHOW_DELAY_MS = 4000;
const BRAND = "#0066CC";
const BRAND_DARK = "#0052A3";

const LaunchOfferPopup = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isFr = language === "fr";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        if (sessionStorage.getItem(SESSION_KEY)) return;
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) return;
        if (cancelled) return;
        timer = setTimeout(() => {
          if (cancelled) return;
          setOpen(true);
          try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
        }, SHOW_DELAY_MS);
      } catch { /* silent */ }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const close = () => setOpen(false);
  const goToPlans = () => {
    setOpen(false);
    navigate("/internet");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="launch-offer-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={isFr ? "Fermer" : "Close"}
        onClick={close}
        className="absolute inset-0 w-full h-full cursor-default"
        style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-[420px] bg-white overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{
          borderRadius: 16,
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* Close button — 44x44 tactile */}
        <button
          type="button"
          onClick={close}
          aria-label={isFr ? "Fermer" : "Close"}
          className="absolute top-2 right-2 flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors"
          style={{ width: 44, height: 44, zIndex: 2, color: "#475569" }}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top accent bar */}
        <div style={{ height: 4, background: BRAND }} aria-hidden="true" />

        <div className="p-7 sm:p-8">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-1.5 mb-5"
            style={{
              background: "rgba(0, 102, 204, 0.08)",
              color: BRAND,
              padding: "5px 11px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: BRAND }} />
            {isFr ? "Offre de bienvenue" : "Welcome offer"}
          </div>

          {/* Title */}
          <h2
            id="launch-offer-title"
            className="text-slate-900"
            style={{ fontSize: "clamp(20px, 5vw, 24px)", fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.02em", marginBottom: 14 }}
          >
            {isFr ? "Votre 1er mois d'Internet" : "Your 1st month of Internet"}
          </h2>

          {/* Big benefit */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: "clamp(30px, 8vw, 40px)", fontWeight: 800, color: BRAND, lineHeight: 1, letterSpacing: "-0.03em" }}>
              {isFr ? "GRATUIT" : "FREE"}
            </div>
            <p className="text-slate-600 mt-2" style={{ fontSize: 14, lineHeight: 1.5 }}>
              {isFr
                ? "Abonnez-vous aujourd'hui et ne payez que l'équipement à l'installation."
                : "Subscribe today and only pay for equipment at setup."}
            </p>
          </div>

          {/* Equipment detail */}
          <div
            className="flex items-center justify-between"
            style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}
          >
            <div className="text-slate-700" style={{ fontSize: 13 }}>
              <span className="font-semibold text-slate-900">{isFr ? "Borne WiFi" : "WiFi Router"}</span>
              <span className="text-slate-400 mx-2">·</span>
              <span className="font-semibold text-slate-900">{isFr ? "Terminal TV" : "TV Terminal"}</span>
            </div>
            <div className="text-slate-500" style={{ fontSize: 12 }}>
              {isFr ? "dès 50$" : "from $50"}
            </div>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={goToPlans}
            className="w-full flex items-center justify-center gap-2 font-semibold text-white transition-colors"
            style={{
              height: 52,
              borderRadius: 10,
              background: BRAND,
              fontSize: 15,
              marginTop: 6,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = BRAND_DARK; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = BRAND; }}
          >
            {isFr ? "Voir les forfaits Internet" : "See Internet plans"}
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Reassurance footer */}
          <div className="flex items-center justify-center gap-1.5 mt-4 text-slate-500" style={{ fontSize: 12 }}>
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#10B981" }} />
            {isFr ? "Remboursable 30 jours · Sans engagement" : "30-day refund · No contract"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaunchOfferPopup;
