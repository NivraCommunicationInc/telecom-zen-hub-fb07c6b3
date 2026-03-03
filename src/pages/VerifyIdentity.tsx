/**
 * Mobile Identity Verification Page (/verify-id)
 * Accessed via QR code scan from checkout.
 * Validates token, shows consent, allows ID document upload, submits.
 */
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Camera, Upload, CheckCircle2, XCircle, AlertCircle, Loader2, FileCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const ID_TYPES = [
  { value: "drivers_license", label: "Permis de conduire" },
  { value: "health_card", label: "Carte d'assurance maladie" },
  { value: "passport", label: "Passeport" },
  { value: "residency_card", label: "Carte de résident permanent" },
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

type PageState = "loading" | "consent" | "capture" | "submitting" | "success" | "error" | "expired";

const VerifyIdentityPage = () => {
  const [searchParams] = useSearchParams();
  const publicToken = searchParams.get("t");

  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [idType, setIdType] = useState("");
  const [idProvince, setIdProvince] = useState("QC");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);

  const idempotencyKeyRef = useRef(crypto.randomUUID());

  // Validate token on mount
  useEffect(() => {
    if (!publicToken) {
      setPageState("error");
      setErrorMessage("Lien de vérification invalide. Veuillez scanner le code QR depuis la caisse.");
      return;
    }

    const validateToken = async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/identity_verification_sessions?public_token=eq.${publicToken}&select=id,status,expires_at`, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });
        const data = await res.json();
        
        if (!data || data.length === 0) {
          setPageState("error");
          setErrorMessage("Lien de vérification invalide ou expiré.");
          return;
        }

        const session = data[0];
        
        if (new Date(session.expires_at) < new Date()) {
          setPageState("expired");
          return;
        }

        if (session.status === "submitted") {
          setPageState("success");
          return;
        }

        if (session.status !== "created") {
          setPageState("error");
          setErrorMessage(`Cette session est déjà en statut: ${session.status}`);
          return;
        }

        setPageState("consent");
      } catch (err) {
        console.error("Token validation error:", err);
        setPageState("error");
        setErrorMessage("Erreur de connexion. Veuillez réessayer.");
      }
    };

    validateToken();
  }, [publicToken]);

  const handleFileSelect = (side: "front" | "back", file: File | null) => {
    if (!file) return;
    
    // Validate file
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop volumineux. Maximum 10 Mo.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/heic"].includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic)$/i)) {
      toast.error("Format non supporté. Utilisez JPG, PNG ou WebP.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (side === "front") {
        setFrontFile(file);
        setFrontPreview(e.target?.result as string);
      } else {
        setBackFile(file);
        setBackPreview(e.target?.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!frontFile || !idType || !consentGiven || !publicToken) {
      toast.error("Veuillez compléter tous les champs obligatoires.");
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

      if (!res.ok) {
        throw new Error(result.error || "Submission failed");
      }

      setPageState("success");
    } catch (err: any) {
      console.error("Submission error:", err);
      setPageState("capture");
      toast.error(err.message || "Erreur lors de la soumission. Veuillez réessayer.");
    }
  };

  // Loading state
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

  // Expired state
  if (pageState === "expired") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Session expirée</h1>
            <p className="text-slate-600 text-sm">
              Ce lien de vérification a expiré. Veuillez retourner à la caisse et régénérer un nouveau code QR.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
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

  // Success state
  if (pageState === "success") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Documents soumis avec succès</h1>
            <p className="text-slate-600 text-sm mb-4">
              Vos documents ont été soumis pour vérification. Vous pouvez retourner à la caisse sur votre ordinateur.
            </p>
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-sm text-emerald-700 font-medium">
                ✓ La page de caisse se mettra à jour automatiquement.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submitting state
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Shield className="w-6 h-6 text-slate-700" />
          <div>
            <h1 className="text-lg font-bold text-slate-900">Nivra — Vérification d'identité</h1>
            <p className="text-xs text-slate-500">Vérification sécurisée pour votre commande</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Consent step */}
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
                  de crédit ne sera effectuée. Vos documents seront traités de manière confidentielle et
                  ne seront conservés que pour la durée requise par la loi.
                </p>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="consent"
                    checked={consentGiven}
                    onCheckedChange={(v) => setConsentGiven(!!v)}
                  />
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
              onClick={() => setPageState("capture")}
            >
              Continuer <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </>
        )}

        {/* Capture step */}
        {pageState === "capture" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Type de pièce d'identité</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Type de pièce *</Label>
                  <Select value={idType} onValueChange={setIdType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ID_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Province d'émission *</Label>
                  <Select value={idProvince} onValueChange={setIdProvince}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map((p) => (
                        <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Front of ID */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Recto de la pièce d'identité *
                </CardTitle>
              </CardHeader>
              <CardContent>
                {frontPreview ? (
                  <div className="space-y-3">
                    <img src={frontPreview} alt="Recto" className="w-full rounded-lg border border-slate-200" />
                    <Button variant="outline" size="sm" onClick={() => { setFrontFile(null); setFrontPreview(null); }}>
                      Reprendre la photo
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-8 cursor-pointer hover:border-slate-400 transition-colors">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-sm text-slate-600 font-medium">Prendre une photo ou choisir un fichier</span>
                    <span className="text-xs text-slate-400 mt-1">JPG, PNG — max 10 Mo</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleFileSelect("front", e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </CardContent>
            </Card>

            {/* Back of ID (optional) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Verso de la pièce d'identité (optionnel)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {backPreview ? (
                  <div className="space-y-3">
                    <img src={backPreview} alt="Verso" className="w-full rounded-lg border border-slate-200" />
                    <Button variant="outline" size="sm" onClick={() => { setBackFile(null); setBackPreview(null); }}>
                      Reprendre la photo
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-6 cursor-pointer hover:border-slate-400 transition-colors">
                    <Upload className="w-6 h-6 text-slate-400 mb-2" />
                    <span className="text-sm text-slate-600">Ajouter le verso</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleFileSelect("back", e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </CardContent>
            </Card>

            {/* Submit */}
            <Button
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-6 text-base"
              disabled={!frontFile || !idType}
              onClick={handleSubmit}
            >
              <FileCheck className="w-5 h-5 mr-2" />
              Soumettre mes documents
            </Button>

            {/* Security notice */}
            <div className="flex items-center gap-2 justify-center text-xs text-slate-400">
              <Shield className="w-3 h-3" />
              Chiffrement 256 bits — Vos données sont protégées
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyIdentityPage;
