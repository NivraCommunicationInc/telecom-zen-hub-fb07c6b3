/**
 * DataTable — Carrier-grade operational table
 * Sorting, pagination, bulk select, sticky header, zebra rows, inline actions
 * This is the PRIMARY UI element for all admin operational pages.
 */
import { ReactNode, useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";

export interface Column<T> {
  key: string;
  label: string;
  className?: string;
  sortable?: boolean;
  render?: (row: T, index: number) => ReactNode;
}

type SortDirection = "asc" | "desc" | null;

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  isLoading?: boolean;
  className?: string;
  /** Enable row selection checkboxes */
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  /** Pagination */
  pageSize?: number;
  /** Compact density */
  compact?: boolean;
  /** Bulk action bar */
  bulkActions?: (selectedKeys: Set<string>) => ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = "Aucune donnée",
  emptyIcon,
  isLoading,
  className,
  selectable = false,
  selectedKeys: externalSelectedKeys,
  onSelectionChange,
  pageSize = 25,
  compact = false,
  bulkActions,
}: DataTableProps<T>) {
  // Sorting
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);

  // Selection (internal or external)
  const [internalSelectedKeys, setInternalSelectedKeys] = useState<Set<string>>(new Set());
  const selectedKeysState = externalSelectedKeys ?? internalSelectedKeys;
  const setSelectedKeys = onSelectionChange ?? setInternalSelectedKeys;

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Reset page on data change
  useMemo(() => {
    if (currentPage >= totalPages) setCurrentPage(0);
  }, [data.length, totalPages]);

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortKey(null); setSortDir(null); }
      else setSortDir("asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setCurrentPage(0);
  }, [sortKey, sortDir]);

  const allPageKeys = paginatedData.map(keyExtractor);
  const allSelected = allPageKeys.length > 0 && allPageKeys.every(k => selectedKeysState.has(k));
  const someSelected = allPageKeys.some(k => selectedKeysState.has(k));

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selectedKeysState);
      allPageKeys.forEach(k => next.delete(k));
      setSelectedKeys(next);
    } else {
      const next = new Set(selectedKeysState);
      allPageKeys.forEach(k => next.add(k));
      setSelectedKeys(next);
    }
  };

  const toggleRow = (key: string) => {
    const next = new Set(selectedKeysState);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedKeys(next);
  };

  const cellPadding = compact ? "px-3 py-1.5" : "px-4 py-2.5";
  const headerPadding = compact ? "px-3 py-2" : "px-4 py-2.5";

  if (isLoading) {
    return (
      <div className="space-y-1">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-10 bg-secondary/30 animate-pulse rounded-sm" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        {emptyIcon}
        <p className="text-sm mt-2">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Bulk actions bar */}
      {selectable && selectedKeysState.size > 0 && bulkActions && (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-md mb-2">
          <span className="text-sm font-medium text-foreground">
            {selectedKeysState.size} sélectionné{selectedKeysState.size > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            {bulkActions(selectedKeysState)}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-xs"
            onClick={() => setSelectedKeys(new Set())}
          >
            Désélectionner
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-secondary border-b-2 border-border">
              {selectable && (
                <th className={cn(headerPadding, "w-10")}>
                  <Checkbox
                    checked={allSelected}
                    // @ts-ignore
                    indeterminate={someSelected && !allSelected}
                    onCheckedChange={toggleAll}
                    className="border-muted-foreground"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    headerPadding,
                    "text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none",
                    col.sortable !== false && "cursor-pointer hover:text-foreground transition-colors",
                    col.className
                  )}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.label}</span>
                    {col.sortable !== false && (
                      <span className="inline-flex">
                        {sortKey === col.key ? (
                          sortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, index) => {
              const key = keyExtractor(row);
              const isSelected = selectedKeysState.has(key);
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "border-b border-border/40 transition-colors",
                    index % 2 === 1 && "bg-secondary/15",
                    onRowClick && "cursor-pointer",
                    isSelected && "bg-primary/8",
                    "hover:bg-primary/5"
                  )}
                >
                  {selectable && (
                    <td className={cn(cellPadding, "w-10")} onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(key)}
                        className="border-muted-foreground"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(cellPadding, "text-sm text-foreground", col.className)}
                    >
                      {col.render
                        ? col.render(row, index)
                        : (row as any)[col.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 px-1">
          <span className="text-xs text-muted-foreground">
            {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, sortedData.length)} sur {sortedData.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let page: number;
              if (totalPages <= 7) {
                page = i;
              } else if (currentPage < 3) {
                page = i;
              } else if (currentPage > totalPages - 4) {
                page = totalPages - 7 + i;
              } else {
                page = currentPage - 3 + i;
              }
              return (
                <Button
                  key={page}
                  variant={page === currentPage ? "default" : "ghost"}
                  size="icon"
                  className={cn("h-7 w-7 text-xs", page === currentPage && "bg-primary text-primary-foreground")}
                  onClick={() => setCurrentPage(page)}
                >
                  {page + 1}
                </Button>
              );
            })}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
