import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy, Check, X, AlertTriangle, Play } from 'lucide-react';

/**
 * DEV-ONLY: Automated 12-check overflow audit.
 * Activated ONLY when:
 *   - import.meta.env.DEV === true
 *   - AND URLSearchParams has dev_overflow_audit=1
 * 
 * Tests 4 routes × 3 widths = 12 combinations using hidden iframes.
 * Detection is done DIRECTLY in iframe via contentDocument (no global function dependency).
 */

const ROUTES = ['/', '/internet', '/tv', '/portal'] as const;
const WIDTHS = [375, 390, 414] as const;

type OffenderInfo = {
  selector: string;
  clientWidth: number;
  scrollWidth: number;
  boundingRight: number;
  viewportWidth: number;
  isDecorative: boolean; // Label only, NOT skipped
};

type AuditResult = {
  route: string;
  width: number;
  status: 'OK' | 'OVERFLOW' | 'SKIPPED' | 'ERROR';
  htmlScrollWidth: number;
  innerWidth: number;
  offenders: OffenderInfo[];
  reason?: string;
  checkedAt: number;
};

type AuditState = {
  results: AuditResult[];
  isRunning: boolean;
  currentTest: string | null;
  completedAt: number | null;
};

const STORAGE_KEY = 'dev_overflow_audit_results';

// Generate CSS selector for element (works in any document context)
function generateSelectorInDoc(el: Element, doc: Document): string {
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== doc.body && parts.length < 4) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className && typeof current.className === 'string') {
      const classes = current.className
        .split(' ')
        .filter((c) => c && !c.startsWith('_') && !c.includes(':'))
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

// Check if element appears decorative (for LABELING only, never skip)
function isDecorativeElement(el: Element, computedStyle: CSSStyleDeclaration): boolean {
  const pointerEvents = computedStyle.getPropertyValue('pointer-events');
  const ariaHidden = el.getAttribute('aria-hidden');
  const className = el.className && typeof el.className === 'string' ? el.className : '';
  const hasDecoClass = className.includes('decorative') || 
                       className.includes('background') ||
                       className.includes('gradient');
  
  return pointerEvents === 'none' || ariaHidden === 'true' || hasDecoClass;
}

// Direct detection in iframe - NO global function needed
function detectOverflowInIframe(
  iframeDoc: Document, 
  iframeWin: Window, 
  viewportWidth: number
): { offenders: OffenderInfo[]; htmlScrollWidth: number } {
  const offenders: OffenderInfo[] = [];
  const htmlScrollWidth = iframeDoc.documentElement.scrollWidth;
  
  const allElements = iframeDoc.querySelectorAll('*');
  
  allElements.forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    
    // Skip html/body for basic scroll check (handled by htmlScrollWidth)
    if (el.tagName === 'HTML' || el.tagName === 'BODY') return;
    
    const rect = el.getBoundingClientRect();
    const computedStyle = iframeWin.getComputedStyle(el);
    
    // Check if element extends beyond viewport
    const extendsRight = rect.right > viewportWidth + 1; // 1px tolerance
    const hasHorizontalScroll = el.scrollWidth > el.clientWidth + 1;
    
    if (extendsRight || hasHorizontalScroll) {
      const selector = generateSelectorInDoc(el, iframeDoc);
      const isDecorative = isDecorativeElement(el, computedStyle);
      
      // NO SKIP - we log ALL offenders, decorative is just a label
      offenders.push({
        selector,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        boundingRight: Math.round(rect.right),
        viewportWidth,
        isDecorative
      });
    }
  });
  
  // Deduplicate by selector
  const seen = new Set<string>();
  const uniqueOffenders = offenders.filter(o => {
    if (seen.has(o.selector)) return false;
    seen.add(o.selector);
    return true;
  });
  
  // Sort: non-decorative first, then by overflow amount
  uniqueOffenders.sort((a, b) => {
    if (a.isDecorative !== b.isDecorative) {
      return a.isDecorative ? 1 : -1;
    }
    return (b.boundingRight - b.viewportWidth) - (a.boundingRight - a.viewportWidth);
  });
  
  return {
    offenders: uniqueOffenders.slice(0, 20),
    htmlScrollWidth
  };
}

