/**
 * TechPageHeader — v2 sticky header for tech portal pages.
 * Drop-in replacement for legacy TechHeader / TechTopBar.
 * Uses tech-core.css tokens.
 */
import { ArrowLeft, Bell } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  alertCount?: number;
}

export default function TechPageHeader({ title, subtitle, back, right, alertCount = 0 }: Props) {
  const navigate = useNavigate();
  return (
    <header
      className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] border-b backdrop-blur-md"
      style={{
        background: "hsl(var(--card) / 0.85)",
        borderColor: "hsl(var(--border))",
      }}
    >
      <div className="flex items-center gap-3 px-4 lg:px-6 h-14 max-w-[1400px] mx-auto">
        {back ? (
          <button
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg tc-focus-ring transition-colors"
            style={{ background: "hsl(var(--muted))", color: "hsl(var(--foreground))" }}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <Link
            to="/tech"
            className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center font-bold text-[14px]"
            style={{ background: "var(--tc-gradient-primary)", color: "hsl(var(--primary-foreground))" }}
            aria-label="Nivra Tech"
          >
            N
          </Link>
        )}

        <div className="flex-1 min-w-0">
          <h1
            className="text-[16px] font-semibold tracking-tight truncate"
            style={{ color: "hsl(var(--foreground))" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-[11.5px] leading-tight mt-0.5 truncate"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {right ?? (
          <button
            aria-label="Notifications"
            className="relative shrink-0 h-9 w-9 flex items-center justify-center rounded-lg tc-focus-ring transition-colors"
            style={{ background: "hsl(var(--muted))", color: "hsl(var(--foreground))" }}
          >
            <Bell className="h-4 w-4" />
            {alertCount > 0 && (
              <span
                className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
                style={{ background: "hsl(var(--destructive))", boxShadow: "0 0 0 2px hsl(var(--card))" }}
              />
            )}
          </button>
        )}
      </div>
    </header>
  );
}
