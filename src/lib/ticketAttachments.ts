/**
 * Ticket Attachments - Secure signed URL helper
 * 
 * SECURITY: All ticket attachments use signed URLs with short expiry.
 * Never use getPublicUrl() for ticket attachments.
 */

import { backendClient } from "@/integrations/backend/client";

const BUCKET_NAME = "ticket-attachments";
const SIGNED_URL_EXPIRY_SECONDS = 600; // 10 minutes

interface SignedUrlResult {
  url: string;
  expiresAt: Date;
}

/**
 * Get a signed URL for a ticket attachment
 * @param path - The storage path (e.g., "ticketId/userId/filename.jpg")
 * @param expirySeconds - URL expiry in seconds (default: 10 minutes)
 */
export async function getTicketAttachmentSignedUrl(
  path: string,
  expirySeconds: number = SIGNED_URL_EXPIRY_SECONDS
): Promise<SignedUrlResult | null> {
  try {
    const { data, error } = await backendClient.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expirySeconds);

    if (error || !data?.signedUrl) {
      console.error("[getTicketAttachmentSignedUrl] Error:", error);
      return null;
    }

    return {
      url: data.signedUrl,
      expiresAt: new Date(Date.now() + expirySeconds * 1000),
    };
  } catch (err) {
    console.error("[getTicketAttachmentSignedUrl] Exception:", err);
    return null;
  }
}

/**
 * Get signed URLs for multiple attachments
 */
export async function getTicketAttachmentSignedUrls(
  paths: string[],
  expirySeconds: number = SIGNED_URL_EXPIRY_SECONDS
): Promise<Map<string, SignedUrlResult>> {
  const results = new Map<string, SignedUrlResult>();

  // Process in parallel for efficiency
  const promises = paths.map(async (path) => {
    const result = await getTicketAttachmentSignedUrl(path, expirySeconds);
    if (result) {
      results.set(path, result);
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Check if a signed URL is expired or about to expire
 */
export function isSignedUrlExpired(expiresAt: Date, bufferSeconds: number = 60): boolean {
  const now = new Date();
  const buffer = bufferSeconds * 1000;
  return expiresAt.getTime() - buffer <= now.getTime();
}

/**
 * Upload a file to ticket attachments bucket
 * Returns the storage path (not a public URL)
 */
export async function uploadTicketAttachment(
  ticketId: string,
  uploaderId: string,
  file: File
): Promise<{ path: string; name: string; size: number; type: string } | null> {
  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `${ticketId}/${uploaderId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data, error } = await backendClient.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("[uploadTicketAttachment] Upload error:", error);
      return null;
    }

    return {
      path: data.path,
      name: file.name,
      size: file.size,
      type: file.type,
    };
  } catch (err) {
    console.error("[uploadTicketAttachment] Exception:", err);
    return null;
  }
}
