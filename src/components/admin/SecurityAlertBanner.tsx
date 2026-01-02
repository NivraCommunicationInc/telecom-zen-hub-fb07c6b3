import { AlertTriangle, ShieldAlert, Calendar, FileText } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";

interface SecurityAlertBannerProps {
  alertLevel: string;
  flaggedAt?: string | null;
  flaggedOrderId?: string | null;
  securityStatus?: string;
  securityReason?: string | null;
}

const SecurityAlertBanner = ({
  alertLevel,
  flaggedAt,
  flaggedOrderId,
  securityStatus,
  securityReason,
}: SecurityAlertBannerProps) => {
  if (alertLevel === "none" || !alertLevel) return null;

  const isFraud = alertLevel === "fraud";
  const isSuspended = securityStatus === "suspended";

  return (
    <Alert variant="destructive" className="mb-4 border-2">
      <div className="flex items-start gap-3">
        {isFraud ? (
          <ShieldAlert className="h-5 w-5 mt-0.5" />
        ) : (
          <AlertTriangle className="h-5 w-5 mt-0.5" />
        )}
        <div className="flex-1">
          <AlertTitle className="text-lg font-bold uppercase tracking-wide">
            {isFraud ? "🚨 SECURITY ALERT: FRAUD REVIEW" : "⚠️ SECURITY ALERT: RISK REVIEW"}
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <div className="flex flex-wrap gap-4 text-sm">
              {isSuspended && (
                <span className="inline-flex items-center px-2 py-1 rounded bg-destructive/20 text-destructive font-semibold">
                  Status: SUSPENDED
                </span>
              )}
              {flaggedAt && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Flagged: {format(new Date(flaggedAt), "PPp")}
                </span>
              )}
              {flaggedOrderId && (
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Order: {flaggedOrderId.slice(0, 8)}...
                </span>
              )}
            </div>
            {securityReason && (
              <p className="text-sm opacity-90">Reason: {securityReason}</p>
            )}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
};

export default SecurityAlertBanner;
