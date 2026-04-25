/**
 * CoverageChecker — Canonical service availability widget.
 * 
 * Replaces the static CoverageSection. Calls the `check-coverage` edge function
 * with the user's postal code and shows the result inline:
 *   - Covered → green panel with available service badges + CTA
 *   - Not covered → amber panel with waitlist email signup
 * 
 * Used on: Index (homepage), InternetPlans, MobilePlans, MobileCoverage, GuestCheckout.
 */
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search, CheckCircle2, AlertTriangle, Loader2, Wifi, Tv, Smartphone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logger } from "@/lib/logger";

interface CoverageResult {
  covered: boolean;
  postal_code?: string;
  city?: string | null;
  province?: string | null;
  services?: {
    internet: boolean;
    internet_max_speed: string;
    tv: boolean;
    mobile: boolean;
  };
  message: string;
}

interface Props {
  /** Compact variant (used inside Field portal, checkout, etc.) */
  variant?: "section" | "compact";
  /** Heading text override */
  title?: string;
  /** Subheading text override */
  subtitle?: string;
  /** Pre-fill the postal code field */
  defaultPostalCode?: string;
  /** Called when coverage is determined; useful for parent flows (Field portal). */
  onResult?: (result: CoverageResult) => void;
}

const formatPostalCode = (raw: string): string => {
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
};

