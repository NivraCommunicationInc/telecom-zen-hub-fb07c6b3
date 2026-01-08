import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

export type DevOverflowOffender = {
  selector: string;
  clientWidth: number;
  scrollWidth: number;
  boundingRight: number;
};

export type DevOverflowReport = {
  route: string;
  viewportWidth: number;
  offenders: DevOverflowOffender[];
  checkedAt: number;
};

const OFFENDER_ATTR = 'data-dev-overflow-offender';
const OUTLINE_STYLE = '2px solid red';

/**
 * DEV-ONLY: Detects horizontal overflow and outlines offending elements in red.
 * Logs route + selector + widths to console.
 * Only active when import.meta.env.DEV is true.
 */
export function useDevOverflowDetector() {
  const location = useLocation();

  const [report, setReport] = useState<DevOverflowReport>(() => ({
    route: location.pathname,
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    offenders: [],
    checkedAt: Date.now(),
  }));

  const route = location.pathname;
  const routeRef = useRef(route);
  routeRef.current = route;

  const clearTimersRef = useRef<() => void>(() => undefined);

  const clearOutlines = useCallback(() => {
    document.querySelectorAll(`[${OFFENDER_ATTR}="true"]`).forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      el.style.outline = '';
      el.removeAttribute(OFFENDER_ATTR);
    });
  }, []);

  const checkOverflow = useCallback(() => {
    const viewportWidth = window.innerWidth;
    const offenders: DevOverflowOffender[] = [];

    clearOutlines();

    document.querySelectorAll('*').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;

      const rect = el.getBoundingClientRect();
      const hasScrollOverflow = el.scrollWidth > el.clientWidth;
      const extendsViewport = rect.right > viewportWidth + 1; // +1 for rounding

      if (!hasScrollOverflow && !extendsViewport) return;

      // Skip body/html for scroll check (they naturally have scrollWidth)
      if ((el.tagName === 'BODY' || el.tagName === 'HTML') && !extendsViewport) {
        return;
      }

      const selector = generateSelector(el);

      offenders.push({
        selector,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        boundingRight: Math.round(rect.right),
      });

      el.setAttribute(OFFENDER_ATTR, 'true');
      el.style.outline = OUTLINE_STYLE;
    });

    const next: DevOverflowReport = {
      route: routeRef.current,
      viewportWidth,
      offenders,
      checkedAt: Date.now(),
    };

    setReport(next);

    if (offenders.length > 0) {
      console.group(`🔴 [DEV] Overflow detected on ${next.route} @ ${viewportWidth}px`);
      offenders.forEach(({ selector, clientWidth, scrollWidth, boundingRight }) => {
        console.warn(
          `${selector}\n  clientWidth: ${clientWidth}, scrollWidth: ${scrollWidth}, boundingRight: ${boundingRight}, viewport: ${viewportWidth}`
        );
      });
      console.groupEnd();
    } else {
      console.log(`✅ [DEV] No overflow on ${next.route} @ ${viewportWidth}px`);
    }

    return next;
  }, [clearOutlines]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    let timer: number | undefined;
    let resizeTimer: number | undefined;

    const schedule = (delay = 250) => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        checkOverflow();
      }, delay);
    };

    const onResize = () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => schedule(0), 120);
    };

    schedule(350);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    clearTimersRef.current = () => {
      if (timer) window.clearTimeout(timer);
      if (resizeTimer) window.clearTimeout(resizeTimer);
    };

    return () => {
      clearTimersRef.current?.();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      clearOutlines();
    };
  }, [route, checkOverflow, clearOutlines]);

  return useMemo(
    () => ({
      report,
      checkOverflow,
    }),
    [report, checkOverflow]
  );
}

function generateSelector(el: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = el;

  while (current && current !== document.body && parts.length < 4) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className && typeof current.className === 'string') {
      const classes = current.className
        .split(' ')
        .filter((c) => c && !c.startsWith('_'))
        .slice(0, 2);
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

export default useDevOverflowDetector;
