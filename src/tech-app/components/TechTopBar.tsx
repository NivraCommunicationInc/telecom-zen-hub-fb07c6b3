/**
 * TechTopBar — Compact top bar with title and optional back button.
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
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 px-4 h-14">
        {back && (
          <button
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="-ml-2 h-11 w-11 flex items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <h1 className="flex-1 text-base font-semibold text-white truncate">{title}</h1>
        {right}
      </div>
    </header>
  );
}
