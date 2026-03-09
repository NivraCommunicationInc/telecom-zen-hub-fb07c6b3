/**
 * corePaths — Centralized route path helper for Nivra Core.
 * Reads VITE_CORE_BASE_PATH to support both:
 *   - Embedded mode: /core/dashboard, /core/orders, etc.
 *   - Standalone mode: /dashboard, /orders, etc.
 *
 * Usage:
 *   import { corePath } from "@/core-app/lib/corePaths";
 *   <Link to={corePath("/orders")} />
 *   <Link to={corePath(`/orders/${id}`)} />
 *   navigate(corePath("/login"));
 */

const BASE = import.meta.env.VITE_CORE_BASE_PATH ?? "/core";

/**
 * Resolve a Core-internal path.
 * @param path — relative path like "/dashboard", "/orders/123", "/login"
 * @returns full path like "/core/dashboard" (embedded) or "/dashboard" (standalone)
 */
export function corePath(path: string): string {
  // Normalize: ensure path starts with /
  const normalized = path.startsWith("/") ? path : `/${path}`;
  // If BASE is empty string, just return the path
  if (!BASE) return normalized;
  return `${BASE}${normalized}`;
}

/**
 * The base path itself (for router config).
 * "/core" in embedded mode, "" in standalone mode.
 */
export const CORE_BASE = BASE;

/**
 * Check if a pathname is active for a given Core href.
 */
export function isCorePathActive(currentPathname: string, href: string): boolean {
  const fullHref = corePath(href);
  if (href === "/" || href === "") {
    // Root dashboard — exact match only
    return currentPathname === fullHref || currentPathname === `${fullHref}/`;
  }
  return currentPathname.startsWith(fullHref);
}
