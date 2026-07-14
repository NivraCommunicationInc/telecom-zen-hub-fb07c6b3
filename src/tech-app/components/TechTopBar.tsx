/**
 * TechTopBar — Thin wrapper around TechHeader for installation / scanner pages.
 * Keeps the back button + right slot, no logo, no bell by default.
 */
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TechTopBar({
  title,
  back = false,
  right,
}: {
  title: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="tp-ops-header sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-3 px-4 h-[64px] max-w-[1180px] mx-auto">
        {back && (
          <button
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="shrink-0 -ml-1 h-10 w-10 flex items-center justify-center rounded-md transition-colors"
            style={{ color: "var(--tp-dark-text)", background: "var(--tp-dark-2)" }}
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
        )}
        <h1 className="flex-1 text-[18px] font-black italic uppercase truncate" style={{ color: "var(--tp-dark-text)", letterSpacing: 0 }}>
          {title}
        </h1>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </header>
  );
}
