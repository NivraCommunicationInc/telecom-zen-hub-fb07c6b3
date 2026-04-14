/**
 * Secure Storage Upload Utility
 *
 * Validates file type and size before uploading, and enforces
 * user-scoped folder paths to align with RLS policies.
 */
import { supabase } from "@/integrations/supabase/client";

const ALLOWED_TYPES = {
  documents: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
  images: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ],
  identity: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
  ],
} as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export type FileCategory = keyof typeof ALLOWED_TYPES;

interface SecureUploadResult {
  path: string;
  error: Error | null;
}

/**
 * Upload a file to a storage bucket with validation.
 * Files are always stored under `{userId}/{safeName}` to match RLS path policies.
 *
 * @param bucket   - Storage bucket name (e.g. "id-documents", "client-documents")
 * @param file     - The File object to upload
 * @param category - Validation category for allowed MIME types
 * @param subPath  - Optional sub-folder between userId and filename (e.g. a ticket ID)
 */
export async function secureUpload(
  bucket: string,
  file: File,
  category: FileCategory = "documents",
  subPath?: string,
): Promise<SecureUploadResult> {
  // Validate file type
  const allowed = ALLOWED_TYPES[category] as readonly string[];
  if (!allowed.includes(file.type)) {
    return {
      path: "",
      error: new Error(`Type de fichier non autorisé : ${file.type}`),
    };
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      path: "",
      error: new Error("Fichier trop volumineux (max 10 Mo)"),
    };
  }

  // Ensure authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { path: "", error: new Error("Non authentifié") };
  }

  // Build safe filename — strip special chars
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const segments = [user.id, subPath, safeName].filter(Boolean);
  const path = segments.join("/");

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  return { path, error: error ? new Error(error.message) : null };
}
