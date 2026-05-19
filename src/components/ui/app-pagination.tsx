/**
 * AppPagination — Reusable paginator with ellipsis (max 7 buttons).
 * Dark-theme friendly with violet accent. Standard 10 per page.
 *
 * Lowercase `pagination.tsx` shadcn primitive is preserved untouched;
 * this is the application-level reusable controller for list pages.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  total: number;
  page: number;          // 1-indexed
  perPage: number;
  onPageChange: (page: number) => void;
  className?: string;
  variant?: "dark" | "light";
  labelResults?: (total: number, page: number, totalPages: number) => string;
}

function buildRange(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("…");
  pages.push(totalPages);
  return pages;
}

export function AppPagination({
  total,
  page,
  perPage,
  onPageChange,
  className,
  variant = "light",
  labelResults,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const isDark = variant === "dark";

  const baseBtn = cn(
    "min-w-[40px] h-10 px-3 rounded-lg text-sm font-medium border transition-colors inline-flex items-center justify-center gap-1",
    isDark
      ? "bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
      : "bg-background border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
  );
  const activeBtn = "bg-violet-600 border-violet-600 text-white hover:bg-violet-500";
  const ellipsisCls = cn(
    "min-w-[28px] h-10 inline-flex items-center justify-center text-sm",
    isDark ? "text-gray-500" : "text-muted-foreground"
  );

  const defaultLabel = (t: number, p: number, tp: number) =>
    `${t} résultat${t > 1 ? "s" : ""} — Page ${p} sur ${tp}`;

  const range = buildRange(safePage, totalPages);

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 pt-2",
        className
      )}
    >
      <p className={cn("text-xs", isDark ? "text-gray-400" : "text-muted-foreground")}>
        {(labelResults ?? defaultLabel)(total, safePage, totalPages)}
      </p>
      <div className="flex items-center gap-1 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className={baseBtn}
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Précédent</span>
        </button>
        {range.map((p, idx) =>
          p === "…" ? (
            <span key={`e-${idx}`} className={ellipsisCls}>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === safePage ? "page" : undefined}
              className={cn(baseBtn, p === safePage && activeBtn)}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className={baseBtn}
          aria-label="Page suivante"
        >
          <span className="hidden sm:inline">Suivant</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

export default AppPagination;
