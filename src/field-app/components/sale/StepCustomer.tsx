/**
 * Step 1 — Customer Identification
 * Supports: Search existing customer OR create new.
 * Uses backend serviceability engine + duplicate detection.
 */
import { useState } from "react";
import { User, MapPin, CheckCircle2, XCircle, Loader2, Search, UserPlus, ArrowRight, AlertTriangle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { FieldSaleCustomer } from "@/field-app/lib/fieldSaleTypes";
import { checkServiceability, checkDuplicates, type ServiceabilityResult, type DuplicateCheckResult } from "@/field-app/lib/fieldServices";

interface Props {
  customer: FieldSaleCustomer;
  onChange: (c: FieldSaleCustomer) => void;
  onNext: () => void;
  onCancel: () => void;
}

interface SearchResult {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address?: string;
  city?: string;
  postal_code?: string;
  source: string;
}

type Mode = "choose" | "search" | "new" | "form";

export default function StepCustomer({ customer, onChange, onNext, onCancel }: Props) {
  const [mode, setMode] = useState<Mode>(customer.first_name ? "form" : "choose");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchDone, setSearchDone] = useState(false);
  const [isExisting, setIsExisting] = useState(false);
  const [coverageDetail, setCoverageDetail] = useState<ServiceabilityResult | null>(null);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);

  const update = (field: keyof FieldSaleCustomer, value: string) =>
    onChange({ ...customer, [field]: value });

  const runServiceabilityCheck = async () => {
    onChange({ ...customer, serviceability_status: "checking" });
    setCoverageDetail(null);
    try {
      const result = await checkServiceability(customer.postal_code, customer.address, customer.city);
      setCoverageDetail(result);
      if (result.status === "available" || result.status === "limited") {
        onChange({ ...customer, serviceability_status: "available" });
      } else {
        onChange({ ...customer, serviceability_status: "unavailable" });
      }
    } catch {
      onChange({ ...customer, serviceability_status: "unavailable" });
    }
  };

  const runDuplicateCheck = async () => {
    if (!customer.phone && !customer.email) return;
    try {
      const result = await checkDuplicates(customer.phone, customer.email, customer.address);
      setDuplicateResult(result);
    } catch {
      // Non-blocking
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchDone(false);
    try {
      const q = searchQuery.trim().toLowerCase();
      const results: SearchResult[] = [];

      // Search profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .or(`email.ilike.%${q}%,full_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(10);

      if (profiles) {
        for (const p of profiles) {
          results.push({
            id: p.user_id,
            full_name: p.full_name,
            email: p.email,
            phone: p.phone,
            source: "profile",
          });
        }
      }

      // Search billing_customers
      const { data: billingCustomers } = await supabase
        .from("billing_customers")
        .select("id, first_name, last_name, email, phone")
        .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(10);

      if (billingCustomers) {
        for (const bc of billingCustomers) {
          if (!results.some((r) => r.email?.toLowerCase() === bc.email?.toLowerCase())) {
            results.push({
              id: bc.id,
              full_name: `${bc.first_name} ${bc.last_name}`.trim(),
              email: bc.email,
              phone: bc.phone,
              source: "billing",
            });
          }
        }
      }

      // Search accounts
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, account_number, account_name, primary_service_address, primary_service_city, primary_service_postal_code")
        .or(`account_number.ilike.%${q}%,account_name.ilike.%${q}%`)
        .limit(5);

      if (accounts) {
        for (const a of accounts) {
          if (!results.some((r) => r.id === a.id)) {
            results.push({
              id: a.id,
              full_name: a.account_name || `Compte ${a.account_number}`,
              email: null,
              phone: null,
              address: a.primary_service_address || undefined,
              city: a.primary_service_city || undefined,
              postal_code: a.primary_service_postal_code || undefined,
              source: "account",
            });
          }
        }
      }

      setSearchResults(results);
      setSearchDone(true);
    } catch (err) {
      console.error("[StepCustomer] Search error:", err);
    } finally {
      setSearching(false);
    }
  };

  const selectExisting = (result: SearchResult) => {
    const nameParts = (result.full_name || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    onChange({
      ...customer,
      first_name: firstName,
      last_name: lastName,
      email: result.email || "",
      phone: result.phone || "",
      address: result.address || customer.address,
      city: result.city || customer.city,
      postal_code: result.postal_code || customer.postal_code,
      serviceability_status: "unknown",
    });
    setIsExisting(true);
    setMode("form");
  };

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim());
  const isValidPhone = customer.phone.replace(/\D/g, "").length >= 10;
  const isValidDOB = /^\d{4}-\d{2}-\d{2}$/.test(customer.date_of_birth) && new Date(customer.date_of_birth) < new Date();

  const canContinue =
    customer.first_name.trim() &&
    customer.last_name.trim() &&
    isValidPhone &&
    isValidEmail &&
    isValidDOB &&
    customer.address.trim() &&
    customer.city.trim() &&
    customer.postal_code.trim() &&
    customer.serviceability_status === "available";

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#000000] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E]";
  const labelClass = "text-xs font-medium text-[#374151] mb-1 block";

  // ── Mode: Choose ──
  if (mode === "choose") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#000000]">Identification du client</h2>
          <p className="text-sm text-[#6B7280] mt-0.5">Client existant ou nouveau client ?</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => setMode("search")}
            className="flex items-center gap-4 p-5 rounded-xl border-2 border-[#E5E7EB] bg-white hover:border-[#22C55E] hover:bg-[#F0FDF4] transition-all text-left"
          >
            <div className="h-12 w-12 rounded-xl bg-[#DBEAFE] flex items-center justify-center shrink-0">
              <Search className="h-6 w-6 text-[#3B82F6]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#000000]">Chercher un client existant</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Recherche par nom, courriel, téléphone ou numéro de compte</p>
            </div>
            <ArrowRight className="h-5 w-5 text-[#D1D5DB] shrink-0 ml-auto" />
          </button>

          <button
            type="button"
            onClick={() => { setMode("form"); setIsExisting(false); }}
            className="flex items-center gap-4 p-5 rounded-xl border-2 border-[#E5E7EB] bg-white hover:border-[#22C55E] hover:bg-[#F0FDF4] transition-all text-left"
          >
            <div className="h-12 w-12 rounded-xl bg-[#DCFCE7] flex items-center justify-center shrink-0">
              <UserPlus className="h-6 w-6 text-[#16A34A]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#000000]">Nouveau client</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Saisir les informations manuellement</p>
            </div>
            <ArrowRight className="h-5 w-5 text-[#D1D5DB] shrink-0 ml-auto" />
          </button>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="w-full py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
        >
          Annuler
        </button>
      </div>
    );
  }

  // ── Mode: Search ──
  if (mode === "search") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#000000]">Rechercher un client</h2>
          <p className="text-sm text-[#6B7280] mt-0.5">Recherchez par nom, courriel, téléphone ou numéro de compte.</p>
        </div>

        <div className="flex gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className={inputClass}
            placeholder="Nom, courriel, téléphone, numéro de compte…"
            autoFocus
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="px-4 rounded-lg bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#2563EB] disabled:opacity-40 transition-colors shrink-0"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </div>

        {searchDone && searchResults.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-[#6B7280]">Aucun client trouvé</p>
            <button
              type="button"
              onClick={() => { setMode("form"); setIsExisting(false); }}
              className="mt-3 text-sm font-medium text-[#22C55E] hover:text-[#16A34A]"
            >
              + Créer un nouveau client
            </button>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#6B7280]">{searchResults.length} résultat{searchResults.length > 1 ? "s" : ""}</p>
            {searchResults.map((r) => (
              <button
                key={`${r.source}-${r.id}`}
                type="button"
                onClick={() => selectExisting(r)}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#22C55E] hover:bg-[#F0FDF4] transition-all text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-[#000000]">{r.full_name || "—"}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {r.email && <span className="text-xs text-[#6B7280]">{r.email}</span>}
                    {r.phone && <span className="text-xs text-[#6B7280]">{r.phone}</span>}
                  </div>
                </div>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#6B7280]">
                  {r.source === "profile" ? "Profil" : r.source === "billing" ? "Facturation" : "Compte"}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setMode("form"); setIsExisting(false); }}
              className="w-full text-center text-sm font-medium text-[#22C55E] hover:text-[#16A34A] py-2"
            >
              + Créer un nouveau client
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => setMode("choose")} className="flex-1 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors">
            ← Retour
          </button>
        </div>
      </div>
    );
  }

  // ── Mode: Form (new or existing with editable fields) ──
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#000000]">
          {isExisting ? "Client existant — Vérifiez et modifiez" : "Nouveau client"}
        </h2>
        <p className="text-sm text-[#6B7280] mt-0.5">
          {isExisting
            ? "Les informations sont pré-remplies. Vous pouvez les modifier au besoin."
            : "Renseignez les informations du client pour commencer la vente."}
        </p>
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
          {customer.phone && !isValidPhone && <p className="text-[10px] text-red-500 mt-0.5">Minimum 10 chiffres</p>}
        </div>
        <div>
          <label className={labelClass}>Courriel *</label>
          <input type="email" value={customer.email} onChange={(e) => update("email", e.target.value)} className={inputClass} placeholder="client@example.com" />
          {customer.email && !isValidEmail && <p className="text-[10px] text-red-500 mt-0.5">Courriel invalide</p>}
        </div>
        <div>
          <label className={labelClass}>Date de naissance *</label>
          <input type="date" value={customer.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} className={inputClass} max={new Date().toISOString().split("T")[0]} />
          {customer.date_of_birth && !isValidDOB && <p className="text-[10px] text-red-500 mt-0.5">Date invalide</p>}
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
            onClick={() => runServiceabilityCheck()}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-colors"
          >
            Vérifier la disponibilité du service
          </button>
        )}
        {customer.serviceability_status === "checking" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Vérification en cours…
          </div>
        )}
        {customer.serviceability_status === "available" && coverageDetail && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-medium dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              {coverageDetail.status === "limited" ? "Service partiellement disponible" : "Service disponible à cette adresse"}
            </div>
            {coverageDetail.status === "limited" && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Couverture limitée</p>
                  {coverageDetail.notes && <p className="mt-0.5">{coverageDetail.notes}</p>}
                  {coverageDetail.serviceable_products && coverageDetail.serviceable_products.length > 0 && (
                    <p className="mt-0.5">Services disponibles : {coverageDetail.serviceable_products.join(", ")}</p>
                  )}
                </div>
              </div>
            )}
            {duplicateResult?.has_duplicates && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Doublons potentiels détectés</p>
                  {duplicateResult.matches.map(m => (
                    <p key={m.id} className="mt-0.5">{m.name} ({m.type}) — score {Math.round(m.score * 100)}%</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {customer.serviceability_status === "unavailable" && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#DC2626] font-medium">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p>Service non disponible à cette adresse</p>
              <p className="text-xs font-normal mt-1">Ce code postal n'est pas dans notre zone de couverture. Vous pouvez sauvegarder le contact comme lead pour suivi.</p>
            </div>
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
          onClick={() => {
            if (mode === "form" && (isExisting || searchResults.length > 0)) {
              setMode("choose");
            } else {
              onCancel();
            }
          }}
          className="flex-1 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
        >
          {isExisting ? "← Retour" : "Annuler"}
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
