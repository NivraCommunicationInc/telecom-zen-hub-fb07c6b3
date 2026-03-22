/**
 * ActionConfirmDialog — Consequence-aware confirmation for employee actions.
 */
import { useState } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  label: string;
  consequence: string;
  onConfirm: () => void;
  isPending: boolean;
  variant?: "primary" | "default" | "warning";
}

const BUTTON_CLASSES = {
  primary: "bg-blue-600 text-white hover:bg-blue-500",
  default: "border border-[hsl(220,15%,18%)] text-[hsl(220,10%,60%)] hover:text-white hover:border-blue-500/30",
  warning: "border border-amber-500/30 text-amber-400 hover:bg-amber-500/10",
};

export function ActionConfirmButton({ label, consequence, onConfirm, isPending, variant = "default" }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(220,20%,6%)] border border-[hsl(220,15%,16%)]">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        <span className="text-[10px] text-[hsl(220,10%,55%)] flex-1">{consequence}</span>
        <button
          onClick={() => { onConfirm(); setShowConfirm(false); }}
          disabled={isPending}
          className="px-2.5 py-1 rounded text-[10px] font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {isPending ? "…" : "Confirmer"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="px-2 py-1 rounded text-[10px] text-[hsl(220,10%,45%)] hover:text-white"
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      disabled={isPending}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${BUTTON_CLASSES[variant]}`}
    >
      {label}
    </button>
  );
}
