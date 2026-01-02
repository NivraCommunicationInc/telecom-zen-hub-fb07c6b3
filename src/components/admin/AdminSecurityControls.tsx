import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Unlock, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AdminSecurityControlsProps {
  clientId: string;
  clientEmail?: string;
  securityStatus: string;
  securityAlertLevel: string;
  securityReason?: string | null;
  securityFlaggedAt?: string | null;
  securityFlaggedOrderId?: string | null;
  securityRequiresPinReset: boolean;
  onUpdate: () => void;
}

const AdminSecurityControls = ({
  clientId,
  clientEmail,
  securityStatus,
  securityAlertLevel,
  securityReason,
  securityFlaggedAt,
  securityFlaggedOrderId,
  securityRequiresPinReset,
  onUpdate,
}: AdminSecurityControlsProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [requirePinReset, setRequirePinReset] = useState(true);
  const [liftReason, setLiftReason] = useState("");

  const isSuspended = securityStatus === "suspended";
  const hasAlert = securityAlertLevel !== "none" && securityAlertLevel;

  const logSecurityAction = async (action: string, reason?: string) => {
    try {
      await supabase.from("security_action_logs").insert({
        client_id: clientId,
        client_email: clientEmail,
        action,
        action_by_id: user?.id,
        action_by_name: user?.email,
        action_by_role: "admin",
        reason,
        details: {
          previous_status: securityStatus,
          previous_alert_level: securityAlertLevel,
        },
      });
    } catch (err) {
      console.error("Error logging security action:", err);
    }
  };

  const handleLiftSuspension = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          security_status: "active",
          security_alert_level: "none",
          security_reason: null,
          security_flagged_at: null,
          security_flagged_order_id: null,
          security_requires_pin_reset: requirePinReset,
        })
        .eq("user_id", clientId);

      if (error) throw error;

      await logSecurityAction("suspension_lifted", liftReason || "Admin lifted suspension");
      
      toast.success("Suspension lifted successfully");
      onUpdate();
    } catch (err) {
      console.error("Error lifting suspension:", err);
      toast.error("Failed to lift suspension");
    } finally {
      setLoading(false);
    }
  };

  const handleFlagClient = async (level: "risk" | "fraud") => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          security_status: "suspended",
          security_alert_level: level,
          security_reason: `Manually flagged as ${level} by admin`,
          security_flagged_at: new Date().toISOString(),
          security_requires_pin_reset: true,
        })
        .eq("user_id", clientId);

      if (error) throw error;

      await logSecurityAction(`flagged_${level}`, `Admin manually flagged client as ${level}`);
      
      toast.success(`Client flagged as ${level}`);
      onUpdate();
    } catch (err) {
      console.error("Error flagging client:", err);
      toast.error("Failed to flag client");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={isSuspended ? "border-destructive" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isSuspended ? (
            <ShieldAlert className="h-5 w-5 text-destructive" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          )}
          Security Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="font-medium">Status:</span>
          <Badge variant={isSuspended ? "destructive" : "default"}>
            {securityStatus?.toUpperCase() || "ACTIVE"}
          </Badge>
        </div>

        {hasAlert && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="font-medium">Alert Level:</span>
            <Badge variant="destructive">
              {securityAlertLevel?.toUpperCase()}
            </Badge>
          </div>
        )}

        {securityFlaggedAt && (
          <div className="text-sm text-muted-foreground">
            <p>Flagged: {format(new Date(securityFlaggedAt), "PPp")}</p>
            {securityReason && <p>Reason: {securityReason}</p>}
          </div>
        )}

        {securityRequiresPinReset && (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <RotateCcw className="h-4 w-4" />
            PIN reset required on next login
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2">
          {isSuspended ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" variant="default" disabled={loading}>
                  <Unlock className="h-4 w-4 mr-2" />
                  Lift Suspension
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Lift Client Suspension</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will restore the client's access to their portal.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="require-pin-reset"
                      checked={requirePinReset}
                      onCheckedChange={setRequirePinReset}
                    />
                    <Label htmlFor="require-pin-reset">
                      Require PIN reset on next login
                    </Label>
                  </div>
                  <div>
                    <Label htmlFor="lift-reason">Reason (optional)</Label>
                    <Textarea
                      id="lift-reason"
                      placeholder="Reason for lifting suspension..."
                      value={liftReason}
                      onChange={(e) => setLiftReason(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLiftSuspension} disabled={loading}>
                    Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1" disabled={loading}>
                    Flag Risk
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Flag as Risk?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will suspend the client's portal access and flag for risk review.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleFlagClient("risk")}>
                      Confirm
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="flex-1" disabled={loading}>
                    Flag Fraud
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Flag as Fraud?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will immediately suspend the client's portal access and flag for fraud investigation.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleFlagClient("fraud")}>
                      Confirm
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminSecurityControls;
