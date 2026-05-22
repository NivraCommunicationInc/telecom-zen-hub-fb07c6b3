/**
 * PhotoCapture — Mobile-first photo capture for installation steps.
 * Uses native camera on mobile via capture="environment".
 * Uploads to Supabase Storage bucket `complaint-attachments` under `tech-photos/` prefix.
 */
import React, { useRef, useState } from "react";
import { Camera, X, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PhotoCaptureProps {
  onCapture: (url: string) => void;
  label?: string;
  stepId?: string;
}

export default function PhotoCapture({ onCapture, label = "Prendre une photo", stepId = "default" }: PhotoCaptureProps) {
  const inputId = `photo-capture-${stepId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);
    setUploadedUrl(null);

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `tech-photos/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from("complaint-attachments")
        .upload(fileName, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });
      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("complaint-attachments")
        .getPublicUrl(fileName);

      setUploadedUrl(urlData.publicUrl);
      onCapture(urlData.publicUrl);
      toast.success("Photo enregistrée ✅");
    } catch (err: any) {
      toast.error("Erreur de téléversement: " + (err?.message ?? "inconnue"));
      setPreview(null);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const reset = () => {
    setPreview(null);
    setUploadedUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full min-h-[56px] rounded-2xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
        {uploading ? "Envoi en cours..." : label}
      </button>
      {preview && (
        <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950">
          <img src={preview} alt="Aperçu" className="w-full h-48 object-cover" />
          <div className="absolute top-2 right-2 flex gap-2">
            {uploadedUrl && (
              <span className="rounded-full bg-emerald-600 text-white p-1.5" aria-label="Téléversée">
                <Check className="h-4 w-4" />
              </span>
            )}
            <button
              type="button"
              onClick={reset}
              className="rounded-full bg-slate-900/90 text-white p-1.5"
              aria-label="Retirer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
