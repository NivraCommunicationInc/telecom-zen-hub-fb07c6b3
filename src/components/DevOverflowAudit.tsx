import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy, Check, X, AlertTriangle, Play } from 'lucide-react';

/**
 * DEV-ONLY: Automated 12-check overflow audit.
 * Activated via: ?dev_overflow_audit=1 in DEV mode only.
 * 
 * Tests 4 routes × 3 widths = 12 combinations using hidden iframes.
 */

const ROUTES = ['/', '/internet', '/tv', '/portal'] as const;
const WIDTHS = [375, 390, 414] as const;

type OffenderInfo = {
  selector: string;
  clientWidth: number;
  scrollWidth: number;
  boundingRight: number;
};

type AuditResult = {
  route: string;
  width: number;
  status: 'OK' | 'OVERFLOW' | 'SKIPPED' | 'ERROR';
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

// Check if audit mode is enabled
export function isAuditModeEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  
  const params = new URLSearchParams(window.location.search);
  return params.get('dev_overflow_audit') === '1' || 
         import.meta.env.VITE_DEV_AUDIT === 'true';
}

// Generate CSS selector for element
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

// Detect overflow offenders in current document
function detectOverflowOffenders(): OffenderInfo[] {
  const viewportWidth = window.innerWidth;
  const offenders: OffenderInfo[] = [];

  document.querySelectorAll('*').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;

    const rect = el.getBoundingClientRect();
    const hasScrollOverflow = el.scrollWidth > el.clientWidth;
    const extendsViewport = rect.right > viewportWidth + 1;

    if (!hasScrollOverflow && !extendsViewport) return;

    // Skip body/html for scroll check
    if ((el.tagName === 'BODY' || el.tagName === 'HTML') && !extendsViewport) {
      return;
    }

    // Skip elements with overflow-hidden that are properly containing decorative content
    const style = window.getComputedStyle(el);
    if (style.overflow === 'hidden' || style.overflowX === 'hidden') {
      // Check if it's a decorative wrapper (pointer-events-none, inset-0, etc.)
      if (style.pointerEvents === 'none' || el.getAttribute('aria-hidden') === 'true') {
        return;
      }
    }

    offenders.push({
      selector: generateSelector(el),
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      boundingRight: Math.round(rect.right),
    });
  });

  return offenders;
}

// Exposed globally for iframe communication
if (import.meta.env.DEV) {
  (window as any).__detectOverflowOffenders = detectOverflowOffenders;
}

