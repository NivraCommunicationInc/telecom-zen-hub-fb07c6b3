/**
 * SectionBadge — Indicateur visuel "ceci nécessite votre attention".
 *
 * Variants:
 * - "dot"        : petit point rouge fixe (info)
 * - "dot-pulse"  : petit point rouge animé (pulse) pour les éléments urgents
 *                  (factures impayées, KYC requis, contrats à signer, etc.)
 *
 * Le badge n'affiche RIEN si `count <= 0` et `show` est false/undefined.
 * Le nombre n'est PAS affiché — seul un point rouge, conforme à la demande:
 * "un point rouge qui va indiquer cette section nécessite son attention".
 *
 * Pour l'accessibilité, un libellé textuel est fourni via `aria-label`.
 */
import { cn } from "@/lib/utils";

interface SectionBadgeProps {
  /** Affiche le badge si > 0 (ou si `show` est true). */
  count?: number;
  /** Force l'affichage du badge même sans compte numérique. */
  show?: boolean;
  /** "pulse" pour les éléments urgents (impayés, KYC, à signer). */
  variant?: "dot" | "dot-pulse";
  /** Position absolue par rapport au parent (le parent doit être `relative`). */
  positioned?: boolean;
  /** Libellé pour les lecteurs d'écran. */
  ariaLabel?: string;
  className?: string;
}

export function SectionBadge({
  count,
  show,
  variant = "dot",
  positioned = false,
  ariaLabel = "Élément nécessitant votre attention",
  className,
}: SectionBadgeProps) {
  const visible = show || (typeof count === "number" && count > 0);
  if (!visible) return null;

  const isPulse = variant === "dot-pulse";

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        positioned && "absolute -top-0.5 -right-0.5",
        className
      )}
    >
      {/* Halo pulse (urgent) */}
      {isPulse && (
        <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-red-500 opacity-60 animate-ping" />
      )}
      {/* Point rouge solide */}
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
    </span>
  );
}

export default SectionBadge;
