import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

interface MaintenancePageProps {
  eta?: string | null;
  messageFr?: string;
  messageEn?: string;
  title?: string;
}

const MaintenancePage = ({ eta, messageFr, messageEn, title }: MaintenancePageProps) => {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const headline =
    title ?? (isFr ? "Maintenance en cours" : "Maintenance in progress");
  const message = isFr
    ? messageFr || "Nous effectuons une maintenance planifiée. Le service sera rétabli sous peu."
    : messageEn || "We are performing scheduled maintenance. Service will be restored shortly.";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d1f3c",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "500px" }}>
        <div style={{ fontSize: "64px", marginBottom: "24px" }} aria-hidden>
          🔧
        </div>
        <h1
          style={{
            color: "white",
            fontSize: "32px",
            fontWeight: 800,
            marginBottom: "12px",
          }}
        >
          {headline}
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: "16px",
            lineHeight: 1.7,
            marginBottom: "24px",
          }}
        >
          {message}
        </p>

        {eta && (
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "14px 20px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                color: "#d4a843",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "4px",
                letterSpacing: "0.5px",
              }}
            >
              {isFr ? "RÉTABLISSEMENT ESTIMÉ" : "ESTIMATED RESTORATION"}
            </div>
            <div style={{ color: "white", fontSize: "20px", fontWeight: 700 }}>{eta}</div>
          </div>
        )}

        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", marginBottom: "16px" }}>
          {isFr ? "Suivez l'état des services en temps réel → " : "Follow real-time service status → "}
          <Link to="/status" style={{ color: "#7C3AED", fontWeight: 600 }}>
            nivra-telecom.ca/status
          </Link>
        </div>

        <div className="flex items-center justify-center gap-3 text-sm">
          <Link to="/contact" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "underline" }}>
            {isFr ? "Nous contacter" : "Contact us"}
          </Link>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>•</span>
          <Link to="/portal/auth" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "underline" }}>
            {isFr ? "Portail client" : "Client portal"}
          </Link>
        </div>

        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", marginTop: "32px" }}>
          Nivra Telecom
        </p>
      </div>
    </div>
  );
};

export default MaintenancePage;
