/**
 * TechHeader — Sticky top bar for all tech portal pages except TechDashboard.
 * Left-aligned title (iOS pattern), subtitle support, back button, notification bell.
 */
import { Bell, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
  alertCount?: number;
  right?: React.ReactNode;
}

export default function TechHeader({ title, subtitle, back, alertCount = 0, right }: Props) {
  const navigate = useNavigate();
  return (
    <header
      className="tp-ops-header sticky top-0 z-40 pt-[env(safe-area-inset-top)]"
    >
      <div className="flex items-center gap-3 px-4 h-[64px] max-w-[1180px] mx-auto">
        {back ? (
          <button
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="shrink-0 -ml-1 h-10 w-10 flex items-center justify-center rounded-md transition-colors"
            style={{ color: "var(--tp-dark-text)", background: "var(--tp-dark-2)" }}
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
        ) : (
          <div
            className="shrink-0 h-10 w-10 rounded-md flex items-center justify-center font-black text-[15px]"
            style={{ background: "var(--tp-primary)", color: "var(--tp-dark)", fontStyle: "italic" }}
          >
            N
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-[18px] font-black leading-tight truncate" style={{ color: "var(--tp-dark-text)", fontStyle: "italic", textTransform: "uppercase", letterSpacing: 0 }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-[10px] leading-tight mt-px font-bold uppercase tracking-wider" style={{ color: "var(--tp-dark-text-dim)" }}>{subtitle}</p>
          )}
        </div>

        {right ?? (
          <button
            aria-label="Notifications"
            className="relative shrink-0 h-10 w-10 flex items-center justify-center rounded-md transition-colors"
            style={{ color: "var(--tp-dark-text)", background: "var(--tp-dark-2)" }}
          >
            <Bell className="h-[18px] w-[18px]" />
            {alertCount > 0 && (
              <span
                className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500"
                style={{ boxShadow: "0 0 0 2px var(--tp-dark)" }}
              />
            )}
          </button>
        )}
      </div>
    </header>
  );
}
