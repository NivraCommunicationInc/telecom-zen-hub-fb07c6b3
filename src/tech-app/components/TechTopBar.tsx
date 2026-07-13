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
    <header
      className="sticky top-0 z-40 pt-[env(safe-area-inset-top)]"
      style={{
        background: "rgba(5,8,6,0.96)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: "1px solid var(--tp-border)",
      }}
    >
      <div className="flex items-center gap-3 px-4 h-[60px]">
        {back && (
          <button
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="shrink-0 -ml-1 h-10 w-10 flex items-center justify-center rounded-full transition-colors"
            style={{ color: "var(--tp-text-muted)", background: "rgba(255,255,255,0.035)" }}
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
        )}
        <h1 className="flex-1 text-[17px] font-black truncate" style={{ color: "var(--tp-text)", letterSpacing: 0 }}>
          {title}
        </h1>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </header>
  );
}
