/**
 * QR Identity Verification Component for Checkout
 * Rogers-style design: shows QR code, live status polling, 20-min countdown, regenerate button.
 * Used in both ClientNewOrder and ClientInternetOrder checkouts.
 * 
 * Includes client-side QR fallback if edge function QR PNG generation fails.
 * Full error instrumentation: logs endpoint, payload, HTTP status, and error messages.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, RefreshCw, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, QrCode } from "lucide-react";
import { portalClient as dbClient } from "@/integrations/backend";
import { toast } from "sonner";
import QRCode from "qrcode";

interface QRVerificationStepProps {
  userId: string;
  checkoutType: "mobile" | "internet" | "tv";
  isFrench: boolean;
  onVerified: (sessionId: string) => void;
  orderContext?: Record<string, unknown>;
  checkoutFields?: Record<string, unknown>;
}

type SessionStatus = "created" | "submitted" | "approved" | "rejected" | "manual_review" | "expired";

const STATUS_CONFIG: Record<SessionStatus, { icon: typeof CheckCircle2; color: string; labelFr: string; labelEn: string }> = {
  created: { icon: QrCode, color: "text-blue-500", labelFr: "En attente de soumission", labelEn: "Awaiting submission" },
  submitted: { icon: Loader2, color: "text-amber-500", labelFr: "Documents soumis — analyse en cours", labelEn: "Documents submitted — analysis in progress" },
  approved: { icon: CheckCircle2, color: "text-emerald-600", labelFr: "Identité vérifiée ✓", labelEn: "Identity verified ✓" },
  rejected: { icon: XCircle, color: "text-red-500", labelFr: "Vérification refusée", labelEn: "Verification rejected" },
  manual_review: { icon: AlertCircle, color: "text-amber-600", labelFr: "Révision manuelle en cours", labelEn: "Manual review in progress" },
  expired: { icon: Clock, color: "text-slate-400", labelFr: "Session expirée", labelEn: "Session expired" },
};

export const QRVerificationStep = ({
  userId,
  checkoutType,
  isFrench,
  onVerified,
  orderContext,
  checkoutFields,
}: QRVerificationStepProps) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>("created");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [regenCount, setRegenCount] = useState(0);
  const [maxRegen, setMaxRegen] = useState(3);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateQR = useCallback(async (regenerateSessionId?: string) => {
    setLoading(true);
    setError(null);
    setErrorDetail(null);
    
    // Clear old QR immediately on regenerate for visual feedback
    if (regenerateSessionId) {
      setQrDataUrl(null);
      setSessionId(null);
      setExpiresAt(null);
      setTimeLeft("");
    }

    const payload = {
      checkout_type: checkoutType,
      order_context: orderContext || {},
      checkout_fields: checkoutFields || {},
      regenerate_session_id: regenerateSessionId,
      _cache_bust: Date.now(),
    };

    console.log(`[QR] Calling generate-verification-qr`, {
      endpoint: "generate-verification-qr",
      payload: { ...payload, checkout_fields: "..." },
      regenerateFrom: regenerateSessionId || "none",
    });

    try {
      const { data, error: fnError } = await dbClient.functions.invoke("generate-verification-qr", {
        body: payload,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
        },
      });

      // Log full response for debugging
      console.log(`[QR] Response received:`, {
        hasData: !!data,
        hasError: !!fnError,
        errorMessage: fnError?.message,
        dataKeys: data ? Object.keys(data) : [],
        requestId: data?.request_id,
        errorCode: data?.error_code,
      });

      if (fnError) {
        console.error(`[QR] Function invoke error:`, fnError);
        throw new Error(fnError.message || "Failed to call verification service");
      }
      
      if (data?.error) {
        console.error(`[QR] Server error response:`, {
          error_code: data.error_code,
          error: data.error,
          request_id: data.request_id,
        });
        throw new Error(data.error);
      }

      // Use server-side QR PNG if available, otherwise generate client-side
      const verifyUrl = data.verify_url;
      let qrImage = data.qr_data_url;
      
      if (!qrImage && verifyUrl) {
        console.warn("[QR] Server QR PNG failed, generating client-side fallback");
        try {
          qrImage = await QRCode.toDataURL(verifyUrl, {
            width: 280,
            margin: 2,
            color: { dark: "#000000", light: "#FFFFFF" },
            errorCorrectionLevel: "H",
          });
          console.log("[QR] Client-side QR generated successfully");
        } catch (qrErr) {
          console.error("[QR] Client-side QR fallback also failed:", qrErr);
        }
      }

      setQrDataUrl(qrImage || null);
      setSessionId(data.session_id);
      setStatus("created");
      setExpiresAt(new Date(data.expires_at));
      setRegenCount(data.qr_regeneration_count || 0);
      setMaxRegen(data.max_regen_allowed || 3);

      console.log(`[QR] ✅ Session created successfully`, {
        request_id: data.request_id,
        session_id: data.session_id,
        expires_at: data.expires_at,
        has_qr_png: !!data.qr_data_url,
        regen_count: `${data.qr_regeneration_count || 0}/${data.max_regen_allowed || 3}`,
        regenerated_from: regenerateSessionId || "none",
      });
    } catch (err: any) {
      console.error("[QR] ❌ Generation failed:", {
        message: err.message,
        name: err.name,
        stack: err.stack?.slice(0, 200),
      });
      
      const userMessage = err.message || (isFrench ? "Erreur lors de la génération du QR" : "Error generating QR code");
      setError(userMessage);
      setErrorDetail(err.message);
      toast.error(isFrench ? "Erreur lors de la génération du code QR" : "Error generating QR code");
    } finally {
      setLoading(false);
    }
  }, [checkoutType, orderContext, checkoutFields, isFrench]);

  // Generate QR on mount
  useEffect(() => {
    generateQR();
  }, [generateQR]);

  // Poll session status every 3 seconds
  useEffect(() => {
    if (!sessionId) return;
    
    const poll = async () => {
      try {
        const { data } = await dbClient
          .from("identity_verification_sessions")
          .select("status")
          .eq("id", sessionId)
          .single();

        if (data && data.status !== status) {
          const newStatus = data.status as SessionStatus;
          setStatus(newStatus);
          
          if (newStatus === "submitted") {
            toast.info(isFrench 
              ? "Documents reçus — analyse en cours..." 
              : "Documents received — analysis in progress...");
          } else if (newStatus === "manual_review") {
            onVerified(sessionId);
            toast.success(isFrench 
              ? "Documents soumis! Un agent vérifiera votre identité sous peu." 
              : "Documents submitted! An agent will verify your identity shortly.");
          } else if (newStatus === "approved") {
            onVerified(sessionId);
            toast.success(isFrench ? "Identité vérifiée avec succès!" : "Identity verified successfully!");
          } else if (newStatus === "rejected") {
            toast.error(isFrench ? "Vérification refusée. Veuillez réessayer." : "Verification rejected. Please try again.");
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    };

    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [sessionId, status, onVerified, isFrench]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft("00:00");
        setStatus("expired");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [expiresAt]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleRegenerate = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const oldSessionId = sessionId;
    console.log(`[QR] Regenerating. Old session=${oldSessionId} will be expired, new session will be created.`);
    generateQR(oldSessionId || undefined);
  };

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.created;
  const StatusIcon = statusConfig.icon;
  const isTerminal = status === "approved" || status === "rejected";
  const isExpired = status === "expired";
  const canRegenerate = regenCount < maxRegen;

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          {isFrench ? "Renseignements personnels" : "Personal Information"}
        </h2>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-2xl">
          {isFrench
            ? "Avant de procéder, nous devons effectuer une vérification d'identité pour confirmer votre identité et approuver votre commande. Nous protégerons la confidentialité de vos renseignements."
            : "Before proceeding, we need to verify your identity to confirm who you are and approve your order. We will protect the confidentiality of your information."}
        </p>
      </div>

      <Card className="bg-white border border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-slate-900">
            {isFrench ? "Vérification de votre identité" : "Identity Verification"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Instructions */}
            <div className="flex-1 space-y-4">
              <h3 className="font-semibold text-slate-900">Instructions</h3>
              <ol className="list-decimal list-inside space-y-3 text-sm text-slate-700">
                <li>{isFrench ? "Vérifiez que votre appareil est connecté à Internet." : "Verify your device is connected to the Internet."}</li>
                <li>{isFrench ? "Balayez le code QR avec l'appareil photo de votre téléphone." : "Scan the QR code with your phone camera."}</li>
                <li>{isFrench ? "Suivez les instructions pour soumettre votre pièce d'identité." : "Follow the instructions to submit your ID."}</li>
                <li>
                  {isFrench
                    ? <>Une fois votre pièce d'identité soumise, sélectionnez <strong>Continuer</strong>.</>
                    : <>Once your ID is submitted, select <strong>Continue</strong>.</>}
                </li>
              </ol>

              {!isTerminal && !isExpired && (
                <p className="text-sm font-bold text-slate-900">
                  {isFrench
                    ? `Ce code QR expire dans ${timeLeft || "20:00"}. Ne fermez pas et n'actualisez pas votre navigateur.`
                    : `This QR code expires in ${timeLeft || "20:00"}. Do not close or refresh your browser.`}
                </p>
              )}
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-4">
              {loading ? (
                <div className="w-[200px] h-[200px] flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200">
                  <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                </div>
              ) : error ? (
                <div className="w-[200px] h-[200px] flex flex-col items-center justify-center bg-red-50 rounded-lg border border-red-200 p-4 text-center">
                  <XCircle className="w-8 h-8 text-red-400 mb-2" />
                  <p className="text-xs text-red-600 mb-1">{error}</p>
                  {errorDetail && (
                    <p className="text-[10px] text-red-400 font-mono break-all">{errorDetail}</p>
                  )}
                  <Button onClick={() => generateQR()} variant="outline" size="sm" className="mt-2">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    {isFrench ? "Réessayer" : "Retry"}
                  </Button>
                </div>
              ) : qrDataUrl ? (
                <div className={`p-2 bg-white rounded-lg border-2 ${isExpired ? "border-slate-300 opacity-50" : "border-slate-200"}`}>
                  <img src={qrDataUrl} alt="QR Code" className="w-[200px] h-[200px]" />
                </div>
              ) : null}

              {/* Countdown */}
              {!isTerminal && (
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${isExpired ? "text-red-500" : "text-slate-500"}`} />
                  <span className={`text-sm font-mono font-bold ${isExpired ? "text-red-500" : "text-slate-700"}`}>
                    {isExpired ? (isFrench ? "Expiré" : "Expired") : timeLeft}
                  </span>
                </div>
              )}

              {/* Regen count indicator */}
              {!isTerminal && sessionId && (
                <p className="text-[10px] text-slate-400 font-mono">
                  {isFrench ? `Régénérations: ${regenCount}/${maxRegen}` : `Regenerations: ${regenCount}/${maxRegen}`}
                </p>
              )}
            </div>
          </div>

          {/* Status indicator */}
          <div className={`flex items-center gap-3 p-4 rounded-lg ${
            status === "approved" ? "bg-emerald-50 border border-emerald-200" :
            status === "rejected" ? "bg-red-50 border border-red-200" :
            status === "submitted" ? "bg-amber-50 border border-amber-200" :
            status === "manual_review" ? "bg-purple-50 border border-purple-200" :
            "bg-slate-50 border border-slate-200"
          }`}>
            <StatusIcon className={`w-5 h-5 ${statusConfig.color} ${status === "submitted" ? "animate-spin" : ""}`} />
            <span className={`text-sm font-medium ${statusConfig.color}`}>
              {isFrench ? statusConfig.labelFr : statusConfig.labelEn}
            </span>
          </div>

          {/* Regenerate button */}
          {(isExpired || status === "rejected") && (
            <Button
              onClick={handleRegenerate}
              variant="outline"
              className="w-full border-slate-300"
              disabled={loading || !canRegenerate}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {!canRegenerate
                ? (isFrench ? `Limite atteinte (${maxRegen}/${maxRegen})` : `Limit reached (${maxRegen}/${maxRegen})`)
                : (isFrench ? "Régénérer le code QR" : "Regenerate QR Code")}
            </Button>
          )}

          {/* Security badge */}
          <div className="flex items-center gap-3 pt-2">
            <Shield className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500">
              {isFrench
                ? "Protégé par un chiffrement sécurisé 256 bits pour garantir la sécurité de vos données."
                : "Protected by 256-bit encryption to ensure the security of your data."}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QRVerificationStep;
