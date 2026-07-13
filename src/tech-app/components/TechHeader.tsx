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
        background: "#18181b",
        color: "#fafafa",
        borderBottom: "1px solid #27272a",
      }}
    >
      <div className="flex items-center gap-3 px-4 h-[60px]">
        {back ? (
          <button
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="shrink-0 -ml-1 h-10 w-10 flex items-center justify-center rounded-md transition-colors"
            style={{ color: "#fafafa", background: "#27272a" }}
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
        ) : (
          <div
            className="shrink-0 h-9 w-9 rounded-md flex items-center justify-center font-black text-[14px]"
            style={{ background: "#fbbf24", color: "#18181b", fontStyle: "italic" }}
          >
            N
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-black leading-tight truncate" style={{ color: "#fafafa", fontStyle: "italic", textTransform: "uppercase", letterSpacing: "-0.01em" }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-[10px] leading-tight mt-px font-bold uppercase tracking-wider" style={{ color: "#a1a1aa" }}>{subtitle}</p>
          )}
        </div>

        {right ?? (
          <button
            aria-label="Notifications"
            className="relative shrink-0 h-10 w-10 flex items-center justify-center rounded-md transition-colors"
            style={{ color: "#fafafa", background: "#27272a" }}
          >
            <Bell className="h-[18px] w-[18px]" />
            {alertCount > 0 && (
              <span
                className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500"
                style={{ boxShadow: "0 0 0 2px #18181b" }}
              />
            )}
          </button>
        )}
      </div>
    </header>
  );
}
