import { useEffect, useMemo, useState } from 'react';
import { useDevOverflowDetector } from '@/hooks/useDevOverflowDetector';

/**
 * DEV-ONLY: Activates overflow detection + renders a small on-screen panel
 * (bottom-left) to prove overflow status without relying on console/CI.
 *
 * Place this component inside BrowserRouter to access location.
 */
export function DevOverflowDetector() {
  const { report } = useDevOverflowDetector();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    // DEV-ONLY: disable the default html/body overflow-x masking for real proof.
    document.documentElement.setAttribute('data-dev-overflow', 'true');

    return () => {
      document.documentElement.removeAttribute('data-dev-overflow');
    };
  }, []);

  const top5 = useMemo(() => {
    const sorted = [...(report.offenders ?? [])].sort((a, b) => {
      const aSeverity = Math.max(a.scrollWidth - a.clientWidth, a.boundingRight - report.viewportWidth);
      const bSeverity = Math.max(b.scrollWidth - b.clientWidth, b.boundingRight - report.viewportWidth);
      return bSeverity - aSeverity;
    });
    return sorted.slice(0, 5);
  }, [report.offenders, report.viewportWidth]);

  const status = report.offenders.length > 0 ? 'OVERFLOW' : 'OK';

  const fullText = useMemo(() => formatReport(report), [report]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Best-effort fallback
      const ta = document.createElement('textarea');
      ta.value = fullText;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  };

  if (!import.meta.env.DEV) return null;

  return (
    <div
      className="fixed bottom-3 left-3 z-50 w-[360px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-background/95 backdrop-blur p-3 shadow-lg"
      role="status"
      aria-live="polite"
      data-testid="dev-overflow-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold">DEV Overflow</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            <span className="break-words">{report.route}</span> · {report.viewportWidth}px
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={
              status === 'OK'
                ? 'text-[11px] font-semibold text-foreground'
                : 'text-[11px] font-semibold text-destructive'
            }
          >
            {status}
          </div>
          <button
            type="button"
            onClick={onCopy}
            className="rounded-md border border-border bg-secondary px-2 py-1 text-[11px] font-medium text-secondary-foreground"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {report.offenders.length > 0 ? (
        <div className="mt-2">
          <div className="text-[11px] text-muted-foreground">
            Showing top 5 of {report.offenders.length}
          </div>
          <ol className="mt-2 space-y-2">
            {top5.map((o, idx) => (
              <li key={`${o.selector}-${idx}`} className="border-t border-border pt-2">
                <div className="text-[11px] font-medium break-words">{o.selector}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  sw/cw: {o.scrollWidth}/{o.clientWidth} · right: {o.boundingRight}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="mt-2 text-[11px] text-muted-foreground">No offenders detected.</div>
      )}
    </div>
  );
}

function formatReport(report: {
  route: string;
  viewportWidth: number;
  offenders: Array<{ selector: string; clientWidth: number; scrollWidth: number; boundingRight: number }>;
  checkedAt: number;
}) {
  const lines: string[] = [];
  lines.push(`[DEV] Overflow report`);
  lines.push(`Route: ${report.route}`);
  lines.push(`Viewport: ${report.viewportWidth}px`);
  lines.push(`CheckedAt: ${new Date(report.checkedAt).toISOString()}`);

  if (report.offenders.length === 0) {
    lines.push(`Status: ✅ OK (0 offenders)`);
    return lines.join('\n');
  }

  lines.push(`Status: 🔴 OVERFLOW (${report.offenders.length} offenders)`);
  lines.push('');
  report.offenders.forEach((o, i) => {
    lines.push(`${i + 1}) ${o.selector}`);
    lines.push(
      `   clientWidth: ${o.clientWidth}, scrollWidth: ${o.scrollWidth}, boundingRight: ${o.boundingRight}, viewport: ${report.viewportWidth}`
    );
  });

  return lines.join('\n');
}

export default DevOverflowDetector;
