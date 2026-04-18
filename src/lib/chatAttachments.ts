/**
 * Chat attachments helper — private bucket + signed URLs.
 * Used by both the visitor widget (NivraChat) and the admin live-chat page.
 */
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "chat-attachments";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];
const SIGNED_TTL = 60 * 60; // 1 hour

export interface UploadedAttachment {
  path: string;
  url: string;
  name: string;
  type: string;
  size: number;
}

export function isImageType(type?: string | null) {
  return !!type && type.startsWith("image/");
}

export function isPdfType(type?: string | null) {
  return type === "application/pdf";
}

export function validateChatFile(file: File): { ok: boolean; error?: string } {
  if (!ALLOWED.includes(file.type)) {
    return { ok: false, error: "Format non supporté (image ou PDF uniquement)" };
  }
  if (file.size > MAX_SIZE) {
    return { ok: false, error: "Fichier trop volumineux (max 10 Mo)" };
  }
  return { ok: true };
}

export async function uploadChatAttachment(
  sessionId: string,
  uploader: "visitor" | "admin",
  file: File,
): Promise<UploadedAttachment | null> {
  const v = validateChatFile(file);
  if (!v.ok) {
    console.warn("[chatAttachments] invalid file:", v.error);
    return null;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${sessionId}/${uploader}/${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) {
    console.error("[chatAttachments] upload error:", error);
    return null;
  }
  const url = await getChatAttachmentSignedUrl(path);
  if (!url) return null;
  return { path, url, name: file.name, type: file.type, size: file.size };
}

export async function getChatAttachmentSignedUrl(
  path: string,
  ttlSeconds = SIGNED_TTL,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) {
    console.error("[chatAttachments] signed url error:", error);
    return null;
  }
  return data.signedUrl;
}
