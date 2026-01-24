import React from "react";
import { FileText, Image, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AttachmentFile {
  id?: string;
  name: string;
  size?: number;
  type: string;
  path?: string;
  url?: string;
}

interface TicketAttachmentDisplayProps {
  attachments: AttachmentFile[];
  className?: string;
}

export const TicketAttachmentDisplay: React.FC<TicketAttachmentDisplayProps> = ({
  attachments,
  className,
}) => {
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

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground">
        Pièces jointes ({attachments.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {attachments.map((file, index) => (
          <div
            key={file.id || `${file.name}-${index}`}
            className="group relative"
          >
            {isImage(file.type) && file.url ? (
              // Image preview
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-full object-cover"
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
                href={file.url}
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
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TicketAttachmentDisplay;
