/**
 * EquipmentRequiredBox — Displays mandatory equipment info on plan cards
 * Equipment prices are fixed: Borne WiFi $60, Terminal $50, SIM $30
 */
import React from "react";

type EquipmentType = "internet" | "tv" | "combo" | "mobile";

interface EquipmentRequiredBoxProps {
  type: EquipmentType;
}

export const EquipmentRequiredBox: React.FC<EquipmentRequiredBoxProps> = ({ type }) => {
  return (
    <div
      className="mt-4 rounded-[10px]"
      style={{
        padding: '12px 14px',
        background: '#F7F5FF',
        border: '1px solid #E8E0FF',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#5B21B6',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Équipement requis
      </div>

      {/* Borne WiFi — Internet, TV, Combo */}
      {(type === "internet" || type === "tv" || type === "combo") && (
        <div style={{ fontSize: 13, color: '#444', display: 'flex', justifyContent: 'space-between' }}>
          <span>Borne Nivra WiFi (obligatoire)</span>
          <span style={{ fontWeight: 700, color: '#111' }}>60$</span>
        </div>
      )}

      {/* Terminal — TV, Combo */}
      {(type === "tv" || type === "combo") && (
        <div style={{ fontSize: 13, color: '#444', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span>Terminal Nivra (1 à 4)</span>
          <span style={{ fontWeight: 700, color: '#111' }}>50$/terminal</span>
        </div>
      )}

      {/* SIM — Mobile */}
      {type === "mobile" && (
        <div style={{ fontSize: 13, color: '#444', display: 'flex', justifyContent: 'space-between' }}>
          <span>Carte SIM Nivra (obligatoire)</span>
          <span style={{ fontWeight: 700, color: '#111' }}>30$/carte</span>
        </div>
      )}

      <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
        {type === "mobile"
          ? "Achat unique • Maximum 3 lignes par compte • Livrée à domicile"
          : "Achat unique — équipement livré à domicile"}
      </div>
    </div>
  );
};
