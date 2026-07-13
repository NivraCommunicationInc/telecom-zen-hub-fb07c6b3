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
      className="sticky top-0 z-40 pt-[env(safe-area-inset-top)]"
      style={{
        background: "rgba(5, 8, 6, 0.96)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: "1px solid var(--tp-border)",
      }}
    >
      <div className="flex items-center gap-3 px-4 h-[60px]">
        {back ? (
          <button
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="shrink-0 -ml-1 h-10 w-10 flex items-center justify-center rounded-full transition-colors"
            style={{ color: "var(--tp-text-muted)", background: "rgba(255,255,255,0.035)" }}
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
        ) : (
          <div
            className="shrink-0 h-8 w-8 rounded-[10px] flex items-center justify-center text-white font-black text-[13px] shadow-lg"
            style={{ background: "linear-gradient(135deg, var(--tp-primary) 0%, var(--tp-primary-deep) 100%)", boxShadow: "0 4px 12px rgba(124,58,237,0.35)" }}
          >
            N
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-black leading-tight truncate" style={{ color: "var(--tp-text)", letterSpacing: 0 }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] leading-tight mt-px" style={{ color: "var(--tp-text-dim)" }}>{subtitle}</p>
          )}
        </div>

        {right ?? (
          <button
            aria-label="Notifications"
            className="relative shrink-0 h-10 w-10 flex items-center justify-center rounded-full transition-colors"
            style={{ color: "var(--tp-text-muted)", background: "rgba(255,255,255,0.035)" }}
          >
            <Bell className="h-[18px] w-[18px]" />
            {alertCount > 0 && (
              <span
                className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500"
                style={{ boxShadow: "0 0 0 2px rgba(10,10,18,0.97)" }}
              />
            )}
          </button>
        )}
      </div>
    </header>
  );
}
