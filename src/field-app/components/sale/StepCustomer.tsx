/**
 * Step 1 — Customer Identification
 * Uses backend serviceability engine + duplicate detection + customer search.
 * NO direct DB queries.
 */
import { useState } from "react";
import { User, MapPin, CheckCircle2, XCircle, Loader2, Search, UserPlus, ArrowRight, AlertTriangle, AlertCircle } from "lucide-react";
import { searchCustomers, checkServiceability, checkDuplicates, type ServiceabilityResult, type DuplicateCheckResult } from "@/field-app/lib/fieldServices";
import type { FieldSaleCustomer } from "@/field-app/lib/fieldSaleTypes";

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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchDone(false);
    try {
      const data = await searchCustomers(searchQuery.trim());
      setSearchResults(data?.results || []);
      setSearchDone(true);
    } catch (err) {
      console.error("[StepCustomer] Search error:", err);
      setSearchResults([]);
      setSearchDone(true);
    } finally {
      setSearching(false);
    }
  };

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

  const canContinue =
    customer.first_name.trim() && customer.last_name.trim() && isValidPhone && isValidEmail &&
    isValidDOB && customer.address.trim() && customer.city.trim() && customer.postal_code.trim() &&
    customer.serviceability_status === "available";

  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";
  const labelClass = "text-xs font-medium text-foreground mb-1 block";

  // ── Mode: Choose ──
  if (mode === "choose") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-foreground">Identification du client</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Client existant ou nouveau client ?</p>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <button type="button" onClick={() => setMode("search")}
            className="flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left">
            <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0"><Search className="h-6 w-6 text-blue-600" /></div>
            <div>
              <p className="text-sm font-semibold text-foreground">Chercher un client existant</p>
              <p className="text-xs text-muted-foreground mt-0.5">Recherche par nom, courriel, téléphone ou numéro de compte</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 ml-auto" />
          </button>
          <button type="button" onClick={() => { setMode("form"); setIsExisting(false); }}
            className="flex items-center gap-4 p-5 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0"><UserPlus className="h-6 w-6 text-emerald-600" /></div>
            <div>
              <p className="text-sm font-semibold text-foreground">Nouveau client</p>
              <p className="text-xs text-muted-foreground mt-0.5">Saisir les informations manuellement</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 ml-auto" />
          </button>
        </div>
        <button type="button" onClick={onCancel} className="w-full py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors">Annuler</button>
      </div>
    );
  }

  // ── Mode: Search ──
  if (mode === "search") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-foreground">Rechercher un client</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Par nom, courriel, téléphone ou numéro de compte.</p>
        </div>
        <div className="flex gap-2">
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()} className={inputClass}
            placeholder="Nom, courriel, téléphone…" autoFocus />
          <button type="button" onClick={handleSearch} disabled={searching || !searchQuery.trim()}
            className="px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-colors shrink-0">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </div>
        {searchDone && searchResults.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Aucun client trouvé</p>
            <button type="button" onClick={() => { setMode("form"); setIsExisting(false); }} className="mt-3 text-sm font-medium text-primary hover:opacity-80">+ Créer un nouveau client</button>
          </div>
        )}
        {searchResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{searchResults.length} résultat{searchResults.length > 1 ? "s" : ""}</p>
            {searchResults.map((r) => (
              <button key={`${r.source}-${r.id}`} type="button" onClick={() => selectExisting(r)}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left">
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.full_name || "—"}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {r.email && <span className="text-xs text-muted-foreground">{r.email}</span>}
                    {r.phone && <span className="text-xs text-muted-foreground">{r.phone}</span>}
                  </div>
                </div>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                  {r.source === "profile" ? "Profil" : r.source === "billing" ? "Facturation" : "Compte"}
                </span>
              </button>
            ))}
            <button type="button" onClick={() => { setMode("form"); setIsExisting(false); }}
              className="w-full text-center text-sm font-medium text-primary hover:opacity-80 py-2">+ Créer un nouveau client</button>
          </div>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={() => setMode("choose")} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors">← Retour</button>
        </div>
      </div>
    );
  }

  // ── Mode: Form ──
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">{isExisting ? "Client existant — Vérifiez et modifiez" : "Nouveau client"}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isExisting ? "Informations pré-remplies. Modifiez au besoin." : "Renseignez les informations du client."}
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1"><User className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">Contact</h3></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelClass}>Prénom *</label><input value={customer.first_name} onChange={(e) => update("first_name", e.target.value)} className={inputClass} required /></div>
          <div><label className={labelClass}>Nom *</label><input value={customer.last_name} onChange={(e) => update("last_name", e.target.value)} className={inputClass} required /></div>
        </div>
        <div>
          <label className={labelClass}>Téléphone *</label>
          <input type="tel" value={customer.phone} onChange={(e) => update("phone", e.target.value)} className={inputClass} placeholder="514-555-0123" />
          {customer.phone && !isValidPhone && <p className="text-[10px] text-destructive mt-0.5">Minimum 10 chiffres</p>}
        </div>
        <div>
          <label className={labelClass}>Courriel *</label>
          <input type="email" value={customer.email} onChange={(e) => update("email", e.target.value)} className={inputClass} placeholder="client@example.com" />
          {customer.email && !isValidEmail && <p className="text-[10px] text-destructive mt-0.5">Courriel invalide</p>}
        </div>
        <div>
          <label className={labelClass}>Date de naissance *</label>
          <input type="date" value={customer.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} className={inputClass} max={new Date().toISOString().split("T")[0]} />
          {customer.date_of_birth && !isValidDOB && <p className="text-[10px] text-destructive mt-0.5">Date invalide</p>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1"><MapPin className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">Adresse de service</h3></div>
        <div><label className={labelClass}>Adresse *</label><input value={customer.address} onChange={(e) => update("address", e.target.value)} className={inputClass} placeholder="123 rue Principale" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelClass}>Ville *</label><input value={customer.city} onChange={(e) => update("city", e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Code postal *</label><input value={customer.postal_code} onChange={(e) => update("postal_code", e.target.value)} className={inputClass} placeholder="H1A 1A1" /></div>
        </div>
        <div>
          <label className={labelClass}>Province</label>
          <select value={customer.province} onChange={(e) => update("province", e.target.value)} className={inputClass}>
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
          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Vérification en cours…</div>
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
          className="w-full py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors">
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

      {customer.notes !== undefined && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-2">
          <label className={labelClass}>Notes internes</label>
          <textarea value={customer.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className={inputClass} placeholder="Notes pour le dossier…" />
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={() => setMode("choose")} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors">← Retour</button>
        <button type="button" onClick={() => { runDuplicateCheck(); onNext(); }} disabled={!canContinue}
          className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
          Continuer <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
