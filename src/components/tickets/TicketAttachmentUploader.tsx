import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, X, FileText, Image, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { backendClient } from "@/integrations/backend/client";
import { cn } from "@/lib/utils";

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  url?: string;
}

interface TicketAttachmentUploaderProps {
  ticketId: string;
  uploaderId: string;
  onFilesUploaded: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  disabled?: boolean;
  className?: string;
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const TicketAttachmentUploader: React.FC<TicketAttachmentUploaderProps> = ({
  ticketId,
  uploaderId,
  onFilesUploaded,
  maxFiles = 5,
  maxSizeMB = 50,
  disabled = false,
  className,
}) => {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: File[] = [];

    for (const file of Array.from(files)) {
      // Validate type
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({
          title: "Type de fichier non supporté",
          description: `${file.name}: Formats acceptés: JPG, PNG, HEIC, WEBP, PDF, DOC, DOCX`,
          variant: "destructive",
        });
        continue;
      }

      // Validate size
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: `${file.name}: Taille max ${maxSizeMB} Mo`,
          variant: "destructive",
        });
        continue;
      }

      // Check max files
      if (pendingFiles.length + newFiles.length >= maxFiles) {
        toast({
          title: "Limite atteinte",
          description: `Maximum ${maxFiles} fichiers`,
          variant: "destructive",
        });
        break;
      }

      newFiles.push(file);
    }

    setPendingFiles((prev) => [...prev, ...newFiles]);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (): Promise<UploadedFile[]> => {
    if (pendingFiles.length === 0) return [];

    setIsUploading(true);
    const uploaded: UploadedFile[] = [];

    try {
      for (const file of pendingFiles) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${ticketId}/${uploaderId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data, error } = await backendClient.storage
          .from("ticket-attachments")
          .upload(fileName, file, {
            contentType: file.type,
            upsert: false,
          });

        if (error) {
          console.error("[TicketAttachmentUploader] Upload error:", error);
          toast({
            title: "Erreur d'upload",
            description: `${file.name}: ${error.message}`,
            variant: "destructive",
          });
          continue;
        }

        // Get public URL
        const { data: urlData } = backendClient.storage
          .from("ticket-attachments")
          .getPublicUrl(data.path);

        uploaded.push({
          id: data.id || data.path,
          name: file.name,
          size: file.size,
          type: file.type,
          path: data.path,
          url: urlData?.publicUrl,
        });
      }

      if (uploaded.length > 0) {
        onFilesUploaded(uploaded);
        setPendingFiles([]);
        toast({
          title: "Fichiers uploadés",
          description: `${uploaded.length} fichier(s) ajouté(s)`,
        });
      }

      return uploaded;
    } catch (err) {
      console.error("[TicketAttachmentUploader] Error:", err);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'upload",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) {
      return <Image className="h-4 w-4 text-blue-500" />;
    }
    return <FileText className="h-4 w-4 text-orange-500" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* File input */}
      <div className="flex items-center gap-2">
        <Input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          multiple
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
          className="hidden"
          id={`file-upload-${ticketId}`}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isUploading || pendingFiles.length >= maxFiles}
          onClick={() => fileInputRef.current?.click()}
          className="gap-2"
        >
          <Paperclip className="h-4 w-4" />
          Joindre fichier
        </Button>
        <span className="text-xs text-muted-foreground">
          Max {maxSizeMB} Mo • JPG, PNG, PDF, DOC
        </span>
      </div>

      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted border text-sm"
            >
              {getFileIcon(file.type)}
              <span className="max-w-[150px] truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                ({formatSize(file.size)})
              </span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="text-muted-foreground hover:text-destructive"
                disabled={isUploading}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {pendingFiles.length > 0 && (
        <Button
          type="button"
          size="sm"
          onClick={uploadFiles}
          disabled={isUploading}
          className="gap-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Upload en cours...
            </>
          ) : (
            `Uploader ${pendingFiles.length} fichier(s)`
          )}
        </Button>
      )}
    </div>
  );
};

export default TicketAttachmentUploader;