export default function CoverageChecker({
  variant = "section",
  title,
  subtitle,
  defaultPostalCode = "",
  onResult,
}: Props) {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const [postal, setPostal] = useState(defaultPostalCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoverageResult | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = useCallback(async () => {
    setError(null);
    setWaitlistDone(false);
    const cleaned = postal.replace(/\s+/g, "").toUpperCase();
    if (cleaned.length < 3) {
      setError(isFr ? "Entrez un code postal valide (ex : H1A 1A1)." : "Enter a valid postal code (e.g. H1A 1A1).");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("check-coverage", {
        body: { postal_code: cleaned },
      });
      if (fnError) throw fnError;
      const res = data as CoverageResult;
      setResult(res);
      onResult?.(res);
    } catch (e) {
      logger.warn("coverage-check failed", e);
      setError(isFr ? "Erreur lors de la vérification. Réessayez." : "Check failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [postal, isFr, onResult]);

  const handleWaitlist = useCallback(async () => {
    if (!waitlistEmail.includes("@")) {
      setError(isFr ? "Entrez un courriel valide." : "Enter a valid email.");
      return;
    }
    setWaitlistSubmitting(true);
    setError(null);
    try {
      const { error: insertError } = await supabase
        .from("coverage_waitlist" as any)
        .insert({
          email: waitlistEmail.trim().toLowerCase(),
          postal_code: result?.postal_code ?? postal.replace(/\s+/g, "").toUpperCase().slice(0, 3),
          city: result?.city ?? null,
        });
      if (insertError) throw insertError;
      setWaitlistDone(true);
      setWaitlistEmail("");
    } catch (e) {
      logger.warn("coverage-waitlist insert failed", e);
      setError(isFr ? "Inscription échouée. Réessayez." : "Signup failed. Please try again.");
    } finally {
      setWaitlistSubmitting(false);
    }
  }, [waitlistEmail, result, postal, isFr]);

  const headerTitle =
    title ?? (isFr ? "Vérifiez la disponibilité à votre adresse" : "Check availability at your address");
  const headerSubtitle =
    subtitle ?? (isFr ? "Entrez votre code postal pour voir les services disponibles." : "Enter your postal code to see available services.");

  const isCompact = variant === "compact";

  const SearchBar = (
    <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
      <div className="flex-1 relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          type="text"
          inputMode="text"
          autoComplete="postal-code"
          placeholder={isFr ? "Code postal (ex : H7E 0E5)" : "Postal code (e.g. H7E 0E5)"}
          value={postal}
          onChange={(e) => setPostal(formatPostalCode(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCheck();
          }}
          className="pl-10 h-12 text-base"
          aria-label={isFr ? "Code postal" : "Postal code"}
          maxLength={7}
        />
      </div>
      <Button
        type="button"
        onClick={handleCheck}
        disabled={loading || postal.length < 3}
        size="lg"
        className="h-12 min-w-[200px]"
        style={{ background: "#7C3AED", color: "white" }}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {isFr ? "Vérification…" : "Checking…"}
          </>
        ) : (
          <>
            <Search className="w-4 h-4 mr-2" />
            {isFr ? "Vérifier la disponibilité" : "Check availability"}
          </>
        )}
      </Button>
    </div>
  );

  const ResultPanel = result && (
    <div className="max-w-2xl mx-auto mt-6">
      {result.covered ? (
        <div
          className="rounded-2xl p-6 text-left"
          style={{ background: "#ECFDF5", border: "1px solid #10B981" }}
          role="status"
        >
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle2 className="w-6 h-6 flex-shrink-0" style={{ color: "#059669" }} />
            <div>
              <h3 className="font-bold text-lg" style={{ color: "#065F46" }}>
                {isFr
                  ? `Services disponibles à ${result.city ?? "votre adresse"} !`
                  : `Services available at ${result.city ?? "your address"}!`}
              </h3>
              <p className="text-sm mt-1" style={{ color: "#047857" }}>
                {isFr ? "Code postal" : "Postal code"} : <strong>{result.postal_code}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {result.services?.internet && (
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium" style={{ background: "white", color: "#065F46", border: "1px solid #A7F3D0" }}>
                <Wifi className="w-4 h-4" />
                {isFr ? "Internet" : "Internet"} — {isFr ? "jusqu'à" : "up to"} {result.services.internet_max_speed}
              </span>
            )}
            {result.services?.tv && (
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium" style={{ background: "white", color: "#065F46", border: "1px solid #A7F3D0" }}>
                <Tv className="w-4 h-4" />
                {isFr ? "Télévision" : "Television"}
              </span>
            )}
            {result.services?.mobile && (
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium" style={{ background: "white", color: "#065F46", border: "1px solid #A7F3D0" }}>
                <Smartphone className="w-4 h-4" />
                {isFr ? "Mobile 4G" : "4G Mobile"}
              </span>
            )}
          </div>

          {!isCompact && (
            <Link
              to="/internet"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold transition-colors"
              style={{ background: "#7C3AED", color: "white" }}
            >
              {isFr ? "Commander maintenant" : "Order now"}
            </Link>
          )}
        </div>
      ) : (
        <div
          className="rounded-2xl p-6 text-left"
          style={{ background: "#FFFBEB", border: "1px solid #F59E0B" }}
          role="status"
        >
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" style={{ color: "#D97706" }} />
            <div>
              <h3 className="font-bold text-lg" style={{ color: "#92400E" }}>
                {isFr ? "Service non disponible dans cette zone" : "Service not available in this area"}
              </h3>
              <p className="text-sm mt-1" style={{ color: "#B45309" }}>
                {isFr
                  ? "Nous travaillons à étendre notre couverture dans votre région."
                  : "We are working to extend our coverage to your area."}
              </p>
            </div>
          </div>

          {!isCompact && (
            <>
              {waitlistDone ? (
                <div className="mt-4 p-4 rounded-lg flex items-start gap-2" style={{ background: "white", border: "1px solid #FCD34D" }}>
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "#059669" }} />
                  <p className="text-sm" style={{ color: "#065F46" }}>
                    {isFr
                      ? "Merci ! Nous vous contacterons dès que votre zone sera couverte."
                      : "Thanks! We'll reach out as soon as your area is covered."}
                  </p>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-sm mb-3" style={{ color: "#92400E" }}>
                    {isFr
                      ? "Laissez-nous votre courriel et nous vous contacterons dès que votre zone est couverte."
                      : "Leave your email and we'll let you know when your area is covered."}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder={isFr ? "Votre courriel" : "Your email"}
                        value={waitlistEmail}
                        onChange={(e) => setWaitlistEmail(e.target.value)}
                        className="pl-9 h-11"
                      />
                    </div>
                    <Button
                      onClick={handleWaitlist}
                      disabled={waitlistSubmitting || !waitlistEmail.includes("@")}
                      style={{ background: "#7C3AED", color: "white" }}
                      className="h-11"
                    >
                      {waitlistSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        isFr ? "M'avertir" : "Notify me"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <p className="text-xs mt-4" style={{ color: "#92400E" }}>
                {isFr ? "Ou contactez-nous : " : "Or contact us: "}
                <a href="mailto:support@nivra-telecom.ca" className="underline font-medium">
                  support@nivra-telecom.ca
                </a>
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm mt-3 text-center" style={{ color: "#DC2626" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );

  if (isCompact) {
    return (
      <div className="w-full">
        {SearchBar}
        {error && !result && (
          <p className="text-sm mt-3 text-center" style={{ color: "#DC2626" }} role="alert">
            {error}
          </p>
        )}
        {ResultPanel}
      </div>
    );
  }

  return (
    <section
      aria-label={isFr ? "Vérification de couverture" : "Coverage check"}
      className="px-5 sm:px-10"
      style={{ background: "#F7F7F7", paddingTop: 56, paddingBottom: 56 }}
    >
      <div className="max-w-[1100px] mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-5" style={{ background: "#F3EEFF", borderRadius: 50 }}>
          <MapPin className="w-4 h-4" style={{ color: "#7C3AED" }} />
          <span className="font-semibold uppercase" style={{ color: "#7C3AED", fontSize: 11, letterSpacing: 2 }}>
            {isFr ? "Couverture" : "Coverage"}
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold mb-3" style={{ color: "#0D0D0D", letterSpacing: "-0.5px" }}>
          {headerTitle}
        </h2>

        <p className="mb-8 max-w-xl mx-auto" style={{ color: "#444444", fontSize: 16, lineHeight: 1.7 }}>
          {headerSubtitle}
        </p>

        {SearchBar}

        {error && !result && (
          <p className="text-sm mt-3" style={{ color: "#DC2626" }} role="alert">
            {error}
          </p>
        )}

        {ResultPanel}
      </div>
    </section>
  );
}