export function DevOverflowAudit() {
  const [state, setState] = useState<AuditState>(() => {
    // Load previous results from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          results: parsed.results || [],
          isRunning: false,
          currentTest: null,
          completedAt: parsed.completedAt || null,
        };
      }
    } catch {
      // Ignore parse errors
    }
    return { results: [], isRunning: false, currentTest: null, completedAt: null };
  });

  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const abortRef = useRef(false);

  // Save results to localStorage whenever they change
  useEffect(() => {
    if (state.results.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        results: state.results,
        completedAt: state.completedAt,
      }));
    }
  }, [state.results, state.completedAt]);

  const runSingleTest = useCallback(async (route: string, width: number): Promise<AuditResult> => {
    return new Promise((resolve) => {
      // Create hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;height:900px;border:none;`;
      iframe.src = `${route}${route.includes('?') ? '&' : '?'}__audit=1`;
      
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          document.body.removeChild(iframe);
          resolve({
            route,
            width,
            status: 'ERROR',
            offenders: [],
            reason: 'Timeout (10s)',
            checkedAt: Date.now(),
          });
        }
      }, 10000);

      iframe.onload = () => {
        // Wait for layout to settle
        setTimeout(() => {
          if (resolved) return;
          
          try {
            const iframeWindow = iframe.contentWindow;
            const iframeDoc = iframe.contentDocument;
            
            if (!iframeWindow || !iframeDoc) {
              resolved = true;
              clearTimeout(timeout);
              document.body.removeChild(iframe);
              resolve({
                route,
                width,
                status: 'ERROR',
                offenders: [],
                reason: 'Cannot access iframe content',
                checkedAt: Date.now(),
              });
              return;
            }

            // Check if redirected to auth (for /portal)
            const currentPath = iframeWindow.location.pathname;
            if (route === '/portal' && currentPath.includes('/auth')) {
              resolved = true;
              clearTimeout(timeout);
              document.body.removeChild(iframe);
              resolve({
                route,
                width,
                status: 'SKIPPED',
                offenders: [],
                reason: 'Not authenticated',
                checkedAt: Date.now(),
              });
              return;
            }

            // Run detection in iframe context
            const detectFn = (iframeWindow as any).__detectOverflowOffenders;
            if (typeof detectFn === 'function') {
              const offenders = detectFn();
              resolved = true;
              clearTimeout(timeout);
              document.body.removeChild(iframe);
              resolve({
                route,
                width,
                status: offenders.length > 0 ? 'OVERFLOW' : 'OK',
                offenders,
                checkedAt: Date.now(),
              });
            } else {
              // Fallback: check basic overflow
              const docWidth = iframeDoc.documentElement.scrollWidth;
              const hasOverflow = docWidth > width;
              resolved = true;
              clearTimeout(timeout);
              document.body.removeChild(iframe);
              resolve({
                route,
                width,
                status: hasOverflow ? 'OVERFLOW' : 'OK',
                offenders: hasOverflow ? [{ 
                  selector: 'html', 
                  clientWidth: width, 
                  scrollWidth: docWidth, 
                  boundingRight: docWidth 
                }] : [],
                reason: 'Fallback detection (no __detectOverflowOffenders)',
                checkedAt: Date.now(),
              });
            }
          } catch (err: any) {
            resolved = true;
            clearTimeout(timeout);
            document.body.removeChild(iframe);
            resolve({
              route,
              width,
              status: 'ERROR',
              offenders: [],
              reason: err.message || 'Unknown error',
              checkedAt: Date.now(),
            });
          }
        }, 800); // Wait 800ms for layout
      };

      iframe.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          document.body.removeChild(iframe);
          resolve({
            route,
            width,
            status: 'ERROR',
            offenders: [],
            reason: 'Failed to load',
            checkedAt: Date.now(),
          });
        }
      };

      document.body.appendChild(iframe);
      iframeRef.current = iframe;
    });
  }, []);

  const runFullAudit = useCallback(async () => {
    abortRef.current = false;
    setState(prev => ({ ...prev, isRunning: true, results: [], currentTest: null }));

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
      completedAt: Date.now(),
    }));
  }, [runSingleTest]);

  const stopAudit = useCallback(() => {
    abortRef.current = true;
    if (iframeRef.current && iframeRef.current.parentNode) {
      iframeRef.current.parentNode.removeChild(iframeRef.current);
    }
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
      const icon = result.status === 'OK' ? '✅' : result.status === 'OVERFLOW' ? '🔴' : result.status === 'SKIPPED' ? '⏭️' : '❌';
      lines.push(`${icon} ${result.route} @ ${result.width}px: ${result.status}${result.reason ? ` (${result.reason})` : ''}`);
      
      if (result.offenders.length > 0) {
        result.offenders.forEach((o, i) => {
          lines.push(`   ${i + 1}) ${o.selector}`);
          lines.push(`      cw: ${o.clientWidth}, sw: ${o.scrollWidth}, right: ${o.boundingRight}`);
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
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
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

  if (!isAuditModeEnabled()) return null;

  const okCount = state.results.filter(r => r.status === 'OK').length;
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
            <Badge variant="outline" className="text-xs">
              DEV-ONLY
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Tests 4 routes × 3 widths (375, 390, 414) using hidden iframes.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={runFullAudit}
              disabled={state.isRunning}
              variant="default"
            >
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
              <Button onClick={stopAudit} variant="destructive" size="sm">
                Stop
              </Button>
            )}
            
            {state.results.length > 0 && !state.isRunning && (
              <>
                <Button onClick={handleCopy} variant="outline" size="sm">
                  {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied ? 'Copied' : 'Copy Results'}
                </Button>
                <Button onClick={clearResults} variant="ghost" size="sm">
                  Clear
                </Button>
              </>
            )}
          </div>

          {/* Current test indicator */}
          {state.currentTest && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Testing: {state.currentTest}
            </div>
          )}

          {/* Summary */}
          {total > 0 && (
            <div className="flex items-center gap-4">
              <Badge variant={okCount === 12 ? 'default' : 'destructive'} className="text-sm">
                {okCount}/12 OK
              </Badge>
              {state.completedAt && (
                <span className="text-xs text-muted-foreground">
                  Completed: {new Date(state.completedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          )}

          {/* Results table */}
          {state.results.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Route</th>
                    <th className="px-3 py-2 text-left font-medium">Width</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">#Offenders</th>
                  </tr>
                </thead>
                <tbody>
                  {state.results.map((result, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{result.route}</td>
                      <td className="px-3 py-2">{result.width}px</td>
                      <td className="px-3 py-2">
                        {result.status === 'OK' && (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <Check className="w-4 h-4" /> OK
                          </span>
                        )}
                        {result.status === 'OVERFLOW' && (
                          <span className="flex items-center gap-1 text-destructive">
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
                      <td className="px-3 py-2">
                        {result.offenders.length > 0 ? (
                          <span className="text-destructive font-medium">{result.offenders.length}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
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
                  <div key={idx} className="border rounded-lg p-3 bg-destructive/5">
                    <div className="font-mono text-xs font-medium text-destructive mb-2">
                      {result.route} @ {result.width}px
                    </div>
                    <ul className="space-y-1 text-xs">
                      {result.offenders.map((o, i) => (
                        <li key={i} className="font-mono">
                          <span className="text-muted-foreground">{i + 1})</span> {o.selector}
                          <br />
                          <span className="text-muted-foreground ml-4">
                            cw:{o.clientWidth} sw:{o.scrollWidth} right:{o.boundingRight}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}

          {/* Instructions */}
          <div className="text-xs text-muted-foreground border-t pt-3 mt-4">
            <p><strong>Note:</strong> /portal tests require being logged in. If SKIPPED, log in first then re-run.</p>
            <p className="mt-1">Results are saved to localStorage for persistence.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DevOverflowAudit;
