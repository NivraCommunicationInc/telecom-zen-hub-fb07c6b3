import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PhotoBg } from "@/components/PhotoBg";
import { COMPANY_CONTACT } from "@/config/company";
import { CONTRACT_TERMS } from "@/lib/contractPolicies";
import { Link } from "react-router-dom";

const infoBox = {
  background: "rgba(6,182,212,0.07)",
  border: "1px solid rgba(6,182,212,0.22)",
  borderRadius: 10,
  padding: "24px 28px",
} as const;

const successBox = {
  background: "rgba(16,185,129,0.07)",
  border: "1px solid rgba(16,185,129,0.22)",
  borderRadius: 10,
  padding: "24px 28px",
} as const;

const warnBox = {
  background: "rgba(245,158,11,0.07)",
  border: "1px solid rgba(245,158,11,0.22)",
  borderRadius: 10,
  padding: "24px 28px",
} as const;

const section = { marginBottom: "2rem" } as const;
const h2 = { color: "#e2e8f0", fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.75rem" } as const;
const p = { color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.75rem" } as const;
const li = { color: "#94a3b8", lineHeight: 1.8, marginBottom: "0.35rem" } as const;

const MetricCard = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 24px", textAlign: "center" }}>
    <p style={{ color: "#22d3ee", fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>{value}</p>
    <p style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.95rem", marginTop: "0.4rem" }}>{label}</p>
    {sub && <p style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.25rem" }}>{sub}</p>}
  </div>
);

export default function NiveauxDeService() {
  const { sla } = CONTRACT_TERMS;
  return (
    <div style={{ background: "#020209", minHeight: "100vh" }} className="relative overflow-hidden">
      <PhotoBg
        url="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1920&q=80"
        opacity={0.11}
        filter="saturate(0.6) brightness(0.6)"
      />
      <div aria-hidden style={{ position: "absolute", top: "-10%", right: "-8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(6,182,212,0.12) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-10%", left: "-6%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(16,185,129,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />
      <Header />

      <main className="pt-24 pb-16" style={{ position: "relative", zIndex: 1 }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <div style={{ marginBottom: "0.5rem" }}>
            <span style={{ color: "#22d3ee", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Accord de niveau de service</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            Niveaux de service
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "2.5rem" }}>
            Service Level Agreement (SLA) · Nos engagements envers vous · Dernière mise à jour : juin 2026
          </p>

          {/* KPI Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2.5rem" }}>
            <MetricCard label="Disponibilité cible" value={`${sla.uptimeTargetPercent}%`} sub="Disponibilité réseau annuelle" />
            <MetricCard label="Réponse critique" value={`${sla.incidentResponseMinutes.critical}min`} sub="Temps de réponse incidents P1" />
            <MetricCard label="Crédit max" value={`${sla.maxCreditPercent}%`} sub="Du forfait mensuel en cas d'indisponibilité" />
          </div>

          <div style={successBox} className="mb-8">
            <p style={{ color: "#34d399", fontWeight: 600, marginBottom: "0.5rem" }}>Notre engagement</p>
            <p style={p}>
              Nivra Telecom s'engage à fournir des services Internet, mobile et TV fiables et de haute qualité.
              Cet accord de niveau de service (SLA) définit nos objectifs de performance, nos procédures de
              réponse aux incidents, et vos droits en cas d'indisponibilité.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>1. Disponibilité du réseau</h2>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Objectif de disponibilité :</strong> {sla.uptimeTargetPercent}% (mesuré mensuellement, hors maintenance planifiée)</li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Maintenance planifiée :</strong> {sla.plannedMaintenanceWindowFr} — Les clients sont notifiés 48h à l'avance par courriel</li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Urgences réseau :</strong> Interventions 24h/7j en cas d'interruption critique</li>
            </ul>
          </div>

          <div style={section}>
            <h2 style={h2}>2. Classification des incidents et temps de réponse</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: "#94a3b8", fontSize: "0.85rem", fontWeight: 600 }}>Priorité</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: "#94a3b8", fontSize: "0.85rem", fontWeight: 600 }}>Description</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: "#94a3b8", fontSize: "0.85rem", fontWeight: 600 }}>Temps de réponse</th>
                    <th style={{ textAlign: "left", padding: "10px 12px", color: "#94a3b8", fontSize: "0.85rem", fontWeight: 600 }}>Objectif résolution</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "10px 12px" }}><span style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", borderRadius: 4, padding: "2px 8px", fontSize: "0.8rem", fontWeight: 700 }}>P1 — Critique</span></td>
                    <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: "0.9rem" }}>Interruption totale du service affectant plusieurs clients</td>
                    <td style={{ padding: "10px 12px", color: "#e2e8f0", fontWeight: 600 }}>{sla.incidentResponseMinutes.critical} min</td>
                    <td style={{ padding: "10px 12px", color: "#94a3b8" }}>4 heures</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "10px 12px" }}><span style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24", borderRadius: 4, padding: "2px 8px", fontSize: "0.8rem", fontWeight: 700 }}>P2 — Élevée</span></td>
                    <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: "0.9rem" }}>Dégradation significative de la qualité de service</td>
                    <td style={{ padding: "10px 12px", color: "#e2e8f0", fontWeight: 600 }}>{sla.incidentResponseMinutes.high / 60}h</td>
                    <td style={{ padding: "10px 12px", color: "#94a3b8" }}>24 heures</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "10px 12px" }}><span style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", borderRadius: 4, padding: "2px 8px", fontSize: "0.8rem", fontWeight: 700 }}>P3 — Normale</span></td>
                    <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: "0.9rem" }}>Interruption individuelle ou problème de configuration</td>
                    <td style={{ padding: "10px 12px", color: "#e2e8f0", fontWeight: 600 }}>24h</td>
                    <td style={{ padding: "10px 12px", color: "#94a3b8" }}>72 heures</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={section}>
            <h2 style={h2}>3. Crédit de service (SLA Credit)</h2>
            <p style={p}>
              Si la disponibilité mensuelle descend sous <strong style={{ color: "#e2e8f0" }}>{sla.creditEligibilityPercent}%</strong> pour
              des raisons imputables à Nivra Telecom (excluant maintenance planifiée, force majeure, problèmes
              hors de notre réseau) :
            </p>
            <ul style={{ paddingLeft: "1.5rem", marginBottom: "1rem" }}>
              <li style={li}>Droit à un crédit sur votre prochain cycle de facturation</li>
              <li style={li}>Crédit maximum : {sla.maxCreditPercent}% du montant mensuel du forfait affecté</li>
              <li style={li}>Les crédits ne s'appliquent pas sur les taxes, frais d'activation, ou équipements</li>
            </ul>
            <p style={p}>
              Pour demander un crédit, soumettez un ticket dans les 30 jours suivant l'incident avec la date,
              l'heure, et la durée approximative de l'interruption.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>4. Exclusions</h2>
            <p style={p}>Les engagements SLA ne s'appliquent pas dans les cas suivants :</p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>Maintenance planifiée (avec préavis de 48h)</li>
              <li style={li}>Force majeure (catastrophes naturelles, pannes électriques généralisées, etc.)</li>
              <li style={li}>Interruptions causées par le client (équipement défectueux côté client, mauvaise configuration)</li>
              <li style={li}>Interruptions hors de notre réseau (problèmes chez notre fournisseur d'accès amont)</li>
              <li style={li}>Service Internet : problèmes liés à l'infrastructure du dernier kilomètre non gérée par Nivra</li>
            </ul>
          </div>

          <div style={warnBox} className="mb-8">
            <p style={{ color: "#fbbf24", fontWeight: 600, marginBottom: "0.5rem" }}>
              <span style={{ marginRight: "0.5rem" }}>⚠</span> Plafond de responsabilité
            </p>
            <p style={{ color: "#94a3b8" }}>
              La responsabilité totale de Nivra Telecom en cas d'interruption de service est limitée aux
              crédits de service décrits ci-dessus. Nivra Telecom n'est pas responsable des dommages indirects,
              consécutifs, ou des pertes commerciales découlant d'une interruption de service.
            </p>
          </div>

          <div style={section}>
            <h2 style={h2}>5. Support technique</h2>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Heures de support :</strong> {COMPANY_CONTACT.supportHours}</li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Canal de contact :</strong> Portail client (tickets) et courriel</li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Urgences réseau :</strong> Surveillance 24h/7j — signalez via le portail</li>
              <li style={li}>Courriel : <a href={`mailto:${COMPANY_CONTACT.supportEmail}`} style={{ color: "#22d3ee" }}>{COMPANY_CONTACT.supportEmail}</a></li>
            </ul>
          </div>

          <div style={infoBox}>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
              <strong style={{ color: "#22d3ee" }}>English summary:</strong> Nivra Telecom targets {sla.uptimeTargetPercent}% network availability. Planned maintenance: {sla.plannedMaintenanceWindowEn} with 48h notice. Critical incidents (P1) are responded to within {sla.incidentResponseMinutes.critical} minutes. If monthly availability drops below {sla.creditEligibilityPercent}%, you are eligible for a service credit of up to {sla.maxCreditPercent}% of your monthly plan fee. Excludes planned maintenance, force majeure, and client-side issues.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
