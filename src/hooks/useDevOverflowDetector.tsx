import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * DEV-ONLY: Detects horizontal overflow and outlines offending elements in red.
 * Logs route + selector + widths to console.
 * Only active when import.meta.env.DEV is true.
 */
export function useDevOverflowDetector() {
  const location = useLocation();

  useEffect(() => {
    // Only run in development mode
    if (!import.meta.env.DEV) return;

    const checkOverflow = () => {
      const viewportWidth = window.innerWidth;
      const offenders: Array<{
        selector: string;
        element: HTMLElement;
        clientWidth: number;
        scrollWidth: number;
        boundingRight: number;
      }> = [];

      // Check all elements
      document.querySelectorAll('*').forEach((el) => {
        if (!(el instanceof HTMLElement)) return;

        const rect = el.getBoundingClientRect();
        const hasScrollOverflow = el.scrollWidth > el.clientWidth;
        const extendsViewport = rect.right > viewportWidth + 1; // +1 for rounding

        if (hasScrollOverflow || extendsViewport) {
          // Skip body/html for scroll check (they naturally have scrollWidth)
          if ((el.tagName === 'BODY' || el.tagName === 'HTML') && !extendsViewport) {
            return;
          }

          // Generate a selector for the element
          const selector = generateSelector(el);

          offenders.push({
            selector,
            element: el,
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            boundingRight: Math.round(rect.right),
          });

          // Outline in red
          el.style.outline = '2px solid red';
        }
      });

      // Log results
      if (offenders.length > 0) {
        console.group(`🔴 [DEV] Overflow detected on ${location.pathname} @ ${viewportWidth}px`);
        offenders.forEach(({ selector, clientWidth, scrollWidth, boundingRight }) => {
          console.warn(
            `${selector}\n  clientWidth: ${clientWidth}, scrollWidth: ${scrollWidth}, boundingRight: ${boundingRight}, viewport: ${viewportWidth}`
          );
        });
        console.groupEnd();
      } else {
        console.log(`✅ [DEV] No overflow on ${location.pathname} @ ${viewportWidth}px`);
      }

      return offenders.length;
    };

    // Clear previous outlines
    document.querySelectorAll('[style*="outline: 2px solid red"]').forEach((el) => {
      if (el instanceof HTMLElement) {
        el.style.outline = '';
      }
    });

    // Run after a short delay to let layout settle
    const timeoutId = setTimeout(checkOverflow, 500);

    return () => clearTimeout(timeoutId);
  }, [location.pathname]);
}

function generateSelector(el: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = el;

  while (current && current !== document.body && parts.length < 4) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className && typeof current.className === 'string') {
      const classes = current.className.split(' ').filter(c => c && !c.startsWith('_')).slice(0, 2);
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