export function DevOverflowAudit() {
  const [isActive, setIsActive] = useState(false);
  const [state, setState] = useState<AuditState>({
    results: [],
    isRunning: false,
    currentTest: null,
    completedAt: null
  });
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(false);

  // Check activation: DEV mode + query param
  useEffect(() => {
    const checkActivation = () => {
      // Must be DEV mode
      if (!import.meta.env.DEV) {
        setIsActive(false);
        return;
      }
      
      // Must have query param
      const params = new URLSearchParams(window.location.search);
      const hasParam = params.get('dev_overflow_audit') === '1';
      setIsActive(hasParam);
    };

    checkActivation();
    
    // Re-check on navigation
    window.addEventListener('popstate', checkActivation);
    
    // Also check periodically for SPA navigation
    const interval = setInterval(checkActivation, 500);
    
    return () => {
      window.removeEventListener('popstate', checkActivation);
      clearInterval(interval);
    };
  }, []);

  // Load previous results when active
  useEffect(() => {
    if (isActive) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setState({
            results: parsed.results || [],
            isRunning: false,
            currentTest: null,
            completedAt: parsed.completedAt || null
          });
        }
      } catch {
        // Ignore
      }
    }
  }, [isActive]);

  // Save results on change
  useEffect(() => {
    if (state.results.length > 0 && isActive) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        results: state.results,
        completedAt: state.completedAt
      }));
    }
  }, [state.results, state.completedAt, isActive]);

  const runSingleTest = useCallback(async (route: string, width: number): Promise<AuditResult> => {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;height:900px;border:none;`;
      // Add __audit param to prevent recursion
      iframe.src = `${route}${route.includes('?') ? '&' : '?'}__audit=1`;
      
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({
            route,
            width,
            status: 'ERROR',
            htmlScrollWidth: 0,
            innerWidth: width,
            offenders: [],
            reason: 'Timeout (10s)',
            checkedAt: Date.now()
          });
        }
      }, 10000);

      const cleanup = () => {
        clearTimeout(timeout);
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      };

      iframe.onload = () => {
        // Wait for layout to settle
        setTimeout(() => {
          if (resolved) return;
          
          try {
            const iframeWin = iframe.contentWindow;
            const iframeDoc = iframe.contentDocument;
            
            if (!iframeWin || !iframeDoc) {
              resolved = true;
              cleanup();
              resolve({
                route,
                width,
                status: 'ERROR',
                htmlScrollWidth: 0,
                innerWidth: width,
                offenders: [],
                reason: 'Cannot access iframe content',
                checkedAt: Date.now()
              });
              return;
            }

            // Check if redirected to auth (for /portal)
            const currentPath = iframeWin.location.pathname;
            if (route === '/portal' && (currentPath.includes('/auth') || currentPath.includes('/client/auth'))) {
              resolved = true;
              cleanup();
              resolve({
                route,
                width,
                status: 'SKIPPED',
                htmlScrollWidth: 0,
                innerWidth: width,
                offenders: [],
                reason: 'Not authenticated (redirected to login)',
                checkedAt: Date.now()
              });
              return;
            }

            // Run DIRECT detection (no global function dependency)
            const { offenders, htmlScrollWidth } = detectOverflowInIframe(iframeDoc, iframeWin, width);
            
            const hasDocumentOverflow = htmlScrollWidth > width;
            const hasOffenders = offenders.length > 0;
            
            resolved = true;
            cleanup();
            resolve({
              route,
              width,
              status: (hasDocumentOverflow || hasOffenders) ? 'OVERFLOW' : 'OK',
              htmlScrollWidth,
              innerWidth: width,
              offenders,
              checkedAt: Date.now()
            });
          } catch (err: any) {
            resolved = true;
            cleanup();
            resolve({
              route,
              width,
              status: 'ERROR',
              htmlScrollWidth: 0,
              innerWidth: width,
              offenders: [],
              reason: err.message || 'Detection failed',
              checkedAt: Date.now()
            });
          }
        }, 800);
      };

      iframe.onerror = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({
            route,
            width,
            status: 'ERROR',
            htmlScrollWidth: 0,
            innerWidth: width,
            offenders: [],
            reason: 'Failed to load iframe',
            checkedAt: Date.now()
          });
        }
      };

      document.body.appendChild(iframe);
    });
  }, []);

  const runFullAudit = useCallback(async () => {
    abortRef.current = false;
    setState({ results: [], isRunning: true, currentTest: null, completedAt: null });

    const results: AuditResult[] = [];

    for (const route of ROUTES) {
      for (const width of WIDTHS) {
        if (abortRef.current) break;
        
        setState(prev => ({ ...prev, currentTest: `${route} @ ${width}px` }));
        const result = await runSingleTest(route, width);
        results.push(result);
        setState(prev => ({ ...prev, results: [...results] }));
      }
      if (abortRef.current) break;
    }

    setState(prev => ({
      ...prev,
      isRunning: false,
      currentTest: null,
      completedAt: Date.now()
    }));
  }, [runSingleTest]);

  const stopAudit = useCallback(() => {
    abortRef.current = true;
  }, []);

  const formatResults = useCallback(() => {
    const lines: string[] = [];
    lines.push('=== DEV Overflow Audit Results ===');
    lines.push(`Completed: ${state.completedAt ? new Date(state.completedAt).toISOString() : 'N/A'}`);
    lines.push('');

    const okCount = state.results.filter(r => r.status === 'OK').length;
    const overflowCount = state.results.filter(r => r.status === 'OVERFLOW').length;
    const skippedCount = state.results.filter(r => r.status === 'SKIPPED').length;
    const errorCount = state.results.filter(r => r.status === 'ERROR').length;

    lines.push(`Summary: ${okCount}/12 OK, ${overflowCount} OVERFLOW, ${skippedCount} SKIPPED, ${errorCount} ERROR`);
    lines.push('');

    for (const result of state.results) {
      const icon = result.status === 'OK' ? '✅' : 
                   result.status === 'OVERFLOW' ? '🔴' : 
                   result.status === 'SKIPPED' ? '⏭️' : '❌';
      
      lines.push(`${icon} ${result.route} @ ${result.width}px: ${result.status}`);
      lines.push(`   scrollWidth: ${result.htmlScrollWidth}px | innerWidth: ${result.innerWidth}px`);
      
      if (result.htmlScrollWidth > result.innerWidth) {
        lines.push(`   ⚠️ Document overflow: ${result.htmlScrollWidth - result.innerWidth}px`);
      }
      
      if (result.reason) {
        lines.push(`   Note: ${result.reason}`);
      }
      
      if (result.offenders.length > 0) {
        lines.push(`   Offenders (${result.offenders.length}):`);
        result.offenders.forEach((o, i) => {
          const decorLabel = o.isDecorative ? ' [DECORATIVE]' : '';
          lines.push(`     ${i + 1}) ${o.selector}${decorLabel}`);
          lines.push(`        clientWidth: ${o.clientWidth}px, scrollWidth: ${o.scrollWidth}px`);
          lines.push(`        boundingRight: ${o.boundingRight}px (overflow: ${o.boundingRight - o.viewportWidth}px)`);
        });
      }
      lines.push('');
    }

    return lines.join('\n');
  }, [state.results, state.completedAt]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatResults());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = formatResults();
      ta.style.cssText = 'position:fixed;left:-9999px;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [formatResults]);

  const clearResults = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ results: [], isRunning: false, currentTest: null, completedAt: null });
  }, []);

  const closeAudit = useCallback(() => {
    // Navigate to current path without the audit param
    const url = new URL(window.location.href);
    url.searchParams.delete('dev_overflow_audit');
    window.history.replaceState({}, '', url.toString());
    setIsActive(false);
  }, []);

  // Don't render if not active
  if (!isActive) return null;

  const okCount = state.results.filter(r => r.status === 'OK').length;
  const overflowCount = state.results.filter(r => r.status === 'OVERFLOW').length;
  const total = state.results.length;

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur overflow-auto p-4">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              DEV Overflow Audit (12 checks)
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">DEV-ONLY</Badge>
              <Button onClick={closeAudit} variant="ghost" size="sm">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Tests 4 routes × 3 widths (375, 390, 414) using hidden iframes.<br/>
            Direct detection in iframe - no global function dependency.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={runFullAudit} disabled={state.isRunning} variant="default">
              {state.isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Audit
                </>
              )}
            </Button>
            
            {state.isRunning && (
              <Button onClick={stopAudit} variant="destructive" size="sm">Stop</Button>
            )}
            
            {total > 0 && !state.isRunning && (
              <>
                <Button onClick={handleCopy} variant="outline" size="sm">
                  {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied ? 'Copied' : 'Copy Results'}
                </Button>
                <Button onClick={clearResults} variant="ghost" size="sm">Clear</Button>
              </>
            )}
          </div>

          {/* Current test */}
          {state.currentTest && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Testing: {state.currentTest}
            </div>
          )}

          {/* Summary */}
          {total > 0 && (
            <div className="flex items-center gap-4 flex-wrap">
              <Badge variant={okCount === 12 ? 'default' : overflowCount > 0 ? 'destructive' : 'secondary'}>
                {okCount}/12 OK
              </Badge>
              {overflowCount > 0 && (
                <Badge variant="destructive">{overflowCount} OVERFLOW</Badge>
              )}
              {state.completedAt && (
                <span className="text-xs text-muted-foreground">
                  Completed: {new Date(state.completedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          )}

          {/* Results table */}
          {total > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Route</th>
                    <th className="px-3 py-2 text-center font-medium">Width</th>
                    <th className="px-3 py-2 text-center font-medium">Status</th>
                    <th className="px-3 py-2 text-center font-medium">scrollW</th>
                    <th className="px-3 py-2 text-center font-medium">innerW</th>
                    <th className="px-3 py-2 text-center font-medium">#Off</th>
                  </tr>
                </thead>
                <tbody>
                  {state.results.map((result, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{result.route}</td>
                      <td className="px-3 py-2 text-center">{result.width}px</td>
                      <td className="px-3 py-2 text-center">
                        {result.status === 'OK' && (
                          <span className="flex items-center justify-center gap-1 text-emerald-600">
                            <Check className="w-4 h-4" /> OK
                          </span>
                        )}
                        {result.status === 'OVERFLOW' && (
                          <span className="flex items-center justify-center gap-1 text-destructive">
                            <X className="w-4 h-4" /> OVERFLOW
                          </span>
                        )}
                        {result.status === 'SKIPPED' && (
                          <span className="text-muted-foreground">SKIPPED</span>
                        )}
                        {result.status === 'ERROR' && (
                          <span className="text-amber-600">ERROR</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-center ${result.htmlScrollWidth > result.innerWidth ? 'text-destructive font-medium' : ''}`}>
                        {result.htmlScrollWidth}
                      </td>
                      <td className="px-3 py-2 text-center">{result.innerWidth}</td>
                      <td className={`px-3 py-2 text-center ${result.offenders.length > 0 ? 'text-destructive font-medium' : ''}`}>
                        {result.offenders.length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Detailed offenders */}
          {state.results.some(r => r.offenders.length > 0) && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Offenders Detail:</h3>
              {state.results
                .filter(r => r.offenders.length > 0)
                .map((result, idx) => (
                  <div key={idx} className="border rounded-lg p-3 bg-destructive/5 border-destructive/30">
                    <div className="font-mono text-xs font-medium text-destructive mb-2">
                      🔴 {result.route} @ {result.width}px (scrollW: {result.htmlScrollWidth}, innerW: {result.innerWidth})
                    </div>
                    <ul className="space-y-2 text-xs">
                      {result.offenders.map((o, i) => (
                        <li key={i} className="font-mono">
                          <span className="text-muted-foreground">{i + 1})</span>{' '}
                          <code className="bg-muted px-1 rounded">{o.selector}</code>
                          {o.isDecorative && (
                            <span className="text-amber-600 ml-2">[DECORATIVE]</span>
                          )}
                          <br />
                          <span className="text-muted-foreground ml-4">
                            clientW: {o.clientWidth} | scrollW: {o.scrollWidth} | 
                            right: {o.boundingRight} (overflow: {o.boundingRight - o.viewportWidth}px)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}

          {/* Notes */}
          <div className="text-xs text-muted-foreground border-t pt-3 mt-4 space-y-1">
            <p><strong>Note:</strong> /portal tests require being logged in. If SKIPPED, log in first then re-run.</p>
            <p>[DECORATIVE] = element has pointer-events:none, aria-hidden, or decorative class (labeled, NOT skipped).</p>
            <p>Results saved to localStorage for persistence.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DevOverflowAudit;
