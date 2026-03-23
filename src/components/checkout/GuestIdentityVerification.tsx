/**
 * GuestIdentityVerification — Identity verification for guest checkout
 * Collects identity document info without requiring authentication.
 * Data is stored in component state and passed to order submission.
 * 
 * Supports:
 * - Document type selection (Permis, Passeport, Carte PR)
 * - Document number, expiration, province
 * - Photo upload (camera + file)
 * - Streaming-only bypass
 */
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, Camera, Upload, CheckCircle2, AlertCircle, FileText, X, Loader2,
} from "lucide-react";

export type DocumentType = "drivers_license" | "passport" | "pr_card";

export interface GuestIdentityData {
  documentType: DocumentType;
  documentNumber: string;
  expirationDate: string;
  issuingProvince: string;
  frontPhoto: File | null;
  backPhoto: File | null;
  status: "not_started" | "incomplete" | "complete";
}

interface GuestIdentityVerificationProps {
  identityData: GuestIdentityData;
  onIdentityChange: (data: GuestIdentityData) => void;
  isStreamingOnly: boolean;
}

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: "drivers_license", label: "Permis de conduire" },
  { value: "passport", label: "Passeport" },
  { value: "pr_card", label: "Carte de résident permanent" },
];

const PROVINCES = [
  "QC", "ON", "BC", "AB", "MB", "SK", "NS", "NB", "NL", "PE", "NT", "YT", "NU",
];

const computeStatus = (data: Omit<GuestIdentityData, "status">): GuestIdentityData["status"] => {
  if (!data.documentType || !data.documentNumber || !data.expirationDate || !data.frontPhoto) {
    if (!data.documentType && !data.documentNumber && !data.frontPhoto) return "not_started";
    return "incomplete";
  }
  if (data.documentType === "drivers_license" && !data.issuingProvince) return "incomplete";
  return "complete";
};

export const GuestIdentityVerification = ({
  identityData,
  onIdentityChange,
  isStreamingOnly,
}: GuestIdentityVerificationProps) => {
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);

  if (isStreamingOnly) {
    return (
      <Card className="bg-emerald-500/10 border-emerald-500/30">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground text-sm">Vérification non requise</p>
              <p className="text-xs text-muted-foreground">
                Les services Streaming+ ne nécessitent pas de vérification d'identité.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const update = (partial: Partial<Omit<GuestIdentityData, "status">>) => {
    const merged = { ...identityData, ...partial };
    onIdentityChange({ ...merged, status: computeStatus(merged) });
  };

  const handleFileSelect = (side: "front" | "back", file: File | null) => {
    if (!file) return;
    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return;
    }
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      return;
    }

    const preview = URL.createObjectURL(file);
    if (side === "front") {
      setFrontPreview(preview);
      update({ frontPhoto: file });
    } else {
      setBackPreview(preview);
      update({ backPhoto: file });
    }
  };

  const removeFile = (side: "front" | "back") => {
    if (side === "front") {
      setFrontPreview(null);
      update({ frontPhoto: null });
    } else {
      setBackPreview(null);
      update({ backPhoto: null });
    }
  };

  const statusColor = identityData.status === "complete" 
    ? "text-emerald-600" 
    : identityData.status === "incomplete" 
      ? "text-amber-500" 
      : "text-muted-foreground";

  const statusLabel = identityData.status === "complete"
    ? "Documents complétés"
    : identityData.status === "incomplete"
      ? "Documents incomplets"
      : "Non commencé";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-base">
            <Shield className="w-5 h-5 text-primary" />
            Vérification d'identité
          </div>
          <Badge variant="outline" className={`text-xs ${statusColor}`}>
            {statusLabel}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Requis pour sécuriser votre compte — vos documents sont supprimés immédiatement après validation.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Document type */}
        <div>
          <Label>Type de pièce d'identité *</Label>
          <Select
            value={identityData.documentType || ""}
            onValueChange={(v) => update({ documentType: v as DocumentType })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionnez un type de document" />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(dt => (
                <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Document number */}
        <div>
          <Label>Numéro du document *</Label>
          <Input
            placeholder="Ex: T1234-56789-01"
            value={identityData.documentNumber}
            onChange={e => update({ documentNumber: e.target.value })}
          />
        </div>

        {/* Expiration date */}
        <div>
          <Label>Date d'expiration *</Label>
          <Input
            type="date"
            value={identityData.expirationDate}
            onChange={e => update({ expirationDate: e.target.value })}
            min={new Date().toISOString().split("T")[0]}
          />
        </div>

        {/* Issuing province (for drivers license) */}
        {identityData.documentType === "drivers_license" && (
          <div>
            <Label>Province d'émission *</Label>
            <Select
              value={identityData.issuingProvince}
              onValueChange={v => update({ issuingProvince: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Province" />
              </SelectTrigger>
              <SelectContent>
                {PROVINCES.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Photo upload */}
        <div className="space-y-3">
          <Label className="flex items-center gap-1.5">
            <Camera className="w-4 h-4" />
            Photos du document *
          </Label>

          {/* Front */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Recto (avant) *</p>
            {frontPreview ? (
              <div className="relative inline-block">
                <img src={frontPreview} alt="Recto" className="h-24 rounded-lg border border-border object-cover" />
                <button
                  onClick={() => removeFile("front")}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => frontInputRef.current?.click()}
                className="w-full h-20 border-2 border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                <Upload className="w-4 h-4" />
                Prendre une photo ou téléverser
              </button>
            )}
            <input
              ref={frontInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => handleFileSelect("front", e.target.files?.[0] || null)}
            />
          </div>

          {/* Back (optional for passport) */}
          {identityData.documentType !== "passport" && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Verso (arrière) — optionnel</p>
              {backPreview ? (
                <div className="relative inline-block">
                  <img src={backPreview} alt="Verso" className="h-24 rounded-lg border border-border object-cover" />
                  <button
                    onClick={() => removeFile("back")}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => backInputRef.current?.click()}
                  className="w-full h-20 border-2 border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Verso du document (optionnel)
                </button>
              )}
              <input
                ref={backInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => handleFileSelect("back", e.target.files?.[0] || null)}
              />
            </div>
          )}
        </div>

        {/* Info notice */}
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
          <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Vos documents d'identité sont traités de façon sécurisée et supprimés immédiatement après la validation de votre commande. Aucune copie n'est conservée.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export const createEmptyIdentityData = (): GuestIdentityData => ({
  documentType: "" as DocumentType,
  documentNumber: "",
  expirationDate: "",
  issuingProvince: "QC",
  frontPhoto: null,
  backPhoto: null,
  status: "not_started",
});

export default GuestIdentityVerification;
