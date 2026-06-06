/**
 * VerifierNumero — /verifier-mon-numero
 * Public page: check if a Canadian phone number is eligible for port-in.
 * Uses the lookup-phone-carrier Edge Function (Numverify or format-only fallback).
 */
import { useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PhotoBg } from "@/components/PhotoBg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone, Search, CheckCircle2, XCircle, Loader2,
  Building2, ArrowRight, AlertCircle, Phone, Wifi,
} from "lucide-react";
import { backendClient } from "@/integrations/backend/client";

interface LookupResult {
  valid: boolean;
  carrier: string | null;
  carrier_normalized: string | null;
  line_type: string | null;
  location: string | null;
  portable: boolean;
  area_code_supported: boolean;
  formatted: string;
  e164: string;
  source: "numverify" | "format_only";
  error?: string;
}

function lineTypeLabel(t: string | null) {
  switch (t) {
    case "mobile":      return "Mobile";
    case "fixed_line":  return "Résidentiel";
    case "voip":        return "VoIP";
    case "toll_free":   return "Numéro sans frais";
    case "premium_rate": return "Numéro surtaxé";
    default:            return "Inconnu";
  }
}

function stripDigits(v: string) {
  return v.replace(/\D/g, "");
}

export default function VerifierNumero() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const digits = stripDigits(input);
  const canSearch = digits.length >= 10;

  const handleSearch = async () => {
    if (!canSearch) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const { data, error: fnErr } = await backendClient.functions.invoke("lookup-phone-carrier", {
        body: { phone_number: digits },
      });
      if (fnErr) throw fnErr;
      if (!data?.valid && data?.error) throw new Error(data.error);
      setResult(data as LookupResult);
    } catch (err: any) {
      setError(err?.message ?? "Erreur lors de la vérification. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleCheckout = () => {
    const params = new URLSearchParams({ port_in: "1" });
    if (result?.formatted) params.set("number", digits);
    if (result?.carrier_normalized) params.set("carrier", result.carrier_normalized);
    navigate(`/commande?${params.toString()}`);
  };

  return (
    <div
      style={{ background: "#020209" }}
      className="relative min-h-screen text-foreground overflow-hidden"
    >
      <PhotoBg
        url="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1920&q=80"
        opacity={0.08}
        filter="saturate(0.4) brightness(0.5)"
      />
      {/* aurora blobs */}
      <div
        aria-hidden
        style={{
          position: "absolute", top: "-15%", right: "-8%", width: 400, height: 400,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(124,58,237,0.14) 0%, transparent 65%)",
          animation: "n-aurora-1 14s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute", bottom: "-10%", left: "-5%", width: 320, height: 320,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(6,182,212,0.08) 0%, transparent 65%)",
          animation: "n-aurora-2 18s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      <Helmet>
        <title>Vérifier mon numéro — Transfert Nivra Telecom</title>
        <meta
          name="description"
          content="Vérifiez si votre numéro de téléphone canadien est admissible au transfert (portabilité) vers Nivra Telecom. Résultat instantané."
        />
      </Helmet>

      <Header />

      <div className="max-w-2xl mx-auto px-4 pt-16 pb-20 relative z-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)" }}>
            <Smartphone size={30} className="text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Transférez votre numéro
          </h1>
          <p className="text-base text-white/60 max-w-lg mx-auto">
            Gardez votre numéro actuel en passant à Nivra Telecom.
            Vérifiez ici si votre numéro est admissible — résultat instantané.
          </p>
        </div>

        {/* Search box */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(124,58,237,0.25)",
            backdropFilter: "blur(20px)",
          }}
        >
          <label className="block text-sm font-medium text-white/70 mb-2">
            Votre numéro de téléphone canadien
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (result) setResult(null);
                  if (error) setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ex: 514 555-1234"
                className="pl-10 h-12 text-base bg-white/5 border-white/20 text-white placeholder:text-white/30 focus:border-violet-500"
                inputMode="numeric"
                maxLength={16}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!canSearch || loading}
              className="h-12 px-6 font-semibold"
              style={{
                background: canSearch && !loading
                  ? "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)"
                  : undefined,
              }}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <><Search className="w-4 h-4 mr-2" />Vérifier</>
              )}
            </Button>
          </div>
          <p className="text-xs text-white/35 mt-2">
            Numéros canadiens seulement — mobile, résidentiel et VoIP admissibles
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: result.portable && result.area_code_supported
                ? "1px solid rgba(16,185,129,0.4)"
                : "1px solid rgba(239,68,68,0.35)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* Status header */}
            <div
              className="px-6 py-5 flex items-center gap-4"
              style={{
                background: result.portable && result.area_code_supported
                  ? "rgba(16,185,129,0.08)"
                  : "rgba(239,68,68,0.08)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {result.portable && result.area_code_supported ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-8 h-8 text-red-400 shrink-0" />
              )}
              <div>
                <p className="text-lg font-bold text-white">
                  {result.portable && result.area_code_supported
                    ? "Numéro admissible au transfert ✓"
                    : !result.area_code_supported
                    ? "Indicatif régional non desservi"
                    : "Numéro non admissible au transfert"}
                </p>
                <p className="text-sm text-white/50 font-mono mt-0.5">{result.formatted}</p>
              </div>
            </div>

            {/* Details */}
            <div className="px-6 py-5 space-y-3">
              {result.carrier && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-white/60">
                    <Building2 className="w-4 h-4" /> Transporteur actuel
                  </span>
                  <span className="text-sm font-semibold text-white">{result.carrier}</span>
                </div>
              )}

              {result.line_type && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-white/60">
                    <Wifi className="w-4 h-4" /> Type de ligne
                  </span>
                  <Badge
                    variant="secondary"
                    className={
                      result.line_type === "mobile"
                        ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                        : result.line_type === "fixed_line"
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                        : "bg-white/10 text-white/60 border-white/20"
                    }
                  >
                    {lineTypeLabel(result.line_type)}
                  </Badge>
                </div>
              )}

              {result.location && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Région</span>
                  <span className="text-sm text-white/80">{result.location}</span>
                </div>
              )}

              {result.source === "format_only" && (
                <p className="text-xs text-white/35 pt-1">
                  Vérification de format uniquement — les informations de transporteur ne sont pas disponibles en ce moment.
                </p>
              )}
            </div>

            {/* CTA */}
            {result.portable && result.area_code_supported && (
              <div
                className="px-6 py-5"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-sm text-white/60 mb-4">
                  Votre numéro est admissible. Commandez un forfait Nivra et conservez votre numéro sans interruption de service.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleCheckout}
                    className="flex-1 h-11 font-semibold"
                    style={{
                      background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)",
                    }}
                  >
                    Commander avec ce numéro
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/commande")}
                    className="h-11 border-white/20 text-white/70 hover:bg-white/5"
                  >
                    Voir les forfaits
                  </Button>
                </div>
              </div>
            )}

            {!result.area_code_supported && (
              <div className="px-6 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-sm text-white/50">
                  Nivra dessert principalement le Québec. Cet indicatif régional n'est pas encore disponible.
                  Contactez-nous à{" "}
                  <a href="mailto:support@nivra-telecom.ca" className="text-violet-400 hover:underline">
                    support@nivra-telecom.ca
                  </a>{" "}
                  pour connaître la couverture dans votre région.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Info cards */}
        {!result && !loading && (
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            {[
              {
                icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
                title: "Gratuit",
                text: "Le transfert de numéro ne coûte rien de plus.",
              },
              {
                icon: <Smartphone className="w-5 h-5 text-violet-400" />,
                title: "1-3 jours ouvrables",
                text: "Votre service actuel reste actif pendant le transfert.",
              },
              {
                icon: <Phone className="w-5 h-5 text-cyan-400" />,
                title: "Tous les transporteurs",
                text: "Rogers, Bell, Telus, Fido, Vidéotron et plus.",
              },
            ].map((c, i) => (
              <div
                key={i}
                className="rounded-xl p-4"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className="mb-2">{c.icon}</div>
                <p className="text-sm font-semibold text-white mb-1">{c.title}</p>
                <p className="text-xs text-white/50">{c.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
