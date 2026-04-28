import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";

// Brand palette (Xfinity Premium / Nivra)
const COLORS = {
  bg: "#1e1b4b",
  card: "rgba(255,255,255,0.05)",
  border: "rgba(124,58,237,0.3)",
  accent: "#7c3aed",
  accentSoft: "#a78bfa",
  text: "#ffffff",
} as const;

const LOGO_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function useIframeHeight(): number {
  const [h, setH] = useState<number>(() => {
    if (typeof window === "undefined") return 650;
    const w = window.innerWidth;
    if (w < 640) return 500;
    if (w < 1024) return 550;
    return 650;
  });
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      if (w < 640) setH(500);
      else if (w < 1024) setH(550);
      else setH(650);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return h;
}

export default function TestVitesse() {
  const iframeHeight = useIframeHeight();

  return (
    <>
      <Helmet>
        <title>Test de vitesse Internet — Nivra Telecom</title>
        <meta
          name="description"
          content="Mesurez votre vitesse Internet réelle avec le test propulsé par Cloudflare. Serveurs Québec, résultats fiables."
        />
        <link rel="canonical" href="https://nivra-telecom.ca/test-vitesse" />
      </Helmet>

      <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text }}>
        {/* HEADER */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px",
            borderBottom: `1px solid ${COLORS.border}`,
            background: "rgba(0,0,0,0.2)",
          }}
        >
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              textDecoration: "none",
              color: COLORS.text,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: COLORS.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: LOGO_FONT,
                fontWeight: 800,
                fontSize: 20,
                color: "#ffffff",
              }}
            >
              N
            </div>
            <span style={{ fontFamily: LOGO_FONT, fontWeight: 700, fontSize: 18 }}>
              Nivra Telecom
            </span>
          </Link>

          <Link
            to="/"
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              border: `1px solid ${COLORS.border}`,
              background: "rgba(255,255,255,0.05)",
              color: COLORS.text,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            ← Retour au site
          </Link>
        </header>

        {/* MAIN */}
        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
          {/* TITLE */}
          <section style={{ textAlign: "center", marginBottom: 32 }}>
            <h1
              style={{
                fontSize: "clamp(28px, 5vw, 44px)",
                fontWeight: 800,
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              Test de vitesse Internet
            </h1>
            <p
              style={{
                marginTop: 12,
                color: COLORS.accentSoft,
                fontSize: "clamp(14px, 2vw, 16px)",
              }}
            >
              Propulsé par Cloudflare — Serveurs Québec
            </p>
          </section>

          {/* IFRAME EMBED */}
          <section style={{ marginBottom: 24 }}>
            <iframe
              src="https://speed.cloudflare.com"
              style={{
                width: "100%",
                height: `${iframeHeight}px`,
                border: "none",
                borderRadius: 12,
                background: "transparent",
                display: "block",
              }}
              title="Test de vitesse Nivra Telecom"
              allow="camera; microphone"
            />
          </section>

          {/* INFO CARD */}
          <section
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            💡 Ce test utilise les serveurs Cloudflare pour mesurer votre vitesse
            réelle depuis votre appareil. Les résultats peuvent varier selon votre
            équipement et votre réseau local.
          </section>

          {/* CTA BUTTONS */}
          <section
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <a
              href="mailto:support@nivra-telecom.ca"
              style={{
                padding: "12px 22px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${COLORS.border}`,
                color: COLORS.text,
                textDecoration: "none",
                fontWeight: 600,
                minHeight: 44,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              📞 Signaler un problème
            </a>
            <Link
              to="/internet"
              style={{
                padding: "12px 22px",
                borderRadius: 999,
                background: COLORS.accent,
                color: "#ffffff",
                textDecoration: "none",
                fontWeight: 700,
                minHeight: 44,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              🌐 Voir nos forfaits
            </Link>
          </section>
        </main>

        {/* FOOTER */}
        <footer
          style={{
            borderTop: `1px solid ${COLORS.border}`,
            padding: "24px",
            marginTop: 48,
            background: "rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: COLORS.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: LOGO_FONT,
                  fontWeight: 800,
                  color: "#ffffff",
                  fontSize: 14,
                }}
              >
                N
              </div>
              <span style={{ color: "rgba(255,255,255,0.7)" }}>
                © {new Date().getFullYear()} Nivra Telecom
              </span>
            </div>
            <nav style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <Link to="/" style={{ color: COLORS.accentSoft, textDecoration: "none" }}>
                Accueil
              </Link>
              <Link to="/internet" style={{ color: COLORS.accentSoft, textDecoration: "none" }}>
                Internet
              </Link>
              <Link to="/contact" style={{ color: COLORS.accentSoft, textDecoration: "none" }}>
                Contact
              </Link>
            </nav>
          </div>
        </footer>
      </div>
    </>
  );
}
