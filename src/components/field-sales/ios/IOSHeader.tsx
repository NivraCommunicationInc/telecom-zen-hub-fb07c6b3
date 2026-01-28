/**
 * IOSHeader - iOS-style fixed header for field sales portal
 * Features: Title, notification bell with badge, menu toggle
 */
import { useState } from "react";
import { Bell, Menu, RefreshCw, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface IOSHeaderProps {
  title: string;
  subtitle?: string;
  onMenuToggle?: () => void;
  onNotificationClick?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  notificationCount?: number;
  showBack?: boolean;
  onBack?: () => void;
  rightContent?: React.ReactNode;
}

export function IOSHeader({
  title,
  subtitle,
  onMenuToggle,
  onNotificationClick,
  onRefresh,
  isRefreshing = false,
  notificationCount = 0,
  showBack = false,
  onBack,
  rightContent,
}: IOSHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800/60 safe-area-pt">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side */}
          <div className="flex items-center gap-3">
            {showBack ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="text-orange-400 hover:bg-orange-500/10 -ml-2"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            ) : onMenuToggle ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onMenuToggle}
                className="text-slate-400 hover:text-white hover:bg-slate-800/60 -ml-2"
              >
                <Menu className="h-5 w-5" />
              </Button>
            ) : null}
            
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">{title}</h1>
              {subtitle && (
                <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1">
            {rightContent}
            
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="text-slate-400 hover:text-white hover:bg-slate-800/60"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            )}
            
            {onNotificationClick && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onNotificationClick}
                className="text-slate-400 hover:text-white hover:bg-slate-800/60 relative"
              >
                <Bell className="h-5 w-5" />
                {notificationCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
