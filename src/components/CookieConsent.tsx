import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const COOKIE_KEY = "nivra_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [lang, setLang] = useState<"fr" | "en">("fr");

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("nivra_language") || navigator.language || "fr";
      setLang(stored.startsWith("en") ? "en" : "fr");
    } catch { /* ignore */ }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(COOKIE_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  const isFr = lang === "fr";

  const text = isFr
    ? "Nous utilisons des cookies essentiels (fonctionnement), analytiques (audience anonyme) et PayPal (paiements)."
    : "We use essential cookies (functionality), analytics cookies (anonymous audience), and PayPal cookies (payments).";

  const privacyLabel = isFr ? "Politique de confidentialité" : "Privacy Policy";
  const acceptLabel = isFr ? "Accepter" : "Accept";
  const declineLabel = isFr ? "Refuser" : "Decline";
  const title = isFr ? "Cookies & vie privée" : "Cookies & Privacy";
  const cookieList = isFr
    ? "Essentiels · Analytiques · PayPal · Sentry"
    : "Essential · Analytics · PayPal · Sentry";

  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, padding: "16px", pointerEvents: "none" }}>
      <div style={{
        maxWidth: 420,
        marginLeft: "auto",
        background: "rgba(6,9,20,0.97)",
        border: "1px solid rgba(6,182,212,0.25)",
        borderRadius: 16,
        boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(6,182,212,0.1)",
        padding: "20px 22px",
        pointerEvents: "auto",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(34,211,238,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 8h.01M11 12h1v4h1" />
            </svg>
          </div>
          <div>
            <p style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.25rem" }}>{title}</p>
            <p style={{ color: "#94a3b8", fontSize: "0.82rem", lineHeight: 1.6, margin: 0 }}>
              {text}{" "}
              <Link to="/politique-de-confidentialite" style={{ color: "#22d3ee", textDecoration: "none" }}>
                {privacyLabel}
              </Link>
              {" "}(Loi 25 QC).
            </p>
          </div>
        </div>

        <p style={{ color: "#475569", fontSize: "0.75rem", marginBottom: 14, fontFamily: "'JetBrains Mono', monospace" }}>
          {cookieList}
        </p>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={decline}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#64748b", fontSize: "0.82rem", padding: "7px 14px", cursor: "pointer", transition: "border-color 0.15s, color 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.color = "#94a3b8"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#64748b"; }}
          >
            {declineLabel}
          </button>
          <button
            onClick={accept}
            style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.9), rgba(6,182,212,0.7))", border: "1px solid rgba(6,182,212,0.4)", borderRadius: 8, color: "#fff", fontSize: "0.82rem", fontWeight: 700, padding: "7px 16px", cursor: "pointer", transition: "opacity 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
