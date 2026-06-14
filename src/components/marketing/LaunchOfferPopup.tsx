/**
 * LaunchOfferPopup — Homepage promo popup for new visitors only.
 * - Shows after 12s on homepage
 * - Hidden for logged-in clients (presence of Supabase session)
 * - Dismissed for 7 days via localStorage
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X, Shield, ArrowRight } from "lucide-react";
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

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={dismiss}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,5,0.75)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 59,
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-labelledby="launch-offer-title"
        className="fixed z-[60] animate-in fade-in zoom-in-95 duration-300"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(440px, calc(100vw - 32px))",
        }}
      >
        <div
          className="relative text-white overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #0C0A1E 0%, #110D28 100%)",
            border: "1px solid rgba(124,58,237,0.4)",
            borderRadius: 20,
            boxShadow: "0 0 80px rgba(124,58,237,0.25), 0 24px 60px rgba(0,0,0,0.8)",
          }}
        >
          {/* Top accent line */}
          <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #7C3AED, #06B6D4, #7C3AED, transparent)", pointerEvents: "none" }} />
          {/* Ambient glow */}
          <div aria-hidden style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 320, height: 160, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />

          {/* Close button */}
          <button
            type="button"
            onClick={dismiss}
            aria-label={isFr ? "Fermer" : "Close"}
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "rgba(255,255,255,0.5)",
              zIndex: 1,
              transition: "background 0.18s, color 0.18s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.14)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Content */}
          <div style={{ padding: "36px 32px 28px", position: "relative", zIndex: 1 }}>
            {/* Eyebrow badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 999, padding: "4px 12px", marginBottom: 18 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#A78BFA", display: "block" }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {isFr ? "Offre de bienvenue" : "Welcome offer"}
              </span>
            </div>

            {/* Main title */}
            <h2 id="launch-offer-title" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: "clamp(20px, 5vw, 26px)", letterSpacing: "-0.8px", lineHeight: 1.15, color: "#fff", marginBottom: 16 }}>
              {isFr ? "Abonnez-vous dès aujourd'hui" : "Subscribe today"}
            </h2>

            {/* Offer highlight */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: "clamp(17px, 4vw, 21px)", color: "#A78BFA", marginBottom: 10, letterSpacing: "-0.3px" }}>
                {isFr ? "Recevez le premier mois GRATUIT" : "Get your first month FREE"}
              </div>
              <p style={{ color: "rgba(255,255,255,0.62)", fontSize: 13.5, lineHeight: 1.65 }}>
                {isFr
                  ? <>Vous payez seulement l'équipement :<br /><span style={{ color: "#fff", fontWeight: 600 }}>Borne WiFi 60$</span> <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span> <span style={{ color: "#fff", fontWeight: 600 }}>Terminal TV 50$</span></>
                  : <>You only pay for the equipment :<br /><span style={{ color: "#fff", fontWeight: 600 }}>WiFi Router $60</span> <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span> <span style={{ color: "#fff", fontWeight: 600 }}>TV Terminal $50</span></>
                }
              </p>
            </div>

            {/* Guarantee strip */}
            <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 24, display: "flex", alignItems: "center", gap: 9 }}>
              <Shield className="w-4 h-4 shrink-0" style={{ color: "#10B981" }} />
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                {isFr ? "Remboursable si annulation dans les 30 jours" : "Refundable if cancelled within 30 days"}
              </span>
            </div>

            {/* CTA */}
            <Link
              to="/commander"
              onClick={dismiss}
              className="flex items-center justify-center gap-2 w-full font-bold text-white"
              style={{
                height: 52,
                borderRadius: 12,
                background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",
                boxShadow: "0 0 0 1px rgba(124,58,237,0.5), 0 8px 28px rgba(124,58,237,0.4)",
                fontSize: 15,
                fontFamily: "'Space Grotesk', sans-serif",
                textDecoration: "none",
                transition: "box-shadow 0.18s, transform 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(124,58,237,0.7), 0 10px 36px rgba(124,58,237,0.6)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(124,58,237,0.5), 0 8px 28px rgba(124,58,237,0.4)"; e.currentTarget.style.transform = "none"; }}
            >
              {isFr ? "Je m'abonne maintenant" : "Subscribe now"} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default LaunchOfferPopup;
