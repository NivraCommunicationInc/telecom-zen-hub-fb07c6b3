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
import { useClientAuth } from "@/hooks/useClientAuth";
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

interface QRDebugState {
  requestUrl: string;
  httpStatus: number | null;
  responseBodyPreview: string;
  requestId: string | null;
  authPresent: boolean;
  hasSession: boolean;
  tokenLength: number;
  timestamp: string;
  checkoutMode: "portal_checkout" | "public_checkout";
}

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
  const { isAdmin } = useClientAuth();
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
  const hasInitializedRef = useRef(false);

  const debugQueryEnabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
  const showDebugPanel = isAdmin || debugQueryEnabled;
  const checkoutMode: QRDebugState["checkoutMode"] = "portal_checkout";

  const [debugState, setDebugState] = useState<QRDebugState>({
    requestUrl: "",
    httpStatus: null,
    responseBodyPreview: "",
    requestId: null,
    authPresent: false,
    hasSession: false,
    tokenLength: 0,
    timestamp: "",
    checkoutMode,
  });

  const toPreview = (value: unknown) => {
    if (typeof value === "string") return value.slice(0, 300);
    try {
      return JSON.stringify(value).slice(0, 300);
    } catch {
      return String(value).slice(0, 300);
    }
  };

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
      user_id: userId,
      checkout_type: checkoutType,
      order_context: orderContext || {},
      checkout_fields: checkoutFields || {},
      regenerate_session_id: regenerateSessionId,
      _cache_bust: Date.now(),
    };

    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const requestUrl = `${baseUrl}/functions/v1/generate-verification-qr?_cb=${Date.now()}`;

    try {
      const { data: sessionData } = await dbClient.auth.getSession();
      const session = sessionData?.session;
      const accessToken = session?.access_token || "";
      const hasSession = !!session;
      const tokenLength = accessToken.length;

      console.log("[QR][TOKEN_STATE]", {
        hasSession,
        tokenLength,
      });

      setDebugState((prev) => ({
        ...prev,
        requestUrl,
        hasSession,
        tokenLength,
        authPresent: tokenLength > 0,
        timestamp: new Date().toISOString(),
        checkoutMode,
      }));

      if (!accessToken) {
        const blockingMessage = "Session expired / please log in again";
        setError(blockingMessage);
        setErrorDetail(blockingMessage);
        setDebugState((prev) => ({
          ...prev,
          requestUrl,
          httpStatus: 401,
          responseBodyPreview: blockingMessage,
          requestId: null,
          authPresent: false,
          hasSession,
          tokenLength,
          timestamp: new Date().toISOString(),
          checkoutMode,
        }));
        toast.error(blockingMessage);
        return;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      };

      console.log("[QR][REQUEST]", {
        request_url: requestUrl,
        method: "POST",
        has_authorization: true,
        hasSession,
        tokenLength,
        payload,
      });

      const response = await fetch(requestUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const requestIdHeader =
        response.headers.get("request-id") ||
        response.headers.get("x-request-id") ||
        response.headers.get("x-correlation-id");

      const rawBody = await response.text();
      let responseBody: unknown = rawBody;
      try {
        responseBody = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        // keep raw text body
      }

      const responseRequestId =
        requestIdHeader ||
        (typeof responseBody === "object" && responseBody !== null && "request_id" in responseBody
          ? String((responseBody as { request_id?: unknown }).request_id || "") || null
          : null);

      setDebugState((prev) => ({
        ...prev,
        requestUrl,
        httpStatus: response.status,
        responseBodyPreview: toPreview(responseBody),
        requestId: responseRequestId,
        authPresent: true,
        hasSession,
        tokenLength,
        timestamp: new Date().toISOString(),
        checkoutMode,
      }));

      console.log("[QR][RESPONSE]", {
        request_url: requestUrl,
        http_status: response.status,
        request_id_header: requestIdHeader,
        response_body: responseBody,
      });

      if (!response.ok) {
        const typedBody = responseBody as Record<string, unknown> | string | null;
        const serverMessage =
          (typedBody && typeof typedBody === "object" && (typedBody.message || typedBody.error || typedBody.detail)) ||
          (typeof typedBody === "string" ? typedBody : `HTTP ${response.status}`);

        const error = new Error(String(serverMessage || `HTTP ${response.status}`)) as Error & {
          httpStatus?: number;
          requestIdHeader?: string | null;
          requestId?: string | null;
          requestUrl?: string;
          responseBody?: unknown;
        };
        error.httpStatus = response.status;
        error.requestIdHeader = requestIdHeader;
        error.requestId = responseRequestId;
        error.requestUrl = requestUrl;
        error.responseBody = responseBody;
        throw error;
      }

      const data = (responseBody || {}) as Record<string, any>;

      // Use server-side QR PNG if available, otherwise generate client-side
      const verifyUrl = data.verify_url;
      let qrImage = data.qr_png || data.qr_data_url;

      if (!qrImage && verifyUrl) {
        console.warn("[QR] Server QR PNG missing, generating client-side fallback");
        try {
          qrImage = await QRCode.toDataURL(verifyUrl, {
            width: 280,
            margin: 2,
            color: { dark: "#000000", light: "#FFFFFF" },
            errorCorrectionLevel: "H",
          });
          console.log("[QR] Client-side QR generated successfully");
        } catch (qrErr) {
          console.error("[QR] Client-side QR fallback failed:", qrErr);
        }
      }

      setQrDataUrl(qrImage || null);
      setSessionId(data.session_id || null);
      setStatus("created");
      setExpiresAt(data.expires_at ? new Date(data.expires_at) : null);
      setRegenCount(data.qr_regeneration_count || 0);
      setMaxRegen(data.max_regen_allowed || 3);

      console.log("[QR] ✅ Session created successfully", {
        request_id: data.request_id || responseRequestId,
        session_id: data.session_id,
        expires_at: data.expires_at,
        has_qr_png: !!(data.qr_png || data.qr_data_url),
        regen_count: `${data.qr_regeneration_count || 0}/${data.max_regen_allowed || 3}`,
        regenerated_from: regenerateSessionId || "none",
      });
    } catch (err: any) {
      const debugRequestId = err?.requestId || err?.requestIdHeader || err?.responseBody?.request_id || null;
      const debugPreview = toPreview(err?.responseBody || err?.message || "Unknown error");

      setDebugState((prev) => ({
        ...prev,
        requestUrl: err?.requestUrl || requestUrl,
        httpStatus: err?.httpStatus || null,
        responseBodyPreview: debugPreview,
        requestId: debugRequestId,
        timestamp: new Date().toISOString(),
      }));

      console.error("[QR] ❌ Generation failed", {
        request_url: err?.requestUrl || requestUrl,
        http_status: err?.httpStatus || null,
        request_id_header: err?.requestIdHeader || null,
        request_id: debugRequestId,
        response_body: err?.responseBody || null,
        message: err?.message,
        stack: err?.stack,
      });

      const userMessage = err?.message || (isFrench ? "Erreur lors de la génération du QR" : "Error generating QR code");
      setError(userMessage);
      setErrorDetail(err?.message || null);
      toast.error(isFrench ? "Erreur lors de la génération du code QR" : "Error generating QR code");
    } finally {
      setLoading(false);
    }
  }, [checkoutType, orderContext, checkoutFields, isFrench, userId]);

  // Generate QR once on first render (prevent request storms on object-prop re-renders)
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
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

          {/* Debug QR panel: visible for admin users or when ?debug=1 */}
          {showDebugPanel && (
            <Card className="bg-muted/30 border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Debug QR</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div><span className="font-medium">checkout_mode:</span> {debugState.checkoutMode}</div>
                  <div><span className="font-medium">auth_present:</span> {String(debugState.authPresent)}</div>
                  <div><span className="font-medium">hasSession:</span> {String(debugState.hasSession)}</div>
                  <div><span className="font-medium">tokenLength:</span> {debugState.tokenLength}</div>
                  <div className="md:col-span-2 break-all"><span className="font-medium">request_url:</span> {debugState.requestUrl || "-"}</div>
                  <div><span className="font-medium">HTTP status:</span> {debugState.httpStatus ?? "-"}</div>
                  <div className="break-all"><span className="font-medium">request_id:</span> {debugState.requestId || "-"}</div>
                  <div className="md:col-span-2 break-all"><span className="font-medium">response_body (300):</span> {debugState.responseBodyPreview || "-"}</div>
                  <div className="md:col-span-2"><span className="font-medium">timestamp:</span> {debugState.timestamp || "-"}</div>
                </div>

                <Button onClick={() => generateQR()} variant="outline" size="sm" disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Test Edge Function Now
                </Button>
              </CardContent>
            </Card>
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
