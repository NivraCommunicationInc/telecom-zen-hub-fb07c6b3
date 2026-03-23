/**
 * GuestKycCard — Premium KYC verification card for guest checkout
 * Desktop: QR code to scan with phone
 * Mobile/Tablet: Direct "Commencer la vérification" button
 * Uses the same existing KYC infrastructure (generate-verification-qr + identity_verification_sessions)
 * 
 * Status states: not_started | in_progress | completed | failed
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Shield, QrCode, Smartphone, Camera, CheckCircle2, XCircle,
  RefreshCw, Clock, Loader2, Lock, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import QRCode from "qrcode";

export type GuestKycStatus = "not_started" | "in_progress" | "completed" | "failed";

interface GuestKycCardProps {
  isStreamingOnly: boolean;
  guestEmail: string;
  guestRequestId: string;
  onStatusChange: (status: GuestKycStatus, sessionId?: string) => void;
}

type SessionStatus = "created" | "submitted" | "approved" | "rejected" | "manual_review" | "expired";

const mapSessionToCardStatus = (s: SessionStatus): GuestKycStatus => {
  if (s === "approved" || s === "submitted" || s === "manual_review") return "completed";
  if (s === "rejected") return "failed";
  if (s === "created") return "in_progress";
  if (s === "expired") return "failed";
  return "not_started";
};

export const GuestKycCard = ({
  isStreamingOnly,
  guestEmail,
  guestRequestId,
  onStatusChange,
}: GuestKycCardProps) => {
  const isMobile = useIsMobile();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenCount, setRegenCount] = useState(0);
  const [maxRegen] = useState(3);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasInit = useRef(false);

  // ── Streaming-only bypass ──
  if (isStreamingOnly) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="py-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm text-foreground">Vérification non requise</p>
              <p className="text-xs text-muted-foreground">
                Les services Streaming+ ne nécessitent pas de vérification d'identité.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Derive card-level status ──
  const cardStatus: GuestKycStatus = sessionStatus
    ? mapSessionToCardStatus(sessionStatus)
    : "not_started";
  const isTerminal = sessionStatus === "approved" || sessionStatus === "submitted" || sessionStatus === "manual_review";
  const isExpired = sessionStatus === "expired";
  const canRegenerate = regenCount < maxRegen;

  // ── Generate QR session ──
  const generateSession = useCallback(async (regenerateSessionId?: string) => {
    setLoading(true);
    setError(null);

    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    try {
      const response = await fetch(`${baseUrl}/functions/v1/generate-verification-qr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          checkout_mode: "public_checkout",
          checkout_type: "internet",
          guest_email: guestEmail,
          guest_request_id: guestRequestId,
          regenerate_session_id: regenerateSessionId || undefined,
          _cache_bust: Date.now(),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `HTTP ${response.status}`);
      }

      const data = await response.json();

      const fetchedUrl = data.verify_url;
      setVerifyUrl(fetchedUrl || null);

      let qrImage = data.qr_png || data.qr_data_url;
      if (!qrImage && fetchedUrl) {
        try {
          qrImage = await QRCode.toDataURL(fetchedUrl, {
            width: 240,
            margin: 2,
            color: { dark: "#000000", light: "#FFFFFF" },
            errorCorrectionLevel: "H",
          });
        } catch {
          console.warn("[GuestKYC] Client QR fallback failed");
        }
      }

      setQrDataUrl(qrImage || null);
      const newSessionId = data.session_id || null;
      setSessionId(newSessionId);
      setSessionStatus("created");
      setExpiresAt(data.expires_at ? new Date(data.expires_at) : null);
      setRegenCount(data.qr_regeneration_count || 0);

      onStatusChange("in_progress", newSessionId);
    } catch (err: any) {
      console.error("[GuestKYC] Session generation failed:", err.message);
      setError("Impossible de démarrer la vérification. Veuillez réessayer.");
      toast.error("Erreur lors de la génération de la session de vérification");
    } finally {
      setLoading(false);
    }
  }, [guestEmail, guestRequestId, onStatusChange]);

  // ── Poll session status ──
  useEffect(() => {
    if (!sessionId) return;

    const poll = async () => {
      try {
        const { data } = await supabase
          .from("identity_verification_sessions")
          .select("status")
          .eq("id", sessionId)
          .single();

        if (data && data.status !== sessionStatus) {
          const newStatus = data.status as SessionStatus;
          setSessionStatus(newStatus);
          const mapped = mapSessionToCardStatus(newStatus);
          onStatusChange(mapped, sessionId);

          if (newStatus === "submitted" || newStatus === "manual_review") {
            toast.success("Documents soumis — en vérification. Vous pouvez continuer.");
          } else if (newStatus === "approved") {
            toast.success("Identité vérifiée avec succès !");
          } else if (newStatus === "rejected") {
            toast.error("Vérification refusée. Veuillez réessayer.");
          }
        }
      } catch {
        // silently ignore polling errors
      }
    };

    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [sessionId, sessionStatus, onStatusChange]);

  // ── Countdown ──
  useEffect(() => {
    if (!expiresAt) return;

    const update = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("00:00");
        setSessionStatus("expired");
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };

    update();
    timerRef.current = setInterval(update, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [expiresAt]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleStart = () => {
    if (!hasInit.current) {
      hasInit.current = true;
    }
    generateSession();
  };

  const handleRegenerate = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    generateSession(sessionId || undefined);
  };

  const handleMobileLaunch = () => {
    if (verifyUrl) {
      window.open(verifyUrl, "_blank", "noopener,noreferrer");
    }
  };

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════

  // ── Completed state ──
  if (isTerminal) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="py-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {sessionStatus === "approved"
                  ? "Identité vérifiée"
                  : "Documents soumis"}
              </p>
              <p className="text-xs text-muted-foreground">
                {sessionStatus === "approved"
                  ? "Votre identité a été vérifiée avec succès."
                  : "Vos documents sont en cours de vérification par notre équipe."}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 pt-2 border-t border-emerald-500/20">
            <Shield className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Documents chiffrés et supprimés immédiatement après validation.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Not started state ──
  if (!sessionId && !loading) {
    return (
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardContent className="py-6 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Vérification d'identité</h3>
              <p className="text-xs text-muted-foreground">
                Requis pour sécuriser votre commande
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Comment ça fonctionne :</p>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
              {isMobile ? (
                <>
                  <li>Appuyez sur le bouton ci-dessous</li>
                  <li>Prenez une photo de votre pièce d'identité</li>
                  <li>Soumettez vos documents</li>
                  <li>Revenez ici pour continuer</li>
                </>
              ) : (
                <>
                  <li>Scannez le code QR avec votre téléphone</li>
                  <li>Prenez une photo de votre pièce d'identité</li>
                  <li>Soumettez vos documents</li>
                  <li>Le statut se met à jour automatiquement</li>
                </>
              )}
            </ol>
          </div>

          {/* CTA */}
          <Button
            onClick={handleStart}
            className="w-full py-5 text-sm font-semibold"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : isMobile ? (
              <Camera className="w-4 h-4 mr-2" />
            ) : (
              <QrCode className="w-4 h-4 mr-2" />
            )}
            {isMobile
              ? "Commencer la vérification"
              : "Générer le code QR"}
          </Button>

          {/* Security notice */}
          <div className="flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Vos documents sont chiffrés et supprimés immédiatement après validation. Aucune copie n'est conservée.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Active session (QR visible / mobile link) ──
  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardContent className="py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Vérification d'identité</h3>
              <p className="text-xs text-muted-foreground">Session active</p>
            </div>
          </div>
          {!isExpired && timeLeft && (
            <div className="flex items-center gap-1.5 text-sm font-mono font-bold text-muted-foreground">
              <Clock className="w-4 h-4" />
              {timeLeft}
            </div>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center bg-destructive/5 border border-destructive/20 rounded-lg p-5 text-center">
            <XCircle className="w-8 h-8 text-destructive mb-2" />
            <p className="text-sm text-destructive mb-3">{error}</p>
            <Button onClick={() => generateSession()} variant="outline" size="sm">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Réessayer
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading && !error && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          </div>
        )}

        {/* QR / Mobile CTA */}
        {!loading && !error && (
          <>
            {isMobile ? (
              /* ── MOBILE: Direct button ── */
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                    <li>Appuyez sur le bouton ci-dessous</li>
                    <li>Prenez une photo de votre pièce d'identité</li>
                    <li>Soumettez, puis revenez ici</li>
                  </ol>
                </div>

                {verifyUrl && !isExpired && (
                  <Button
                    onClick={handleMobileLaunch}
                    className="w-full py-5 text-sm font-semibold"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Commencer la vérification
                  </Button>
                )}

                {isExpired && (
                  <div className="text-center py-4">
                    <AlertCircle className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Session expirée</p>
                  </div>
                )}
              </div>
            ) : (
              /* ── DESKTOP: QR Code ── */
              <div className="flex gap-6">
                {/* Instructions */}
                <div className="flex-1 space-y-3">
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Scannez le code QR avec votre téléphone</li>
                    <li>Prenez une photo de votre pièce d'identité</li>
                    <li>Soumettez vos documents</li>
                    <li>Le statut se met à jour automatiquement ici</li>
                  </ol>

                  {!isExpired && (
                    <p className="text-xs font-medium text-foreground">
                      Ce code expire dans {timeLeft || "20:00"}. Ne fermez pas votre navigateur.
                    </p>
                  )}
                </div>

                {/* QR */}
                <div className="flex flex-col items-center gap-3">
                  {qrDataUrl ? (
                    <div className={`p-2 bg-background rounded-xl border-2 shadow-sm ${
                      isExpired ? "border-muted opacity-40" : "border-primary/20"
                    }`}>
                      <img src={qrDataUrl} alt="QR Code" className="w-[200px] h-[200px]" />
                    </div>
                  ) : (
                    <div className="w-[200px] h-[200px] flex items-center justify-center bg-muted/30 rounded-xl border-2 border-dashed border-muted">
                      <QrCode className="w-10 h-10 text-muted-foreground/40" />
                    </div>
                  )}

                  {isExpired && (
                    <p className="text-xs text-destructive font-medium">Expiré</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Status indicator */}
        {sessionStatus && (
          <div className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium ${
            sessionStatus === "approved" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
            sessionStatus === "submitted" || sessionStatus === "manual_review"
              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
            sessionStatus === "rejected" ? "bg-destructive/10 text-destructive border border-destructive/20" :
            sessionStatus === "expired" ? "bg-muted text-muted-foreground border border-border" :
            "bg-primary/5 text-primary border border-primary/20"
          }`}>
            {sessionStatus === "created" && <Loader2 className="w-4 h-4 animate-spin" />}
            {sessionStatus === "submitted" && <Loader2 className="w-4 h-4 animate-spin" />}
            {sessionStatus === "manual_review" && <Loader2 className="w-4 h-4 animate-spin" />}
            {sessionStatus === "approved" && <CheckCircle2 className="w-4 h-4" />}
            {sessionStatus === "rejected" && <XCircle className="w-4 h-4" />}
            {sessionStatus === "expired" && <Clock className="w-4 h-4" />}
            <span>
              {sessionStatus === "created" && "En attente de soumission…"}
              {sessionStatus === "submitted" && "Documents soumis — vérification en cours"}
              {sessionStatus === "manual_review" && "Documents soumis — vérification en cours"}
              {sessionStatus === "approved" && "Identité vérifiée ✓"}
              {sessionStatus === "rejected" && "Vérification refusée"}
              {sessionStatus === "expired" && "Session expirée"}
            </span>
          </div>
        )}

        {/* Regenerate */}
        {(isExpired || sessionStatus === "rejected") && (
          <Button
            onClick={handleRegenerate}
            variant="outline"
            className="w-full"
            disabled={loading || !canRegenerate}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {!canRegenerate
              ? `Limite atteinte (${maxRegen}/${maxRegen})`
              : isMobile
                ? "Relancer la vérification"
                : "Régénérer le code QR"}
          </Button>
        )}

        {/* Security footer */}
        <div className="flex items-start gap-2 pt-2 border-t border-border">
          <Shield className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground">
            Documents chiffrés et supprimés immédiatement après validation. Aucune copie n'est conservée.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default GuestKycCard;
