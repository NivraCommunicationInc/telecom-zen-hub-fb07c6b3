/**
 * PhotoCapture - Camera/file upload for field sales documents
 * Captures ID photos, location photos, and other documents
 */
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Upload, X, Check, Image, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PhotoCaptureProps {
  label: string;
  description?: string;
  required?: boolean;
  onUpload: (url: string) => void;
  currentUrl?: string | null;
  folder?: string;
}

export function PhotoCapture({ 
  label, 
  description, 
  required = false, 
  onUpload, 
  currentUrl,
  folder = "field-sales-photos"
}: PhotoCaptureProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image doit faire moins de 5 Mo");
      return;
    }

    setUploading(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("client-documents")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from("client-documents")
        .getPublicUrl(data.path);

      onUpload(publicUrl.publicUrl);
      toast.success("Photo téléchargée");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Erreur lors du téléchargement");
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const clearPhoto = () => {
    setPreviewUrl(null);
    onUpload("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <Card className={cn(
      "border transition-colors",
      previewUrl ? "border-emerald-500/50 bg-emerald-500/5" : "border-slate-700/50 bg-slate-900/40"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="font-medium text-white text-sm">
              {label}
              {required && <span className="text-red-400 ml-1">*</span>}
            </h4>
            {description && (
              <p className="text-xs text-slate-500">{description}</p>
            )}
          </div>
          {previewUrl && (
            <Check className="h-5 w-5 text-emerald-400" />
          )}
        </div>

        {previewUrl ? (
          <div className="relative">
            <img
              src={previewUrl}
              alt={label}
              className="w-full h-32 object-cover rounded-lg"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={clearPhoto}
              className="absolute top-2 right-2 h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            {/* Camera capture */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 border-slate-600 text-slate-300"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              Caméra
            </Button>

            {/* File upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 border-slate-600 text-slate-300"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Fichier
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
