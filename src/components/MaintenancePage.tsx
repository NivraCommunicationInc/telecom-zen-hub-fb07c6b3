import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { LogoFull } from "@/components/brand";
import { Wrench, Clock, Mail, ArrowRight, Activity } from "lucide-react";

interface MaintenancePageProps {
  eta?: string | null;
  messageFr?: string;
  messageEn?: string;
  title?: string;
}

/**
 * MaintenancePage — Native Nivra Telecom design.
 * Dark background (#020209), violet primary (#7C3AED), Space Grotesk display,
 * Inter body, rounded-full CTAs, brand logo. Visually identical to public site.
 */
const MaintenancePage = ({ eta, messageFr, messageEn, title }: MaintenancePageProps) => {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const headline =
    title ?? (isFr ? "Maintenance en cours" : "Maintenance in progress");
  const message = isFr
    ? messageFr ||
      "Nous effectuons une maintenance planifiée pour améliorer votre expérience. Le service sera rétabli sous peu."
    : messageEn ||
      "We're performing scheduled maintenance to improve your experience. Service will be restored shortly.";

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{
        background:
          "radial-gradient(1200px 600px at 50% -10%, rgba(124,58,237,0.18), transparent 60%), #020209",
        color: "#FAFAFA",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header — matches public site */}
      <header className="w-full">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" aria-label="Nivra Telecom" className="flex items-center">
            <LogoFull height={36} className="text-white" />
          </Link>
          <Link
            to="/status"
            className="hidden sm:inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition"
          >
            <Activity className="w-4 h-4" />
            {isFr ? "État des services" : "Service status"}
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl text-center">
          {/* Icon badge */}
          <div
            className="inline-flex items-center justify-center mb-8"
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
              boxShadow: "0 20px 60px -10px rgba(124,58,237,0.5)",
            }}
            aria-hidden
          >
            <Wrench className="w-10 h-10 text-white" />
          </div>

          {/* Headline */}
          <h1
            className="font-bold tracking-tight mb-4"
            style={{
              fontFamily: "'Space Grotesk', 'Inter', sans-serif",
              fontSize: "clamp(2rem, 5vw, 3.25rem)",
              lineHeight: 1.1,
              color: "#FAFAFA",
            }}
          >
            {headline}
          </h1>

          {/* Message */}
          <p
            className="mx-auto mb-8"
            style={{
              color: "rgba(250,250,250,0.7)",
              fontSize: "clamp(1rem, 2vw, 1.125rem)",
              lineHeight: 1.65,
              maxWidth: "520px",
            }}
          >
            {message}
          </p>

          {/* ETA card */}
          {eta && (
            <div
              className="mx-auto mb-10 inline-flex items-center gap-4 px-6 py-4 text-left"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(124,58,237,0.3)",
                borderRadius: 16,
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(124,58,237,0.2)",
                }}
              >
                <Clock className="w-5 h-5" style={{ color: "#A78BFA" }} />
              </div>
              <div>
                <div
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "#A78BFA" }}
                >
                  {isFr ? "Rétablissement estimé" : "Estimated restoration"}
                </div>
                <div className="text-lg font-bold text-white">{eta}</div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-10">
            <Link
              to="/status"
              className="inline-flex items-center justify-center gap-2 px-7 font-semibold transition-all hover:scale-[1.02]"
              style={{
                height: 52,
                borderRadius: 9999,
                background: "#7C3AED",
                color: "#FFFFFF",
                boxShadow: "0 10px 30px -5px rgba(124,58,237,0.5)",
                minWidth: 220,
              }}
            >
              {isFr ? "Voir l'état des services" : "View service status"}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 px-7 font-semibold transition-all"
              style={{
                height: 52,
                borderRadius: 9999,
                background: "rgba(255,255,255,0.06)",
                color: "#FAFAFA",
                border: "1px solid rgba(255,255,255,0.12)",
                minWidth: 220,
              }}
            >
              <Mail className="w-4 h-4" />
              {isFr ? "Nous contacter" : "Contact us"}
            </Link>
          </div>

          {/* Portal access */}
          <div className="text-sm" style={{ color: "rgba(250,250,250,0.5)" }}>
            {isFr ? "Client existant ? " : "Existing client? "}
            <Link
              to="/portal/auth"
              className="font-semibold hover:underline"
              style={{ color: "#A78BFA" }}
            >
              {isFr ? "Accéder au portail" : "Access portal"}
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="w-full border-t"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: "rgba(250,250,250,0.4)" }}>
          <div>© {new Date().getFullYear()} Nivra Telecom</div>
          <div className="flex items-center gap-4">
            <Link to="/aide" className="hover:text-white transition">
              {isFr ? "Centre d'aide" : "Help center"}
            </Link>
            <span aria-hidden style={{ color: "rgba(255,255,255,0.15)" }}>•</span>
            <a
              href="mailto:support@nivra-telecom.ca"
              className="hover:text-white transition"
            >
              support@nivra-telecom.ca
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MaintenancePage;
