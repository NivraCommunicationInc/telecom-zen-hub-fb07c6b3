import { useState, useEffect } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Ban, CheckCircle2, Loader2, Save, Edit, Plus, ShoppingCart, Tv } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// DEV ONLY - This route is only registered in development mode in App.tsx

/**
 * Simulated BlockedActionWrapper for QA testing
 * Mimics the real component behavior without requiring database state
 */
const QABlockedWrapper = ({
  children,
  isBlocked,
  action = "order",
  showInlineNotice = false,
}: {
  children: React.ReactNode;
  isBlocked: boolean;
  action?: "order" | "change" | "request" | "submit";
  showInlineNotice?: boolean;
}) => {
  if (!isBlocked) {
    return <>{children}</>;
  }

  const messages: Record<string, string> = {
    order: "Compte bloqué — les nouvelles commandes sont désactivées. / Account blocked — new orders are disabled.",
    change: "Compte bloqué — les modifications de service sont désactivées. / Account blocked — service changes are disabled.",
    request: "Compte bloqué — les demandes sont désactivées. / Account blocked — requests are disabled.",
    submit: "Compte bloqué — contactez le support. / Account blocked — contact support.",
  };

  if (showInlineNotice) {
    return (
      <div className="space-y-2">
        <div className="pointer-events-none opacity-50">{children}</div>
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          <Ban className="h-4 w-4 shrink-0" />
          <span>{messages[action]}</span>
        </div>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="pointer-events-none opacity-50">
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="flex items-center gap-2">
          <Ban className="h-4 w-4 text-destructive" />
          <span>{messages[action]}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

const AdminQABlockStatus = () => {
  const { mode } = useParams<{ mode?: string }>();
  const [searchParams] = useSearchParams();
  const urlState = searchParams.get("state");
  
  // Priority: path param > query param > default (active)
  const initialBlocked = mode === "blocked" || urlState === "blocked";
  
  const [isBlocked, setIsBlocked] = useState(initialBlocked);

  // Sync with URL state when it changes
  useEffect(() => {
    if (mode === "blocked" || urlState === "blocked") {
      setIsBlocked(true);
    } else if (mode === "active" || urlState === "active") {
      setIsBlocked(false);
    }
  }, [mode, urlState]);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-500/20 text-amber-600 border-amber-500/30">
              DEV ONLY
            </Badge>
            <h1 className="text-3xl font-bold">QA: Block Status Test</h1>
          </div>
          <p className="text-muted-foreground">
            Visual verification of BlockedActionWrapper behavior. Toggle blocked state to see buttons disabled/enabled.
          </p>
        </div>

        {/* Toggle Control */}
        <Card className="border-2 border-dashed">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-lg font-semibold">Account Status Simulation</Label>
                <p className="text-sm text-muted-foreground">
                  Toggle to simulate profiles.account_status = 'blocked' | 'active'
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Badge 
                  className={cn(
                    "px-4 py-2 text-base",
                    isBlocked 
                      ? "bg-destructive text-destructive-foreground" 
                      : "bg-emerald-500 text-white"
                  )}
                >
                  {isBlocked ? (
                    <>
                      <Ban className="h-4 w-4 mr-2" />
                      BLOCKED
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      ACTIVE
                    </>
                  )}
                </Badge>
                <Switch 
                  checked={isBlocked} 
                  onCheckedChange={setIsBlocked}
                  className="scale-125"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Test Cases */}
        <div className="grid gap-6">
          {/* ClientCancellations Submit Button */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="secondary">ClientCancellations.tsx</Badge>
                Submit Cancellation Request
              </CardTitle>
              <CardDescription>
                action="request" with showInlineNotice when blocked
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QABlockedWrapper action="request" isBlocked={isBlocked} showInlineNotice={isBlocked}>
                <Button disabled={isBlocked}>
                  <Loader2 className={cn("w-4 h-4 mr-2", isBlocked ? "hidden" : "hidden")} />
                  Soumettre la demande
                </Button>
              </QABlockedWrapper>
            </CardContent>
          </Card>

          {/* ClientChannels Modify Button */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="secondary">ClientChannels.tsx</Badge>
                Modify Channels Button
              </CardTitle>
              <CardDescription>
                action="change" with tooltip when blocked
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QABlockedWrapper action="change" isBlocked={isBlocked}>
                <Button variant="outline" size="sm" disabled={isBlocked}>
                  <Edit className="h-4 w-4 mr-1" />
                  Modifier
                </Button>
              </QABlockedWrapper>
            </CardContent>
          </Card>

          {/* ClientChannels Save Button */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="secondary">ClientChannels.tsx</Badge>
                Save Channels Button
              </CardTitle>
              <CardDescription>
                action="change" with tooltip when blocked
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QABlockedWrapper action="change" isBlocked={isBlocked}>
                <Button size="sm" disabled={isBlocked}>
                  <Save className="h-4 w-4 mr-1" />
                  Sauvegarder
                </Button>
              </QABlockedWrapper>
            </CardContent>
          </Card>

          {/* ClientNewOrder Submit Button */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="secondary">ClientNewOrder.tsx</Badge>
                Place Order Button
              </CardTitle>
              <CardDescription>
                action="order" with showInlineNotice when blocked
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QABlockedWrapper action="order" isBlocked={isBlocked} showInlineNotice={isBlocked}>
                <Button variant="default" size="lg" disabled={isBlocked}>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Confirmer la commande
                </Button>
              </QABlockedWrapper>
            </CardContent>
          </Card>

          {/* ClientTVOrder Submit Button */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="secondary">ClientTVOrder.tsx</Badge>
                TV Order Button
              </CardTitle>
              <CardDescription>
                action="order" with showInlineNotice when blocked
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QABlockedWrapper action="order" isBlocked={isBlocked} showInlineNotice={isBlocked}>
                <Button variant="default" size="lg" disabled={isBlocked}>
                  <Tv className="w-4 h-4 mr-2" />
                  Commander TV
                </Button>
              </QABlockedWrapper>
            </CardContent>
          </Card>
        </div>

        {/* Legend */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              <strong>Legend:</strong> When blocked, buttons show <code className="bg-background px-1 rounded">opacity-50</code> + <code className="bg-background px-1 rounded">pointer-events-none</code>. 
              Inline notices show a red banner below the button. Tooltips show on hover (visible in non-blocked state only due to pointer-events).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminQABlockStatus;
