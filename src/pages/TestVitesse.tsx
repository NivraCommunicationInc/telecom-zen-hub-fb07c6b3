import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";

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

export default function TestVitesse() {

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
          {/* HERO */}
          <section style={{ textAlign: "center", marginBottom: 40 }}>
            <h1
              style={{
                fontSize: "clamp(28px, 5vw, 48px)",
                fontWeight: 800,
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              Testez votre vitesse Internet
            </h1>
            <p
              style={{
                marginTop: 14,
                color: COLORS.accentSoft,
                fontSize: "clamp(14px, 2vw, 17px)",
                maxWidth: 640,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              Vérifiez si votre connexion correspond à votre forfait Nivra Telecom
            </p>
          </section>

          {/* INFO CARDS */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
              marginBottom: 40,
            }}
          >
            {[
              { icon: "🌐", title: "Serveur recommandé", line1: "Montréal, QC", line2: "Bell / Videotron" },
              { icon: "⚡", title: "Test complet", line1: "Download, Upload", line2: "et Latence" },
              { icon: "🏆", title: "Propulsé par", line1: "Speedtest.net by Ookla", line2: "Le standard mondial" },
            ].map((c) => (
              <div
                key={c.title}
                style={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 16,
                  padding: 24,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>{c.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{c.title}</div>
                <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>{c.line1}</div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{c.line2}</div>
              </div>
            ))}
          </section>

          {/* LARGE CTA */}
          <section style={{ textAlign: "center", marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => window.open("https://www.speedtest.net", "_blank", "noopener,noreferrer")}
              style={{
                width: "min(300px, 100%)",
                height: 64,
                borderRadius: 999,
                border: "none",
                background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentSoft})`,
                color: "#ffffff",
                fontWeight: 800,
                fontSize: 17,
                cursor: "pointer",
                boxShadow: "0 10px 30px -10px rgba(124,58,237,0.6)",
              }}
            >
              ▶ Démarrer le test de vitesse
            </button>
            <p
              style={{
                marginTop: 14,
                fontSize: 13,
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.5,
              }}
            >
              Vous serez redirigé vers Speedtest.net.
              <br />
              Le test s'ouvrira dans un nouvel onglet.
            </p>
          </section>

          {/* COMPARISON */}
          <section style={{ marginTop: 56, marginBottom: 48 }}>
            <h2
              style={{
                fontSize: "clamp(20px, 3vw, 26px)",
                fontWeight: 700,
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              Comparez avec votre forfait Nivra
            </h2>
            <div
              style={{
                background: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                  <thead>
                    <tr style={{ background: "rgba(124,58,237,0.15)" }}>
                      <th style={{ padding: "14px 18px", textAlign: "left", fontSize: 14, fontWeight: 700 }}>
                        Forfait
                      </th>
                      <th style={{ padding: "14px 18px", textAlign: "left", fontSize: 14, fontWeight: 700 }}>
                        Download
                      </th>
                      <th style={{ padding: "14px 18px", textAlign: "left", fontSize: 14, fontWeight: 700 }}>
                        Upload
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { plan: "Internet 100 Mbps", down: "~90 Mbps", up: "~20 Mbps" },
                      { plan: "Internet 500 Mbps", down: "~450 Mbps", up: "~50 Mbps" },
                      { plan: "Internet Giga", down: "~900 Mbps", up: "~100 Mbps" },
                    ].map((row) => (
                      <tr key={row.plan} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: "14px 18px", fontSize: 14, fontWeight: 600 }}>{row.plan}</td>
                        <td style={{ padding: "14px 18px", fontSize: 14, color: COLORS.accentSoft }}>{row.down}</td>
                        <td style={{ padding: "14px 18px", fontSize: 14, color: COLORS.accentSoft }}>{row.up}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p
              style={{
                marginTop: 14,
                fontSize: 13,
                color: "rgba(255,255,255,0.65)",
                textAlign: "center",
              }}
            >
              Si votre vitesse est inférieure à 70 % de votre forfait, contactez notre support.
            </p>
          </section>

          {/* SUPPORT */}
          <section
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 16,
              padding: 28,
              textAlign: "center",
            }}
          >
            <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 16 }}>
              Un problème avec votre connexion ?
            </h3>
            <div
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
                📧 Contacter le support
              </a>
              <Link
                to="/portal/tickets"
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
                🎫 Ouvrir un ticket
              </Link>
            </div>
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
