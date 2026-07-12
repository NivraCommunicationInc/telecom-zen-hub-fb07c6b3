/**
 * Step 1 — Customer Identification
 * Uses backend serviceability engine + duplicate detection + customer search.
 * NO direct DB queries.
 */
import { useEffect, useState } from "react";
import { User, MapPin, CheckCircle2, XCircle, Loader2, Search, UserPlus, ArrowRight, AlertTriangle, AlertCircle } from "lucide-react";
import { searchCustomers, checkServiceability, checkDuplicates, type ServiceabilityResult, type DuplicateCheckResult } from "@/field-app/lib/fieldServices";
import type { FieldSaleCustomer } from "@/field-app/lib/fieldSaleTypes";
import InstallSlotPicker from "@/components/shared/InstallSlotPicker";
import CoaxialSurvey, { initialCoaxialAnswers } from "@/components/shared/CoaxialSurvey";

interface Props {
  customer: FieldSaleCustomer;
  onChange: (c: FieldSaleCustomer) => void;
  onNext: () => void;
  onCancel: () => void;
  /**
   * When true (staff opened the tunnel from a known account + address),
   * hide the "choose/search" modes, land directly on the form, and lock
   * the identity + address fields. Serviceability check still runs.
   */
  locked?: boolean;
  /** Optional label shown when locked, e.g. "Compte #200756 — Adresse principale". */
  lockedContext?: string;
  /**
   * BUG-CORE-002A: gate the InstallSlotPicker + CoaxialSurvey on the presence
   * of ≥1 selected service that requires installation (Internet/TV). Mirrors
   * the exact rule already used by Core POS (UnifiedPOSPage `requiresInstall`).
   * Defaults to false so a fresh Step 1 never shows the calendar.
   */
  hasInstallableService?: boolean;
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

export default function StepCustomer({ customer, onChange, onNext, onCancel, locked = false, lockedContext }: Props) {
  const [mode, setMode] = useState<Mode>(locked || customer.first_name ? "form" : "choose");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchDone, setSearchDone] = useState(false);
  const [isExisting, setIsExisting] = useState(locked);
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
      onChange({ ...customer, serviceability_status: result.status === "available" || result.status === "limited" ? "available" : "unavailable" });
    } catch {
      onChange({ ...customer, serviceability_status: "unavailable" });
    }
  };

  const runDuplicateCheck = async () => {
    if (!customer.phone && !customer.email) return;
    try {
      const result = await checkDuplicates(customer.phone, customer.email, customer.address);
      setDuplicateResult(result);
    } catch { /* Non-blocking */ }
  };

  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async (queryOverride?: string) => {
    const q = (queryOverride ?? searchQuery).trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchDone(false);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchDone(false);
    setSearchError(null);
    try {
      const data = await searchCustomers(q);
      setSearchResults(data?.results || []);
      setSearchDone(true);
    } catch (err: any) {
      console.error("[StepCustomer] Search error:", err);
      setSearchResults([]);
      setSearchDone(true);
      setSearchError(err?.message || "Erreur de recherche");
    } finally {
      setSearching(false);
    }
  };

  // Auto-search with debounce when in search mode
  useEffect(() => {
    if (mode !== "search") return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchDone(false);
      return;
    }
    const t = setTimeout(() => handleSearch(q), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, mode]);

  const selectExisting = (result: SearchResult) => {
    const nameParts = (result.full_name || "").split(" ");
    onChange({
      ...customer,
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
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

  const missing: string[] = [];
  if (!customer.first_name.trim()) missing.push("Prénom");
  if (!customer.last_name.trim()) missing.push("Nom");
  if (!isValidPhone) missing.push("Téléphone valide (10 chiffres)");
  if (!isValidEmail) missing.push("Courriel valide");
  if (!isValidDOB) missing.push("Date de naissance");
  if (!customer.address.trim()) missing.push("Adresse");
  if (!customer.city.trim()) missing.push("Ville");
  if (!customer.postal_code.trim()) missing.push("Code postal");
  if (customer.serviceability_status !== "available") missing.push("Vérification de disponibilité du service");

  const canContinue = missing.length === 0;

  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-border bg-gray-800 text-sm text-gray-50 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";
  const labelClass = "text-xs font-medium text-gray-50 mb-1 block";

  // ── Mode: Choose ──
  if (mode === "choose") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-50">Identification du client</h2>
          <p className="text-sm text-gray-400 mt-0.5">Client existant ou nouveau client ?</p>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <button type="button" onClick={() => setMode("search")}
            className="flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-gray-800 hover:border-primary hover:bg-primary/5 transition-all text-left">
            <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0"><Search className="h-6 w-6 text-blue-600" /></div>
            <div>
              <p className="text-sm font-semibold text-gray-50">Chercher un client existant</p>
              <p className="text-xs text-gray-400 mt-0.5">Recherche par nom, courriel, téléphone ou numéro de compte</p>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 shrink-0 ml-auto" />
          </button>
          <button type="button" onClick={() => { setMode("form"); setIsExisting(false); }}
            className="flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-gray-800 hover:border-primary hover:bg-primary/5 transition-all text-left">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0"><UserPlus className="h-6 w-6 text-emerald-600" /></div>
            <div>
              <p className="text-sm font-semibold text-gray-50">Nouveau client</p>
              <p className="text-xs text-gray-400 mt-0.5">Saisir les informations manuellement</p>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 shrink-0 ml-auto" />
          </button>
        </div>
        <button type="button" onClick={onCancel} className="w-full py-2.5 rounded-lg border border-border text-sm font-medium text-gray-50 hover:bg-secondary transition-colors">Annuler</button>
      </div>
    );
  }

  // ── Mode: Search ──
  if (mode === "search") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-50">Rechercher un client</h2>
          <p className="text-sm text-gray-400 mt-0.5">Par nom, courriel, téléphone ou numéro de compte.</p>
        </div>
        <div className="flex gap-2">
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()} className={inputClass}
            placeholder="Nom, courriel, téléphone, # compte…" autoFocus />
          <button type="button" onClick={() => handleSearch()} disabled={searching || searchQuery.trim().length < 2}
            className="px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-colors shrink-0">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </div>
        {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
          <p className="text-xs text-gray-400">Tapez au moins 2 caractères…</p>
        )}
        {searchError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div><p className="font-medium">Erreur de recherche</p><p className="text-xs mt-0.5">{searchError}</p></div>
          </div>
        )}
        {searchDone && !searchError && searchResults.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">Aucun client trouvé pour « {searchQuery.trim()} »</p>
            <button type="button" onClick={() => { setMode("form"); setIsExisting(false); }} className="mt-3 text-sm font-medium text-primary hover:opacity-80">+ Créer un nouveau client</button>
          </div>
        )}
        {searchResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-400">{searchResults.length} résultat{searchResults.length > 1 ? "s" : ""}</p>
            {searchResults.map((r) => (
              <button key={`${r.source}-${r.id}`} type="button" onClick={() => selectExisting(r)}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-border bg-gray-800 hover:border-primary hover:bg-primary/5 transition-all text-left">
                <div>
                  <p className="text-sm font-semibold text-gray-50">{r.full_name || "—"}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {r.email && <span className="text-xs text-gray-400">{r.email}</span>}
                    {r.phone && <span className="text-xs text-gray-400">{r.phone}</span>}
                  </div>
                </div>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-gray-400">
                  {r.source === "profile" ? "Profil" : r.source === "billing" ? "Facturation" : "Compte"}
                </span>
              </button>
            ))}
            <button type="button" onClick={() => { setMode("form"); setIsExisting(false); }}
              className="w-full text-center text-sm font-medium text-primary hover:opacity-80 py-2">+ Créer un nouveau client</button>
          </div>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={() => setMode("choose")} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-gray-50 hover:bg-secondary transition-colors">← Retour</button>
        </div>
      </div>
    );
  }

  // ── Mode: Form ──
  const lockedInputClass = `${inputClass} opacity-70 cursor-not-allowed`;
  const lockedCls = (base: string) => (locked ? `${base} opacity-70 cursor-not-allowed` : base);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-50">
          {locked ? "Commande pour un client existant" : (isExisting ? "Client existant — Vérifiez et modifiez" : "Nouveau client")}
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">
          {locked
            ? "Identité et adresse verrouillées — la commande sera rattachée au compte existant."
            : (isExisting ? "Informations pré-remplies. Modifiez au besoin." : "Renseignez les informations du client.")}
        </p>
      </div>

      {locked && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-500/10 border border-violet-500/30 text-sm text-violet-200">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Client existant sélectionné</p>
            {lockedContext && <p className="text-xs mt-0.5 opacity-90">{lockedContext}</p>}
            <p className="text-xs mt-0.5 opacity-75">Aucun nouveau compte ne sera créé.</p>
          </div>
        </div>
      )}

      <div className="bg-gray-800 border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1"><User className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-gray-50">Contact</h3></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelClass}>Prénom *</label><input value={customer.first_name} onChange={(e) => update("first_name", e.target.value)} readOnly={locked} className={lockedCls(inputClass)} required /></div>
          <div><label className={labelClass}>Nom *</label><input value={customer.last_name} onChange={(e) => update("last_name", e.target.value)} readOnly={locked} className={lockedCls(inputClass)} required /></div>
        </div>
        <div>
          <label className={labelClass}>Téléphone *</label>
          <input type="tel" value={customer.phone} onChange={(e) => update("phone", e.target.value)} readOnly={locked} className={lockedCls(inputClass)} placeholder="514-555-0123" />
          {customer.phone && !isValidPhone && <p className="text-[10px] text-destructive mt-0.5">Minimum 10 chiffres</p>}
        </div>
        <div>
          <label className={labelClass}>Courriel *</label>
          <input type="email" value={customer.email} onChange={(e) => update("email", e.target.value)} readOnly={locked} className={lockedCls(inputClass)} placeholder="client@example.com" />
          {customer.email && !isValidEmail && <p className="text-[10px] text-destructive mt-0.5">Courriel invalide</p>}
        </div>
        <div>
          <label className={labelClass}>Date de naissance *</label>
          <input type="date" value={customer.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} readOnly={locked} className={lockedCls(inputClass)} max={new Date().toISOString().split("T")[0]} />
          {customer.date_of_birth && !isValidDOB && <p className="text-[10px] text-destructive mt-0.5">Date invalide</p>}
        </div>
      </div>

      <div className="bg-gray-800 border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1"><MapPin className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-gray-50">Adresse de service</h3></div>
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <div><label className={labelClass}>Adresse *</label><input value={customer.address} onChange={(e) => update("address", e.target.value)} readOnly={locked} className={lockedCls(inputClass)} placeholder="123 rue Principale" /></div>
          <div><label className={labelClass}>App. <span className="text-gray-400 font-normal">(optionnel)</span></label><input value={customer.apartment || ""} onChange={(e) => update("apartment" as any, e.target.value)} readOnly={locked} className={lockedCls(inputClass)} placeholder="Ex. 3B" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelClass}>Ville *</label><input value={customer.city} onChange={(e) => update("city", e.target.value)} readOnly={locked} className={lockedCls(inputClass)} /></div>
          <div><label className={labelClass}>Code postal *</label><input value={customer.postal_code} onChange={(e) => update("postal_code", e.target.value)} readOnly={locked} className={lockedCls(inputClass)} placeholder="H1A 1A1" /></div>
        </div>
        <div>
          <label className={labelClass}>Province</label>
          <select value={customer.province} onChange={(e) => update("province", e.target.value)} disabled={locked} className={lockedCls(inputClass)}>
            <option value="QC">Québec</option><option value="ON">Ontario</option>
          </select>
        </div>


        {customer.serviceability_status === "unknown" && customer.postal_code.trim() && (
          <button type="button" onClick={runServiceabilityCheck}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-colors">
            Vérifier la disponibilité du service
          </button>
        )}
        {customer.serviceability_status === "checking" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />Vérification en cours…</div>
        )}
        {customer.serviceability_status === "available" && coverageDetail && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              {coverageDetail.status === "limited" ? "Service partiellement disponible" : "Service disponible à cette adresse"}
            </div>
            {coverageDetail.status === "limited" && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4" /> Certains produits peuvent ne pas être éligibles.
              </div>
            )}
            {coverageDetail.has_active_subscription && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
                <AlertCircle className="h-4 w-4" /> Un abonnement actif existe déjà à cette adresse.
              </div>
            )}
          </div>
        )}
        {customer.serviceability_status === "unavailable" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
            <XCircle className="h-4 w-4" /> Service non disponible à cette adresse
          </div>
        )}
      </div>

      {/* Duplicate check */}
      {customer.serviceability_status === "available" && !duplicateResult && (customer.phone || customer.email) && (
        <button type="button" onClick={runDuplicateCheck}
          className="w-full py-2 rounded-lg border border-border text-sm font-medium text-gray-50 hover:bg-secondary transition-colors">
          Vérifier les doublons
        </button>
      )}
      {duplicateResult?.has_duplicates && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Doublons potentiels détectés</p>
            {duplicateResult.matches.map((m) => (
              <p key={m.id} className="text-xs mt-0.5">{m.name} ({m.type}) — score: {m.score}%</p>
            ))}
          </div>
        </div>
      )}

      {/* ── Installation slot + coaxial survey (shared components) ── */}
      {customer.serviceability_status === "available" && (
        <div className="bg-gray-800 border border-border rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-50">Créneau d'installation (optionnel)</h3>
            <p className="text-xs text-gray-400 mt-0.5">Réserve un passage technicien si nécessaire.</p>
          </div>
          <InstallSlotPicker
            variant="compact"
            value={customer.install_slot ?? null}
            onChange={(slot) => onChange({
              ...customer,
              install_slot: slot,
              install_date: slot?.date ?? null,
              install_mode: slot ? "technician" : customer.install_mode,
            })}
          />
          <div className="pt-3 border-t border-white/10">
            <h3 className="text-sm font-semibold text-gray-50 mb-2">Câblage coaxial</h3>
            <CoaxialSurvey
              variant="compact"
              value={customer.coaxial_survey ?? initialCoaxialAnswers()}
              onChange={(answers) => onChange({ ...customer, coaxial_survey: answers })}
            />
          </div>
        </div>
      )}

      {customer.notes !== undefined && (
        <div className="bg-gray-800 border border-border rounded-xl p-5 space-y-2">
          <label className={labelClass}>Notes internes</label>
          <textarea value={customer.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className={inputClass} placeholder="Notes pour le dossier…" />
        </div>
      )}

      {!canContinue && missing.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Pour continuer, complétez :</p>
            <ul className="text-xs mt-1 list-disc list-inside space-y-0.5">
              {missing.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {!locked && (
          <button type="button" onClick={() => setMode("choose")} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-gray-50 hover:bg-secondary transition-colors">← Retour</button>
        )}
        <button type="button" onClick={() => { runDuplicateCheck(); onNext(); }} disabled={!canContinue}
          className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
          Continuer <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
