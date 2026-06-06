/**
 * Critical Information Summary (CIS) — CRTC Internet Code requirement
 * Displays standardized key plan information at the point of sale.
 * Required for all Internet, Mobile, and TV service plans.
 */
import { Link } from "react-router-dom";
import { COMPANY_CONTACT } from "@/config/company";

interface CISProps {
  serviceType: "internet" | "mobile" | "tv";
  planName: string;
  monthlyPrice: number;
  downloadSpeed?: string;
  uploadSpeed?: string;
  dataCapGb?: number | null;
  overageFeePerGb?: number | null;
  contractMonths?: number;
  activationFee?: number;
  equipmentFee?: number;
  language?: "fr" | "en";
}

export default function CriticalInfoSummary({
  serviceType,
  planName,
  monthlyPrice,
  downloadSpeed,
  uploadSpeed,
  dataCapGb,
  overageFeePerGb,
  contractMonths = 0,
  activationFee,
  equipmentFee,
  language = "fr",
}: CISProps) {
  const isFr = language === "fr";

  const fmt = (n: number) =>
    new Intl.NumberFormat(isFr ? "fr-CA" : "en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 2,
    }).format(n);

  const rows: { label: string; value: string; highlight?: boolean }[] = [];

  // Price
  rows.push({
    label: isFr ? "Prix mensuel" : "Monthly price",
    value: `${fmt(monthlyPrice)} ${isFr ? "(+ TPS + TVQ)" : "(+ GST + QST)"}`,
    highlight: true,
  });

  // Speeds (internet/mobile)
  if (serviceType !== "tv") {
    if (downloadSpeed) {
      rows.push({ label: isFr ? "Vitesse téléchargement" : "Download speed", value: downloadSpeed });
    }
    if (uploadSpeed) {
      rows.push({ label: isFr ? "Vitesse envoi" : "Upload speed", value: uploadSpeed });
    }
  }

  // Data cap
  if (serviceType !== "tv") {
    rows.push({
      label: isFr ? "Données incluses" : "Included data",
      value: dataCapGb ? `${dataCapGb} Go` : (isFr ? "Illimité" : "Unlimited"),
    });
    if (dataCapGb && overageFeePerGb) {
      rows.push({
        label: isFr ? "Frais dépassement" : "Overage fee",
        value: `${fmt(overageFeePerGb)}/Go supplémentaire`,
      });
    }
  }

  // Contract
  rows.push({
    label: isFr ? "Durée du contrat" : "Contract term",
    value: contractMonths === 0
      ? (isFr ? "Aucun contrat (prépayé)" : "No contract (prepaid)")
      : `${contractMonths} ${isFr ? "mois" : "months"}`,
  });

  // Cancellation
  rows.push({
    label: isFr ? "Annulation" : "Cancellation",
    value: isFr
      ? "En tout temps — service actif jusqu'à la fin du cycle payé"
      : "Anytime — service active until end of paid cycle",
  });

  // Activation fee
  if (activationFee !== undefined) {
    rows.push({
      label: isFr ? "Frais d'activation" : "Activation fee",
      value: activationFee === 0 ? (isFr ? "Aucun" : "None") : fmt(activationFee),
    });
  }

  // Equipment
  if (equipmentFee !== undefined && equipmentFee > 0) {
    rows.push({
      label: isFr ? "Équipement" : "Equipment",
      value: fmt(equipmentFee),
    });
  }

  // 30-day notice for price changes
  rows.push({
    label: isFr ? "Avis de changement de prix" : "Price change notice",
    value: isFr ? "30 jours à l'avance (Code CRTC)" : "30 days in advance (CRTC Code)",
  });

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
      padding: "16px 18px",
      fontSize: "0.82rem",
    }}>
      <p style={{
        color: "#94a3b8",
        fontWeight: 700,
        fontSize: "0.72rem",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: "10px",
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {isFr ? "Résumé d'information essentielle (CRTC)" : "Critical Information Summary (CRTC)"}
        {" — "}{planName}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {rows.map((row) => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "5px" }}>
            <span style={{ color: "#64748b", flexShrink: 0 }}>{row.label}</span>
            <span style={{ color: row.highlight ? "#22d3ee" : "#e2e8f0", fontWeight: row.highlight ? 700 : 400, textAlign: "right" }}>{row.value}</span>
          </div>
        ))}
      </div>

      <p style={{ color: "#475569", fontSize: "0.72rem", marginTop: "10px", lineHeight: 1.6 }}>
        {isFr
          ? "Si un problème ne peut pas être résolu avec nous, contactez le "
          : "If an issue cannot be resolved with us, contact the "
        }
        <a href="https://www.ccts-cprst.ca" target="_blank" rel="noopener noreferrer" style={{ color: "#22d3ee" }}>
          {isFr ? "CPRST" : "CCTS"}
        </a>
        {isFr ? " (service gratuit pour les consommateurs)." : " (free service for consumers)."}
        {" · "}
        <Link to="/conformite-crtc" style={{ color: "#22d3ee" }}>
          {isFr ? "Conformité CRTC" : "CRTC Compliance"}
        </Link>
        {" · "}{COMPANY_CONTACT.supportEmail}
      </p>
    </div>
  );
}
