/**
 * Step 1 — Customer Identification
 */
import { useState } from "react";
import { User, MapPin, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { FieldSaleCustomer } from "@/field-app/lib/fieldSaleTypes";

interface Props {
  customer: FieldSaleCustomer;
  onChange: (c: FieldSaleCustomer) => void;
  onNext: () => void;
  onCancel: () => void;
}

export default function StepCustomer({ customer, onChange, onNext, onCancel }: Props) {
  const update = (field: keyof FieldSaleCustomer, value: string) =>
    onChange({ ...customer, [field]: value });

  const checkServiceability = () => {
    onChange({ ...customer, serviceability_status: "checking" });
    // Simulated check — in production this would hit an API
    setTimeout(() => {
      const available = customer.postal_code.trim().length >= 3;
      onChange({ ...customer, serviceability_status: available ? "available" : "unavailable" });
    }, 1200);
  };

  const canContinue =
    customer.first_name.trim() &&
    customer.last_name.trim() &&
    customer.phone.trim() &&
    customer.address.trim() &&
    customer.city.trim() &&
    customer.postal_code.trim() &&
    customer.serviceability_status === "available";

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#000000] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E]";
  const labelClass = "text-xs font-medium text-[#374151] mb-1 block";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#000000]">Identification du client</h2>
        <p className="text-sm text-[#6B7280] mt-0.5">Renseignez les informations du client pour commencer la vente.</p>
      </div>

      {/* Contact info */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User className="h-4 w-4 text-[#22C55E]" />
          <h3 className="text-sm font-semibold text-[#000000]">Contact</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Prénom *</label>
            <input value={customer.first_name} onChange={(e) => update("first_name", e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Nom *</label>
            <input value={customer.last_name} onChange={(e) => update("last_name", e.target.value)} className={inputClass} required />
          </div>
        </div>
        <div>
          <label className={labelClass}>Téléphone *</label>
          <input type="tel" value={customer.phone} onChange={(e) => update("phone", e.target.value)} className={inputClass} placeholder="514-555-0123" />
        </div>
        <div>
          <label className={labelClass}>Courriel</label>
          <input type="email" value={customer.email} onChange={(e) => update("email", e.target.value)} className={inputClass} placeholder="client@example.com" />
        </div>
      </div>

      {/* Address */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-4 w-4 text-[#22C55E]" />
          <h3 className="text-sm font-semibold text-[#000000]">Adresse de service</h3>
        </div>
        <div>
          <label className={labelClass}>Adresse *</label>
          <input value={customer.address} onChange={(e) => update("address", e.target.value)} className={inputClass} placeholder="123 rue Principale" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Ville *</label>
            <input value={customer.city} onChange={(e) => update("city", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Code postal *</label>
            <input value={customer.postal_code} onChange={(e) => update("postal_code", e.target.value)} className={inputClass} placeholder="H1A 1A1" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Province</label>
          <select value={customer.province} onChange={(e) => update("province", e.target.value)} className={inputClass}>
            <option value="QC">Québec</option>
            <option value="ON">Ontario</option>
          </select>
        </div>

        {/* Serviceability check */}
        {customer.serviceability_status === "unknown" && customer.postal_code.trim() && (
          <button
            type="button"
            onClick={checkServiceability}
            className="w-full py-2.5 rounded-lg bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#2563EB] transition-colors"
          >
            Vérifier la disponibilité du service
          </button>
        )}
        {customer.serviceability_status === "checking" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[#F3F4F6] text-sm text-[#6B7280]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Vérification en cours…
          </div>
        )}
        {customer.serviceability_status === "available" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-sm text-[#16A34A] font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Service disponible à cette adresse
          </div>
        )}
        {customer.serviceability_status === "unavailable" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#DC2626] font-medium">
            <XCircle className="h-4 w-4" />
            Service non disponible — Vente impossible
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
        <label className={labelClass}>Notes agent</label>
        <textarea
          value={customer.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={2}
          className={inputClass}
          placeholder="Notes internes sur ce client…"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="flex-1 py-2.5 rounded-lg bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Continuer →
        </button>
      </div>
    </div>
  );
}
