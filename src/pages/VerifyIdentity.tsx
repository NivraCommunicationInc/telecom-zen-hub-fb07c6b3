/**
 * Mobile Identity Verification Page (/verify-id)
 * Accessed via QR code scan from checkout.
 * SECURITY: Token validated via edge function (no direct DB access for anon).
 * 3-step flow: (1) Document type cards → (2) Capture recto/verso/selfie → (3) Confirmation.
 * Includes: 20-min timer, max 3 attempts, idempotency, mandatory selfie.
 */
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, Camera, Upload, CheckCircle2, XCircle, AlertCircle, Loader2,
  FileCheck, ArrowRight, ArrowLeft, Clock, BookOpen, CreditCard, IdCard, FileText, ScanFace,
} from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type DocOption = {
  value: string;
  label: string;
  description: string;
  Icon: any;
  needsBack: boolean;
  needsProvince: boolean;
};

const ID_TYPES: DocOption[] = [
  { value: "passport",        label: "Passeport canadien",          description: "Document de voyage officiel",         Icon: BookOpen,   needsBack: false, needsProvince: false },
  { value: "drivers_license", label: "Permis de conduire",          description: "Émis par votre province",             Icon: CreditCard, needsBack: false, needsProvince: true  },
  { value: "national_id",     label: "Carte d'identité provinciale", description: "Carte photo gouvernementale",         Icon: IdCard,     needsBack: true,  needsProvince: true  },
  { value: "residency_card",  label: "Carte de résident permanent", description: "Document fédéral d'immigration",      Icon: FileText,   needsBack: true,  needsProvince: false },
  { value: "other",           label: "Autre document gouvernemental", description: "Carte santé, certificat citoyenneté…", Icon: FileText,   needsBack: true,  needsProvince: false },
];

const PROVINCES = [
  { code: "QC", name: "Québec" },
  { code: "ON", name: "Ontario" },
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "Colombie-Britannique" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "Nouveau-Brunswick" },
  { code: "NL", name: "Terre-Neuve-et-Labrador" },
  { code: "NS", name: "Nouvelle-Écosse" },
  { code: "PE", name: "Île-du-Prince-Édouard" },
  { code: "SK", name: "Saskatchewan" },
];

type PageState = "loading" | "consent" | "step1_type" | "step2_capture" | "step3_confirm" | "submitting" | "success" | "error" | "expired";

