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

export default function SupportEtPlaintes() {
  return (
    <div style={{ background: "#020209", minHeight: "100vh" }} className="relative overflow-hidden">
      <PhotoBg
        url="https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1920&q=80"
        opacity={0.11}
        filter="saturate(0.6) brightness(0.6)"
      />
      <div aria-hidden style={{ position: "absolute", top: "-10%", right: "-8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-10%", left: "-6%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />
      <Header />

      <main className="pt-24 pb-16" style={{ position: "relative", zIndex: 1 }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            Support, tickets & plaintes
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "2.5rem" }}>
            Dernière mise à jour : {CONTRACT_TERMS.lastUpdated}
          </p>

          {/* Support Channels */}
          <div style={section}>
            <h2 style={h2}>1. Canaux de support</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
              {[
                {
                  title: "Portail client",
                  sub: "Méthode recommandée",
                  action: "Ouvrir un ticket",
                  href: "/portal/auth",
                  isLink: true,
                  color: "#22d3ee",
                },
                {
                  title: "Courriel",
                  sub: COMPANY_CONTACT.supportEmailDisplay,
                  action: "Envoyer un courriel",
                  href: `mailto:${COMPANY_CONTACT.supportEmail}`,
                  isLink: false,
                  color: "#a78bfa",
                },
                {
                  title: "Heures",
                  sub: COMPANY_CONTACT.supportHoursWeekday,
                  action: COMPANY_CONTACT.supportHoursWeekend,
                  href: null,
                  isLink: false,
                  color: "#10b981",
                },
              ].map((ch) => (
                <div key={ch.title} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "20px", textAlign: "center" }}>
                  <p style={{ color: "#e2e8f0", fontWeight: 700, marginBottom: "0.35rem" }}>{ch.title}</p>
                  <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{ch.sub}</p>
                  {ch.href ? (
                    ch.isLink ? (
                      <Link to={ch.href} style={{ color: ch.color, fontSize: "0.85rem" }}>{ch.action}</Link>
                    ) : (
                      <a href={ch.href} style={{ color: ch.color, fontSize: "0.85rem" }}>{ch.action}</a>
                    )
                  ) : (
                    <p style={{ color: ch.color, fontSize: "0.85rem", margin: 0 }}>{ch.action}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Response Targets */}
          <div style={section}>
            <h2 style={h2}>2. Délais cibles de réponse</h2>
            <div style={infoBox}>
              <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.75rem" }}>Objectifs (sans garantie)</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                {[
                  ["Première réponse (ticket)", "24h ouvrables"],
                  ["Résolution standard", "48–72h"],
                  ["Changements chaînes TV", "2h – 24h"],
                  ["Urgences techniques", "Même jour si possible"],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "0.5rem" }}>
                    <span style={{ color: "#64748b", fontSize: "0.9rem" }}>{label}</span>
                    <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.9rem" }}>{val}</span>
                  </div>
                ))}
              </div>
              <p style={{ color: "#475569", fontSize: "0.8rem", marginTop: "0.75rem", fontStyle: "italic" }}>
                Ces délais sont des objectifs et non des garanties. Les délais réels peuvent varier selon la complexité et le volume de demandes.
              </p>
            </div>
          </div>

          {/* Ticket System */}
          <div style={section}>
            <h2 style={h2}>3. Système de tickets</h2>
            <p style={p}>Tous les tickets de support passent par les statuts suivants :</p>
            <ul style={{ paddingLeft: "1.5rem", marginBottom: "1rem" }}>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Open (Ouvert) :</strong> Ticket créé, en attente de traitement</li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>In Progress (En cours) :</strong> Un agent travaille sur votre demande</li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Waiting for client :</strong> Information additionnelle requise</li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Resolved (Résolu) :</strong> Problème résolu</li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Closed (Fermé) :</strong> Ticket fermé</li>
            </ul>
            <div style={warnBox}>
              <p style={{ color: "#fbbf24", fontWeight: 600, marginBottom: "0.5rem" }}>
                <span style={{ marginRight: "0.5rem" }}>⚠</span> Fermeture automatique
              </p>
              <p style={{ color: "#94a3b8", margin: 0 }}>
                Les tickets sans réponse du client peuvent être <strong style={{ color: "#e2e8f0" }}>fermés automatiquement après 7 jours</strong>.
                Vous pouvez demander la réouverture d'un ticket fermé en contactant le support.
              </p>
            </div>
          </div>

          {/* TV Changes */}
          <div style={section}>
            <h2 style={h2}>4. Changements de chaînes TV</h2>
            <p style={p}>Les demandes de modification de chaînes TV créent un ticket interne avec les délais suivants :</p>
            <div style={infoBox}>
              <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.5rem" }}>Délai de traitement : 2h à 24h</p>
              <p style={{ color: "#94a3b8", margin: 0 }}>
                Statuts : <strong style={{ color: "#e2e8f0" }}>Open → In Progress → Completed</strong>.<br />
                Vous recevrez une notification lorsque les modifications seront appliquées.
              </p>
            </div>
          </div>

          {/* Billing Disputes */}
          <div style={section}>
            <h2 style={h2}>5. Contestation de facturation</h2>
            <p style={p}>
              Toute contestation de facturation doit être soumise dans les <strong style={{ color: "#e2e8f0" }}>10 jours</strong> suivant
              la réception de la facture.
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>Ouvrez un ticket avec le sujet « Contestation de facturation »</li>
              <li style={li}>Incluez le numéro de facture concerné</li>
              <li style={li}>Décrivez clairement la nature du litige</li>
            </ul>
          </div>

          {/* Technical Evidence */}
          <div style={section}>
            <h2 style={h2}>6. Preuves techniques</h2>
            <p style={p}>
              Conformément aux lois applicables, les éléments suivants peuvent être utilisés comme preuves en cas de litige :
            </p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>Logs d'activation et confirmations de service</li>
              <li style={li}>Preuves de livraison et accusés de réception</li>
              <li style={li}>Statuts de paiement et confirmations e-Transfer</li>
              <li style={li}>Historique des tickets et communications</li>
            </ul>
          </div>

          {/* CCTS */}
          <div style={section}>
            <h2 style={h2}>7. Plaintes non résolues — CPRST</h2>
            <div style={infoBox}>
              <p style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "0.5rem" }}>
                Commission des plaintes relatives aux services de télécom-télévision (CPRST)
              </p>
              <p style={p}>
                Si vous ne pouvez pas résoudre un problème avec nous, vous pouvez soumettre une plainte
                au CPRST, un organisme indépendant de résolution des plaintes — gratuit pour les consommateurs.
              </p>
              <ul style={{ paddingLeft: "1.5rem" }}>
                <li style={li}>
                  <strong style={{ color: "#e2e8f0" }}>Site web : </strong>
                  <a href={CONTRACT_TERMS.regulatory.ccts.website} target="_blank" rel="noopener noreferrer" style={{ color: "#22d3ee" }}>
                    {CONTRACT_TERMS.regulatory.ccts.website}
                  </a>
                </li>
                <li style={li}><strong style={{ color: "#e2e8f0" }}>Description : </strong>{CONTRACT_TERMS.regulatory.ccts.description}</li>
              </ul>
            </div>
          </div>

          {/* CRTC */}
          <div style={section}>
            <h2 style={h2}>8. CRTC</h2>
            <p style={p}>Le CRTC offre également des options de plainte/demande pour les questions réglementaires.</p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>
                <strong style={{ color: "#e2e8f0" }}>Site web : </strong>
                <a href={CONTRACT_TERMS.regulatory.crtc.website} target="_blank" rel="noopener noreferrer" style={{ color: "#22d3ee" }}>
                  {CONTRACT_TERMS.regulatory.crtc.website}
                </a>
              </li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Codes applicables : </strong>{CONTRACT_TERMS.regulatory.crtc.codes.join(", ")}</li>
            </ul>
          </div>

          {/* Security PIN */}
          <div style={section}>
            <h2 style={h2}>9. NIP de sécurité</h2>
            <p style={p}>Un NIP de sécurité à 4 chiffres est obligatoire pour :</p>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}>Accéder à votre compte par courriel ou support</li>
              <li style={li}>Autoriser certaines modifications sensibles</li>
              <li style={li}>Vérifier votre identité auprès du support</li>
            </ul>
            <p style={{ ...p, fontSize: "0.85rem", color: "#475569" }}>
              Vous pouvez désigner un « Autre utilisateur autorisé » dans votre portail client.
              Ne partagez jamais votre NIP par courriel ou messagerie non sécurisée.
            </p>
          </div>

          {/* Contact */}
          <div style={section}>
            <h2 style={h2}>Contact</h2>
            <ul style={{ paddingLeft: "1.5rem" }}>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Courriel : </strong>{COMPANY_CONTACT.supportEmailDisplay}</li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Adresse : </strong>{COMPANY_CONTACT.fullAddress}</li>
              <li style={li}><strong style={{ color: "#e2e8f0" }}>Chat / Tickets : </strong><Link to="/contact" style={{ color: "#22d3ee" }}>Nous joindre</Link></li>
            </ul>
          </div>

          <p style={{ color: "#475569", fontSize: "0.9rem" }}>
            <Link to="/conditions-de-service" style={{ color: "#22d3ee" }}>← Retour aux Conditions de service</Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
