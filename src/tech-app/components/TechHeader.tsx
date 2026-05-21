/**
 * TechHeader — Fixed top header for the technician PWA.
 * Logo on left, page title centered, notification bell on right.
 */
import { Bell, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  title: string;
  back?: boolean;
  alertCount?: number;
}

export default function TechHeader({ title, back, alertCount = 0 }: Props) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur border-b border-violet-900/40 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 px-4 h-14">
        {back ? (
          <button
            onClick={() => navigate(-1)}
            aria-label="Retour"
            className="-ml-2 h-11 w-11 flex items-center justify-center rounded-full text-slate-300 hover:bg-slate-800 active:bg-slate-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/30">
            N
          </div>
        )}
        <h1 className="flex-1 text-center text-base font-bold text-white truncate">{title}</h1>
        <button
          aria-label="Notifications"
          className="relative h-11 w-11 flex items-center justify-center rounded-full text-slate-300 hover:bg-slate-800 active:bg-slate-700"
        >
          <Bell className="h-5 w-5" />
          {alertCount > 0 && (
            <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-slate-950" />
          )}
        </button>
      </div>
    </header>
  );
}
