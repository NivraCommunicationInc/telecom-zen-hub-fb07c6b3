import React, { useState, useEffect, useCallback } from "react";
import { FileText, Image, Download, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTicketAttachmentSignedUrl, isSignedUrlExpired } from "@/lib/ticketAttachments";

interface AttachmentFile {
  id?: string;
  name: string;
  size?: number;
  type: string;
  path: string;
}

interface SignedUrlCache {
  url: string;
  expiresAt: Date;
}

interface TicketAttachmentDisplayProps {
  attachments: AttachmentFile[];
  className?: string;
}

export const TicketAttachmentDisplay: React.FC<TicketAttachmentDisplayProps> = ({
  attachments,
  className,
}) => {
  const [signedUrls, setSignedUrls] = useState<Map<string, SignedUrlCache>>(new Map());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  // Fetch signed URL for a single attachment
  const fetchSignedUrl = useCallback(async (path: string) => {
    if (loadingPaths.has(path)) return;

    // Check if we have a valid cached URL
    const cached = signedUrls.get(path);
    if (cached && !isSignedUrlExpired(cached.expiresAt)) {
      return;
    }

    setLoadingPaths((prev) => new Set(prev).add(path));

    try {
      const result = await getTicketAttachmentSignedUrl(path);
      if (result) {
        setSignedUrls((prev) => {
          const newMap = new Map(prev);
          newMap.set(path, result);
          return newMap;
        });
      }
    } catch (err) {
      console.error("[TicketAttachmentDisplay] Error fetching signed URL:", err);
    } finally {
      setLoadingPaths((prev) => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
      });
    }
  }, [signedUrls, loadingPaths]);

  // Fetch signed URLs for all attachments on mount
  useEffect(() => {
    if (!attachments || attachments.length === 0) return;

    attachments.forEach((att) => {
      if (att.path) {
        fetchSignedUrl(att.path);
      }
    });
  }, [attachments, fetchSignedUrl]);

  if (!attachments || attachments.length === 0) return null;

  const getFileIcon = (type: string) => {
    if (type?.startsWith("image/")) {
      return <Image className="h-4 w-4 text-blue-500" />;
    }
    return <FileText className="h-4 w-4 text-orange-500" />;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const isImage = (type: string) => type?.startsWith("image/");

  const getUrl = (path: string): string | null => {
    const cached = signedUrls.get(path);
    if (cached && !isSignedUrlExpired(cached.expiresAt)) {
      return cached.url;
    }
    return null;
  };

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground">
        Pièces jointes ({attachments.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {attachments.map((file, index) => {
          const url = getUrl(file.path);
          const isLoading = loadingPaths.has(file.path);

          return (
            <div
              key={file.id || `${file.name}-${index}`}
              className="group relative"
            >
              {isLoading ? (
                // Loading state
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground max-w-[100px] truncate">
                    {file.name}
                  </span>
                </div>
              ) : url ? (
                // Has valid URL
                isImage(file.type) ? (
                  // Image preview
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border bg-muted">
                      <img
                        src={url}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // If image fails to load (expired URL), refresh
                          fetchSignedUrl(file.path);
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ExternalLink className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 max-w-20 truncate">
                      {file.name}
                    </p>
                  </a>
                ) : (
                  // Document preview
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={file.name}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                  >
                    {getFileIcon(file.type)}
                    <div className="flex flex-col">
                      <span className="text-sm max-w-[120px] truncate">
                        {file.name}
                      </span>
                      {file.size && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatSize(file.size)}
                        </span>
                      )}
                    </div>
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </a>
                )
              ) : (
                // URL expired or failed - show refresh button
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50">
                  {getFileIcon(file.type)}
                  <span className="text-sm text-muted-foreground max-w-[100px] truncate">
                    {file.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => fetchSignedUrl(file.path)}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TicketAttachmentDisplay;
