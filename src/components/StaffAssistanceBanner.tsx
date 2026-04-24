import { useEffect, useState } from "react";
import { Eye, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  clearStaffAssistance,
  getStaffAssistance,
  type StaffAssistanceSession,
} from "@/lib/staffAssistance";

export default function StaffAssistanceBanner() {
  const [session, setSession] = useState<StaffAssistanceSession | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setSession(getStaffAssistance());
    const onStorage = () => setSession(getStaffAssistance());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!session) return null;

  const exit = () => {
    clearStaffAssistance();
    setSession(null);
    navigate("/core");
  };

  return (
    <div className="w-full bg-purple-700 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm shadow-md sticky top-0 z-50">
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-4 w-4 shrink-0" />
        <span className="truncate">
          <strong>Mode assistance</strong> — Vous consultez le portail de{" "}
          <strong>{session.staff_name}</strong> ({session.staff_email})
        </span>
      </div>
      <button
        onClick={exit}
        className="flex items-center gap-1 bg-white/15 hover:bg-white/25 px-3 py-1 rounded-md font-medium transition-colors"
      >
        <X className="h-3 w-3" /> Quitter
      </button>
    </div>
  );
}
