import React from "react";
import { cn } from "@/lib/utils";

interface ActivityFeedSkeletonProps {
  count?: number;
}

export const ActivityFeedSkeleton: React.FC<ActivityFeedSkeletonProps> = ({
  count = 8,
}) => {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card",
            "animate-pulse"
          )}
          style={{ animationDelay: `${i * 100}ms` }}
        >
          {/* Icon skeleton */}
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-muted" />

          {/* Content skeleton */}
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-3 w-40 bg-muted/70 rounded" />
            <div className="flex items-center gap-3">
              <div className="h-3 w-20 bg-muted/50 rounded" />
              <div className="h-3 w-16 bg-muted/50 rounded" />
            </div>
          </div>

          {/* Badge skeleton */}
          <div className="flex-shrink-0 h-5 w-14 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
};

export default ActivityFeedSkeleton;
