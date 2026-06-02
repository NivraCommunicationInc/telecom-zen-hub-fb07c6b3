import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import { Globe, Zap, Award, Mail, TicketCheck, Gauge } from "lucide-react";

const BG = '#020209';
const VIOLET = '#7C3AED';
const CYAN = '#06B6D4';
const VIOLET_LIGHT = '#A78BFA';

const COLORS = {
  bg: BG,
  card: "rgba(255,255,255,0.04)",
  border: "rgba(124,58,237,0.25)",
  accent: VIOLET,
  accentSoft: VIOLET_LIGHT,
  text: "#ffffff",
} as const;

export default function TestVitesse() {
  return (
    <>
      <Helmet>
        <title>Test de vitesse Internet — Nivra Telecom</title>
        <meta
          name="description"
          content="Mesurez votre vitesse Internet réelle avec le test propulsé par Speedtest.net. Serveurs Québec, résultats fiables."
        />
        <link rel="canonical" href="https://nivra-telecom.ca/test-vitesse" />
      </Helmet>

      <Header />
      <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, paddingTop: 64 }}>

        {/* HERO */}
        <section className="relative overflow-hidden" style={{ paddingTop: 80, paddingBottom: 64, textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 550, height: 550, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', animation: 'n-aurora-1 18s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', animation: 'n-aurora-2 14s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), rgba(6,182,212,0.4), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 2, maxWidth: 700, margin: '0 auto', padding: '0 24px' }}>
            <div className="n-animate-in" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 100, padding: '6px 16px', marginBottom: 24 }}>
              <Gauge style={{ width: 14, height: 14, color: VIOLET }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: VIOLET_LIGHT, letterSpacing: '0.08em' }}>TEST DE VITESSE</span>
            </div>
            <h1 className="n-animate-in-delay-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(32px, 5vw, 56px)', letterSpacing: '-2.5px', lineHeight: 1.05, marginBottom: 16, color: '#fff' }}>
              Testez votre{' '}<span className="n-shimmer-text">vitesse Internet</span>
            </h1>
            <p className="n-animate-in-delay-2" style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', maxWidth: 520, margin: '0 auto 40px' }}>
              Vérifiez si votre connexion correspond à votre forfait Nivra Telecom
            </p>

            {/* CTA */}
            <div className="n-animate-in-delay-3">
              <button
                type="button"
                onClick={() => window.open("https://www.speedtest.net", "_blank", "noopener,noreferrer")}
                style={{
                  height: 60,
                  padding: '0 40px',
                  borderRadius: 999,
                  border: "none",
                  background: `linear-gradient(135deg, ${VIOLET}, ${CYAN})`,
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: 16,
                  fontFamily: "'Space Grotesk', sans-serif",
                  cursor: "pointer",
                  boxShadow: "0 10px 30px -10px rgba(124,58,237,0.6)",
                  transition: 'opacity 0.2s, transform 0.2s',
                  letterSpacing: '-0.3px',
                }}
              >
                Démarrer le test de vitesse
              </button>
              <p style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                Redirigé vers Speedtest.net — s'ouvre dans un nouvel onglet
              </p>
            </div>
          </div>
        </section>

        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>

          {/* INFO CARDS */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
              marginBottom: 48,
            }}
          >
            {[
              { icon: <Globe style={{ width: 22, height: 22, color: VIOLET_LIGHT }} />, bg: 'rgba(124,58,237,0.15)', title: "Serveur recommandé", line1: "Montréal, QC", line2: "Réseau local certifié" },
              { icon: <Zap style={{ width: 22, height: 22, color: CYAN }} />, bg: 'rgba(6,182,212,0.15)', title: "Test complet", line1: "Download, Upload", line2: "et Latence" },
              { icon: <Award style={{ width: 22, height: 22, color: '#F59E0B' }} />, bg: 'rgba(245,158,11,0.15)', title: "Propulsé par", line1: "Speedtest.net by Ookla", line2: "Le standard mondial" },
            ].map((c) => (
              <div
                key={c.title}
                style={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 16,
                  padding: 24,
                  textAlign: "center",
                  backdropFilter: 'blur(24px)',
                }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 12, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>{c.icon}</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 6, color: '#fff' }}>{c.title}</div>
                <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>{c.line1}</div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>{c.line2}</div>
              </div>
            ))}
          </section>

          {/* COMPARISON */}
          <section style={{ marginBottom: 48 }}>
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "clamp(20px, 3vw, 26px)",
                fontWeight: 700,
                marginBottom: 20,
                textAlign: "center",
                color: '#fff',
                letterSpacing: '-1px',
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
                backdropFilter: 'blur(24px)',
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                  <thead>
                    <tr style={{ background: "rgba(124,58,237,0.15)" }}>
                      <th style={{ padding: "14px 18px", textAlign: "left", fontSize: 14, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: '#fff' }}>
                        Forfait
                      </th>
                      <th style={{ padding: "14px 18px", textAlign: "left", fontSize: 14, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: '#fff' }}>
                        Download
                      </th>
                      <th style={{ padding: "14px 18px", textAlign: "left", fontSize: 14, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: '#fff' }}>
                        Upload
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { plan: "Internet 100 Mbps", down: "~90 Mbps", up: "~20 Mbps" },
                      { plan: "Internet 500 Mbps", down: "~450 Mbps", up: "~50 Mbps" },
                      { plan: "Internet Giga", down: "~1 000 Mbps", up: "~100 Mbps" },
                    ].map((row) => (
                      <tr key={row.plan} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: "14px 18px", fontSize: 14, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", color: '#fff' }}>{row.plan}</td>
                        <td style={{ padding: "14px 18px", fontSize: 14, fontFamily: "'JetBrains Mono', monospace", color: VIOLET_LIGHT }}>{row.down}</td>
                        <td style={{ padding: "14px 18px", fontSize: 14, fontFamily: "'JetBrains Mono', monospace", color: VIOLET_LIGHT }}>{row.up}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p style={{ marginTop: 14, fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
              Si votre vitesse est inférieure à 70 % de votre forfait, contactez notre support.
            </p>
          </section>

          {/* SUPPORT */}
          <section
            style={{
              background: COLORS.card,
              border: `1px solid rgba(124,58,237,0.3)`,
              borderRadius: 20,
              padding: 32,
              textAlign: "center",
              backdropFilter: 'blur(24px)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: '-40%', left: '50%', transform: 'translateX(-50%)', width: 300, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: '#fff', letterSpacing: '-0.5px' }}>
                Un problème avec votre connexion ?
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 24, fontSize: 14 }}>Notre équipe est disponible 7j/7 pour vous aider.</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                <a
                  href="mailto:support@nivra-telecom.ca"
                  style={{
                    padding: "12px 22px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.text,
                    textDecoration: "none",
                    fontWeight: 600,
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 14,
                    minHeight: 44,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    transition: 'all 0.2s',
                  }}
                >
                  <Mail style={{ width: 16, height: 16 }} />
                  Contacter le support
                </a>
                <Link
                  to="/portal/tickets"
                  style={{
                    padding: "12px 22px",
                    borderRadius: 12,
                    background: `linear-gradient(135deg, ${VIOLET}, ${CYAN})`,
                    color: "#ffffff",
                    textDecoration: "none",
                    fontWeight: 700,
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 14,
                    minHeight: 44,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
                    transition: 'opacity 0.2s',
                  }}
                >
                  <TicketCheck style={{ width: 16, height: 16 }} />
                  Ouvrir un ticket
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