const VerifyIdentityPage = () => {
  const [searchParams] = useSearchParams();
  const publicToken = (
    searchParams.get("t") ||
    searchParams.get("token") ||
    searchParams.get("public_token") ||
    ""
  ).trim() || null;

  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [confirmGiven, setConfirmGiven] = useState(false);
  const [idType, setIdType] = useState("");
  const [idProvince, setIdProvince] = useState("QC");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const selectedDoc = ID_TYPES.find((t) => t.value === idType);
  const needsBack = selectedDoc?.needsBack ?? true;
  const needsProvince = selectedDoc?.needsProvince ?? false;

  // Validate token via EDGE FUNCTION (no direct anon DB access)
  useEffect(() => {
    if (!publicToken) {
      setPageState("error");
      setErrorMessage("Lien de vérification invalide. Veuillez scanner le code QR depuis la caisse.");
      return;
    }

    const validateToken = async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-verification-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ public_token: publicToken }),
        });
        const data = await res.json();

        if (!res.ok || !data.valid) {
          setPageState("error");
          setErrorMessage("Lien de vérification invalide ou expiré.");
          return;
        }

        if (data.status === "expired") { setPageState("expired"); return; }

        if (data.submission_attempts >= (data.max_attempts || 3)) {
          setPageState("error");
          setErrorMessage("Nombre maximum de tentatives atteint. Veuillez régénérer un nouveau code QR.");
          return;
        }

        if (data.status === "submitted") { setPageState("success"); return; }

        if (data.status !== "created") {
          setPageState("error");
          setErrorMessage(`Cette session est déjà en statut: ${data.status}`);
          return;
        }

        setExpiresAt(new Date(data.expires_at));
        setPageState("consent");
      } catch (err) {
        console.error("Token validation error:", err);
        setPageState("error");
        setErrorMessage("Erreur de connexion. Veuillez réessayer.");
      }
    };

    validateToken();
  }, [publicToken]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("00:00");
        setPageState("expired");
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleFileSelect = (side: "front" | "back" | "selfie", file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop volumineux. Maximum 10 Mo.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
      toast.error("Format non supporté. Utilisez JPG, PNG ou WebP.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (side === "front") { setFrontFile(file); setFrontPreview(result); }
      else if (side === "back") { setBackFile(file); setBackPreview(result); }
      else { setSelfieFile(file); setSelfiePreview(result); }
    };
    reader.readAsDataURL(file);
  };

  const canGoToConfirm = !!frontFile && (!needsBack || !!backFile) && !!selfieFile && !!idType;

  const handleSubmit = async () => {
    if (!frontFile || !idType || !consentGiven || !publicToken || !selfieFile) {
      toast.error("Veuillez compléter tous les champs obligatoires.");
      return;
    }
    if (needsBack && !backFile) {
      toast.error("Le verso de la pièce est obligatoire pour ce type de document.");
      return;
    }
    if (!confirmGiven) {
      toast.error("Veuillez confirmer que les documents sont à vous.");
      return;
    }

    setPageState("submitting");

    try {
      const formData = new FormData();
      formData.append("public_token", publicToken);
      formData.append("id_type", idType);
      formData.append("id_province", idProvince);
      formData.append("consent", "true");
      formData.append("document_front", frontFile);
      if (backFile) formData.append("document_back", backFile);
      if (selfieFile) formData.append("selfie", selfieFile);
      formData.append("idempotency_key", idempotencyKeyRef.current);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-id-verification`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Submission failed");

      setPageState("success");
    } catch (err: any) {
      console.error("Submission error:", err);
      setPageState("step3_confirm");
      toast.error(err.message || "Erreur lors de la soumission. Veuillez réessayer.");
    }
  };

  const TimerBadge = () => (
    expiresAt && pageState !== "success" && pageState !== "error" ? (
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
        <Clock className="w-4 h-4" />
        <span className="text-sm font-mono font-bold">{timeLeft || "20:00"}</span>
        <span className="text-xs">restant</span>
      </div>
    ) : null
  );

  // ── Loading / terminal states ───────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-slate-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Validation du lien...</p>
        </div>
      </div>
    );
  }

  if (pageState === "expired") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Session expirée</h1>
            <p className="text-slate-600 text-sm">
              Ce lien de vérification a expiré (20 minutes). Veuillez retourner à la caisse et régénérer un nouveau code QR.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Erreur</h1>
            <p className="text-slate-600 text-sm">{errorMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === "success") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Documents soumis avec succès</h1>
            <p className="text-slate-600 text-sm mb-4">
              Vos documents ont été soumis pour vérification manuelle. Un administrateur les examinera sous peu.
            </p>
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-sm text-emerald-700 font-medium">
                ✓ Vos documents d'identité sont supprimés automatiquement après vérification. Nivra Telecom ne conserve aucune copie.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === "submitting") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-700 font-medium">Envoi de vos documents...</p>
          <p className="text-slate-500 text-sm mt-1">Veuillez ne pas fermer cette page.</p>
        </div>
      </div>
    );
  }

  // ── Step indicator ──────────────────────────────────────────────────
  const stepNum = pageState === "consent" ? 0
    : pageState === "step1_type" ? 1
    : pageState === "step2_capture" ? 2
    : pageState === "step3_confirm" ? 3 : 0;

  const StepIndicator = () => (
    stepNum > 0 ? (
      <div className="flex items-center justify-center gap-2 py-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              n < stepNum ? "bg-emerald-500 text-white" : n === stepNum ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"
            }`}>
              {n < stepNum ? <CheckCircle2 className="w-4 h-4" /> : n}
            </div>
            {n < 3 && <div className={`w-6 h-0.5 ${n < stepNum ? "bg-emerald-500" : "bg-slate-200"}`} />}
          </div>
        ))}
      </div>
    ) : null
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-slate-700" />
            <div>
              <h1 className="text-lg font-bold text-slate-900">Nivra — Vérification d'identité</h1>
              <p className="text-xs text-slate-500">Vérification sécurisée pour votre commande</p>
            </div>
          </div>
          <TimerBadge />
        </div>
        <div className="max-w-lg mx-auto"><StepIndicator /></div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* ── CONSENT ────────────────────────────────────────────────── */}
        {pageState === "consent" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Consentement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed">
                  En poursuivant, vous consentez à ce que Nivra collecte et vérifie votre pièce d'identité
                  gouvernementale avec photo aux fins de validation de votre identité. Aucune vérification
                  de crédit ne sera effectuée. Vos documents d'identité sont supprimés automatiquement
                  après vérification de votre identité. Nivra Telecom ne conserve aucune copie de vos
                  pièces d'identité.
                </p>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800 font-medium flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    Ce QR expire dans {timeLeft || "20:00"}. Complétez la vérification avant l'expiration.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox id="consent" checked={consentGiven} onCheckedChange={(v) => setConsentGiven(!!v)} />
                  <label htmlFor="consent" className="text-sm text-slate-700 cursor-pointer">
                    J'accepte que mes documents d'identité soient collectés et vérifiés par Nivra conformément
                    à la politique de confidentialité.
                  </label>
                </div>
              </CardContent>
            </Card>
            <Button
              className="w-full bg-slate-900 hover:bg-slate-800 text-white"
              disabled={!consentGiven}
              onClick={() => setPageState("step1_type")}
            >
              Continuer <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </>
        )}

        {/* ── STEP 1 — DOC TYPE ─────────────────────────────────────── */}
        {pageState === "step1_type" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">1. Choisissez votre type de pièce d'identité</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ID_TYPES.map((opt) => {
                  const Icon = opt.Icon;
                  const selected = idType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setIdType(opt.value)}
                      className={`w-full text-left rounded-xl border-2 transition-all p-4 flex items-center gap-3 min-h-[64px] ${
                        selected
                          ? "border-slate-900 bg-slate-900 text-white shadow-md"
                          : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                        selected ? "bg-white/15" : "bg-slate-100"
                      }`}>
                        <Icon className={`w-6 h-6 ${selected ? "text-white" : "text-slate-700"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${selected ? "text-white" : "text-slate-900"}`}>{opt.label}</p>
                        <p className={`text-xs mt-0.5 ${selected ? "text-white/80" : "text-slate-500"}`}>{opt.description}</p>
                      </div>
                      {selected && <CheckCircle2 className="w-5 h-5 text-white shrink-0" />}
                    </button>
                  );
                })}

                {idType && needsProvince && (
                  <div className="space-y-2 pt-2">
                    <Label>Province d'émission *</Label>
                    <Select value={idProvince} onValueChange={setIdProvince}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROVINCES.map((p) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPageState("consent")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Retour
              </Button>
              <Button
                className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white"
                disabled={!idType}
                onClick={() => setPageState("step2_capture")}
              >
                Continuer <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}

        {/* ── STEP 2 — CAPTURE ──────────────────────────────────────── */}
        {pageState === "step2_capture" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Recto du document *
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-3">Prenez une photo du recto de votre {selectedDoc?.label.toLowerCase()}.</p>
                {frontPreview ? (
                  <div className="space-y-3">
                    <img src={frontPreview} alt="Recto" className="w-full rounded-lg border border-slate-200" />
                    <Button variant="outline" size="sm" onClick={() => { setFrontFile(null); setFrontPreview(null); }}>
                      Reprendre la photo
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-8 cursor-pointer hover:border-slate-400 transition-colors min-h-[140px]">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-sm text-slate-700 font-medium">Prendre une photo ou choisir un fichier</span>
                    <span className="text-xs text-slate-400 mt-1">JPG, PNG — max 10 Mo</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => handleFileSelect("front", e.target.files?.[0] || null)} />
                  </label>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Verso du document {needsBack ? "*" : "(non requis)"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!needsBack ? (
                  <p className="text-sm text-slate-500 text-center py-4">Non requis pour ce type de document.</p>
                ) : backPreview ? (
                  <div className="space-y-3">
                    <img src={backPreview} alt="Verso" className="w-full rounded-lg border border-slate-200" />
                    <Button variant="outline" size="sm" onClick={() => { setBackFile(null); setBackPreview(null); }}>
                      Reprendre la photo
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-6 cursor-pointer hover:border-slate-400 transition-colors min-h-[120px]">
                    <Upload className="w-7 h-7 text-slate-400 mb-2" />
                    <span className="text-sm text-slate-700 font-medium">Prendre une photo du verso</span>
                    <span className="text-xs text-slate-400 mt-1">JPG, PNG — max 10 Mo</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => handleFileSelect("back", e.target.files?.[0] || null)} />
                  </label>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ScanFace className="w-4 h-4" /> Selfie avec votre document *
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-600 mb-3">
                  Prenez un selfie en tenant votre document d'identité visible <strong>à côté de votre visage</strong>. Cela confirme que c'est bien vous sur la photo.
                </p>
                {selfiePreview ? (
                  <div className="space-y-3">
                    <img src={selfiePreview} alt="Selfie" className="w-full rounded-lg border border-slate-200" />
                    <Button variant="outline" size="sm" onClick={() => { setSelfieFile(null); setSelfiePreview(null); }}>
                      Reprendre le selfie
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-6 cursor-pointer hover:border-slate-400 transition-colors min-h-[120px]">
                    <ScanFace className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-sm text-slate-700 font-medium">Prendre un selfie</span>
                    <span className="text-xs text-slate-400 mt-1">Caméra avant — visage + document visible</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="hidden" onChange={(e) => handleFileSelect("selfie", e.target.files?.[0] || null)} />
                  </label>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPageState("step1_type")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Retour
              </Button>
              <Button
                className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white py-6 text-base"
                disabled={!canGoToConfirm}
                onClick={() => setPageState("step3_confirm")}
              >
                Vérifier mes photos <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </>
        )}

        {/* ── STEP 3 — CONFIRM ─────────────────────────────────────── */}
        {pageState === "step3_confirm" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">3. Vérifiez vos documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-600">Confirmez que les photos sont bien lisibles et complètes avant de soumettre.</p>

                <div className="grid grid-cols-3 gap-2">
                  {frontPreview && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Recto</p>
                      <img src={frontPreview} alt="Recto" className="w-full aspect-square object-cover rounded-lg border border-slate-200" />
                    </div>
                  )}
                  {backPreview && needsBack && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Verso</p>
                      <img src={backPreview} alt="Verso" className="w-full aspect-square object-cover rounded-lg border border-slate-200" />
                    </div>
                  )}
                  {selfiePreview && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Selfie</p>
                      <img src={selfiePreview} alt="Selfie" className="w-full aspect-square object-cover rounded-lg border border-slate-200" />
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-slate-500">Type de document</span><span className="text-slate-900 font-medium">{selectedDoc?.label}</span></div>
                  {needsProvince && <div className="flex justify-between"><span className="text-slate-500">Province</span><span className="text-slate-900 font-medium">{idProvince}</span></div>}
                </div>

                <div className="flex items-start gap-3 pt-2">
                  <Checkbox id="confirm" checked={confirmGiven} onCheckedChange={(v) => setConfirmGiven(!!v)} />
                  <label htmlFor="confirm" className="text-sm text-slate-700 cursor-pointer">
                    Je confirme que ces documents sont les miens, qu'ils sont valides, et que les photos sont lisibles.
                  </label>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPageState("step2_capture")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Modifier
              </Button>
              <Button
                className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-base"
                disabled={!confirmGiven}
                onClick={handleSubmit}
              >
                <FileCheck className="w-5 h-5 mr-2" /> Soumettre mes documents
              </Button>
            </div>

            <div className="flex items-center gap-2 justify-center text-xs text-slate-400">
              <Shield className="w-3 h-3" />
              Documents supprimés après vérification — aucune copie conservée
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyIdentityPage;
